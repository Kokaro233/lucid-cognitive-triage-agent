import { NextResponse } from "next/server";
import { analyzeWithGemini } from "@/lib/gemini";
import { ensureBodyguard, findDemoResult, imageOnlyFallback, searchLocalPatterns } from "@/lib/fallback";
import { searchPatternsMongo } from "@/lib/mongodb";
import type { AnalysisResult, PatternRecord } from "@/lib/types";

const GENERIC_CHAIN_TERMS = new Set(["urgency", "fear", "due diligence needed", "pressure"]);

function patternScore(pattern: PatternRecord, chain: string[], scenario?: string) {
  const targetChain = chain.map((item) => item.toLowerCase());
  const patternChain = pattern.manipulation_chain.map((item) => item.toLowerCase());
  const strongOverlap = patternChain.filter(
    (item) => targetChain.includes(item) && !GENERIC_CHAIN_TERMS.has(item)
  ).length;
  const genericOverlap = patternChain.filter(
    (item) => targetChain.includes(item) && GENERIC_CHAIN_TERMS.has(item)
  ).length;
  const scenarioWords = (scenario ?? "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/)
    .filter((word) => word.length >= 4 || /[\u4e00-\u9fff]/.test(word));
  const scenarioOverlap = scenarioWords.filter((word) => pattern.scenario.toLowerCase().includes(word)).length;
  return strongOverlap * 10 + scenarioOverlap * 5 + genericOverlap + (pattern.severity ?? 0) / 100;
}

function rankPatterns(patterns: PatternRecord[], chain: string[], scenario?: string) {
  const seen = new Set<string>();
  return patterns
    .map((pattern) => ({ pattern, score: patternScore(pattern, chain, scenario) }))
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      if (seen.has(item.pattern.pattern_id)) return false;
      seen.add(item.pattern.pattern_id);
      return true;
    })
    .map((item) => item.pattern)
    .slice(0, 3);
}

function applyOfficialHotlineNearMatchGuard(result: AnalysisResult, text?: string, outputLanguage?: "en" | "zh") {
  const combined = [
    text,
    result.scenario,
    result.summary,
    result.evidence_summary,
    ...result.manipulation_chain,
    ...result.evidence.map((item) => `${item.text} ${item.type} ${item.reason}`)
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const hasAntiFraudLabel = /反诈中心|anti[-\s]?fraud|fraud prevention|police|公安|警方/.test(combined);
  const hasSuspiciousNumber = /\+?\s*86\s*21\s*96110|8602196110|021\s*96110|96110/.test(combined);
  const hasCallerIdRisk = /号码识别|caller id|third[-\s]?party|spoof|near[-\s]?match|missing|少一个?0|错一位|错开|digit/.test(combined);
  const hasRepeatedCalls = /repeated|multiple calls|多次|通话记录|响铃|call history|来电/.test(combined);

  if (!hasAntiFraudLabel || !hasSuspiciousNumber || (!hasCallerIdRisk && !hasRepeatedCalls)) {
    return result;
  }

  const isZh = outputLanguage === "zh";
  const riskScore = Math.max(result.overall_risk_score, 82);
  const chain = Array.from(
    new Set([...result.manipulation_chain, "Authority Impersonation", "Number Spoofing", "Due Diligence Needed"])
  );

  return {
    ...result,
    risk_level: result.risk_level === "Red" ? "Red" : "Orange",
    overall_risk_score: riskScore,
    scenario: isZh ? "官方号码近似冒充来电" : "Official hotline near-match caller spoofing",
    summary: isZh
      ? "截图显示官方反诈/警方标签、96110 相关号码和重复来电迹象。来电识别标签不是官方验证，号码近似或格式异常应先按高风险处理，并通过独立渠道核实。"
      : "The screenshot combines an official anti-fraud/police-style caller label, a 96110-related number, and repeated-call or caller-ID risk signals. Caller ID is not official verification, so LUCID treats this as possible official-number spoofing until independently verified.",
    manipulation_chain: chain,
    evidence: [
      {
        text: isZh ? "上海市反诈中心 / +86 21 96110" : "Shanghai anti-fraud label / +86 21 96110",
        type: "Number Spoofing",
        risk_score: 84,
        reason: isZh
          ? "官方标签和 96110 相关号码不能仅凭第三方来电识别确认；少位、错位、区号/0 前缀差异都可能被用于近似号码冒充。"
          : "An official-sounding label and a 96110-related number should not be trusted from caller ID alone; missing digits, shifted digits, area-code formatting, or trunk-prefix differences can be used for near-match impersonation."
      },
      ...result.evidence.filter((item) => item.type !== "Official Number Match")
    ],
    tool_timeline: Array.from(
      new Set([
        ...result.tool_timeline,
        isZh
          ? "Official Hotline Near-Match Guard raised the risk because caller ID and number formatting require independent verification."
          : "Official Hotline Near-Match Guard raised the risk because caller ID and number formatting require independent verification."
      ])
    ),
    tool_calls: [
      ...result.tool_calls.filter((item) => item.tool !== "Official Hotline Near-Match Guard"),
      {
        tool: "Official Hotline Near-Match Guard",
        result: isZh
          ? "将 96110 近似号码/第三方来电识别风险提升为 Orange。"
          : "Raised 96110 near-match or third-party caller-ID risk to Orange."
      }
    ],
    agent_actions: isZh
      ? [
          "不要从通话记录直接回拨。",
          "通过官方网站、官方 App 或可信公开渠道独立核对号码。",
          "不要在电话中提供验证码、转账、身份证件、远程控制或账户恢复信息。"
        ]
      : [
          "Do not call back from the call log.",
          "Independently verify the number through an official website, official app, or trusted public channel.",
          "Do not provide OTPs, payments, identity documents, remote access, or account-recovery information by phone."
        ],
    verification_checklist: isZh
      ? [
          "不要相信来电显示标签本身。",
          "手动查找官方号码，不使用对方提供的回拨入口。",
          "如果对方要求保密、转账、验证码、远程协助或身份材料，立即升级为高风险。"
        ]
      : [
          "Do not trust the caller-ID label by itself.",
          "Look up the official number manually instead of using the callback entry.",
          "Escalate to high risk if the caller asks for secrecy, payment, OTPs, remote access, or identity documents."
        ],
    safe_reply: isZh
      ? "我不会通过这个来电继续处理。我会自己查找官方号码并独立核实，不会在电话里提供验证码、转账或身份信息。"
      : "I will not continue through this call. I will look up the official number independently and will not provide OTPs, payment, or identity information by phone.",
    evidence_summary: isZh
      ? "疑似官方号码近似冒充：截图包含反诈/警方式标签、96110 相关号码和重复来电。来电识别不是官方验证，应独立核实。"
      : "Possible official-number near-match impersonation: the screenshot shows an anti-fraud/police-style label, a 96110-related number, and repeated-call/caller-ID risk. Caller ID is not official verification.",
    bodyguard_mode: true
  } satisfies AnalysisResult;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    text?: string;
    imageBase64?: string;
    imagesBase64?: string[];
    mimeType?: string;
    mimeTypes?: string[];
    demoCaseId?: string;
    outputLanguage?: "en" | "zh";
  };

  let result = findDemoResult(body.demoCaseId, body.text);

  try {
    if (process.env.GOOGLE_API_KEY && !body.demoCaseId) {
      result = await analyzeWithGemini({
        text: body.text,
        imageBase64: body.imageBase64,
        imagesBase64: body.imagesBase64,
        mimeType: body.mimeType,
        mimeTypes: body.mimeTypes,
        outputLanguage: body.outputLanguage
      });
    }
  } catch (error) {
    console.error("Gemini analyze fallback:", error);
  }

  result = applyOfficialHotlineNearMatchGuard(result, body.text, body.outputLanguage);

  try {
    const mongoMatches = process.env.MONGODB_URI
      ? await searchPatternsMongo(result.manipulation_chain, result.scenario)
      : [];
    const localMatches = searchLocalPatterns(result.manipulation_chain, result.scenario);
    const matches = rankPatterns([...mongoMatches, ...localMatches], result.manipulation_chain, result.scenario);

    if (matches.length > 0 && (result.risk_level === "Orange" || result.risk_level === "Red")) {
      result = {
        ...result,
        tool_calls: [
          ...result.tool_calls.filter((item) => item.tool !== "MongoDB Pattern Memory"),
          {
            tool: "MongoDB Pattern Memory",
            result: `Matched ${matches[0].pattern_id}: ${matches[0].scenario}.`
          }
        ],
        tool_timeline: [
          ...result.tool_timeline.filter((item) => !item.includes("MongoDB Pattern Memory")),
          `MongoDB Pattern Memory returned ${matches.length} similar anonymized pattern${
            matches.length === 1 ? "" : "s"
          }.`
        ]
      };
    }
  } catch (error) {
    console.error("Pattern memory fallback:", error);
  }

  const hasSubmittedImage = Boolean(body.imageBase64 || body.imagesBase64?.length);
  return NextResponse.json(
    ensureBodyguard(imageOnlyFallback(result, hasSubmittedImage && !body.demoCaseId, body.outputLanguage), body.text)
  );
}

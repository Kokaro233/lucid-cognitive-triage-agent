"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { demoCases } from "@/data/demoCases";
import { postJson, riskTone } from "@/lib/api";
import type { AnalysisResult, DemoCase, PatternRecord } from "@/lib/types";

type AnalyzeResponse = AnalysisResult;
type SavedReview = {
  id: string;
  savedAt: string;
  scenario: string;
  riskLevel: string;
  score: number;
  summary: string;
  safeReply: string;
  evidenceSummary: string;
  evidence: string[];
  imageCount: number;
  inputPreview: string;
};

const SAVED_REVIEWS_KEY = "lucid-saved-reviews";

function resizeImageForAnalysis(file: File): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not prepare image for analysis."));
          return;
        }
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.86), mimeType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function imageUrlToDataUrl(url: string): Promise<{ dataUrl: string; mimeType: string }> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ dataUrl: String(reader.result), mimeType: blob.type || "image/png" });
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type IntelligencePack = {
  trends: { title: string; body: string; chips: string[] };
  scoring: { label: string; value: number; reason: string }[];
  pressure: { label: string; value: number }[];
  domain: { title: string; body: string; domains: string[] };
  replay: { title: string; body: string }[];
  vulnerability: { title: string; body: string; chips: string[] };
  confidence: { level: string; body: string };
  psychology: { title: string; body: string }[];
  adaptiveActions: string[];
};

function clampMeter(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function extractDomains(text: string) {
  const matches = text.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s"']*)?/gi) ?? [];
  return Array.from(
    new Set(
      matches.map((item) =>
        item
          .replace(/^https?:\/\//i, "")
          .replace(/[),.。]+$/g, "")
          .split("/")[0]
          .toLowerCase()
      )
    )
  ).slice(0, 4);
}

function hasAny(haystack: string, words: string[]) {
  return words.some((word) => haystack.includes(word.toLowerCase()));
}

function deriveIntelligence(result: AnalysisResult, inputText: string, urlInput: string, language: "en" | "zh"): IntelligencePack {
  const text = [
    inputText,
    urlInput,
    result.scenario,
    result.summary,
    result.evidence_summary,
    result.safe_reply,
    ...result.manipulation_chain,
    ...result.agent_actions,
    ...result.verification_checklist,
    ...result.evidence.flatMap((item) => [item.text, item.type, item.reason])
  ]
    .join(" ")
    .toLowerCase();
  const domains = extractDomains([inputText, urlInput, result.evidence.map((item) => item.text).join(" ")].join(" "));
  const isZh = language === "zh";
  const riskBase = result.overall_risk_score;
  const authority = clampMeter(
    (hasAny(text, ["authority", "impersonation", "police", "embassy", "inspector", "公安", "大使馆", "警官"]) ? 55 : 0) +
      result.evidence.filter((item) => /authority|impersonation|brand/i.test(item.type)).length * 18
  );
  const urgency = clampMeter(
    (hasAny(text, ["urgent", "immediate", "now", "minutes", "hours", "deadline", "倒计时", "马上", "立即", "分钟", "小时"]) ? 50 : 0) +
      result.evidence.filter((item) => /urgency|time/i.test(item.type)).length * 20
  );
  const fear = clampMeter(
    (hasAny(text, ["fear", "arrest", "detain", "freeze", "blocked", "suspend", "拘留", "冻结", "封禁", "洗钱"]) ? 55 : 0) +
      result.evidence.filter((item) => /fear|threat|account/i.test(item.type)).length * 18
  );
  const isolation = clampMeter(
    (hasAny(text, ["do not tell", "secret", "do not search", "stay on the line", "不要告诉", "保密", "不要搜索", "不要挂电话"]) ? 60 : 0) +
      result.evidence.filter((item) => /isolation|secrecy/i.test(item.type)).length * 20
  );
  const greed = clampMeter(
    (hasAny(text, ["refund", "compensation", "bonus", "growth", "return", "profit", "赔偿", "退款", "收益", "投资", "财富"]) ? 45 : 0) +
      result.evidence.filter((item) => /financial incentive|greed|investment/i.test(item.type)).length * 18
  );
  const sensitiveDemand = hasAny(text, [
    "otp",
    "verification code",
    "bank card",
    "face",
    "seed phrase",
    "private key",
    "transfer",
    "deposit",
    "验证码",
    "银行卡",
    "人脸",
    "助记词",
    "私钥",
    "转账",
    "保证金"
  ]);
  const suspiciousDomain = domains.some((domain) =>
    /goo\.su|bit\.ly|tinyurl|whtasapp|whatsapp-|airline-refund|refund-check|verify|security|login|account|安全|验证/i.test(domain)
  );
  const impersonation = clampMeter(Math.max(authority, hasAny(text, ["whatsapp", "airline", "support", "security center", "客服", "安全中心"]) ? 50 : 0));
  const domainScore = clampMeter(domains.length ? (suspiciousDomain ? 78 : 36) : 0);
  const chainScore = clampMeter(result.manipulation_chain.length * 16 + (sensitiveDemand ? 20 : 0));
  const confidenceValue = clampMeter(
    Math.max(
      25,
      result.evidence.length * 18 +
        result.manipulation_chain.length * 10 +
        (domains.length ? 10 : 0) +
        (result.source === "gemini" ? 12 : 6)
    )
  );
  const confidenceLevel = confidenceValue >= 76 ? (isZh ? "高" : "High") : confidenceValue >= 50 ? (isZh ? "中" : "Medium") : isZh ? "低" : "Low";
  const accountPhishing = hasAny(text, ["whatsapp", "telegram", "instagram", "account", "security center", "账号", "账户", "安全中心"]);
  const authorityScam = authority >= 55;
  const refundScam = hasAny(text, ["refund", "compensation", "airline", "赔偿", "退款", "航空"]);
  const investmentScam = hasAny(text, ["investment", "crypto", "wallet", "token", "growth", "投资", "交易所", "钱包", "收益"]);

  return {
    trends: {
      title: isZh ? "模拟情报趋势" : "Simulated threat trend",
      body: isZh
        ? authorityScam
          ? "这类话术接近东南亚常见的跨境执法/大使馆冒充骗局：先制造法律恐惧，再隔离受害者，最后提出保证金或账户验证。"
          : accountPhishing
            ? "这类账号安全钓鱼常借用 WhatsApp、Telegram 或银行安全中心名义，用封禁/恢复账号推动用户点击非官方链接。"
            : refundScam
              ? "退款/赔偿型骗局常从电话或短信开始，再把用户引导到仿冒网站收集银行卡、验证码或人脸验证。"
              : investmentScam
                ? "投资页面如果只展示行情不一定危险；一旦结合群聊催促、充值、解冻或高收益承诺，就会进入高风险路径。"
                : "当前内容没有形成典型高风险诈骗链条，更像普通沟通或证据不足的低风险场景。"
        : authorityScam
          ? "This resembles regional cross-border police or embassy impersonation scams: legal fear first, isolation next, then a deposit or verification demand."
          : accountPhishing
            ? "Account-security phishing often borrows WhatsApp, Telegram, or bank-security language to push users toward non-official recovery links."
            : refundScam
              ? "Refund or compensation scams often start with a call or SMS, then redirect users to fake sites collecting card, OTP, or face-verification data."
              : investmentScam
                ? "An investment page alone is not enough; risk rises when a person adds urgency, deposits, withdrawal unlocks, or high-return pressure."
                : "This does not form a strong scam chain; it looks closer to normal communication or an incomplete low-risk signal.",
      chips: isZh
        ? [authorityScam ? "权威冒充" : "证据门槛", refundScam ? "退款重定向" : "低误报校准", accountPhishing ? "账号接管" : "用户可控动作"]
        : [authorityScam ? "Authority impersonation" : "Evidence threshold", refundScam ? "Refund redirect" : "False-positive control", accountPhishing ? "Account takeover" : "User-controlled action"]
    },
    scoring: [
      {
        label: isZh ? "紧迫感贡献" : "Urgency contribution",
        value: urgency,
        reason: isZh ? "倒计时、马上处理或短时间窗口会压缩判断时间。" : "Deadlines, immediate action, or short windows compress decision time."
      },
      {
        label: isZh ? "冒充身份贡献" : "Impersonation contribution",
        value: impersonation,
        reason: isZh ? "品牌、客服、警官或官方身份会降低用户质疑意愿。" : "Brand, support, police, or official identities reduce the urge to question."
      },
      {
        label: isZh ? "域名/跳转贡献" : "Domain / redirect contribution",
        value: domainScore,
        reason: domains.length
          ? isZh
            ? "发现可分析域名；短链接、拼写变体或非官方域名会提高风险。"
            : "A domain was found; short links, typos, or non-official domains increase risk."
          : isZh
            ? "未发现可分析域名，因此不因链接因素加分。"
            : "No analyzable domain was found, so link risk did not raise the score."
      },
      {
        label: isZh ? "操控链组合贡献" : "Manipulation-chain contribution",
        value: chainScore,
        reason: isZh ? "多个操控信号叠加时，比单个关键词更可靠。" : "Combined manipulation signals are more reliable than a single keyword."
      }
    ],
    pressure: [
      { label: isZh ? "恐惧" : "Fear", value: fear },
      { label: isZh ? "紧迫感" : "Urgency", value: urgency },
      { label: isZh ? "权威" : "Authority", value: authority },
      { label: isZh ? "奖励/贪婪" : "Reward", value: greed },
      { label: isZh ? "隔离" : "Isolation", value: isolation }
    ],
    domain: {
      title: isZh ? "域名情报" : "Domain intelligence",
      body: domains.length
        ? isZh
          ? `${domains[0]} ${suspiciousDomain ? "带有短链、仿冒或账号验证特征，应只从官方 App/官网自行进入。" : "未显示明显拼写仿冒，但仍应独立核实来源。"}`
          : `${domains[0]} ${suspiciousDomain ? "shows short-link, imitation, or account-verification cues. Use only the official app or website." : "does not show an obvious typo imitation, but the source should still be verified independently."}`
        : isZh
          ? "未发现可分析域名。LUCID 不会凭空判断链接风险。"
          : "No analyzable domain was found. LUCID does not invent link risk.",
      domains
    },
    replay: [
      {
        title: isZh ? "1. 情绪触发" : "1. Emotional trigger",
        body: fear > 45 ? (isZh ? "先制造害怕、损失或法律后果。" : "The message first creates fear, loss, or legal consequences.") : isZh ? "没有明显恐惧触发。" : "No strong fear trigger is visible."
      },
      {
        title: isZh ? "2. 紧迫升级" : "2. Urgency escalation",
        body: urgency > 45 ? (isZh ? "用时间限制压缩思考空间。" : "Time pressure narrows the user's thinking window.") : isZh ? "紧迫感较低。" : "Urgency is low."
      },
      {
        title: isZh ? "3. 信任劫持" : "3. Trust hijacking",
        body: impersonation > 45 ? (isZh ? "借用官方、品牌或熟人关系让用户先相信。" : "Official, brand, or relationship cues are used to borrow trust.") : isZh ? "没有强冒充身份。" : "No strong impersonation cue is present."
      },
      {
        title: isZh ? "4. 重定向尝试" : "4. Redirect attempt",
        body: domains.length ? (isZh ? "用户被推向外部链接或可疑页面。" : "The user is pushed toward an external link or suspicious page.") : isZh ? "没有明显跳转路径。" : "No clear redirect path is visible."
      },
      {
        title: isZh ? "5. 凭证或资金收割" : "5. Credential or money harvesting",
        body: sensitiveDemand ? (isZh ? "最终目标指向付款、验证码、银行卡、人脸或账号恢复信息。" : "The end goal points toward payment, OTP, card, face, or recovery data.") : isZh ? "没有看到最终付款或敏感信息索取。" : "No final payment or sensitive-data request is visible."
      }
    ],
    vulnerability: {
      title: isZh ? "为什么它可能骗到人" : "Why this can fool people",
      body:
        result.risk_level === "Green"
          ? isZh
            ? "这里没有明显骗局链条；LUCID 的重点是避免把普通沟通误判成危险。"
            : "No clear scam chain is present; LUCID is intentionally avoiding a false alarm."
          : isZh
            ? "人在害怕、赶时间或面对权威时，会更容易跳过核实步骤。LUCID 的作用是把这段压力拆开，让你重新拿回节奏。"
            : "People under fear, time pressure, or authority cues are more likely to skip verification. LUCID breaks that pressure apart so the user can regain control.",
      chips: isZh
        ? ["赶时间的人", "独自在处理的人", authorityScam ? "害怕官方后果的人" : "不熟悉平台流程的人"]
        : ["People in a hurry", "People handling it alone", authorityScam ? "People afraid of official consequences" : "People unfamiliar with the platform flow"]
    },
    confidence: {
      level: confidenceLevel,
      body:
        confidenceValue >= 76
          ? isZh
            ? "信心较高：多个证据信号互相支持，而不是只依赖单个关键词。"
            : "Confidence is high because multiple evidence signals support each other, not because of one keyword."
          : confidenceValue >= 50
            ? isZh
              ? "信心中等：有可疑信号，但仍需要更多上下文确认。"
              : "Confidence is medium: suspicious signals exist, but more context would improve the judgment."
            : isZh
              ? "信心较低：目前证据不足，LUCID 选择保守解释。"
              : "Confidence is low: evidence is incomplete, so LUCID keeps the interpretation conservative."
    },
    psychology: [
      {
        title: isZh ? "恐慌诱导" : "Panic induction",
        body: fear > 45 ? (isZh ? "用后果威胁让人先反应、后思考。" : "Threatened consequences make people react before thinking.") : isZh ? "没有强恐慌诱导。" : "No strong panic induction is visible."
      },
      {
        title: isZh ? "权威利用" : "Authority exploitation",
        body: authority > 45 ? (isZh ? "冒充权威会让人觉得必须服从。" : "Impersonated authority can make compliance feel mandatory.") : isZh ? "权威利用不明显。" : "Authority exploitation is not prominent."
      },
      {
        title: isZh ? "情绪打断" : "Emotional interruption",
        body: isolation > 45 || urgency > 45 ? (isZh ? "通过催促或隔离打断用户向外求助。" : "Urgency or isolation interrupts the user's ability to seek help.") : isZh ? "情绪打断较弱。" : "Emotional interruption is weak."
      }
    ],
    adaptiveActions:
      result.risk_level === "Green"
        ? isZh
          ? ["可以正常处理，但继续保护验证码、银行卡和身份信息。", "如果对方突然改成催付款或发链接，再重新复核。"]
          : ["You can continue normally, while protecting OTPs, cards, and identity information.", "If the other party suddenly pushes payment or links, review it again."]
        : authorityScam
          ? isZh
            ? ["立刻停止对话，不转账。", "不要使用对方给的号码或链接。", "从官方公开渠道重新查找机构联系方式。"]
            : ["Stop the conversation and do not transfer money.", "Do not use numbers or links provided by the sender.", "Find the institution through official public channels."]
          : accountPhishing
            ? isZh
              ? ["不要点消息中的链接。", "从官方 App 自行打开账号安全页面。", "不要输入验证码、密码或恢复信息。"]
              : ["Do not open links in the message.", "Open account security from the official app yourself.", "Do not enter OTPs, passwords, or recovery details."]
            : refundScam
              ? isZh
                ? ["不要填写银行卡、人脸或验证码。", "通过航空公司官方 App 或官网查订单。", "保存通话和网页截图。"]
                : ["Do not enter card, face, or OTP details.", "Check the booking through the airline's official app or website.", "Save the call and website screenshots."]
              : isZh
                ? ["先暂停，不要被倒计时推着操作。", "独立核实平台和域名。", "找可信任的人一起看。"]
                : ["Pause and do not let the countdown drive action.", "Verify the platform and domain independently.", "Ask a trusted person to review it with you."]
  };
}

function deriveCareGuidance(result: AnalysisResult, language: "en" | "zh") {
  const isZh = language === "zh";
  const highRisk = result.risk_level === "Red" || result.risk_level === "Orange";
  const mediumRisk = result.risk_level === "Yellow";

  if (highRisk) {
    return {
      title: isZh ? "先把决定权拿回来" : "Take the decision back first",
      body: isZh
        ? "你现在不需要证明自己、不需要马上回复，也不需要按对方的节奏行动。真正可信的机构不会要求你在恐惧中转账、给验证码，或不告诉家人。"
        : "You do not need to prove yourself, reply immediately, or move at the sender's pace. A legitimate organization will not make you transfer money, share codes, or stay isolated while afraid.",
      steps: isZh
        ? ["停止和对方继续争论。", "截图保存证据。", "把这份报告发给一个你信任的人一起看。"]
        : ["Stop arguing with the sender.", "Save screenshots as evidence.", "Share this report with someone you trust."],
      trustedMessage: isZh
        ? "我收到一段让我很紧张的信息，LUCID 认为这里有压力操控。你能帮我一起看一下吗？我先不转账、不点链接。"
        : "I received a message that made me anxious. LUCID found pressure tactics. Can you look at this with me? I will not pay or open links for now."
    };
  }

  if (mediumRisk) {
    return {
      title: isZh ? "先核实，再决定" : "Verify first, decide later",
      body: isZh
        ? "这里有一些需要放慢的信号，但还不等于已经确认被骗。最稳的做法是不要被倒计时、收益承诺或陌生页面带着走，先从独立渠道核实。"
        : "There are signals worth slowing down for, but this does not automatically mean it is confirmed fraud. The safest move is to avoid being driven by countdowns, profit claims, or unfamiliar pages and verify independently.",
      steps: isZh
        ? ["不要因为倒计时或收益宣传马上操作。", "从官方渠道或可信来源核实。", "如果有人开始催你付款或给验证码，再重新复核。"]
        : ["Do not act because of a countdown or profit claim.", "Verify through official or trusted sources.", "Review again if someone starts pushing payment or codes."],
      trustedMessage: isZh
        ? "这个页面/信息看起来有点可疑，但证据还不完整。你能帮我从官方渠道一起核实一下吗？"
        : "This page/message looks somewhat suspicious, but the evidence is incomplete. Can you help me verify it through official sources?"
    };
  }

  return {
    title: isZh ? "目前可以先放松一点" : "You can relax a little for now",
    body: isZh
      ? "LUCID 没有看到明确的诈骗操控链条。你仍然可以保持基本隐私习惯：不要随便给验证码、银行卡、身份证件或助记词。"
      : "LUCID did not find a clear scam pressure chain. Keep normal privacy habits: do not casually share OTPs, bank details, identity documents, seed phrases, or private keys.",
    steps: isZh
      ? ["可以正常回复。", "如果话题转向钱、验证码或保密，再停下来。", "不确定时再回来复核。"]
      : ["It is okay to reply normally.", "Pause if the conversation shifts to money, codes, or secrecy.", "Come back for another review if unsure."],
    trustedMessage: isZh
      ? "LUCID 暂时没有看到明显诈骗压力，但我会继续保持基本隐私警惕。"
      : "LUCID did not find obvious scam pressure for now, but I will keep basic privacy caution."
  };
}

export function LucidConsole() {
  const { language } = useLanguage();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [inputMode, setInputMode] = useState<"chat" | "phone">("chat");
  const [selectedDemo, setSelectedDemo] = useState<DemoCase>(demoCases[0]);
  const [activeDemoId, setActiveDemoId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageMimes, setImageMimes] = useState<string[]>([]);
  const [result, setResult] = useState<AnalysisResult>(demoCases[2].result);
  const [patterns, setPatterns] = useState<PatternRecord[]>([]);
  const [status, setStatus] = useState("Ready");
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [memorySaveNote, setMemorySaveNote] = useState("");
  const [savedReviews, setSavedReviews] = useState<SavedReview[]>([]);
  const [calmChecks, setCalmChecks] = useState<boolean[]>([false, false, false]);
  const calmComplete = calmChecks.every(Boolean);
  const [careChecks, setCareChecks] = useState<boolean[]>([false, false, false]);
  const careComplete = careChecks.every(Boolean);
  const [modal, setModal] = useState<"reply" | "summary" | "checklist" | "memory" | "memoryConfirm" | "report" | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const copy =
    language === "zh"
      ? {
          reset: "30 秒重置",
          resetTitle: "你现在不需要立刻回复。",
          resetBody:
            "把这段对话先放下。不要转账，不要给验证码，也不要继续和对方争论。LUCID 只分析你主动提交到这里的内容。",
          resetSteps: ["1. 呼吸", "2. 不付款", "3. 去别处核实"],
          resetCompleteTitle: "做得很好。现在我们再看清楚。",
          resetCompleteBody: "你已经把节奏从对方手里拿回来了一点。接下来只需要把材料交给 LUCID 复核，不用马上回复任何人。",
          workspace: "实时 Agent 工作台",
          reviewTitle: "压力模式复核",
          bodyguardOn: "Bodyguard Mode 已开启",
          noEscalation: "未升级",
          showReceived: "把你收到的内容给 LUCID 看",
          privateContent: "支持聊天、网页、链接、短信、邮件和电话转写",
          upload: "上传截图或网页截图",
          selected: "截图已选择",
          uploadHelp: "PNG/JPG。可上传聊天、网站、短信等截图，最多 5 张。",
          selectedHelp: "最多保留 5 张，已为 OCR 优化。不会发送任何消息。",
          remove: "移除",
          clearSample: "退出样本，重新上传",
          paste: "粘贴文字或说明",
          urlLabel: "可疑网址（可选）",
          urlPlaceholder: "粘贴骗子发来的网址、短链接或网站地址",
          placeholder: "粘贴可疑聊天、短信、邮件、网页文字，或描述你看到的网站内容。",
          review: "复核压力模式",
          chatMode: "聊天截图",
          phoneMode: "电话模式",
          phonePlaceholder: "粘贴电话转写、通话笔记，或把对方说过的关键句写下来。例如：对方要求我不要挂电话、不要告诉家人、马上转账或提供验证码。",
          reading: "正在安全读取...",
          sample: "样本案例",
          demo: "可用于测试",
          evidence: "证据视图",
          triage: "分诊",
          pressureFound: "发现压力模式",
          safeActions: "安全下一步",
          checked: "LUCID 检查了什么",
          safeReply: "生成安全回复",
          evidenceSummary: "证据摘要",
          verifySteps: "核实步骤",
          save: "帮助保护别人：保存匿名模式",
          patternMemory: "模式记忆",
          noPatterns: "运行复核后会搜索相似匿名模式。",
          close: "关闭",
          safeResponse: "安全回复",
          safeResponseTitle: "在不透露更多信息的情况下回复。",
          summaryTitle: "可以发给可信任的人看的摘要。",
          verifyTitle: "只使用独立渠道核实。",
          memoryTitle: "MongoDB 模式记忆",
          memoryUpdated: "模式记忆已更新。",
          memoryBody: "LUCID 只保存匿名化的策略、短语、场景和风险等级，不保存完整私人对话。",
          memoryAskTitle: "你想帮助别人吗？",
          memoryAskBody:
            "分析时，LUCID/Gemini 会临时接收你主动提交的内容来完成判断。点击确认后，只会保存抽象后的匿名模式：风险类型、操控链条、少量证据短语和建议动作；不会保存原图、完整聊天、姓名、账号或联系方式。",
          memoryConfirm: "确认保存匿名模式",
          memoryCancel: "暂不保存",
          memorySaving: "正在保存匿名模式...",
          memoryThanksTitle: "谢谢，你帮助完善了防护记忆。",
          memoryThanksBody: "这次只保存匿名化模式，之后可帮助 LUCID 识别相似压力套路。",
          memoryVisible: "已加入本页模式记忆；如果 MongoDB 已配置，也可以在 Atlas 的 cases collection 里看到。",
          memoryFailed: "保存失败。请稍后再试，或检查 MongoDB 环境变量。",
          localMemory: "我的保存记录",
          localMemoryBody: "保存本次复核到这台设备，方便之后回看。不会上传完整聊天内容。",
          saveReview: "保存本次复核",
          reviewSaved: "已保存到本机记录。",
          viewSaved: "去记录页查看",
          report: "生成报告",
          reportTitle: "LUCID 安全复核报告",
          reportSubtitle: "可保存为图片，发给可信任的人一起确认。",
          reportScenario: "复核场景",
          reportRisk: "风险判断",
          reportChain: "操控链条",
          reportPrivacy: "隐私说明",
          reportPrivacyBody: "本报告用于用户自愿分享。LUCID 不会替你发送消息，也不会自动联系对方。",
          exportPng: "保存为 PNG",
          reportGenerated: "报告图片已生成。",
          safestTitle: "你现在最安全的 3 件事",
          safestActions: ["不要转账", "不要点链接", "找可信任的人确认"],
          sourceGemini: "实时 Google Cloud Gemini",
          sourceFallback: "稳定 fallback",
          mongoMemory: "MongoDB 模式记忆",
          step1: "1 输入材料",
          step2: "2 安全扫描",
          step3: "3 查看结果",
          callMode: "电话语音怎么办？",
          callModeBody: "先不要按对方指令操作。把电话内容简单写下来，或用系统转写后粘贴到这里；后续可以接语音转文字。",
          learning: "学习模式",
          learningBody: "用户可以保存匿名模式，进入 MongoDB 记忆库；它不会直接训练模型，也不会保存完整隐私聊天。",
          scanningTitle: "正在识别压力模式",
          scanningBody: "LUCID 正在读取截图、区分你和对方的消息，并检查恐惧、隔离、转账、威胁和验证码等信号。",
          selectedCount: "张截图已选择",
          pressurePattern: "压力模式",
          riskLabels: { Green: "绿色", Yellow: "黄色", Orange: "橙色", Red: "红色" },
          demos: [
            ["低风险提醒", "普通提醒，只有轻微紧迫感，没有权威、保密、金钱、验证码或身份压力。"],
            ["航空退款钓鱼", "电话冒充航空客服，引导进入虚假赔偿网站并提交银行卡和人脸验证。"],
            ["假大使馆 / 公安骗局", "高风险权威骗局，使用恐惧、保密、法律威胁和大额保证金。"],
            ["WhatsApp 安全中心钓鱼", "假装账号即将封禁，诱导用户点击非官方验证链接。"],
            ["加密投资宣传页", "模拟交易所用倒计时、高收益和未验证审计制造投资冲动。"]
          ]
        }
      : {
          reset: "30-second reset",
          resetTitle: "You do not have to reply right now.",
          resetBody:
            "Put the conversation down for a moment. Do not transfer money, do not share OTPs, and do not continue arguing with the sender. LUCID analyzes only what you submit here.",
          resetSteps: ["1. Breathe", "2. Do not pay", "3. Verify elsewhere"],
          resetCompleteTitle: "Good. You took the pace back.",
          resetCompleteBody: "You have created a little distance from the pressure. Now let LUCID review the material; you still do not need to reply to anyone.",
          workspace: "Live agent workspace",
          reviewTitle: "Pressure Pattern Review",
          bodyguardOn: "Bodyguard Mode on",
          noEscalation: "No escalation",
          showReceived: "Show LUCID what you received",
          privateContent: "Chats, websites, links, SMS, email, and call transcripts",
          upload: "Upload screenshot or web page",
          selected: "Screenshot selected",
          uploadHelp: "PNG/JPG. Chat, website, SMS, and email screenshots supported. Up to 5 images.",
          selectedHelp: "Up to 5 images kept and optimized for OCR. No message was sent.",
          remove: "Remove",
          clearSample: "Exit sample and upload my own",
          paste: "Paste text or context",
          urlLabel: "Suspicious URL (optional)",
          urlPlaceholder: "Paste a scam URL, short link, or suspicious website address",
          placeholder: "Paste suspicious chat, SMS, email, web page text, or describe the website you saw.",
          review: "Review pressure pattern",
          chatMode: "Chat screenshot",
          phoneMode: "Phone Call Mode",
          phonePlaceholder: "Paste a call transcript, call notes, or the key sentences the caller used. Example: they told me not to hang up, not to tell family, to transfer money now, or to provide an OTP.",
          reading: "Reading safely...",
          sample: "Sample cases",
          demo: "Ready to test",
          evidence: "Evidence view",
          triage: "Triage",
          pressureFound: "Pressure pattern found",
          safeActions: "Safe next actions",
          checked: "What LUCID checked",
          safeReply: "Generate Safe Reply",
          evidenceSummary: "Evidence Summary",
          verifySteps: "Verify Steps",
          save: "Help protect others: save anonymized pattern",
          patternMemory: "Pattern Memory",
          noPatterns: "Run triage to search similar anonymized patterns.",
          close: "Close",
          safeResponse: "Safe response",
          safeResponseTitle: "Reply without leaking more information.",
          summaryTitle: "Shareable note for a trusted person.",
          verifyTitle: "Use independent channels only.",
          memoryTitle: "MongoDB Pattern Memory",
          memoryUpdated: "Pattern memory updated.",
          memoryBody:
            "LUCID saves only anonymized tactics, phrases, scenario, and risk level. It does not store the full private conversation.",
          memoryAskTitle: "Do you want to help protect others?",
          memoryAskBody:
            "During analysis, LUCID/Gemini temporarily receives the content you choose to submit. If you confirm, LUCID saves only an anonymized pattern: risk type, manipulation chain, short evidence phrases, and recommended actions. It does not save the original image, full chat, names, accounts, or contact details.",
          memoryConfirm: "Confirm anonymous save",
          memoryCancel: "Not now",
          memorySaving: "Saving anonymized pattern...",
          memoryThanksTitle: "Thank you for improving protective memory.",
          memoryThanksBody: "Only the anonymized pattern was saved. It can help LUCID recognize similar pressure tactics later.",
          memoryVisible: "Added to Pattern Memory on this page. If MongoDB is configured, it is also visible in the Atlas cases collection.",
          memoryFailed: "Save failed. Please try again later or check the MongoDB environment variables.",
          localMemory: "My saved reviews",
          localMemoryBody: "Save this review on this device so you can revisit it later. Full private chat text is not uploaded.",
          saveReview: "Save this review",
          reviewSaved: "Saved to this device.",
          viewSaved: "Open saved reviews",
          report: "Generate report",
          reportTitle: "LUCID Safety Review Report",
          reportSubtitle: "Save as an image and share with someone you trust.",
          reportScenario: "Review scenario",
          reportRisk: "Risk assessment",
          reportChain: "Manipulation chain",
          reportPrivacy: "Privacy note",
          reportPrivacyBody: "This report is for voluntary sharing by the user. LUCID does not send messages or contact the sender for you.",
          exportPng: "Save as PNG",
          reportGenerated: "Report image generated.",
          safestTitle: "Your safest 3 actions now",
          safestActions: ["Do not transfer money", "Do not open links", "Ask a trusted person to verify"],
          sourceGemini: "Live Google Cloud Gemini",
          sourceFallback: "Stable fallback",
          mongoMemory: "MongoDB Pattern Memory",
          step1: "1 Input",
          step2: "2 Safety scan",
          step3: "3 Results",
          callMode: "Phone call?",
          callModeBody: "Do not follow instructions from the caller yet. Paste a short call transcript or notes here; voice-to-text can be added next.",
          learning: "Learning mode",
          learningBody: "Users can save anonymized patterns into MongoDB memory. It does not directly train the model or store full private chats.",
          scanningTitle: "Scanning pressure patterns",
          scanningBody: "LUCID is reading screenshots, separating your messages from the other party, and checking fear, isolation, payment, threats, and OTP signals.",
          selectedCount: "screenshots selected",
          pressurePattern: "Pressure Pattern",
          riskLabels: { Green: "Green", Yellow: "Yellow", Orange: "Orange", Red: "Red" },
          demos: demoCases.map((demo) => [demo.title, demo.description])
        };

  const bodyguard = result.bodyguard_mode;
  const tone = riskTone(result.risk_level);
  const showAnonymousContribution = result.risk_level !== "Green";
  const sourceLabel = useMemo(
    () => (result.source === "gemini" ? copy.sourceGemini : copy.sourceFallback),
    [copy.sourceFallback, copy.sourceGemini, result.source]
  );
  const intelligence = useMemo(
    () => deriveIntelligence(result, text, urlInput, language),
    [language, result, text, urlInput]
  );
  const careGuidance = useMemo(() => deriveCareGuidance(result, language), [language, result]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_REVIEWS_KEY);
      if (saved) {
        setSavedReviews(JSON.parse(saved) as SavedReview[]);
      }
    } catch {
      setSavedReviews([]);
    }
  }, []);

  useEffect(() => {
    const caseId = new URLSearchParams(window.location.search).get("case");
    const demo = demoCases.find((item) => item.id === caseId);
    if (demo && activeDemoId !== demo.id) {
      void loadDemo(demo);
    }
  }, [activeDemoId, language]);

  const statusLabel =
    language === "zh"
      ? status
          .replace("Ready", "就绪")
          .replace("Reading the message. You do not need to respond yet.", "正在读取消息。你现在不需要回复。")
          .replace("Analysis complete via Gemini", "分析由 Gemini 完成")
          .replace("Analysis complete via fallback", "分析由 fallback 完成")
          .replace("Screenshot removed", "截图已移除")
          .replace("Generating safe reply...", "正在生成安全回复...")
          .replace("Generating evidence summary...", "正在生成证据摘要...")
          .replace("Safe reply ready via", "安全回复已生成，来源")
          .replace("Evidence summary ready via", "证据摘要已生成，来源")
      : status;
  const zhLabelMap: Record<string, string> = {
    Urgency: "紧迫感",
    "Mild urgency": "轻微紧迫感",
    Authority: "权威施压",
    Fear: "恐惧",
    Isolation: "隔离",
    "Financial Demand": "转账要求",
    "Financial Request": "财务要求",
    "Identity Leverage": "身份压力",
    "Identity Leverage + Financial Request": "身份压力 + 财务要求",
    "Fear + Authority": "恐惧 + 权威施压",
    "Financial Demand + Urgency": "转账要求 + 紧迫感",
    "Brand Impersonation": "品牌冒充",
    "Account Threat": "账号威胁",
    "Suspicious Link": "可疑链接",
    "Sensitive Data Request": "敏感信息要求",
    "Call to Action": "行动诱导",
    "Financial Incentive": "财务诱饵",
    "Physical Threat": "人身威胁",
    "Emotional Manipulation": "情感操控",
    Guilt: "内疚操控",
    Deception: "欺骗",
    "Authority Impersonation": "权威冒充",
    "Financial or Sensitive Data Demand": "财务或敏感信息要求",
    "Sensitive Data or Payment Demand": "敏感信息或付款要求",
    "Authority or Support Impersonation": "权威或客服冒充",
    "Investment Hype": "投资宣传诱导",
    "Due Diligence Needed": "需要独立核实"
  };

  function displayLabel(label: string) {
    return language === "zh" ? zhLabelMap[label] ?? label : label;
  }

  function displayAction(item: string) {
    if (language !== "zh") return item;
    const normalized = item.toLowerCase();
    if (normalized.includes("pause before replying")) return "先暂停，不要立刻回复。";
    if (normalized.includes("do not engage")) return "不要继续和对方纠缠。";
    if (normalized.includes("seek advice")) return "找可信任的人、学校/公司负责人或专业人士一起确认。";
    if (normalized.includes("verify the sender") || normalized.includes("verify independently")) return "通过独立渠道核实对方身份和说法。";
    if (normalized.includes("report the suspicious")) return "如果涉及威胁或损失风险，保存证据并考虑举报。";
    if (normalized.includes("do not open")) return "不要打开对方发来的链接。";
    if (normalized.includes("official app") || normalized.includes("official website")) return "只从官方 App 或官网自行进入核实。";
    if (normalized.includes("otp") || normalized.includes("password") || normalized.includes("verification code")) return "不要透露验证码、密码或账户恢复信息。";
    if (normalized.includes("continue normally")) return "可以正常处理，但继续保护隐私信息。";
    if (normalized.includes("trusted person")) return "把情况发给可信任的人一起看。";
    return item;
  }

  function displayTimeline(item: string) {
    if (language !== "zh") return item;
    return item
      .replace("Gemini Analyzer extracted content.", "Gemini 已提取可见内容。")
      .replace("Gemini Analyzer extracted the conversation text.", "Gemini 已提取对话文字。")
      .replace("Gemini Analyzer extracted the suspicious refund request.", "Gemini 已提取可疑退款请求。")
      .replace("Gemini Analyzer extracted account-warning messages and URLs.", "Gemini 已提取账号警告和链接。")
      .replace("Cognitive Triage analyzed manipulation tactics.", "认知分诊已分析操控信号。")
      .replace("Cognitive Triage identified manipulation tactics and risk level.", "认知分诊已识别操控信号和风险等级。")
      .replace("Cognitive Triage found mild urgency only.", "认知分诊只发现轻微紧迫感。")
      .replace(
        "Cognitive Triage detected Authority + Urgency + Financial Request.",
        "认知分诊发现权威施压、紧迫感和财务要求。"
      )
      .replace(
        "Cognitive Triage detected Brand Impersonation + Urgency + Account Threat + Suspicious Link.",
        "认知分诊发现品牌冒充、紧迫感、账号威胁和可疑链接。"
      )
      .replace("Safe Reply Generator prepared a response.", "安全回复已准备。")
      .replace("Safe Reply Generator formulated a safe response.", "安全回复已生成。")
      .replace("Evidence Summary compiled key findings.", "证据摘要已整理关键发现。")
      .replace("Evidence Summary compiled key scam indicators.", "证据摘要已整理关键诈骗信号。")
      .replace("Escalation Gate kept Bodyguard Mode off.", "升级判断保持 Bodyguard Mode 关闭。")
      .replace("No Pattern Memory search was required.", "无需检索模式记忆。")
      .replace(/MongoDB Pattern Memory returned (\d+) similar anonymized pattern(s)?\./, "MongoDB 模式记忆返回 $1 个相似匿名模式。");
  }

  function localizedDemoText(demo: DemoCase) {
    if (language !== "zh") return demo.text;
    const zhTexts: Record<string, string> = {
      "low-risk-checkin": "嗨，如果你今天有空可以回复我一下吗？我今晚前要确认聚餐人数。不急，有空再说。",
      "airline-refund":
        "航空客服：您的航班退款将在30分钟后失效。请立即打开链接验证银行卡和人脸信息以获得即时赔付。请不要关闭此页面。",
      "embassy-police":
        "大使馆办公室：你的护照和银行账户涉及洗钱案件。警方今天会签发拘留通知。不要告诉家人，也不要上网搜索。你必须在两小时内转账保证金 RM650,000 证明配合。",
      "whatsapp-security-phishing": demo.text
      ,
      "investment-hype":
        "OBX 模拟交易所页面：Early access closes in 01:45:22。OBX Token 24h +842%。Up to 120% weekly growth (unverified)。Starter Tier $100 minimum。Audits: Not Verified。INVEST NOW。"
    };
    return zhTexts[demo.id] ?? demo.text;
  }

  function persistSavedReviews(nextReviews: SavedReview[]) {
    setSavedReviews(nextReviews);
    window.localStorage.setItem(SAVED_REVIEWS_KEY, JSON.stringify(nextReviews));
  }

  function saveCurrentReview() {
    const saved: SavedReview = {
      id: `review-${Date.now()}`,
      savedAt: new Date().toLocaleString(language === "zh" ? "zh-CN" : "en-US"),
      scenario: result.scenario,
      riskLevel: result.risk_level,
      score: result.overall_risk_score,
      summary: result.summary,
      safeReply: result.safe_reply,
      evidenceSummary: result.evidence_summary,
      evidence: result.evidence.map((item) => `${displayLabel(item.type)}: ${item.text}`),
      imageCount: imagePreviews.length,
      inputPreview: text.trim().slice(0, 220)
    };
    persistSavedReviews([saved, ...savedReviews].slice(0, 20));
    setSaveStatus(copy.reviewSaved);
  }

  function clearSavedReviews() {
    persistSavedReviews([]);
  }

  async function exportReportPng() {
    if (!reportRef.current) return;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(reportRef.current, {
      pixelRatio: 2,
      backgroundColor: "#090d0b",
      cacheBust: true
    });
    const link = document.createElement("a");
    link.download = `lucid-report-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    setSaveStatus(copy.reportGenerated);
  }

  async function loadDemo(demo: DemoCase) {
    setInputMode("chat");
    setSelectedDemo(demo);
    setActiveDemoId(demo.id);
    setUrlInput("");
    setCareChecks([false, false, false]);
    const demoImages = demo.images ?? (demo.image ? [demo.image] : []);
    setText(demoImages.length > 0 ? "" : localizedDemoText(demo));
    if (demoImages.length > 0) {
      try {
        const prepared = await Promise.all(demoImages.map((image) => imageUrlToDataUrl(image)));
        setImagePreviews(prepared.map((item) => item.dataUrl));
        setImageMimes(prepared.map((item) => item.mimeType));
      } catch {
        setImagePreviews([]);
        setImageMimes([]);
      }
    } else {
      setImagePreviews([]);
      setImageMimes([]);
    }
    setResult(demo.result);
    setPatterns([]);
    setSaveStatus("");
    setStatus(`${demo.title} loaded`);
    setStep(1);
  }

  function clearSampleInput() {
    setSelectedDemo(demoCases[0]);
    setActiveDemoId(null);
    setImagePreviews([]);
    setImageMimes([]);
    setText("");
    setUrlInput("");
    setSaveStatus("");
    setStatus("Ready");
    setStep(1);
  }

  async function onFileChange(files?: FileList | null) {
    if (!files || files.length === 0) return;
    setInputMode("chat");
    const prepared = await Promise.all(Array.from(files).slice(0, 5).map((file) => resizeImageForAnalysis(file)));
    const dataUrls = prepared.map((item) => item.dataUrl);
    const mimeTypes = prepared.map((item) => item.mimeType);
    setImagePreviews(dataUrls);
    setImageMimes(mimeTypes);
    setActiveDemoId(null);
    setSelectedDemo(demoCases[0]);
    setText("");
    setUrlInput("");
    setStep(1);
    setStatus("Ready");
  }

  async function runAnalyze(payload?: {
    text?: string;
    imageBase64?: string;
    imagesBase64?: string[];
    mimeType?: string;
    mimeTypes?: string[];
    demoCaseId?: string;
  }) {
    setIsLoading(true);
    setSaveStatus("");
    setCareChecks([false, false, false]);
    setStep(2);
    setStatus("Reading the message. You do not need to respond yet.");
    try {
      const next = await postJson<AnalyzeResponse>("/api/analyze", {
        text: [payload?.text ?? text, urlInput ? `Suspicious URL submitted by user: ${urlInput}` : ""]
          .filter(Boolean)
          .join("\n\n"),
        imageBase64: payload?.imageBase64,
        imagesBase64: payload?.imagesBase64 ?? imagePreviews,
        mimeType: payload?.mimeType,
        mimeTypes: payload?.mimeTypes ?? imageMimes,
        outputLanguage: language,
        demoCaseId: payload?.demoCaseId ?? activeDemoId ?? undefined
      });
      setResult(next);
      setStatus(`Analysis complete via ${next.source === "gemini" ? "Gemini" : "fallback"}`);
      setStep(3);

      const patternResponse = await postJson<{ patterns: PatternRecord[] }>("/api/patterns/search", {
        manipulation_chain: next.manipulation_chain,
        scenario: next.scenario
      });
      setPatterns(patternResponse.patterns);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateSafeReply() {
    setIsLoading(true);
    setStatus("Generating safe reply...");
    try {
      const response = await postJson<{ reply: string; source: string }>("/api/safe-reply", {
        text,
        scenario: result.scenario,
        risk_level: result.risk_level,
        manipulation_chain: result.manipulation_chain,
        fallback_reply: result.safe_reply,
        outputLanguage: language
      });
      setResult((current) => ({ ...current, safe_reply: response.reply }));
      setStatus(`Safe reply ready via ${response.source}`);
      setModal("reply");
    } finally {
      setIsLoading(false);
    }
  }

  async function generateEvidenceSummary() {
    setIsLoading(true);
    setStatus("Generating evidence summary...");
    try {
      const response = await postJson<{ summary: string; source: string }>("/api/evidence-summary", {
        text,
        scenario: result.scenario,
        risk_level: result.risk_level,
        evidence: result.evidence,
        fallback_summary: result.evidence_summary,
        outputLanguage: language
      });
      setResult((current) => ({ ...current, evidence_summary: response.summary }));
      setStatus(`Evidence summary ready via ${response.source}`);
      setModal("summary");
    } finally {
      setIsLoading(false);
    }
  }

  async function savePattern() {
    const localPattern: PatternRecord = {
      pattern_id: `LUCID-${Date.now()}`,
      scenario: result.scenario || copy.pressurePattern,
      language,
      manipulation_chain: result.manipulation_chain,
      phrases: [...result.evidence.map((item) => item.text), urlInput].filter(Boolean),
      risk_level: result.risk_level,
      severity: result.overall_risk_score,
      recommended_actions: result.agent_actions,
      source: "user_confirmed_anonymized_pattern"
    };

    setIsLoading(true);
    setSaveStatus(copy.memorySaving);
    setMemorySaveNote("");
    setModal("memory");

    try {
      const response = await postJson<{ source: string; saved: PatternRecord }>("/api/patterns/save", localPattern);
      const savedPattern = response.saved?.pattern_id ? response.saved : localPattern;
      setPatterns((current) => [
        savedPattern,
        ...current.filter((pattern) => pattern.pattern_id !== savedPattern.pattern_id)
      ].slice(0, 6));
      setSaveStatus(copy.memoryThanksTitle);
      setMemorySaveNote(copy.memoryVisible);
    } catch (error) {
      console.error("Pattern save failed:", error);
      setSaveStatus(copy.memoryFailed);
      setMemorySaveNote("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <section className="product-shell agent-shell">
        {step === 1 && (
        <div className="calm-card">
          <div>
            <p className="eyebrow">{copy.reset}</p>
            <h2>{copy.resetTitle}</h2>
            <p>{copy.resetBody}</p>
          </div>
          <div className="calm-actions">
            {copy.resetSteps.map((item, index) => (
              <button
                key={item}
                type="button"
                className={calmChecks[index] ? "checked" : ""}
                aria-pressed={calmChecks[index]}
                onClick={() =>
                  setCalmChecks((current) =>
                    current.map((checked, checkIndex) => (checkIndex === index ? !checked : checked))
                  )
                }
              >
                <span>{calmChecks[index] ? "✓" : index + 1}</span>
                {item.replace(/^\d+\.\s*/, "")}
              </button>
            ))}
          </div>
          {calmComplete && (
            <div className="calm-reward" role="status">
              <strong>{copy.resetCompleteTitle}</strong>
              <p>{copy.resetCompleteBody}</p>
            </div>
          )}
        </div>
        )}

        {step !== 2 && (
        <div className="product-header">
          <div>
            <p className="eyebrow">{copy.workspace}</p>
            <h1>{copy.reviewTitle}</h1>
          </div>
          {step === 3 && (
          <div className={`risk-pill ${tone}`}>
            <span>{result.risk_level}</span>
            <strong>{result.overall_risk_score}</strong>
          </div>
          )}
        </div>
        )}

        {step === 3 && (
        <div className="capability-row">
          <span>{sourceLabel}</span>
          <span>{copy.mongoMemory}</span>
          <span>{bodyguard ? copy.bodyguardOn : copy.noEscalation}</span>
          <span>{statusLabel}</span>
        </div>
        )}

        {step !== 2 && (
        <div className="agent-steps" aria-label="Agent progress">
          <span className={step === 1 ? "active" : ""}>{copy.step1}</span>
          <span>{copy.step2}</span>
          <span className={step === 3 ? "active" : ""}>{copy.step3}</span>
        </div>
        )}

        {step === 2 && (
          <section className="scan-stage scan-only panel">
            <div className="scan-orbit" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <p className="eyebrow">{copy.step2}</p>
              <h2>{copy.scanningTitle}</h2>
              <p>{copy.scanningBody}</p>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className={`result-top-card ${tone}`}>
            <div>
              <p className="eyebrow">{copy.safestTitle}</p>
              <h2>{bodyguard ? copy.pressurePattern : copy.riskLabels[result.risk_level]}</h2>
            </div>
            <div className="safest-actions">
              {copy.safestActions.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>
        )}

        {step !== 2 && (
        <div className={step === 3 ? "workspace result-workspace" : "workspace input-workspace"}>
          {step === 1 && (
          <aside className="panel input-panel">
            <div className="section-heading">
              <span>{copy.showReceived}</span>
              <small>{copy.privateContent}</small>
            </div>

            <div className="mode-switch">
              <button
                type="button"
                className={inputMode === "chat" ? "active" : ""}
                onClick={() => setInputMode("chat")}
              >
                {copy.chatMode}
              </button>
              <button
                type="button"
                className={inputMode === "phone" ? "active" : ""}
                onClick={() => {
                  setInputMode("phone");
                  setImagePreviews([]);
                  setImageMimes([]);
                  setActiveDemoId(null);
                  setSelectedDemo(demoCases[0]);
                }}
              >
                {copy.phoneMode}
              </button>
            </div>

            {inputMode === "chat" && (
              <label className="upload">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  multiple
                  onChange={(event) => onFileChange(event.target.files)}
                />
                <span>
                  {imagePreviews.length > 0
                    ? `${imagePreviews.length} ${copy.selectedCount}`
                    : copy.upload}
                </span>
                <small>
                  {imagePreviews.length > 0 ? copy.selectedHelp : copy.uploadHelp}
                </small>
              </label>
            )}

            {activeDemoId && (
              <button className="sample-reset" type="button" onClick={clearSampleInput}>
                {copy.clearSample}
              </button>
            )}

            {imagePreviews.length > 0 && (
              <div className="input-thumbs">
                {imagePreviews.map((preview, index) => (
                  <div className="input-thumb" key={preview}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={
                        language === "zh"
                          ? `已选择截图 ${index + 1}`
                          : `Selected screenshot ${index + 1}`
                      }
                    />
                    <span>{index + 1}</span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setImagePreviews([]);
                    setImageMimes([]);
                    setActiveDemoId(null);
                    setSelectedDemo(demoCases[0]);
                    setStatus("Screenshot removed");
                  }}
                >
                  {copy.remove}
                </button>
              </div>
            )}

            <label className="text-label">
              {copy.urlLabel}
              <input
                className="url-input"
                value={urlInput}
                placeholder={copy.urlPlaceholder}
                onChange={(event) => {
                  setUrlInput(event.target.value);
                  setActiveDemoId(null);
                  setSelectedDemo(demoCases[0]);
                }}
              />
            </label>

            <label className="text-label">
              {copy.paste}
              <textarea
                value={text}
                placeholder={inputMode === "phone" ? copy.phonePlaceholder : copy.placeholder}
                onChange={(event) => {
                  setText(event.target.value);
                  setActiveDemoId(null);
                  setSelectedDemo(demoCases[0]);
                }}
              />
            </label>

            <button className="primary" onClick={() => runAnalyze()} disabled={isLoading}>
              {isLoading ? copy.reading : copy.review}
            </button>

            <div className="sample-header">
              <span>{copy.sample}</span>
              <small>{copy.demo}</small>
            </div>

            <div className="demo-grid compact">
              {demoCases.map((demo, index) => (
                <button
                  key={demo.id}
                  className={demo.id === activeDemoId ? "demo active" : "demo"}
                  onClick={() => loadDemo(demo)}
                >
                  <strong>{copy.demos[index]?.[0] ?? demo.title}</strong>
                  <span>{copy.demos[index]?.[1] ?? demo.description}</span>
                </button>
              ))}
            </div>
          </aside>
          )}

          {step === 1 && (
            <aside className="preflight-grid">
              <article className="panel preflight-card">
                <h3>{copy.callMode}</h3>
                <p>{copy.callModeBody}</p>
              </article>
              <article className="panel preflight-card">
                <h3>{copy.learning}</h3>
                <p>{copy.learningBody}</p>
              </article>
            </aside>
          )}

          {step === 3 && (
          <section className="panel evidence-panel">
            <div className="section-heading">
              <span>{copy.evidence}</span>
              <small>{sourceLabel}</small>
            </div>
            <div className="preview">
              {imagePreviews.length > 0 ? (
                <div className="image-stack">
                  {imagePreviews.map((preview, index) => (
                    <div className="image-wrap" key={preview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={
                          language === "zh"
                            ? `上传的对话截图 ${index + 1}`
                            : `Uploaded conversation screenshot ${index + 1}`
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="chat-sim">
                  {text
                    .split(/(?<=[.!?。])\s+/)
                    .filter(Boolean)
                    .map((line, index) => {
                      const hit = result.evidence.find((item) =>
                        line.toLowerCase().includes(item.text.toLowerCase().slice(0, 18))
                      );
                      return (
                        <p key={`${line}-${index}`} className={hit ? "message flagged" : "message"}>
                          {line}
                        </p>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="evidence-list">
              {result.evidence.map((item) => (
                <article key={`${item.text}-${item.type}`}>
                  <div>
                    <strong>{displayLabel(item.type)}</strong>
                    <span>{item.risk_score}%</span>
                  </div>
                  <p className="quote">"{item.text}"</p>
                  <p>{item.reason}</p>
                </article>
              ))}
            </div>
          </section>
          )}

          {step === 3 && (
          <aside className="panel triage-panel">
            <div className="section-heading">
              <span>{copy.triage}</span>
              <small>{bodyguard ? copy.pressureFound : copy.noEscalation}</small>
            </div>
            <div className={`triage-card ${tone}`}>
              <p>{result.scenario}</p>
              <h2>{bodyguard ? copy.pressurePattern : copy.riskLabels[result.risk_level]}</h2>
              <span>{result.summary}</span>
            </div>
            <div className="safe-actions">
              <h3>{copy.safeActions}</h3>
              {result.agent_actions.slice(0, 3).map((item) => (
                <p key={item}>{displayAction(item)}</p>
              ))}
            </div>
            <div className="chain">
              {result.manipulation_chain.map((item) => (
                <span key={item}>{displayLabel(item)}</span>
              ))}
            </div>
            <div className="timeline">
              <h3>{copy.checked}</h3>
              {result.tool_timeline.map((item) => (
                <p key={item}>{displayTimeline(item)}</p>
              ))}
            </div>
            <button className="report-button" type="button" onClick={() => setModal("report")}>
              {copy.report}
            </button>
            <div className="local-memory-actions">
              <button type="button" onClick={saveCurrentReview}>
                {copy.saveReview}
              </button>
              <a href="/saved">{copy.viewSaved} ({savedReviews.length})</a>
            </div>
            {saveStatus && <p className="save-status">{saveStatus}</p>}
          </aside>
          )}
        </div>
        )}

        {step === 3 && (
        <section className="bottom-grid">
          <article className="panel care-card">
            <div className="section-heading">
              <span>{language === "zh" ? "给你自己的安全提醒" : "A calmer note for you"}</span>
              <small>{language === "zh" ? "先稳住，再判断" : "Steady first, decide second"}</small>
            </div>
            <h3>{careGuidance.title}</h3>
            <p>{careGuidance.body}</p>
            <div className="care-steps">
              {careGuidance.steps.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  className={careChecks[index] ? "checked" : ""}
                  aria-pressed={careChecks[index]}
                  onClick={() =>
                    setCareChecks((current) =>
                      current.map((checked, checkIndex) => (checkIndex === index ? !checked : checked))
                    )
                  }
                >
                  <span>{careChecks[index] ? "✓" : index + 1}</span>
                  {item}
                </button>
              ))}
            </div>
            {careComplete && (
              <div className="care-reward" role="status">
                {language === "zh"
                  ? "很好，你已经先稳住了。现在再慢慢核实，不需要马上回应。"
                  : "Good. You have slowed the moment down. Now verify calmly; no immediate reply is needed."}
              </div>
            )}
          </article>
          <article className="panel care-card">
            <div className="section-heading">
              <span>{language === "zh" ? "可以发给可信任的人" : "Message for a trusted person"}</span>
              <small>{language === "zh" ? "不用一个人判断" : "Do not decide alone"}</small>
            </div>
            <p className="trusted-message">{careGuidance.trustedMessage}</p>
          </article>
          <article className="panel">
            <h3>{copy.safeReply}</h3>
            <p>{result.safe_reply}</p>
          </article>
          <article className="panel">
            <h3>{copy.evidenceSummary}</h3>
            <p>{result.evidence_summary}</p>
          </article>
          <article className="panel">
            <h3>{copy.verifySteps}</h3>
            <ul>
              {result.verification_checklist.map((item) => (
                <li key={item}>{displayAction(item)}</li>
              ))}
            </ul>
          </article>
          <article className="panel intelligence-card">
            <div className="section-heading">
              <span>{language === "zh" ? "诈骗演化情报" : "Scam Evolution Intelligence"}</span>
              <small>{language === "zh" ? "参考性趋势洞察" : "Simulated intelligence insight"}</small>
            </div>
            <h3>{intelligence.trends.title}</h3>
            <p>{intelligence.trends.body}</p>
            <div className="intel-chip-row">
              {intelligence.trends.chips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          </article>
          <article className="panel intelligence-card">
            <div className="section-heading">
              <span>{language === "zh" ? "风险分数为什么升高" : "What increased the risk score?"}</span>
              <small>{language === "zh" ? "可解释评分" : "Explainable scoring"}</small>
            </div>
            <div className="score-breakdown">
              {intelligence.scoring.map((item) => (
                <div key={item.label} className="meter-row">
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.value}%</span>
                  </div>
                  <div className="meter-track">
                    <span style={{ width: `${item.value}%` }} />
                  </div>
                  <p>{item.reason}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="panel intelligence-card">
            <div className="section-heading">
              <span>{language === "zh" ? "情绪压力仪表" : "Emotional Pressure Meter"}</span>
              <small>{language === "zh" ? "操控压力分布" : "Pressure distribution"}</small>
            </div>
            <div className="pressure-meter-list">
              {intelligence.pressure.map((item) => (
                <div key={item.label} className="pressure-item">
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.value}%</span>
                  </div>
                  <div className="meter-track">
                    <span style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className="panel intelligence-card">
            <div className="section-heading">
              <span>{language === "zh" ? "域名情报" : "Domain Intelligence"}</span>
              <small>{language === "zh" ? "仿冒与跳转检查" : "Imitation and redirect check"}</small>
            </div>
            <h3>{intelligence.domain.title}</h3>
            <p>{intelligence.domain.body}</p>
            {intelligence.domain.domains.length > 0 && (
              <div className="intel-chip-row domain-row">
                {intelligence.domain.domains.map((domain) => (
                  <span key={domain}>{domain}</span>
                ))}
              </div>
            )}
          </article>
          <article className="panel intelligence-card">
            <div className="section-heading">
              <span>{language === "zh" ? "骗局流程回放" : "Scam Flow Replay"}</span>
              <small>{language === "zh" ? "压力链条" : "Pressure chain"}</small>
            </div>
            <div className="replay-list">
              {intelligence.replay.map((item) => (
                <div key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="panel intelligence-card">
            <div className="section-heading">
              <span>{language === "zh" ? "受害脆弱点洞察" : "Victim Vulnerability Insights"}</span>
              <small>{language === "zh" ? "为什么会有效" : "Why it can work"}</small>
            </div>
            <h3>{intelligence.vulnerability.title}</h3>
            <p>{intelligence.vulnerability.body}</p>
            <div className="intel-chip-row">
              {intelligence.vulnerability.chips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          </article>
          <article className="panel intelligence-card">
            <div className="section-heading">
              <span>{language === "zh" ? "置信度透明度" : "Confidence Transparency"}</span>
              <small>{intelligence.confidence.level}</small>
            </div>
            <p>{intelligence.confidence.body}</p>
          </article>
          <article className="panel intelligence-card">
            <div className="section-heading">
              <span>{language === "zh" ? "心理操控分析" : "Psychological Manipulation Analysis"}</span>
              <small>{language === "zh" ? "非责备式解释" : "Non-blaming explanation"}</small>
            </div>
            <div className="psych-grid">
              {intelligence.psychology.map((item) => (
                <div key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="panel intelligence-card">
            <div className="section-heading">
              <span>{language === "zh" ? "动态安全动作" : "Dynamic Safe Actions"}</span>
              <small>{language === "zh" ? "按场景调整" : "Adaptive to this scam type"}</small>
            </div>
            <ul className="adaptive-actions">
              {intelligence.adaptiveActions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article className="panel">
            <h3>{copy.report}</h3>
            <p>{copy.reportSubtitle}</p>
            <button className="memory-button" type="button" onClick={() => setModal("report")}>
              {copy.report}
            </button>
          </article>
          <article className="panel">
            <h3>{copy.patternMemory}</h3>
            {patterns.length === 0 ? (
              <p>{copy.noPatterns}</p>
            ) : (
              patterns.map((pattern) => (
                <p key={pattern.pattern_id}>
                  <strong>{pattern.pattern_id}</strong> · {pattern.scenario}
                </p>
              ))
            )}
          </article>
          <article className="panel">
            <h3>{copy.localMemory}</h3>
            <p>{copy.localMemoryBody}</p>
            <div className="local-memory-actions stacked">
              <button type="button" onClick={saveCurrentReview}>
                {copy.saveReview}
              </button>
              <a href="/saved">{copy.viewSaved} ({savedReviews.length})</a>
            </div>
          </article>
          {showAnonymousContribution && (
            <article className="panel contribution-card">
              <h3>{copy.memoryAskTitle}</h3>
              <p>{copy.memoryAskBody}</p>
              <button className="memory-button" type="button" onClick={() => setModal("memoryConfirm")}>
                {copy.save}
              </button>
            </article>
          )}
        </section>
        )}
      </section>

      {modal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <button className="modal-close" onClick={() => setModal(null)}>
              {copy.close}
            </button>
            {modal === "reply" && (
              <>
                <p className="eyebrow">{copy.safeResponse}</p>
                <h3>{copy.safeResponseTitle}</h3>
                <p>{result.safe_reply}</p>
              </>
            )}
            {modal === "summary" && (
              <>
                <p className="eyebrow">{copy.evidenceSummary}</p>
                <h3>{copy.summaryTitle}</h3>
                <p>{result.evidence_summary}</p>
              </>
            )}
            {modal === "checklist" && (
              <>
                <p className="eyebrow">{copy.verifySteps}</p>
                <h3>{copy.verifyTitle}</h3>
                <ul>
                  {result.verification_checklist.map((item) => (
                    <li key={item}>{displayAction(item)}</li>
                  ))}
                </ul>
              </>
            )}
            {modal === "memory" && (
              <>
                <p className="eyebrow">{copy.memoryTitle}</p>
                <h3>{saveStatus || copy.memoryThanksTitle}</h3>
                <p>{memorySaveNote || copy.memoryThanksBody}</p>
              </>
            )}
            {modal === "memoryConfirm" && (
              <>
                <p className="eyebrow">{copy.memoryTitle}</p>
                <h3>{copy.memoryAskTitle}</h3>
                <p>{copy.memoryAskBody}</p>
                <div className="modal-actions">
                  <button type="button" className="report-button" onClick={savePattern} disabled={isLoading}>
                    {copy.memoryConfirm}
                  </button>
                  <button type="button" className="memory-button" onClick={() => setModal(null)}>
                    {copy.memoryCancel}
                  </button>
                </div>
              </>
            )}
            {modal === "report" && (
              <>
                <div className="report-card" ref={reportRef}>
                  <div className="report-header">
                    <div>
                      <strong>LUCID</strong>
                      <span>{copy.reportTitle}</span>
                    </div>
                    <div className={`report-risk ${tone}`}>
                      <small>{copy.riskLabels[result.risk_level]}</small>
                      <b>{result.overall_risk_score}</b>
                    </div>
                  </div>
                  <p className="report-subtitle">{copy.reportSubtitle}</p>
                  <section className="report-summary-grid">
                    <div>
                      <h4>{copy.reportScenario}</h4>
                      <p>{result.scenario}</p>
                    </div>
                    <div>
                      <h4>{copy.reportRisk}</h4>
                      <p>{result.summary}</p>
                    </div>
                  </section>
                  <section>
                    <h4>{copy.safestTitle}</h4>
                    <div className="report-actions">
                      {copy.safestActions.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  </section>
                  <section className="report-care">
                    <h4>{language === "zh" ? "给当事人的一句话" : "A note for the person receiving this"}</h4>
                    <p>{careGuidance.body}</p>
                  </section>
                  <section>
                    <h4>{copy.reportChain}</h4>
                    <div className="report-chain">
                      {result.manipulation_chain.map((item) => (
                        <span key={item}>{displayLabel(item)}</span>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h4>{language === "zh" ? "风险分数来源" : "Risk score drivers"}</h4>
                    <div className="report-mini-meters">
                      {intelligence.scoring.slice(0, 4).map((item) => (
                        <div key={item.label}>
                          <span>{item.label}</span>
                          <b>{item.value}%</b>
                          <i>
                            <em style={{ width: `${item.value}%` }} />
                          </i>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h4>{language === "zh" ? "情绪压力分布" : "Emotional pressure distribution"}</h4>
                    <div className="report-pressure">
                      {intelligence.pressure.map((item) => (
                        <span key={item.label}>
                          {item.label} · {item.value}%
                        </span>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h4>{copy.evidenceSummary}</h4>
                    <p>{result.evidence_summary}</p>
                  </section>
                  <section>
                    <h4>{copy.verifySteps}</h4>
                    <ul>
                      {result.verification_checklist.slice(0, 4).map((item) => (
                        <li key={item}>{displayAction(item)}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h4>{language === "zh" ? "建议发给可信任的人" : "Suggested message to a trusted person"}</h4>
                    <p>{careGuidance.trustedMessage}</p>
                  </section>
                  <section>
                    <h4>{copy.evidence}</h4>
                    {result.evidence.slice(0, 6).map((item) => (
                      <div key={`${item.text}-${item.type}`} className="report-evidence">
                        <div>
                          <b>{displayLabel(item.type)}</b>
                          <span>{item.risk_score}%</span>
                        </div>
                        <p>"{item.text}"</p>
                        <small>{item.reason}</small>
                      </div>
                    ))}
                  </section>
                  <section>
                    <h4>{copy.reportPrivacy}</h4>
                    <p>{copy.reportPrivacyBody}</p>
                  </section>
                  <footer>
                    {new Date().toLocaleString(language === "zh" ? "zh-CN" : "en-US")} · LUCID
                  </footer>
                </div>
                <button className="memory-button" type="button" onClick={exportReportPng}>
                  {copy.exportPng}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

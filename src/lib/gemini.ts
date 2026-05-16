import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AnalysisResult } from "@/lib/types";
import { ensureBodyguard } from "@/lib/fallback";

const MODEL_NAME = process.env.GOOGLE_MODEL || "gemini-2.5-flash";
const GOOGLE_API_MODE = process.env.GOOGLE_API_MODE || "vertex_express";

export function hasGeminiKey() {
  return Boolean(process.env.GOOGLE_API_KEY);
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Gemini response did not contain JSON.");
  }
  return match[0];
}

export async function analyzeWithGemini(input: {
  text?: string;
  imageBase64?: string;
  imagesBase64?: string[];
  mimeType?: string;
  mimeTypes?: string[];
  outputLanguage?: "en" | "zh";
}): Promise<AnalysisResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY.");
  }

  const outputLanguage =
    input.outputLanguage === "zh"
      ? "Simplified Chinese. Keep product names like LUCID, Gemini, MongoDB, Bodyguard Mode in English if needed."
      : "English only. Do not include Chinese translations unless the submitted evidence phrase itself is Chinese.";

  const prompt = `You are LUCID, an AI Cognitive Triage Agent for scam-resistant decisions.

Analyze the submitted material. It may be a chat screenshot, website screenshot, wallet/exchange page, SMS, email, pasted URL, pasted conversation, or phone-call transcript.

Rules:
1. Return valid JSON only. No markdown, no code fences, no commentary.
2. Start by identifying the content type internally: chat screenshot, website screenshot, wallet/exchange/account page, SMS/email, URL-only, phone transcript, or unclear.
3. Do not over-alert based on one suspicious phrase or a large number. Escalate only when manipulation tactics combine with sensitive contexts such as money, identity, legal threat, account access, OTP, secrecy, urgent payment, private key, seed phrase, fees, taxes, unlock payments, or account recovery.
4. Do not reveal hidden chain-of-thought. Use short evidence-based reasoning only.
5. Assign risk_level as exactly one of: Green, Yellow, Orange, Red.
6. Orange or Red must activate bodyguard_mode. Green or Yellow should not unless there is a clear sensitive context.
7. Tool timeline must explicitly name: Gemini Analyzer, Cognitive Triage, MongoDB Pattern Memory when applicable, Safe Reply Generator, Evidence Summary when applicable.
8. Do not claim legal or financial authority. Recommend pause, official verification, trusted-person review, and user-controlled action.
9. Screenshots may be Chinese, English, Malay, or mixed-language. Perform OCR on the visible text and inspect UI elements such as chat bubbles, sender direction, URLs/domains, buttons, countdowns, wallet balances, exchange navigation, brand names, and fake-brand cues. Keep evidence.text as the exact original phrase when possible, including Chinese phrases.
10. If the screenshot contains Chinese scam language such as 大使馆, 公安, 涉嫌诈骗, 拘留, 转账, 不要告诉别人, 不要挂电话, 验证码, 保证金, 解冻, 手续费, 助记词, 私钥, treat it as authority/fear/isolation/financial-demand/sensitive-data evidence when the context supports it.
11. Output all explanation fields in: ${outputLanguage}
12. For chat screenshots, identify speaker direction. In common mobile chat UIs, right-side green bubbles are usually the user's outgoing messages and left-side white bubbles are usually the other party's incoming messages. Do not treat the user's skeptical replies, refusals, questions, or pushback as scammer pressure. Evidence should focus on the other party's pressure, threats, demands, isolation, links, OTP requests, account-recovery requests, private-key/seed-phrase requests, or financial instructions. If unsure, say "speaker direction uncertain" in the summary and do not assign Red based only on ambiguous speaker direction.
13. If multiple screenshots are submitted, treat them as one conversation sequence and combine evidence across images.
14. Critical calibration: a crypto wallet, Bitcoin wallet, exchange dashboard, account balance, portfolio, transaction list, banking page, payment page, or large number is NOT suspicious by itself. Do not assign Orange/Red merely because the screenshot shows a large balance, crypto asset, countdown, or trading interface. Escalate only if there is an actual pressure instruction such as "send/transfer/pay now", "deposit to unlock/withdraw", "tax/fee/guarantee", "verify seed phrase/private key/OTP", "click this unofficial link", secrecy, impersonation, threat, or time-limited coercion from another party.
15. If the submitted evidence looks like a normal account, wallet, banking, payment, AI chat, or trading page with no visible coercive instruction from another party, classify it as Green or Yellow. Explain that LUCID found no clear manipulation chain and recommend independent verification only.

Risk calibration:
- Green: ordinary conversation, normal reminder, normal AI chat, or normal account/wallet/page with no manipulation chain.
- Yellow: suspicious but incomplete signal, unknown investment page, exaggerated marketing, ordinary link, incomplete screenshot, or unclear sender direction without a concrete demand.
- Orange: clear scam structure or pressure pattern, but no final payment/sensitive-data demand is visible yet.
- Red: strong combined evidence such as official/brand impersonation + threat/account suspension/legal fear + immediate action + link/payment/OTP/account recovery/private key/seed phrase/fee/unlock/tax/guarantee demand.

High-risk patterns to recognize:
- Social account phishing: WhatsApp/Telegram/Instagram/bank/security center messages claiming suspension, restriction, verification, deletion, or account recovery through a non-official link.
- Authority scams: police, embassy, immigration, bank, tax, court, or government claims combined with fear, secrecy, legal threat, arrest, detention, or payment.
- Refund/customer-support phishing: fake airline, delivery, bank, platform, or merchant refund/compensation plus link, card verification, face scan, OTP, or urgency.
- Investment/romance scams: relationship trust or mentor/group pressure plus crypto/stocks/forex/high return, fake platform, deposit, tax, withdrawal unlock, fee, or private chat migration.
- Phone scams: caller says not to hang up, not to tell family, stay on the line, transfer money, provide OTP, or cooperate with police/bank/customer service.

Return this exact JSON shape:
{
  "risk_level": "Green | Yellow | Orange | Red",
  "overall_risk_score": 0,
  "scenario": "short scenario",
  "summary": "one or two sentences",
  "manipulation_chain": ["Fear", "Urgency"],
  "evidence": [
    {
      "text": "exact phrase",
      "type": "Fear",
      "risk_score": 0,
      "reason": "short evidence-based reason",
      "location": {"x": 0, "y": 0, "width": 0, "height": 0}
    }
  ],
  "tool_timeline": ["Gemini Analyzer extracted content."],
  "tool_calls": [{"tool": "Cognitive Triage", "result": "Assigned Yellow risk."}],
  "agent_actions": ["Pause before replying."],
  "verification_checklist": ["Verify through an official channel found independently."],
  "safe_reply": "short safe reply",
  "evidence_summary": "short shareable evidence note",
  "bodyguard_mode": false
}

Conversation text, if provided:
${input.text ?? ""}`;

  if (GOOGLE_API_MODE === "vertex_express") {
    const responseText = await generateWithVertexExpress(
      prompt,
      input.imagesBase64 ?? (input.imageBase64 ? [input.imageBase64] : undefined),
      input.mimeTypes ?? (input.mimeType ? [input.mimeType] : undefined)
    );
    const parsed = JSON.parse(extractJson(responseText)) as AnalysisResult;
    return ensureBodyguard(
      {
        ...parsed,
        source: "gemini",
        evidence: parsed.evidence ?? [],
        tool_timeline: parsed.tool_timeline ?? [],
        tool_calls: parsed.tool_calls ?? [],
        agent_actions: parsed.agent_actions ?? [],
        verification_checklist: parsed.verification_checklist ?? [],
        manipulation_chain: parsed.manipulation_chain ?? []
      },
      input.text
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const parts: Array<string | { inlineData: { data: string; mimeType: string } }> = [prompt];
  const images = input.imagesBase64 ?? (input.imageBase64 ? [input.imageBase64] : []);
  const mimeTypes = input.mimeTypes ?? (input.mimeType ? [input.mimeType] : []);
  images.forEach((image, index) => {
    parts.push({
      inlineData: {
        data: image.replace(/^data:[^,]+,/, ""),
        mimeType: mimeTypes[index] ?? "image/png"
      }
    });
  });

  const response = await model.generateContent(parts);
  const raw = response.response.text();
  const parsed = JSON.parse(extractJson(raw)) as AnalysisResult;

  return ensureBodyguard(
    {
      ...parsed,
      source: "gemini",
      evidence: parsed.evidence ?? [],
      tool_timeline: parsed.tool_timeline ?? [],
      tool_calls: parsed.tool_calls ?? [],
      agent_actions: parsed.agent_actions ?? [],
      verification_checklist: parsed.verification_checklist ?? [],
      manipulation_chain: parsed.manipulation_chain ?? []
    },
    input.text
  );
}

export async function generateTextWithGemini(prompt: string) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY.");
  }
  if (GOOGLE_API_MODE === "vertex_express") {
    return generateWithVertexExpress(prompt);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const response = await model.generateContent(prompt);
  return response.response.text().trim();
}

async function generateWithVertexExpress(prompt: string, imagesBase64?: string[], mimeTypes?: string[]) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY.");
  }

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt }
  ];

  imagesBase64?.forEach((imageBase64, index) => {
    parts.push({
      inlineData: {
        mimeType: mimeTypes?.[index] ?? "image/png",
        data: imageBase64.replace(/^data:[^,]+,/, "")
      }
    });
  });

  const response = await fetch(
    `https://aiplatform.googleapis.com/v1/publishers/google/models/${MODEL_NAME}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      })
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload));
  }

  return payload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim() ?? "";
}

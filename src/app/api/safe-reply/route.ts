import { NextResponse } from "next/server";
import { generateTextWithGemini } from "@/lib/gemini";
import { findDemoResult } from "@/lib/fallback";
import { sanitizeGeneratedText, wrapUntrustedEvidence } from "@/lib/promptSecurity";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    text?: string;
    scenario?: string;
    risk_level?: string;
    manipulation_chain?: string[];
    fallback_reply?: string;
    outputLanguage?: "en" | "zh";
  };

  try {
    if (process.env.GOOGLE_API_KEY) {
      const languageRule =
        body.outputLanguage === "zh"
          ? "Write in Simplified Chinese only, except product names if necessary."
          : "Write in English only. Do not add Chinese translations.";
      const raw = await generateTextWithGemini(
        `You write one short safe reply for a user facing a possible scam.
Do not accuse, argue, reveal personal information, promise payment, or continue the conversation.
Recommend independent official verification.
Return only the reply sentence, no quotes.
Language: ${languageRule}`,
        [
          `Risk level from LUCID: ${body.risk_level ?? "unknown"}`,
          wrapUntrustedEvidence(body.scenario, "Scenario"),
          wrapUntrustedEvidence((body.manipulation_chain ?? []).join(", "), "Manipulation chain"),
          wrapUntrustedEvidence(body.text, "Conversation")
        ].join("\n\n")
      );
      const reply = sanitizeGeneratedText(raw, 300);
      if (!reply) {
        throw new Error("Safe reply output rejected by sanitizer.");
      }
      return NextResponse.json({ source: "gemini", reply });
    }
  } catch (error) {
    console.error("Safe reply fallback:", error);
  }

  return NextResponse.json({
    source: "fallback",
    reply: body.fallback_reply || findDemoResult(undefined, body.text).safe_reply
  });
}

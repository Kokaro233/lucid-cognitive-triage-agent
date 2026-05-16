import { NextResponse } from "next/server";
import { generateTextWithGemini } from "@/lib/gemini";
import { findDemoResult } from "@/lib/fallback";

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
      const reply = await generateTextWithGemini(`Write one short safe reply for a user facing a possible scam.
Do not accuse, argue, reveal personal information, promise payment, or continue the conversation.
Recommend independent official verification.
Return only the reply sentence, no quotes.
Language: ${languageRule}

Scenario: ${body.scenario ?? "suspicious conversation"}
Risk level: ${body.risk_level ?? "unknown"}
Manipulation chain: ${(body.manipulation_chain ?? []).join(", ")}
Conversation: ${body.text ?? ""}`);
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

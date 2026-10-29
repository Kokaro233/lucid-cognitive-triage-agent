import { NextResponse } from "next/server";
import { generateTextWithGemini } from "@/lib/gemini";
import { findDemoResult } from "@/lib/fallback";
import { sanitizeGeneratedText, wrapUntrustedEvidence } from "@/lib/promptSecurity";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    text?: string;
    scenario?: string;
    risk_level?: string;
    evidence?: Array<{ text: string; type: string; reason: string }>;
    fallback_summary?: string;
    outputLanguage?: "en" | "zh";
  };

  try {
    if (process.env.GOOGLE_API_KEY) {
      const languageRule =
        body.outputLanguage === "zh"
          ? "Write in Simplified Chinese only, except product names if necessary."
          : "Write in English only. Do not add Chinese translations.";
      const raw = await generateTextWithGemini(
        `You create a concise evidence summary that a user can share with a trusted person.
Do not claim legal validity. Mention only observable signals and recommended safe next steps.
Return 3-5 sentences, no markdown heading.
Language: ${languageRule}`,
        [
          `Risk level from LUCID: ${body.risk_level ?? "unknown"}`,
          wrapUntrustedEvidence(body.scenario, "Scenario"),
          wrapUntrustedEvidence(JSON.stringify(body.evidence ?? []), "Evidence items"),
          wrapUntrustedEvidence(body.text, "Conversation")
        ].join("\n\n")
      );
      const summary = sanitizeGeneratedText(raw, 900);
      if (!summary) {
        throw new Error("Evidence summary output rejected by sanitizer.");
      }
      return NextResponse.json({ source: "gemini", summary });
    }
  } catch (error) {
    console.error("Evidence summary fallback:", error);
  }

  return NextResponse.json({
    source: "fallback",
    summary: body.fallback_summary || findDemoResult(undefined, body.text).evidence_summary
  });
}

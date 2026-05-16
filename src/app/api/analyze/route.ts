import { NextResponse } from "next/server";
import { analyzeWithGemini } from "@/lib/gemini";
import { ensureBodyguard, findDemoResult, imageOnlyFallback, searchLocalPatterns } from "@/lib/fallback";
import { searchPatternsMongo } from "@/lib/mongodb";
import type { PatternRecord } from "@/lib/types";

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

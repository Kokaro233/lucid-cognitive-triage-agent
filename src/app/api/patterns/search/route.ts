import { NextResponse } from "next/server";
import { searchLocalPatterns } from "@/lib/fallback";
import { searchPatternsMongo } from "@/lib/mongodb";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    manipulation_chain?: string[];
    scenario?: string;
  };

  try {
    if (process.env.MONGODB_URI) {
      const patterns = await searchPatternsMongo(body.manipulation_chain ?? [], body.scenario);
      return NextResponse.json({ source: "mongodb", patterns });
    }
  } catch (error) {
    console.error("MongoDB pattern search fallback:", error);
  }

  const patterns = searchLocalPatterns(body.manipulation_chain ?? [], body.scenario);
  return NextResponse.json({ source: "fallback", patterns });
}

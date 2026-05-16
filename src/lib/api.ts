import type { AnalysisResult } from "@/lib/types";

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export function riskTone(level: AnalysisResult["risk_level"]) {
  return {
    Green: "green",
    Yellow: "yellow",
    Orange: "orange",
    Red: "red"
  }[level];
}

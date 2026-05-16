import fs from "node:fs/promises";

const endpoint = process.env.LUCID_ANALYZE_URL || "http://127.0.0.1:3000/api/analyze";
const casesPath = new URL("../docs/risk-eval-cases.json", import.meta.url);
const cases = JSON.parse(await fs.readFile(casesPath, "utf8"));

let failed = 0;

for (const item of cases) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: item.text,
      outputLanguage: item.language === "zh" ? "zh" : "en"
    })
  });

  if (!response.ok) {
    failed += 1;
    console.log(`FAIL ${item.id}: HTTP ${response.status}`);
    continue;
  }

  const result = await response.json();
  const ok = item.allowedRiskLevels.includes(result.risk_level);
  if (!ok) {
    failed += 1;
  }

  console.log(
    `${ok ? "PASS" : "FAIL"} ${item.id}: ${result.risk_level} ${result.overall_risk_score} · expected ${item.allowedRiskLevels.join("/")}`
  );
  console.log(`  ${result.scenario}`);
}

if (failed > 0) {
  console.log(`\n${failed} risk calibration case(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${cases.length} risk calibration cases passed.`);

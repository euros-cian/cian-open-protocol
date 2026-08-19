import { readFileSync } from "node:fs";
import { analyseWelshV2, evaluateWelshCases } from "../src/index.js";
const cases = readFileSync(new URL("../evaluation/cy-v0.2.seed.jsonl", import.meta.url), "utf8")
  .split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const report = evaluateWelshCases(cases, { analyser: analyseWelshV2, profileId: "cy-v0.2" });
console.log(JSON.stringify(report, null, 2));
console.error("\nPROVISIONAL ONLY: REVIEW_REQUIRED is automated abstention, not a real-time human queue. Labels remain unreviewed.");

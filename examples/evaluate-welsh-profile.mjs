import { readFileSync } from "node:fs";
import { evaluateWelshCases } from "../src/index.js";

const path = process.argv[2] ?? new URL("../evaluation/cy-v0.1.seed.jsonl", import.meta.url);
const cases = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
const report = evaluateWelshCases(cases);
console.log(JSON.stringify(report, null, 2));
if (!report.production_claim_allowed) {
  console.error("\nPROVISIONAL ONLY: not all labels have Welsh-expert approval; no production accuracy claim is allowed.");
}

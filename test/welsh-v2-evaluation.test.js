import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyseWelshV2, evaluateWelshCases } from "../src/index.js";

test("cy-v0.2 seed evaluation includes scalable automated abstention", () => {
  const cases = readFileSync(new URL("../evaluation/cy-v0.2.seed.jsonl", import.meta.url), "utf8")
    .split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const report = evaluateWelshCases(cases, { analyser: analyseWelshV2, profileId: "cy-v0.2" });
  assert.equal(report.profile_id, "cy-v0.2");
  assert.equal(report.total_cases, 10);
  assert.equal(report.confusion_matrix.review_required, 3);
  assert.equal(report.production_claim_allowed, false);
  assert.equal(report.results.find(item => item.case_id === "cy2-seed-001").actual, "QUALIFIES");
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evaluateWelshCases } from "../src/index.js";

test("Welsh evaluation reports a confusion matrix and blocks unreviewed production claims", () => {
  const cases = readFileSync(new URL("../evaluation/cy-v0.1.seed.jsonl", import.meta.url), "utf8")
    .split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const report = evaluateWelshCases(cases);
  assert.equal(report.total_cases, 12);
  assert.equal(report.expert_approved_cases, 0);
  assert.equal(report.production_claim_allowed, false);
  assert.equal(Object.values(report.confusion_matrix).reduce((sum, count) => sum + count, 0), 12);
});

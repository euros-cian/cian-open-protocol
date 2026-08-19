import test from "node:test";
import assert from "node:assert/strict";
import { assessWelshReview, createBlindReviewPacket } from "../src/index.js";

const cases = [
  { case_id: "a", text: "Bore da", category: "greeting", expected_decision: "QUALIFIES" },
  { case_id: "b", text: "Hello", category: "english", expected_decision: "DOES_NOT_QUALIFY" }
];
const analyser = text => ({ decision: text === "Bore da" ? "QUALIFIES" : "DOES_NOT_QUALIFY" });

test("blind packets omit provisional labels", () => {
  const packet = createBlindReviewPacket(cases);
  assert.deepEqual(Object.keys(packet[0]), ["case_id", "text", "category"]);
});

test("independent review requires two reviewers for every case", () => {
  const reviews = cases.flatMap(item => ["r1", "r2"].map(reviewer_id => ({
    case_id: item.case_id, reviewer_id, decision: item.expected_decision, role: "reviewer"
  })));
  const report = assessWelshReview({ cases, reviews, analyser });
  assert.equal(report.independent_review_complete, true);
  assert.equal(report.production_claim_allowed, true);
  assert.equal(report.agreement_ppm, 1_000_000);
});

test("reviewer disagreement requires adjudication", () => {
  const reviews = [
    { case_id: "a", reviewer_id: "r1", decision: "QUALIFIES", role: "reviewer" },
    { case_id: "a", reviewer_id: "r2", decision: "REVIEW_REQUIRED", role: "reviewer" }
  ];
  const report = assessWelshReview({ cases: [cases[0]], reviews, analyser });
  assert.equal(report.needs_adjudication, 1);
  assert.equal(report.production_claim_allowed, false);
});

test("duplicate or adjudicator records cannot replace two independent reviewers", () => {
  const reviews = [
    { case_id: "a", reviewer_id: "r1", decision: "QUALIFIES", role: "reviewer" },
    { case_id: "a", reviewer_id: "r1", decision: "QUALIFIES", role: "reviewer" },
    { case_id: "a", reviewer_id: "judge", decision: "QUALIFIES", role: "adjudicator" }
  ];
  const report = assessWelshReview({ cases: [cases[0]], reviews, analyser });
  assert.equal(report.awaiting_review, 1);
  assert.equal(report.independent_review_complete, false);
});

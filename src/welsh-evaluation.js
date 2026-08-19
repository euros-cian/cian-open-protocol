// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { analyseWelsh } from "./welsh-validator.js";

export function evaluateWelshCases(cases, { analyser = analyseWelsh, profileId = "cy-v0.1" } = {}) {
  const matrix = { true_positive: 0, true_negative: 0, false_positive: 0, false_negative: 0, review_required: 0 };
  const results = cases.map(item => {
    const actual = analyser(item.text).decision;
    const expected = item.expected_decision;
    const correct = actual === expected;
    if (expected === "QUALIFIES" && actual === "QUALIFIES") matrix.true_positive += 1;
    else if (expected === "DOES_NOT_QUALIFY" && actual === "DOES_NOT_QUALIFY") matrix.true_negative += 1;
    else if (actual === "REVIEW_REQUIRED") matrix.review_required += 1;
    else if (actual === "QUALIFIES") matrix.false_positive += 1;
    else matrix.false_negative += 1;
    return { case_id: item.case_id, expected, actual, correct, review_status: item.review_status };
  });
  const total = results.length;
  const reviewed = results.filter(item => item.review_status === "expert_approved").length;
  return {
    profile_id: profileId, total_cases: total, expert_approved_cases: reviewed,
    accuracy_ppm: total ? Math.floor((results.filter(item => item.correct).length * 1_000_000) / total) : 0,
    confusion_matrix: matrix, results,
    production_claim_allowed: reviewed === total && total > 0
  };
}

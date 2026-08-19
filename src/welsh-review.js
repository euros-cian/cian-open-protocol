// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
const DECISIONS = new Set(["QUALIFIES", "DOES_NOT_QUALIFY", "REVIEW_REQUIRED"]);

export function createBlindReviewPacket(cases) {
  return cases.map(({ case_id, text, category }) => ({ case_id, text, category }));
}

export function assessWelshReview({ cases, reviews, analyser, profileId = "cy-v0.2", minimumReviewers = 2 }) {
  if (typeof analyser !== "function") throw new TypeError("analyser is required");
  const byCase = new Map(cases.map(item => [item.case_id, item]));
  const accepted = reviews.filter(review => byCase.has(review.case_id) && DECISIONS.has(review.decision));
  const reviewers = [...new Set(accepted.filter(review => review.role === "reviewer").map(review => review.reviewer_id))];
  const rows = cases.map(item => {
    const caseReviews = accepted.filter(review => review.case_id === item.case_id);
    const peerReviews = caseReviews.filter(review => review.role === "reviewer");
    const peerReviewerCount = new Set(peerReviews.map(review => review.reviewer_id)).size;
    const decisions = [...new Set(peerReviews.map(review => review.decision))];
    const adjudication = peerReviewerCount >= minimumReviewers
      ? caseReviews.find(review => review.role === "adjudicator")?.decision
      : null;
    const consensus = adjudication ?? (decisions.length === 1 && peerReviewerCount >= minimumReviewers ? decisions[0] : null);
    const actual = analyser(item.text).decision;
    return {
      case_id: item.case_id,
      category: item.category,
      review_count: caseReviews.length,
      consensus_decision: consensus,
      validator_decision: actual,
      agrees_with_consensus: consensus === null ? null : consensus === actual,
      status: consensus ? "reviewed" : peerReviewerCount >= minimumReviewers ? "needs_adjudication" : "awaiting_review"
    };
  });
  const reviewedRows = rows.filter(row => row.consensus_decision);
  const agreements = reviewedRows.filter(row => row.agrees_with_consensus).length;
  const categoryReport = Object.values(rows.reduce((result, row) => {
    const value = result[row.category] ??= { category: row.category, total: 0, reviewed: 0, agreements: 0 };
    value.total += 1;
    if (row.consensus_decision) value.reviewed += 1;
    if (row.agrees_with_consensus) value.agreements += 1;
    return result;
  }, {})).map(value => ({ ...value, agreement_ppm: value.reviewed ? Math.floor(value.agreements * 1_000_000 / value.reviewed) : null }));
  const complete = reviewedRows.length === cases.length && cases.length > 0 && reviewers.length >= minimumReviewers;
  return {
    profile_id: profileId,
    total_cases: cases.length,
    reviewer_count: reviewers.length,
    reviewed_cases: reviewedRows.length,
    agreement_ppm: reviewedRows.length ? Math.floor(agreements * 1_000_000 / reviewedRows.length) : null,
    awaiting_review: rows.filter(row => row.status === "awaiting_review").length,
    needs_adjudication: rows.filter(row => row.status === "needs_adjudication").length,
    category_report: categoryReport,
    rows,
    independent_review_complete: complete,
    production_claim_allowed: complete && agreements === reviewedRows.length
  };
}

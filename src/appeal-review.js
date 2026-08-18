// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { randomUUID } from "node:crypto";

const OUTCOMES = new Set(["upheld", "overturned"]);
const RATIONALES = new Set(["validator_correct", "validator_error", "insufficient_evidence", "profile_gap"]);

export function createAppealResolution({ appeal, outcome, rationaleCode, signer, now = () => new Date() }) {
  if (!appeal || !["open", "under_review"].includes(appeal.status)) throw new Error("appeal is not open for resolution");
  if (!OUTCOMES.has(outcome) || !RATIONALES.has(rationaleCode)) throw new Error("valid outcome and rationale_code are required");
  return signer.sign({
    protocol_version: "0.1", resolution_id: `resolution:${randomUUID()}`,
    appeal_id: appeal.appeal_id, interaction_id: appeal.interaction_id,
    language_profile: appeal.language_profile, disputed_decision: appeal.disputed_decision,
    outcome, rationale_code: rationaleCode, reviewer_id: signer.serviceId,
    effect: "prospective_profile_review_only",
    resolved_at: now().toISOString()
  });
}

export class AppealReviewer {
  constructor({ store, signer, now = () => new Date() } = {}) {
    if (!store?.resolve || !signer?.sign) throw new Error("appeal store and reviewer signer are required");
    Object.assign(this, { store, signer, now });
  }
  resolve({ appealId, outcome, rationaleCode }) {
    return this.store.resolve({ appealId, outcome, rationaleCode, signer: this.signer, now: this.now });
  }
}

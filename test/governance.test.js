import test from "node:test";
import assert from "node:assert/strict";
import {
  AppealReviewer, InMemoryAppealStore, createGovernanceServer,
  createSigningService, importPublicKey, verifyRecord
} from "../src/index.js";

test("appeal governance creates one signed prospective-only resolution", async t => {
  const store = new InMemoryAppealStore();
  const appeal = await store.create({
    sessionId: "session:test",
    input: { interaction_id: "interaction:test", disputed_decision: "QUALIFIES", reason_code: "false_positive" }
  });
  const signer = createSigningService({ serviceId: "reviewer:cy:test" });
  const service = createGovernanceServer({ reviewer: new AppealReviewer({ store, signer }), apiToken: "governance-secret" });
  t.after(() => service.close());
  const url = await service.listen();

  let response = await fetch(`${url}/v0.1/appeals/${encodeURIComponent(appeal.appeal_id)}/resolve`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ outcome: "overturned", rationale_code: "validator_error" })
  });
  assert.equal(response.status, 401);

  response = await fetch(`${url}/v0.1/appeals/${encodeURIComponent(appeal.appeal_id)}/resolve`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer governance-secret" },
    body: JSON.stringify({ outcome: "overturned", rationale_code: "validator_error" })
  });
  assert.equal(response.status, 201);
  const resolution = await response.json();
  assert.equal(resolution.effect, "prospective_profile_review_only");
  assert.equal(verifyRecord(resolution, importPublicKey(signer.publicKeyPem)), true);
  assert.equal((await store.get({ appealId: appeal.appeal_id, sessionId: "session:test" })).status, "overturned");

  response = await fetch(`${url}/v0.1/appeals/${encodeURIComponent(appeal.appeal_id)}/resolve`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer governance-secret" },
    body: JSON.stringify({ outcome: "upheld", rationale_code: "validator_correct" })
  });
  assert.equal(response.status, 409);
});

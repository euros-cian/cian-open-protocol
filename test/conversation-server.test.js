import test from "node:test";
import assert from "node:assert/strict";
import { createConversationServer, PilotSessionManager } from "../src/index.js";

test("conversation API requires issuer authentication, consent and a session token", async (t) => {
  const calls = [];
  const service = createConversationServer({
    agent: { async handle(input) {
      calls.push(input);
      return {
        response: { text: "Shwmae!", provider: "mock", model: "test" },
        validation: { decision: "QUALIFIES", reward_state: "welsh_use" },
        proof: { proof_id: "proof:test" }
      };
    } },
    sessionIssuerToken: "issuer-secret"
  });
  t.after(() => service.close());
  const url = await service.listen();

  let response = await fetch(`${url}/v0.1/sessions`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ consent: true, notice_version: "pilot-1" })
  });
  assert.equal(response.status, 401);

  response = await fetch(`${url}/v0.1/sessions`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer issuer-secret" },
    body: JSON.stringify({ consent: false, notice_version: "pilot-1" })
  });
  assert.equal(response.status, 400);

  response = await fetch(`${url}/v0.1/sessions`, {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer issuer-secret" },
    body: JSON.stringify({ consent: true, notice_version: "pilot-1", client_id: "client:test" })
  });
  assert.equal(response.status, 201);
  const session = await response.json();

  response = await fetch(`${url}/v0.1/conversations`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ text: "Bore da" })
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.protocol.proof_id, "proof:test");
  assert.equal(calls[0].text, "Bore da");
  assert.equal(calls[0].sessionId, session.session_id);
});

test("session manager expires sessions and enforces a turn window", () => {
  let time = new Date("2026-01-01T00:00:00Z");
  const sessions = new PilotSessionManager({ now: () => time, ttlMs: 1_000, windowMs: 500, maxTurnsPerWindow: 1 });
  const issued = sessions.issue({ consent: true, noticeVersion: "pilot-1" });
  sessions.authorise(issued.token);
  assert.throws(() => sessions.authorise(issued.token), /rate limit/);
  time = new Date("2026-01-01T00:00:00.600Z");
  sessions.authorise(issued.token);
  time = new Date("2026-01-01T00:00:01.001Z");
  assert.throws(() => sessions.authorise(issued.token), /expired/);
});

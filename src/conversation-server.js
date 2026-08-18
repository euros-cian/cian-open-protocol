// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createServer } from "node:http";
import { PilotSessionManager } from "./pilot-session.js";
import { InMemoryAppealStore } from "./appeal-store.js";

const MAX_BODY_BYTES = 32_768;

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("invalid JSON"), { status: 400 }); }
}

function bearer(request) {
  const match = /^Bearer (.+)$/.exec(request.headers.authorization ?? "");
  return match?.[1];
}

function send(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(JSON.stringify(body));
}

export function createConversationServer({ agent, sessionIssuerToken, sessions = new PilotSessionManager(), appeals = new InMemoryAppealStore() } = {}) {
  if (!agent?.handle) throw new Error("conversational agent is required");
  if (!sessionIssuerToken) throw new Error("session issuer token is required");
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);
      if (request.method === "GET" && url.pathname === "/health") {
        return send(response, 200, { status: "ok", protocol_version: "0.1" });
      }
      if (request.method === "POST" && url.pathname === "/v0.1/sessions") {
        if (bearer(request) !== sessionIssuerToken) throw Object.assign(new Error("session issuer authorisation required"), { status: 401 });
        const body = await readJson(request);
        return send(response, 201, await sessions.issue({
          consent: body.consent, noticeVersion: body.notice_version, clientId: body.client_id
        }));
      }
      if (request.method === "POST" && url.pathname === "/v0.1/conversations") {
        const session = await sessions.authorise(bearer(request));
        const body = await readJson(request);
        if (typeof body.text !== "string" || !body.text.trim() || body.text.length > 10_000) {
          throw Object.assign(new Error("text must contain 1 to 10000 characters"), { status: 400 });
        }
        const result = await agent.handle({ sessionId: session.sessionId, text: body.text.trim(), humanOriginAssurance: "H1" });
        return send(response, 200, {
          protocol_version: "0.1", session_id: session.sessionId,
          response: result.response,
          protocol: {
            interaction_id: result.origin_attestation.interaction_id,
            decision: result.validation.decision, reward_state: result.validation.reward_state,
            proof_id: result.proof?.proof_id ?? null
          }
        });
      }
      if (request.method === "DELETE" && url.pathname === "/v0.1/sessions/current") {
        return send(response, 200, await sessions.withdraw(bearer(request)));
      }
      if (request.method === "POST" && url.pathname === "/v0.1/appeals") {
        const session = await sessions.authorise(bearer(request));
        return send(response, 201, await appeals.create({ sessionId: session.sessionId, input: await readJson(request) }));
      }
      if (request.method === "GET" && url.pathname.startsWith("/v0.1/appeals/")) {
        const session = await sessions.authorise(bearer(request));
        const appealId = decodeURIComponent(url.pathname.slice("/v0.1/appeals/".length));
        const appeal = await appeals.get({ appealId, sessionId: session.sessionId });
        return appeal ? send(response, 200, appeal) : send(response, 404, { error: "appeal not found", code: "NOT_FOUND" });
      }
      if (request.method === "POST" && url.pathname === "/v0.1/admin/retention") {
        if (bearer(request) !== sessionIssuerToken) throw Object.assign(new Error("session issuer authorisation required"), { status: 401 });
        const body = await readJson(request);
        return send(response, 200, await sessions.purgeExpired(body.expired_before ? new Date(body.expired_before) : undefined));
      }
      return send(response, 404, { error: "route not found", code: "NOT_FOUND" });
    } catch (error) {
      const status = error.status ?? 400;
      return send(response, status, { error: error.message, code: status === 401 ? "UNAUTHORISED" : status === 429 ? "RATE_LIMITED" : "BAD_REQUEST" });
    }
  });
  return {
    server, sessions, appeals,
    async listen({ host = "127.0.0.1", port = 0 } = {}) {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      const address = server.address();
      return `http://${address.address}:${address.port}`;
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  };
}

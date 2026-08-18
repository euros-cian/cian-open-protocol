// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createServer } from "node:http";
import { digest, importPublicKey, verifyRecord } from "./crypto.js";

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
function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(body));
}

export function createValidatorServer({ validator, trustedGateways, apiToken } = {}) {
  if (!validator?.validate || !apiToken) throw new Error("validator and API token are required");
  const trust = new Map(trustedGateways ?? []);
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);
      if (request.method === "GET" && url.pathname === "/health") {
        return send(response, 200, { status: "ok", protocol_version: "0.1", role: "independent-validator" });
      }
      if (request.method === "POST" && url.pathname === "/v0.1/validate") {
        if (request.headers.authorization !== `Bearer ${apiToken}`) throw Object.assign(new Error("validator authorisation required"), { status: 401 });
        const body = await readJson(request);
        const origin = body.originAttestation;
        const interaction = body.interaction;
        const publicKey = trust.get(origin?.signature?.key_id);
        if (!publicKey || !verifyRecord(origin, importPublicKey(publicKey))) throw Object.assign(new Error("untrusted or invalid gateway attestation"), { status: 401 });
        if (!interaction || interaction.interaction_id !== origin.interaction_id ||
            interaction.interaction_digest !== origin.interaction_digest ||
            digest(interaction.text?.normalize?.("NFC") ?? "") !== origin.interaction_digest) {
          throw Object.assign(new Error("interaction does not match gateway attestation"), { status: 400 });
        }
        return send(response, 200, await validator.validate(body));
      }
      return send(response, 404, { error: "route not found", code: "NOT_FOUND" });
    } catch (error) {
      const status = error.status ?? 400;
      return send(response, status, { error: error.message, code: status === 401 ? "UNAUTHORISED" : "BAD_REQUEST" });
    }
  });
  return {
    server,
    async listen({ host = "127.0.0.1", port = 0 } = {}) {
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host, resolve); });
      const address = server.address();
      return `http://${address.address}:${address.port}`;
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  };
}

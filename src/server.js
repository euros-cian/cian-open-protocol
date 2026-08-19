// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createServer } from "node:http";
import { agentIdFromPublicKey, importPublicKey, verifyRecord } from "./crypto.js";
import { SettlementRegistry } from "./registry.js";
import { createRegistrySigner } from "./registry-signer.js";

const MAX_BODY_BYTES = 1_000_000;

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
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function requireAdmin(request, token) {
  if (!token || request.headers.authorization !== `Bearer ${token}`) {
    throw Object.assign(new Error("admin authorisation required"), { status: 401 });
  }
}

function verifyManifest(manifest) {
  if (manifest.protocol_version !== "0.1") throw Object.assign(new Error("unsupported protocol version"), { status: 400 });
  const publicKey = importPublicKey(manifest.public_key);
  if (agentIdFromPublicKey(publicKey) !== manifest.agent_id) throw Object.assign(new Error("agent_id does not match public key"), { status: 400 });
  if (!verifyRecord(manifest, publicKey)) throw Object.assign(new Error("invalid manifest signature"), { status: 401 });
}

export function createRegistryServer({
  registryId = "registry:local", adminToken, now = () => new Date(), registry,
  registryCredentialsPath, registryPassphrase
} = {}) {
  const publicKeys = new Map();
  const state = registry ?? new SettlementRegistry({
    registryId, now,
    verifySignature(record) {
      const actor = record.from_agent ?? record.holder_agent;
      const key = publicKeys.get(actor);
      return Boolean(key && verifyRecord(record, key));
    }
  });
  const signer = createRegistrySigner({
    registryId, credentialsPath: registryCredentialsPath, passphrase: registryPassphrase
  });

  const server = createServer(async (request, response) => {
    try {
      const base = `http://${request.headers.host ?? "127.0.0.1"}`;
      const url = new URL(request.url, base);

      if (request.method === "GET" && url.pathname === "/health") {
        return send(response, 200, { status: "ok", protocol_version: "0.1", registry_id: registryId });
      }

      if (request.method === "GET" && url.pathname === "/v0.1") {
        return send(response, 200, signer.sign({
          protocol_version: "0.1", registry_id: registryId,
          registry_public_key: signer.publicKeyPem, status: "available"
        }));
      }

      if (request.method === "POST" && url.pathname === "/v0.1/agents/register") {
        const manifest = await readJson(request);
        verifyManifest(manifest);
        publicKeys.set(manifest.agent_id, importPublicKey(manifest.public_key));
        await state.registerAgent({ ...manifest, assurance_level: "A1" });
        return send(response, 201, { agent_id: manifest.agent_id, assurance_level: "A1", status: "registered" });
      }

      if (request.method === "GET" && url.pathname.startsWith("/v0.1/agents/")) {
        const agentId = decodeURIComponent(url.pathname.slice("/v0.1/agents/".length));
        const agent = await state.agent(agentId);
        return agent ? send(response, 200, agent) : send(response, 404, { error: "agent not found", code: "NOT_FOUND" });
      }

      if (request.method === "GET" && url.pathname.startsWith("/v0.1/balances/")) {
        const agentId = decodeURIComponent(url.pathname.slice("/v0.1/balances/".length));
        const seriesId = url.searchParams.get("series_id");
        if (!await state.agent(agentId) || !seriesId) return send(response, 404, { error: "agent or series not found", code: "NOT_FOUND" });
        return send(response, 200, { agent_id: agentId, series_id: seriesId, ...await state.balance(agentId, seriesId) });
      }

      if (request.method === "GET" && url.pathname === "/v0.1/ledger") {
        const seriesId = url.searchParams.get("series_id");
        if (!seriesId) return send(response, 400, { error: "series_id is required", code: "BAD_REQUEST" });
        return send(response, 200, signer.sign(await state.ledgerSummary(seriesId)));
      }

      if (request.method === "POST" && url.pathname === "/v0.1/admin/allocations") {
        requireAdmin(request, adminToken);
        const allocation = await readJson(request);
        await state.allocate(allocation);
        return send(response, 201, { status: "allocated", series_id: allocation.seriesId, count: allocation.allocations.length });
      }

      if (request.method === "POST" && url.pathname === "/v0.1/transfers") {
        const receipt = await state.transfer(await readJson(request));
        return send(response, 201, signer.sign(receipt));
      }

      if (request.method === "GET" && url.pathname.startsWith("/v0.1/transfers/")) {
        const transferId = decodeURIComponent(url.pathname.slice("/v0.1/transfers/".length));
        const event = await state.transferRecord?.(transferId) ?? state.journal?.find(item => item.type === "transfer" && item.transfer_id === transferId);
        return event ? send(response, 200, event) : send(response, 404, { error: "transfer not found", code: "NOT_FOUND" });
      }

      if (request.method === "POST" && url.pathname === "/v0.1/redemptions") {
        const lock = await state.lockRedemption(await readJson(request));
        return send(response, 201, signer.sign(lock));
      }

      if (request.method === "GET" && url.pathname.startsWith("/v0.1/redemptions/")) {
        const redemptionId = decodeURIComponent(url.pathname.slice("/v0.1/redemptions/".length));
        const redemption = await state.redemption(redemptionId);
        return redemption ? send(response, 200, redemption) : send(response, 404, { error: "redemption not found", code: "NOT_FOUND" });
      }

      if (request.method === "POST" && /^\/v0\.1\/admin\/redemptions\/[^/]+\/retire$/.test(url.pathname)) {
        requireAdmin(request, adminToken);
        const redemptionId = decodeURIComponent(url.pathname.split("/")[4]);
        return send(response, 201, signer.sign(await state.retire(redemptionId, await readJson(request))));
      }

      if (request.method === "GET" && url.pathname === "/v0.1/audit") {
        const events = state.auditEvents ? await state.auditEvents() : state.journal;
        return send(response, 200, { registry_id: registryId, events });
      }

      return send(response, 404, { error: "route not found", code: "NOT_FOUND" });
    } catch (error) {
      const status = error.status ?? (/signature|credentialed|authorisation/.test(error.message) ? 401 : /replay|sequence|consumed|insufficient|expired/.test(error.message) ? 409 : 400);
      return send(response, status, { error: error.message, code: status === 409 ? "CONFLICT" : status === 401 ? "UNAUTHORISED" : "BAD_REQUEST" });
    }
  });

  return {
    registry: state,
    signer,
    server,
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

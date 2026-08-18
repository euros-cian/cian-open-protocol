// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createServer } from "node:http";

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw Object.assign(new Error("request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("invalid JSON"), { status: 400 }); }
}
function send(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(body));
}

export function createGovernanceServer({ reviewer, apiToken } = {}) {
  if (!reviewer?.resolve || !apiToken) throw new Error("reviewer and governance API token are required");
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);
      if (request.method === "GET" && url.pathname === "/health") {
        return send(response, 200, { status: "ok", protocol_version: "0.1", role: "appeal-governance" });
      }
      if (request.method === "POST" && /^\/v0\.1\/appeals\/[^/]+\/resolve$/.test(url.pathname)) {
        if (request.headers.authorization !== `Bearer ${apiToken}`) throw Object.assign(new Error("governance authorisation required"), { status: 401 });
        const appealId = decodeURIComponent(url.pathname.split("/")[3]);
        const body = await readJson(request);
        return send(response, 201, await reviewer.resolve({ appealId, outcome: body.outcome, rationaleCode: body.rationale_code }));
      }
      return send(response, 404, { error: "route not found", code: "NOT_FOUND" });
    } catch (error) {
      const status = error.status ?? (/unique|not open/.test(error.message) ? 409 : 400);
      return send(response, status, { error: error.message, code: status === 401 ? "UNAUTHORISED" : status === 409 ? "CONFLICT" : "BAD_REQUEST" });
    }
  });
  return {
    server,
    async listen({ host = "127.0.0.1", port = 0 } = {}) {
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host, resolve); });
      const address = server.address(); return `http://${address.address}:${address.port}`;
    },
    async close() {
      if (!server.listening) return;
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  };
}

// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { appendFile, readFile } from "node:fs/promises";
import { createServer } from "node:http";

const DECISIONS = new Set(["QUALIFIES", "DOES_NOT_QUALIFY", "REVIEW_REQUIRED"]);
const MAX_BODY_BYTES = 4096;
async function readJson(request) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("request body too large"), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("invalid JSON"), { status: 400 }); }
}
function sendJson(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify(body));
}

export function createWelshReviewServer({ cases, reviewerId, outputPath, uiHtml, logoPng, now = () => new Date() }) {
  if (!Array.isArray(cases) || !cases.length || !reviewerId || !outputPath || !uiHtml) throw new Error("cases, reviewerId, outputPath and uiHtml are required");
  const caseById = new Map(cases.map(item => [item.case_id, { case_id: item.case_id, text: item.text, category: item.category }]));
  const completed = new Set();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'", "x-content-type-options": "nosniff" });
        return response.end(uiHtml);
      }
      if (request.method === "GET" && url.pathname === "/cian-ai.png" && logoPng) {
        response.writeHead(200, { "content-type": "image/png", "cache-control": "no-store", "x-content-type-options": "nosniff" });
        return response.end(logoPng);
      }
      if (request.method === "GET" && url.pathname === "/v0.1/review-cases") {
        return sendJson(response, 200, { reviewer_id: reviewerId, cases: [...caseById.values()].map(item => ({ ...item, completed: completed.has(item.case_id) })) });
      }
      if (request.method === "POST" && url.pathname === "/v0.1/reviews") {
        const body = await readJson(request);
        if (!caseById.has(body.case_id) || !DECISIONS.has(body.decision)) throw Object.assign(new Error("invalid case or decision"), { status: 400 });
        if (completed.has(body.case_id)) throw Object.assign(new Error("case already reviewed in this session"), { status: 409 });
        const record = { case_id: body.case_id, reviewer_id: reviewerId, decision: body.decision, role: "reviewer", reviewed_at: now().toISOString() };
        await appendFile(outputPath, `${JSON.stringify(record)}\n`, { encoding: "utf8", flag: "a" });
        completed.add(body.case_id);
        return sendJson(response, 201, { accepted: true, completed: completed.size, total: caseById.size });
      }
      return sendJson(response, 404, { error: "route not found", code: "NOT_FOUND" });
    } catch (error) {
      const status = error.status ?? 500;
      return sendJson(response, status, { error: error.message, code: status === 409 ? "CONFLICT" : "BAD_REQUEST" });
    }
  });
  return {
    async restore() {
      try {
        const records = (await readFile(outputPath, "utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse);
        for (const record of records) if (record.reviewer_id === reviewerId && caseById.has(record.case_id)) completed.add(record.case_id);
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    },
    async listen({ host = "127.0.0.1", port = 8794 } = {}) {
      if (host !== "127.0.0.1") throw new Error("review cockpit is restricted to 127.0.0.1");
      await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, host, resolve); });
      return `http://${host}:${server.address().port}`;
    },
    async close() { if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  };
}

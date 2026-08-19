import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWelshReviewServer } from "../src/index.js";

test("local review cockpit hides labels and records one blinded decision", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cian-review-"));
  const outputPath = join(directory, "reviews.jsonl");
  const service = createWelshReviewServer({
    cases: [{ case_id: "case-1", text: "Bore da", category: "greeting", expected_decision: "QUALIFIES" }],
    reviewerId: "reviewer:test", outputPath, uiHtml: "<h1>Review</h1>", logoPng: Buffer.from("test-logo"), now: () => new Date("2026-08-19T12:00:00Z")
  });
  const address = await service.listen({ port: 0 });
  try {
    const packet = await fetch(`${address}/v0.1/review-cases`).then(response => response.json());
    assert.equal(packet.cases[0].expected_decision, undefined);
    const logo = await fetch(`${address}/cian-ai.png`);
    assert.equal(logo.status, 200);
    assert.equal(logo.headers.get("content-type"), "image/png");
    const response = await fetch(`${address}/v0.1/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: "case-1", decision: "QUALIFIES" }) });
    assert.equal(response.status, 201);
    const duplicate = await fetch(`${address}/v0.1/reviews`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ case_id: "case-1", decision: "QUALIFIES" }) });
    assert.equal(duplicate.status, 409);
    const record = JSON.parse((await readFile(outputPath, "utf8")).trim());
    assert.deepEqual(record, { case_id: "case-1", reviewer_id: "reviewer:test", decision: "QUALIFIES", role: "reviewer", reviewed_at: "2026-08-19T12:00:00.000Z" });
  } finally { await service.close(); await rm(directory, { recursive: true }); }
});

test("review cockpit refuses non-loopback binding", async () => {
  const service = createWelshReviewServer({ cases: [{ case_id: "a", text: "x", category: "x" }], reviewerId: "r", outputPath: "unused", uiHtml: "x" });
  await assert.rejects(service.listen({ host: "0.0.0.0", port: 0 }), /restricted/);
});

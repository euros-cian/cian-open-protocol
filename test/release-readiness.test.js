import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("public alpha remains blocked while mandatory external evidence is absent", () => {
  const checklist = JSON.parse(readFileSync(new URL("../release/public-alpha-readiness.json", import.meta.url)));
  const blockers = checklist.gates.filter(gate => gate.required && !gate.complete);
  assert.equal(checklist.status, "blocked");
  assert.ok(blockers.some(gate => gate.id === "independent_welsh_review"));
  assert.ok(blockers.some(gate => gate.id === "external_security_assessment"));
  assert.ok(checklist.gates.filter(gate => gate.complete).every(gate => gate.evidence));
});

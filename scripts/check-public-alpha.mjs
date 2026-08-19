import { readFileSync } from "node:fs";

const path = new URL("../release/public-alpha-readiness.json", import.meta.url);
const checklist = JSON.parse(readFileSync(path, "utf8"));
const ids = checklist.gates.map(gate => gate.id);
if (ids.length !== new Set(ids).size) throw new Error("release gate IDs must be unique");
for (const gate of checklist.gates) {
  if (typeof gate.required !== "boolean" || typeof gate.complete !== "boolean") throw new Error(`invalid gate: ${gate.id}`);
  if (gate.complete && !gate.evidence) throw new Error(`completed gate lacks evidence: ${gate.id}`);
}
const blockers = checklist.gates.filter(gate => gate.required && !gate.complete);
const derivedStatus = blockers.length ? "blocked" : "ready";
if (checklist.status !== derivedStatus) throw new Error(`declared status ${checklist.status} does not match ${derivedStatus}`);
console.log(`Public alpha ${checklist.release}: ${derivedStatus.toUpperCase()}`);
for (const gate of checklist.gates) console.log(`${gate.complete ? "PASS" : "BLOCK"}  ${gate.id}${gate.evidence ? ` — ${gate.evidence}` : ""}`);
if (blockers.length) console.log(`\n${blockers.length} required gate(s) remain. Publication is not authorised.`);
process.exitCode = blockers.length ? 2 : 0;

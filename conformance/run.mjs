import { createPrivateKey } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  agentIdFromPublicKey, allocateProRata, analyseWelshV2, canonicalize, digest,
  epochBudget, importPublicKey, recognisedCapacity, signRecord, verifyRecord
} from "../src/index.js";

const vectors = JSON.parse(readFileSync(new URL("./vectors-v0.1.json", import.meta.url), "utf8"));
const packageInfo = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const checks = [];
function check(level, requirement, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push({ level, requirement, status: pass ? "PASS" : "FAIL", expected, actual });
}

check("CORE", "canonical JSON", canonicalize(vectors.canonical.input), vectors.canonical.expected);
check("CORE", "UTF-8 SHA-256 digest", digest(vectors.text_digest.input), vectors.text_digest.expected);
const publicKey = importPublicKey(vectors.test_key.public_key);
check("PARTICIPANT", "public-key agent identifier", agentIdFromPublicKey(publicKey), vectors.test_key.agent_id);
check("PARTICIPANT", "Ed25519 signature verification", verifyRecord(vectors.signed_record, publicKey), true);
check("PARTICIPANT", "signature tamper rejection", verifyRecord({ ...vectors.signed_record, sequence: 1 }, publicKey), false);
const unsignedVector = Object.fromEntries(Object.entries(vectors.signed_record).filter(([key]) => key !== "signature"));
check("PARTICIPANT", "deterministic Ed25519 signing", signRecord(unsignedVector, createPrivateKey(vectors.test_key.private_key), vectors.test_key.key_id), vectors.signed_record);
check("REGISTRY", "risk-adjusted recognised capacity", recognisedCapacity(vectors.capacity.commitment), vectors.capacity.recognised);
check("REGISTRY", "compute-backed epoch budget", epochBudget([vectors.capacity.commitment], vectors.capacity.units_per_entitlement), vectors.capacity.budget);
check("REGISTRY", "largest-remainder allocation", allocateProRata(vectors.allocation.proofs, vectors.allocation.budget), vectors.allocation.expected);
for (const [index, item] of vectors.validator_cases.entries()) {
  check("VALIDATOR", `cy-v0.2 decision vector ${index + 1}`, analyseWelshV2(item.text).decision, item.expected);
}
check("GOVERNANCE", "signed appeal resolution", verifyRecord(vectors.appeal_resolution, publicKey), true);
check("GOVERNANCE", "prospective-only resolution effect", vectors.appeal_resolution.effect, "prospective_profile_review_only");

const levels = ["CORE", "PARTICIPANT", "VALIDATOR", "REGISTRY", "GOVERNANCE"].map(level => {
  const selected = checks.filter(item => item.level === level);
  return { level, status: selected.every(item => item.status === "PASS") ? "PASS" : "FAIL", passed: selected.filter(item => item.status === "PASS").length, total: selected.length };
});
const conformant = levels.every(item => item.status === "PASS");
const report = {
  report_format: "cian-conformance-report-v1", protocol_version: vectors.protocol_version,
  vector_set: vectors.vector_set, implementation: packageInfo.name, implementation_version: packageInfo.version,
  runtime: { name: "node", version: process.version, platform: process.platform, architecture: process.arch },
  generated_at: new Date().toISOString(), levels,
  overall: conformant ? "FULL_CONFORMANT" : "NOT_CONFORMANT", checks,
  limitations: [
    "Conformance demonstrates protocol compatibility only.",
    "It is not security certification, linguistic accreditation, legal approval, solvency assurance or production-readiness approval."
  ]
};
const outputIndex = process.argv.indexOf("--output");
const output = resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : "tmp/conformance-report.json");
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`CIAN Protocol ${report.protocol_version} conformance`);
for (const level of levels) console.log(`${level.level.padEnd(12)} ${level.status} (${level.passed}/${level.total})`);
console.log(`Overall      ${report.overall}`);
console.log(`Report       ${output}`);
console.log("Compatibility only — not a security, linguistic, legal or production certification.");
if (!conformant) process.exitCode = 1;

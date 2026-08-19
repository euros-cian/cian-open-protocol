import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProviderOnboardingBundle, createSafeComputeExecutor, validateProviderProfile, verifyRecord, importPublicKey } from "../src/index.js";

const profile = { protocol_version: "0.1", provider_id: "provider:test:outside", organisation: "Outside Test", contact: "operator@example.invalid", resource_class: "local.safe-job.v1", nominal_capacity: 5, assurance_ppm: 900000, availability_ppm: 900000, reserve_ppm: 800000, redemption_endpoint: "https://outside.example.invalid/cian" };
const now = () => new Date("2026-08-19T12:00:00Z");

test("onboarding creates a public signed bundle and encrypted persistent identity", () => {
  const directory = mkdtempSync(join(tmpdir(), "cian-provider-"));
  try {
    const credentialsPath = join(directory, "provider.credentials.json");
    const options = { profile, credentialsPath, passphrase: "outside provider passphrase", availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z", now };
    const first = createProviderOnboardingBundle(options);
    const second = createProviderOnboardingBundle(options);
    assert.equal(first.public_key, second.public_key);
    assert.equal(verifyRecord(first.commitment, importPublicKey(first.public_key)), true);
    assert.equal(first.commitment.redemption_endpoint, profile.redemption_endpoint);
    const disk = readFileSync(credentialsPath, "utf8");
    assert.match(disk, /cian-encrypted-credentials-v1/);
    assert.doesNotMatch(disk, /PRIVATE KEY/);
    assert.equal(JSON.stringify(first).includes("passphrase"), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("provider profiles reject unsafe public HTTP endpoints", () => {
  assert.throws(() => validateProviderProfile({ ...profile, redemption_endpoint: "http://outside.example.invalid" }), /HTTPS/);
  assert.throws(() => validateProviderProfile({ ...profile, nominal_capacity: 1 }), /risk-adjusted/);
  assert.equal(validateProviderProfile({ ...profile, redemption_endpoint: "http://127.0.0.1:8793" }).provider_id, profile.provider_id);
});

test("safe operator executor permits only bounded allowlisted work", async () => {
  const execute = createSafeComputeExecutor();
  assert.equal((await execute({ kind: "utf8-byte-count", text: "Cymru" })).bytes, 5);
  await assert.rejects(execute({ kind: "execute-javascript", source: "process.exit()" }), /not allowlisted/);
  await assert.rejects(createSafeComputeExecutor({ maxInputBytes: 10 })({ kind: "sha256", text: "too long" }), /input limit/);
});

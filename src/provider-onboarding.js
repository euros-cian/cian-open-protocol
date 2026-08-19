// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { digest } from "./crypto.js";
import { recognisedCapacity } from "./allocation.js";
import { LocalComputeProvider } from "./compute-pool.js";
import { createSigningService } from "./signing-service.js";

const MAX_INPUT_BYTES = 65_536;
const PPM_FIELDS = ["assurance_ppm", "availability_ppm", "reserve_ppm"];

function safeEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
}

export function validateProviderProfile(profile) {
  if (!profile || profile.protocol_version !== "0.1") throw new Error("provider profile must use protocol version 0.1");
  if (!/^provider:[a-z0-9][a-z0-9:._-]{2,127}$/i.test(profile.provider_id ?? "")) throw new Error("invalid provider_id");
  if (!/^[a-z0-9][a-z0-9._-]{2,127}$/i.test(profile.resource_class ?? "")) throw new Error("invalid resource_class");
  if (!Number.isSafeInteger(profile.nominal_capacity) || profile.nominal_capacity < 1) throw new Error("nominal_capacity must be a positive safe integer");
  if (!safeEndpoint(profile.redemption_endpoint)) throw new Error("redemption_endpoint must use HTTPS, except for loopback testing");
  for (const field of PPM_FIELDS) if (!Number.isSafeInteger(profile[field]) || profile[field] < 0 || profile[field] > 1_000_000) throw new Error(`${field} must be an integer from 0 to 1000000`);
  if (recognisedCapacity(profile) < 1) throw new Error("risk-adjusted provider capacity must be at least one");
  return structuredClone(profile);
}

export function createProviderOnboardingBundle({ profile, credentialsPath, passphrase, availableFrom, availableUntil, now = () => new Date() } = {}) {
  const validated = validateProviderProfile(profile);
  if (!credentialsPath) throw new Error("encrypted credentialsPath is required");
  const signer = createSigningService({ serviceId: validated.provider_id, credentialsPath, passphrase });
  const provider = new LocalComputeProvider({ signer, resourceClass: validated.resource_class, redemptionEndpoint: validated.redemption_endpoint, now });
  const commitment = provider.createCommitment({
    nominalCapacity: validated.nominal_capacity, availableFrom, availableUntil,
    assurancePpm: validated.assurance_ppm, availabilityPpm: validated.availability_ppm,
    reservePpm: validated.reserve_ppm
  });
  return {
    protocol_version: "0.1", profile: validated, public_key: signer.publicKeyPem,
    commitment, generated_at: now().toISOString()
  };
}

export function createSafeComputeExecutor({ maxInputBytes = MAX_INPUT_BYTES } = {}) {
  if (!Number.isSafeInteger(maxInputBytes) || maxInputBytes < 1 || maxInputBytes > MAX_INPUT_BYTES) throw new Error("invalid safe executor input limit");
  return async workload => {
    if (Buffer.byteLength(JSON.stringify(workload), "utf8") > maxInputBytes) throw new Error("workload exceeds safe executor input limit");
    if (workload?.kind === "sha256" && typeof workload.text === "string") return { kind: "sha256", digest: digest(workload.text) };
    if (workload?.kind === "utf8-byte-count" && typeof workload.text === "string") return { kind: "utf8-byte-count", bytes: Buffer.byteLength(workload.text, "utf8") };
    throw new Error("workload kind is not allowlisted");
  };
}

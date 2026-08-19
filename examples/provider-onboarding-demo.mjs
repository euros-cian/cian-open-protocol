import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ComputeCoordinator, InMemoryComputeJobStore, RemoteComputeProviderClient,
  SettlementRegistry, createComputePoolServer, createProviderOnboardingBundle,
  createSafeComputeExecutor, createSigningService, digest
} from "../src/index.js";

const now = () => new Date("2026-08-19T12:00:00Z");
const directory = mkdtempSync(join(tmpdir(), "cian-provider-onboarding-"));
const credentialsPath = join(directory, "outside-provider.credentials.json");
const passphrase = "demo provider encrypted passphrase";
const profile = {
  protocol_version: "0.1", provider_id: "provider:demo:outside-organisation",
  organisation: "Outside Demonstration Organisation", contact: "operator@example.invalid",
  resource_class: "local.safe-job.v1", nominal_capacity: 10,
  assurance_ppm: 900000, availability_ppm: 900000, reserve_ppm: 800000,
  redemption_endpoint: "http://127.0.0.1:8793"
};

try {
  const bundle = createProviderOnboardingBundle({ profile, credentialsPath, passphrase, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z", now });
  console.log("Public onboarding bundle", { provider_id: bundle.profile.provider_id, resource_class: bundle.profile.resource_class, commitment_id: bundle.commitment.commitment_id, contains_private_key: JSON.stringify(bundle).includes("PRIVATE KEY") });

  const registry = new SettlementRegistry({ now, verifySignature: request => request.signature === "demo-valid" });
  registry.registerAgent("agent:demo:onboarding-holder");
  registry.allocate({ seriesId: "TB-CY-ONBOARDING-DEMO", allocations: [{ proof_id: "proof:onboarding-demo", recipient_agent_id: "agent:demo:onboarding-holder", amount: 2 }] });
  const store = new InMemoryComputeJobStore({ now });
  const coordinator = new ComputeCoordinator({ registry, store, now });
  const apiToken = randomBytes(32).toString("base64url");
  await coordinator.registerProvider({ commitment: bundle.commitment, publicKeyPem: bundle.public_key, apiToken });
  const workload = { kind: "sha256", text: "Darparwr allanol diogel" };
  registry.lockRedemption({ redemption_id: "red:onboarding-demo", holder_agent: "agent:demo:onboarding-holder", series_id: "TB-CY-ONBOARDING-DEMO", amount: 1, sender_sequence: 0, nonce: "nonce-onboarding-demo-0001", workload_digest: digest(workload), resource_classes: [profile.resource_class], expires_at: "2026-08-19T13:00:00Z", signature: "demo-valid" });
  await coordinator.enqueue({ redemptionId: "red:onboarding-demo", workload });

  const service = createComputePoolServer({ coordinator, store, adminToken: "demo-admin-token" });
  const url = await service.listen();
  try {
    const signer = createSigningService({ serviceId: profile.provider_id, credentialsPath, passphrase });
    const client = new RemoteComputeProviderClient({ url, apiToken, signer, resourceClass: profile.resource_class });
    const outcome = await client.runOnce(createSafeComputeExecutor());
    console.log("Outside provider completed", { provider_id: outcome.job.provider_id, status: outcome.job.status, retirement: outcome.retirement.status });
    console.log("MILESTONE_21_PASS");
  } finally { await service.close(); }
} finally {
  rmSync(directory, { recursive: true, force: true });
}

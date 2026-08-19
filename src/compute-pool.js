// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { randomUUID } from "node:crypto";
import { digest, importPublicKey, verifyRecord } from "./crypto.js";
import { recognisedCapacity } from "./allocation.js";

const MAX_INPUT_BYTES = 65_536;

export class LocalComputeProvider {
  constructor({ signer, resourceClass = "local.safe-job.v1", now = () => new Date() } = {}) {
    if (!signer?.sign || !signer?.publicKeyPem || !signer?.serviceId) throw new Error("provider signer is required");
    this.signer = signer;
    this.providerId = signer.serviceId;
    this.publicKeyPem = signer.publicKeyPem;
    this.resourceClass = resourceClass;
    this.now = now;
  }

  createCommitment({ nominalCapacity, availableFrom, availableUntil, assurancePpm = 1_000_000, availabilityPpm = 1_000_000, reservePpm = 1_000_000 } = {}) {
    return this.signer.sign({
      protocol_version: "0.1",
      commitment_id: `commitment:${randomUUID()}`,
      provider_id: this.providerId,
      resource_class: this.resourceClass,
      nominal_capacity: nominalCapacity,
      available_from: availableFrom,
      available_until: availableUntil,
      assurance_ppm: assurancePpm,
      availability_ppm: availabilityPpm,
      reserve_ppm: reservePpm,
      redemption_endpoint: `local://${encodeURIComponent(this.providerId)}`
    });
  }

  async execute({ redemption, workload }) {
    const started = this.now();
    const encoded = Buffer.from(JSON.stringify(workload), "utf8");
    if (encoded.length > MAX_INPUT_BYTES) throw new Error("workload exceeds local provider input limit");
    let result;
    if (workload?.kind === "sha256" && typeof workload.text === "string") {
      result = { kind: "sha256", digest: digest(workload.text) };
    } else if (workload?.kind === "utf8-byte-count" && typeof workload.text === "string") {
      result = { kind: "utf8-byte-count", bytes: Buffer.byteLength(workload.text, "utf8") };
    } else {
      throw new Error("workload kind is not allowlisted");
    }
    const completed = this.now();
    const jobId = `job:${randomUUID()}`;
    return {
      result,
      receipt: this.signer.sign({
        protocol_version: "0.1",
        receipt_id: `receipt:${randomUUID()}`,
        redemption_id: redemption.redemption_id,
        job_id: jobId,
        holder_agent: redemption.holder_agent,
        provider_id: this.providerId,
        resource_class: this.resourceClass,
        metered_quantity: redemption.amount,
        result_digest: digest(result),
        started_at: started.toISOString(),
        completed_at: completed.toISOString(),
        status: "verified"
      })
    };
  }
}

export class ComputePool {
  constructor({ registry, now = () => new Date() } = {}) {
    if (!registry?.redemption || !registry?.retire) throw new Error("settlement registry is required");
    this.registry = registry;
    this.now = now;
    this.providers = new Map();
  }

  registerProvider({ commitment, publicKeyPem, provider }) {
    if (!provider?.execute || provider.providerId !== commitment?.provider_id) throw new Error("provider identity does not match commitment");
    if (!verifyRecord(commitment, importPublicKey(publicKeyPem))) throw new Error("invalid compute commitment signature");
    const now = this.now().getTime();
    const availableFrom = new Date(commitment.available_from).getTime();
    const availableUntil = new Date(commitment.available_until).getTime();
    if (commitment.protocol_version !== "0.1" || typeof commitment.resource_class !== "string" ||
        !Number.isFinite(availableFrom) || !Number.isFinite(availableUntil) || availableFrom > now || availableUntil <= now || availableUntil <= availableFrom) {
      throw new Error("compute commitment is not currently available");
    }
    const capacity = recognisedCapacity(commitment);
    if (capacity < 1) throw new Error("compute commitment has no recognised capacity");
    this.providers.set(commitment.commitment_id, { commitment: structuredClone(commitment), publicKey: importPublicKey(publicKeyPem), provider, remaining: capacity });
    return { commitment_id: commitment.commitment_id, provider_id: commitment.provider_id, recognised_capacity: capacity, remaining_capacity: capacity, status: "available" };
  }

  commitments() {
    return [...this.providers.values()].map(item => ({ ...structuredClone(item.commitment), recognised_capacity: recognisedCapacity(item.commitment), remaining_capacity: item.remaining }));
  }

  async execute({ redemptionId, workload }) {
    const redemption = await this.registry.redemption(redemptionId);
    if (!redemption || redemption.status !== "locked") throw new Error("redemption is not locked");
    if (digest(workload) !== redemption.workload_digest) throw new Error("workload does not match locked redemption digest");
    const now = this.now().getTime();
    const entry = [...this.providers.values()].find(item =>
      redemption.resource_classes.includes(item.commitment.resource_class) &&
      new Date(item.commitment.available_from).getTime() <= now &&
      new Date(item.commitment.available_until).getTime() > now &&
      item.remaining >= redemption.amount
    );
    if (!entry) throw new Error("no recognised compute capacity is available");
    entry.remaining -= redemption.amount;
    try {
      const execution = await entry.provider.execute({ redemption, workload });
      const receipt = execution.receipt;
      if (!verifyRecord(receipt, entry.publicKey) || receipt.redemption_id !== redemptionId ||
          receipt.provider_id !== entry.commitment.provider_id || receipt.holder_agent !== redemption.holder_agent ||
          receipt.resource_class !== entry.commitment.resource_class || receipt.metered_quantity !== redemption.amount ||
          receipt.status !== "verified" || digest(execution.result) !== receipt.result_digest) {
        throw new Error("provider execution receipt failed verification");
      }
      const retirement = await this.registry.retire(redemptionId, receipt);
      return { commitment_id: entry.commitment.commitment_id, result: execution.result, receipt, retirement, remaining_capacity: entry.remaining };
    } catch (error) {
      entry.remaining += redemption.amount;
      throw error;
    }
  }
}

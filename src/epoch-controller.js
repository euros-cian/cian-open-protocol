// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { randomUUID } from "node:crypto";
import { allocateProRata, epochBudget } from "./allocation.js";

export class EpochController {
  constructor({ proofStore, registry, signer, now = () => new Date() }) {
    this.proofStore = proofStore;
    this.registry = registry;
    this.signer = signer;
    this.now = now;
  }

  async close({ seriesId, languageProfile, commitments, computeUnitsPerEntitlement = 1 }) {
    const proofs = await this.proofStore.unconsumed(languageProfile);
    if (!proofs.length) throw new Error("epoch has no accepted proofs");
    const budget = epochBudget(commitments, computeUnitsPerEntitlement);
    if (budget <= 0) throw new Error("epoch has no recognised compute backing");
    const allocations = allocateProRata(proofs, budget);
    const epochId = `epoch:${randomUUID()}`;
    await this.registry.allocate({ seriesId, allocations });
    await this.proofStore.consume(proofs.map(item => item.proof_id), epochId);
    const report = this.signer.sign({
      protocol_version: "0.1", epoch_id: epochId, series_id: seriesId,
      language_profile: languageProfile, budget,
      accepted_proof_count: proofs.length,
      total_weight: proofs.reduce((sum, item) => sum + item.weight, 0),
      allocated_total: allocations.reduce((sum, item) => sum + item.amount, 0),
      allocations, closed_at: this.now().toISOString(), status: "final"
    });
    await this.proofStore.recordEpoch?.(report);
    return report;
  }
}

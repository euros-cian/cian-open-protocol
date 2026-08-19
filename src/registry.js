// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.

function requirePositiveAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("amount must be a positive safe integer");
}

export class SettlementRegistry {
  constructor({ registryId = "registry:local", now = () => new Date(), verifySignature = () => true } = {}) {
    this.registryId = registryId;
    this.now = now;
    this.verifySignature = verifySignature;
    this.agents = new Set();
    this.manifests = new Map();
    this.accounts = new Map();
    this.acceptedIds = new Set();
    this.acceptedNonces = new Set();
    this.consumedProofs = new Set();
    this.redemptions = new Map();
    this.retiredBySeries = new Map();
    this.issuedBySeries = new Map();
    this.journal = [];
  }

  registerAgent(agentOrManifest) {
    const agentId = typeof agentOrManifest === "string" ? agentOrManifest : agentOrManifest.agent_id;
    if (!agentId) throw new Error("agent_id is required");
    this.agents.add(agentId);
    if (typeof agentOrManifest === "object") this.manifests.set(agentId, structuredClone(agentOrManifest));
  }

  agent(agentId) {
    if (!this.agents.has(agentId)) return null;
    return this.manifests.has(agentId) ? structuredClone(this.manifests.get(agentId)) : { agent_id: agentId };
  }

  #key(agentId, seriesId) { return `${agentId}\u0000${seriesId}`; }

  #account(agentId, seriesId) {
    const key = this.#key(agentId, seriesId);
    if (!this.accounts.has(key)) this.accounts.set(key, { balance: 0, locked: 0, sequence: 0 });
    return this.accounts.get(key);
  }

  balance(agentId, seriesId) { return { ...this.#account(agentId, seriesId) }; }

  allocate({ seriesId, allocations }) {
    const proofIds = allocations.map(item => item.proof_id);
    if (new Set(proofIds).size !== proofIds.length || proofIds.some(id => this.consumedProofs.has(id))) throw new Error("proof already consumed or duplicated");
    for (const item of allocations) {
      if (!this.agents.has(item.recipient_agent_id)) throw new Error("recipient is not a credentialed agent");
      if (!Number.isSafeInteger(item.amount) || item.amount < 0) throw new Error("invalid allocation amount");
    }
    for (const item of allocations) {
      this.#account(item.recipient_agent_id, seriesId).balance += item.amount;
      this.issuedBySeries.set(seriesId, (this.issuedBySeries.get(seriesId) ?? 0) + item.amount);
      this.consumedProofs.add(item.proof_id);
    }
    this.journal.push({ type: "allocation", series_id: seriesId, proof_ids: proofIds });
  }

  transfer(request) {
    requirePositiveAmount(request.amount);
    this.#validateRequest(request, request.from_agent, request.transfer_id);
    if (!this.agents.has(request.to_agent)) throw new Error("recipient is not a credentialed agent");
    const sender = this.#account(request.from_agent, request.series_id);
    if (sender.balance - sender.locked < request.amount) throw new Error("insufficient unlocked balance");
    const recipient = this.#account(request.to_agent, request.series_id);
    sender.balance -= request.amount;
    recipient.balance += request.amount;
    sender.sequence += 1;
    this.#consumeRequest(request.transfer_id, request.nonce);
    const receipt = {
      protocol_version: "0.1", settlement_id: `settle:${request.transfer_id}`,
      transfer_id: request.transfer_id, registry_id: this.registryId, series_id: request.series_id,
      from_agent: request.from_agent, to_agent: request.to_agent, amount: request.amount,
      accepted_sender_sequence: request.sender_sequence, next_sender_sequence: sender.sequence,
      committed_at: this.now().toISOString(), status: "final"
    };
    this.journal.push({ type: "transfer", ...receipt });
    return receipt;
  }

  lockRedemption(request) {
    requirePositiveAmount(request.amount);
    this.#validateRequest(request, request.holder_agent, request.redemption_id);
    const account = this.#account(request.holder_agent, request.series_id);
    if (account.balance - account.locked < request.amount) throw new Error("insufficient unlocked balance");
    account.locked += request.amount;
    account.sequence += 1;
    this.#consumeRequest(request.redemption_id, request.nonce);
    this.redemptions.set(request.redemption_id, { ...request, status: "locked" });
    this.journal.push({ type: "redemption_locked", redemption_id: request.redemption_id });
    return { redemption_id: request.redemption_id, status: "locked", amount: request.amount, series_id: request.series_id };
  }

  redemption(redemptionId) {
    const item = this.redemptions.get(redemptionId);
    return item ? structuredClone(item) : null;
  }

  ledgerSummary(seriesId) {
    const accounts = [...this.accounts.entries()].filter(([key]) => key.endsWith(`\u0000${seriesId}`)).map(([key, value]) => ({ agent_id: key.split("\u0000")[0], ...value }));
    const circulating = accounts.reduce((sum, item) => sum + item.balance, 0);
    const locked = accounts.reduce((sum, item) => sum + item.locked, 0);
    const issued = this.issuedBySeries.get(seriesId) ?? 0;
    const retired = this.retiredBySeries.get(seriesId) ?? 0;
    return { protocol_version: "0.1", registry_id: this.registryId, series_id: seriesId, issued_total: issued, circulating_total: circulating, spendable_total: circulating - locked, locked_total: locked, retired_total: retired, conservation_valid: issued === circulating + retired, accounts };
  }

  retire(redemptionId, executionReceipt) {
    const redemption = this.redemptions.get(redemptionId);
    if (!redemption || redemption.status !== "locked") throw new Error("redemption is not locked");
    if (executionReceipt.redemption_id !== redemptionId || executionReceipt.status !== "verified") throw new Error("execution receipt is not verified for this redemption");
    const account = this.#account(redemption.holder_agent, redemption.series_id);
    account.locked -= redemption.amount;
    account.balance -= redemption.amount;
    redemption.status = "retired";
    this.retiredBySeries.set(redemption.series_id, (this.retiredBySeries.get(redemption.series_id) ?? 0) + redemption.amount);
    const record = { retirement_id: `retire:${redemptionId}`, redemption_id: redemptionId, series_id: redemption.series_id, amount: redemption.amount, retired_at: this.now().toISOString(), status: "permanently_retired" };
    this.journal.push({ type: "retirement", ...record });
    return record;
  }

  #validateRequest(request, actor, requestId) {
    if (!this.agents.has(actor)) throw new Error("sender is not a credentialed agent");
    if (!this.verifySignature(request)) throw new Error("invalid signature");
    if (this.acceptedIds.has(requestId) || this.acceptedNonces.has(request.nonce)) throw new Error("replayed request");
    if (new Date(request.expires_at).getTime() <= this.now().getTime()) throw new Error("request expired");
    const account = this.#account(actor, request.series_id);
    if (request.sender_sequence !== account.sequence) throw new Error("unexpected sender sequence");
  }

  #consumeRequest(id, nonce) { this.acceptedIds.add(id); this.acceptedNonces.add(nonce); }
}

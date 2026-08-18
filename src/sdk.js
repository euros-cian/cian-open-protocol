// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createPrivateKey, randomBytes, randomUUID } from "node:crypto";
import {
  agentIdFromPublicKey, exportPrivateKey, exportPublicKey,
  generateAgentKeys, signRecord
} from "./crypto.js";

function nonce() { return randomBytes(18).toString("base64url"); }

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error ?? `Registry request failed with ${response.status}`);
    error.status = response.status;
    error.code = body.code;
    throw error;
  }
  return body;
}

export class AgentClient {
  constructor({ registryUrl, agentId, publicKeyPem, privateKeyPem, endpoint, capabilities = [], languageProfiles = ["cy-v0.1"] }) {
    this.registryUrl = registryUrl.replace(/\/$/, "");
    this.agentId = agentId;
    this.publicKeyPem = publicKeyPem;
    this.privateKey = createPrivateKey(privateKeyPem);
    this.endpoint = endpoint;
    this.capabilities = capabilities;
    this.languageProfiles = languageProfiles;
  }

  static create({ registryUrl, endpoint, capabilities = [], languageProfiles = ["cy-v0.1"] }) {
    const { publicKey, privateKey } = generateAgentKeys();
    const publicKeyPem = exportPublicKey(publicKey);
    return new AgentClient({
      registryUrl, endpoint, capabilities, languageProfiles,
      agentId: agentIdFromPublicKey(publicKey), publicKeyPem,
      privateKeyPem: exportPrivateKey(privateKey)
    });
  }

  exportCredentials() {
    return {
      agent_id: this.agentId,
      public_key: this.publicKeyPem,
      private_key: exportPrivateKey(this.privateKey)
    };
  }

  manifest() {
    const record = {
      protocol_version: "0.1", agent_id: this.agentId, public_key: this.publicKeyPem,
      endpoint: this.endpoint, capabilities: this.capabilities,
      language_profiles: this.languageProfiles, assurance_level: "A0",
      issued_at: new Date().toISOString()
    };
    return signRecord(record, this.privateKey, `${this.agentId}#key-1`);
  }

  register() {
    return jsonRequest(`${this.registryUrl}/v0.1/agents/register`, {
      method: "POST", body: JSON.stringify(this.manifest())
    });
  }

  getBalance(seriesId) {
    return jsonRequest(`${this.registryUrl}/v0.1/balances/${encodeURIComponent(this.agentId)}?series_id=${encodeURIComponent(seriesId)}`);
  }

  async transfer({ recipient, seriesId, amount, taskId, expiresInMs = 60_000 }) {
    const { sequence } = await this.getBalance(seriesId);
    const record = {
      protocol_version: "0.1", transfer_id: `tx:${randomUUID()}`, series_id: seriesId,
      from_agent: this.agentId, to_agent: recipient, amount, sender_sequence: sequence,
      nonce: nonce(), expires_at: new Date(Date.now() + expiresInMs).toISOString()
    };
    if (taskId) record.task_id = taskId;
    const request = signRecord(record, this.privateKey, `${this.agentId}#key-1`);
    const receipt = await jsonRequest(`${this.registryUrl}/v0.1/transfers`, { method: "POST", body: JSON.stringify(request) });
    return { request, receipt };
  }

  async redeem({ seriesId, amount, workload, resourceClasses = ["inference-general-v1"], expiresInMs = 60_000 }) {
    const { sequence } = await this.getBalance(seriesId);
    const record = {
      protocol_version: "0.1", redemption_id: `red:${randomUUID()}`, holder_agent: this.agentId,
      series_id: seriesId, amount, sender_sequence: sequence, nonce: nonce(),
      workload_digest: workload, resource_classes: resourceClasses,
      expires_at: new Date(Date.now() + expiresInMs).toISOString()
    };
    const request = signRecord(record, this.privateKey, `${this.agentId}#key-1`);
    const lock = await jsonRequest(`${this.registryUrl}/v0.1/redemptions`, { method: "POST", body: JSON.stringify(request) });
    return { request, lock };
  }
}

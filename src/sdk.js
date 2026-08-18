// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createPrivateKey, randomBytes, randomUUID } from "node:crypto";
import {
  agentIdFromPublicKey, exportPrivateKey, exportPublicKey,
  generateAgentKeys, importPublicKey, signRecord, verifyRecord
} from "./crypto.js";
import { credentialsExist, loadCredentials, saveCredentials } from "./credentials.js";

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
  constructor({ registryUrl, registryPublicKeyPem, agentId, publicKeyPem, privateKeyPem, endpoint, capabilities = [], languageProfiles = ["cy-v0.1"] }) {
    this.registryUrl = registryUrl.replace(/\/$/, "");
    this.registryPublicKeyPem = registryPublicKeyPem;
    this.agentId = agentId;
    this.publicKeyPem = publicKeyPem;
    this.privateKey = createPrivateKey(privateKeyPem);
    this.endpoint = endpoint;
    this.capabilities = capabilities;
    this.languageProfiles = languageProfiles;
  }

  static create({ registryUrl, registryPublicKeyPem, endpoint, capabilities = [], languageProfiles = ["cy-v0.1"] }) {
    const { publicKey, privateKey } = generateAgentKeys();
    const publicKeyPem = exportPublicKey(publicKey);
    return new AgentClient({
      registryUrl, registryPublicKeyPem, endpoint, capabilities, languageProfiles,
      agentId: agentIdFromPublicKey(publicKey), publicKeyPem,
      privateKeyPem: exportPrivateKey(privateKey)
    });
  }

  static createPersistent({ credentialsPath, passphrase, ...options }) {
    if (credentialsExist(credentialsPath)) {
      const saved = loadCredentials(credentialsPath, passphrase);
      return new AgentClient({ ...options, ...saved });
    }
    const agent = AgentClient.create(options);
    saveCredentials(credentialsPath, {
      agentId: agent.agentId,
      publicKeyPem: agent.publicKeyPem,
      privateKeyPem: exportPrivateKey(agent.privateKey),
      endpoint: agent.endpoint,
      capabilities: agent.capabilities,
      languageProfiles: agent.languageProfiles,
      registryPublicKeyPem: agent.registryPublicKeyPem
    }, passphrase);
    return agent;
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

  async registryInfo() {
    if (!this._registryInfo) this._registryInfo = await jsonRequest(`${this.registryUrl}/v0.1`);
    return this._registryInfo;
  }

  async verifyRegistryRecord(record) {
    const info = await this.registryInfo();
    if (this.registryPublicKeyPem && info.registry_public_key !== this.registryPublicKeyPem) {
      throw new Error("registry public key does not match pinned key");
    }
    const trustedKey = importPublicKey(this.registryPublicKeyPem ?? info.registry_public_key);
    if (!verifyRecord(info, trustedKey)) throw new Error("invalid registry identity signature");
    return verifyRecord(record, trustedKey);
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
    if (!await this.verifyRegistryRecord(receipt)) throw new Error("invalid Settlement Receipt signature");
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
    if (!await this.verifyRegistryRecord(lock)) throw new Error("invalid redemption-lock signature");
    return { request, lock };
  }
}

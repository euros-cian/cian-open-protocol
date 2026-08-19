// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { readFileSync } from "node:fs";
import pg from "pg";
import { importPublicKey, verifyRecord } from "./crypto.js";

const { Pool } = pg;
const migration = [
  readFileSync(new URL("../database/001-durable-registry.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../database/002-language-proof-pipeline.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../database/003-persistent-pilot-sessions.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../database/004-validation-appeals.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../database/005-signed-appeal-resolutions.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../database/006-tristate-validation.sql", import.meta.url), "utf8"),
  readFileSync(new URL("../database/007-compute-pool.sql", import.meta.url), "utf8")
].join("\n");

function positiveAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("amount must be a positive safe integer");
}

function safeNumber(value, field) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error(`${field} exceeds the JavaScript safe-integer range`);
  return number;
}

function databaseError(error) {
  if (error.code === "23505") {
    if (error.constraint?.includes("nonce")) return new Error("replayed request nonce");
    if (error.constraint?.includes("proof")) return new Error("proof already consumed or duplicated");
    return new Error("replayed request");
  }
  return error;
}

export class PostgresSettlementRegistry {
  constructor({ pool, registryId = "registry:postgres", now = () => new Date() }) {
    this.pool = pool;
    this.registryId = registryId;
    this.now = now;
  }

  static async connect({ connectionString, pool, registryId, now, migrate = true } = {}) {
    const ownedPool = pool ?? new Pool({ connectionString, max: 10 });
    if (migrate) await ownedPool.query(migration);
    return new PostgresSettlementRegistry({ pool: ownedPool, registryId, now });
  }

  async close() { await this.pool.end(); }

  async registerAgent(manifest) {
    await this.pool.query(
      `INSERT INTO protocol_agents (agent_id, public_key, manifest, assurance_level)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (agent_id) DO UPDATE SET manifest = EXCLUDED.manifest,
         assurance_level = EXCLUDED.assurance_level
       WHERE protocol_agents.public_key = EXCLUDED.public_key`,
      [manifest.agent_id, manifest.public_key, JSON.stringify(manifest), manifest.assurance_level ?? "A1"]
    );
  }

  async agent(agentId) {
    const result = await this.pool.query("SELECT manifest, assurance_level FROM protocol_agents WHERE agent_id = $1", [agentId]);
    return result.rowCount ? { ...result.rows[0].manifest, assurance_level: result.rows[0].assurance_level } : null;
  }

  async balance(agentId, seriesId) {
    const result = await this.pool.query(
      "SELECT balance, locked, sequence FROM protocol_accounts WHERE agent_id = $1 AND series_id = $2",
      [agentId, seriesId]
    );
    if (!result.rowCount) return { balance: 0, locked: 0, sequence: 0 };
    const row = result.rows[0];
    return { balance: safeNumber(row.balance, "balance"), locked: safeNumber(row.locked, "locked"), sequence: safeNumber(row.sequence, "sequence") };
  }

  async allocate({ seriesId, allocations }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const ids = allocations.map(item => item.proof_id);
      if (new Set(ids).size !== ids.length) throw new Error("proof already consumed or duplicated");
      for (const item of allocations) {
        if (!Number.isSafeInteger(item.amount) || item.amount < 0) throw new Error("invalid allocation amount");
        const agent = await client.query("SELECT 1 FROM protocol_agents WHERE agent_id = $1", [item.recipient_agent_id]);
        if (!agent.rowCount) throw new Error("recipient is not a credentialed agent");
        await client.query(
          "INSERT INTO protocol_consumed_proofs (proof_id, series_id, recipient_agent_id, amount) VALUES ($1, $2, $3, $4)",
          [item.proof_id, seriesId, item.recipient_agent_id, item.amount]
        );
        await client.query(
          `INSERT INTO protocol_accounts (agent_id, series_id, balance) VALUES ($1, $2, $3)
           ON CONFLICT (agent_id, series_id) DO UPDATE SET balance = protocol_accounts.balance + EXCLUDED.balance`,
          [item.recipient_agent_id, seriesId, item.amount]
        );
      }
      await this.#audit(client, "allocation", { series_id: seriesId, proof_ids: ids });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw databaseError(error);
    } finally { client.release(); }
  }

  async transfer(request) {
    positiveAmount(request.amount);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.#verifyRequest(client, request, request.from_agent, request.transfer_id);
      const recipient = await client.query("SELECT 1 FROM protocol_agents WHERE agent_id = $1", [request.to_agent]);
      if (!recipient.rowCount) throw new Error("recipient is not a credentialed agent");
      await this.#ensureAccount(client, request.from_agent, request.series_id);
      await this.#ensureAccount(client, request.to_agent, request.series_id);
      const rows = await client.query(
        `SELECT agent_id, balance, locked, sequence FROM protocol_accounts
         WHERE series_id = $1 AND agent_id = ANY($2::text[]) ORDER BY agent_id FOR UPDATE`,
        [request.series_id, [request.from_agent, request.to_agent]]
      );
      const sender = rows.rows.find(row => row.agent_id === request.from_agent);
      if (safeNumber(sender.sequence, "sequence") !== request.sender_sequence) throw new Error("unexpected sender sequence");
      if (BigInt(sender.balance) - BigInt(sender.locked) < BigInt(request.amount)) throw new Error("insufficient unlocked balance");
      await this.#consumeRequest(client, request.transfer_id, request.nonce, "transfer");
      await client.query("UPDATE protocol_accounts SET balance = balance - $1, sequence = sequence + 1 WHERE agent_id = $2 AND series_id = $3", [request.amount, request.from_agent, request.series_id]);
      await client.query("UPDATE protocol_accounts SET balance = balance + $1 WHERE agent_id = $2 AND series_id = $3", [request.amount, request.to_agent, request.series_id]);
      const committedAt = this.now().toISOString();
      const receipt = {
        protocol_version: "0.1", settlement_id: `settle:${request.transfer_id}`,
        transfer_id: request.transfer_id, registry_id: this.registryId, series_id: request.series_id,
        from_agent: request.from_agent, to_agent: request.to_agent, amount: request.amount,
        accepted_sender_sequence: request.sender_sequence, next_sender_sequence: request.sender_sequence + 1,
        committed_at: committedAt, status: "final"
      };
      await client.query(
        `INSERT INTO protocol_transfers (transfer_id, series_id, from_agent, to_agent, amount,
          accepted_sender_sequence, next_sender_sequence, receipt, committed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [request.transfer_id, request.series_id, request.from_agent, request.to_agent, request.amount,
          request.sender_sequence, request.sender_sequence + 1, JSON.stringify(receipt), committedAt]
      );
      await this.#audit(client, "transfer", receipt);
      await client.query("COMMIT");
      return receipt;
    } catch (error) {
      await client.query("ROLLBACK");
      throw databaseError(error);
    } finally { client.release(); }
  }

  async transferRecord(transferId) {
    const result = await this.pool.query("SELECT receipt FROM protocol_transfers WHERE transfer_id = $1", [transferId]);
    return result.rowCount ? { type: "transfer", ...result.rows[0].receipt } : null;
  }

  async lockRedemption(request) {
    positiveAmount(request.amount);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.#verifyRequest(client, request, request.holder_agent, request.redemption_id);
      await this.#ensureAccount(client, request.holder_agent, request.series_id);
      const result = await client.query(
        "SELECT balance, locked, sequence FROM protocol_accounts WHERE agent_id = $1 AND series_id = $2 FOR UPDATE",
        [request.holder_agent, request.series_id]
      );
      const account = result.rows[0];
      if (safeNumber(account.sequence, "sequence") !== request.sender_sequence) throw new Error("unexpected sender sequence");
      if (BigInt(account.balance) - BigInt(account.locked) < BigInt(request.amount)) throw new Error("insufficient unlocked balance");
      await this.#consumeRequest(client, request.redemption_id, request.nonce, "redemption");
      await client.query("UPDATE protocol_accounts SET locked = locked + $1, sequence = sequence + 1 WHERE agent_id = $2 AND series_id = $3", [request.amount, request.holder_agent, request.series_id]);
      await client.query(
        `INSERT INTO protocol_redemptions (redemption_id, holder_agent, series_id, amount, request, status, locked_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,'locked',$6)`,
        [request.redemption_id, request.holder_agent, request.series_id, request.amount, JSON.stringify(request), this.now().toISOString()]
      );
      const lock = { redemption_id: request.redemption_id, status: "locked", amount: request.amount, series_id: request.series_id };
      await this.#audit(client, "redemption_locked", lock);
      await client.query("COMMIT");
      return lock;
    } catch (error) {
      await client.query("ROLLBACK");
      throw databaseError(error);
    } finally { client.release(); }
  }

  async redemption(redemptionId) {
    const result = await this.pool.query("SELECT request, status FROM protocol_redemptions WHERE redemption_id = $1", [redemptionId]);
    return result.rowCount ? { ...result.rows[0].request, status: result.rows[0].status } : null;
  }

  async ledgerSummary(seriesId) {
    const [issuedResult, accountResult, retiredResult] = await Promise.all([
      this.pool.query("SELECT COALESCE(sum(amount),0) AS total FROM protocol_consumed_proofs WHERE series_id = $1", [seriesId]),
      this.pool.query("SELECT agent_id, balance, locked, sequence FROM protocol_accounts WHERE series_id = $1 ORDER BY agent_id", [seriesId]),
      this.pool.query("SELECT COALESCE(sum(amount),0) AS total FROM protocol_retirements WHERE series_id = $1", [seriesId])
    ]);
    const accounts = accountResult.rows.map(row => ({ agent_id: row.agent_id, balance: safeNumber(row.balance, "balance"), locked: safeNumber(row.locked, "locked"), sequence: safeNumber(row.sequence, "sequence") }));
    const issued = safeNumber(issuedResult.rows[0].total, "issued_total");
    const retired = safeNumber(retiredResult.rows[0].total, "retired_total");
    const circulating = accounts.reduce((sum, item) => sum + item.balance, 0);
    const locked = accounts.reduce((sum, item) => sum + item.locked, 0);
    return { protocol_version: "0.1", registry_id: this.registryId, series_id: seriesId, issued_total: issued, circulating_total: circulating, spendable_total: circulating - locked, locked_total: locked, retired_total: retired, conservation_valid: issued === circulating + retired, accounts };
  }

  async retire(redemptionId, executionReceipt) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT * FROM protocol_redemptions WHERE redemption_id = $1 FOR UPDATE", [redemptionId]);
      if (!result.rowCount || result.rows[0].status !== "locked") throw new Error("redemption is not locked");
      if (executionReceipt.redemption_id !== redemptionId || executionReceipt.status !== "verified") throw new Error("execution receipt is not verified for this redemption");
      const redemption = result.rows[0];
      await client.query(
        `UPDATE protocol_accounts SET locked = locked - $1, balance = balance - $1
         WHERE agent_id = $2 AND series_id = $3`,
        [redemption.amount, redemption.holder_agent, redemption.series_id]
      );
      const retiredAt = this.now().toISOString();
      const record = {
        retirement_id: `retire:${redemptionId}`, redemption_id: redemptionId,
        series_id: redemption.series_id, amount: safeNumber(redemption.amount, "amount"),
        retired_at: retiredAt, status: "permanently_retired"
      };
      await client.query("UPDATE protocol_redemptions SET status = 'retired', retired_at = $1 WHERE redemption_id = $2", [retiredAt, redemptionId]);
      await client.query(
        `INSERT INTO protocol_retirements (retirement_id, redemption_id, series_id, amount, execution_receipt, record, retired_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
        [record.retirement_id, redemptionId, redemption.series_id, redemption.amount, JSON.stringify(executionReceipt), JSON.stringify(record), retiredAt]
      );
      await this.#audit(client, "retirement", record);
      await client.query("COMMIT");
      return record;
    } catch (error) {
      await client.query("ROLLBACK");
      throw databaseError(error);
    } finally { client.release(); }
  }

  async releaseRedemption(redemptionId, failure) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT * FROM protocol_redemptions WHERE redemption_id = $1 FOR UPDATE", [redemptionId]);
      if (!result.rowCount || result.rows[0].status !== "locked") throw new Error("redemption is not locked");
      const redemption = result.rows[0];
      await client.query("UPDATE protocol_accounts SET locked = locked - $1 WHERE agent_id = $2 AND series_id = $3", [redemption.amount, redemption.holder_agent, redemption.series_id]);
      await client.query("UPDATE protocol_redemptions SET status = 'refunded', failure = $1::jsonb WHERE redemption_id = $2", [JSON.stringify(failure), redemptionId]);
      const record = { redemption_id: redemptionId, series_id: redemption.series_id, amount: safeNumber(redemption.amount, "amount"), status: "refunded", failure };
      await this.#audit(client, "redemption_refunded", record);
      await client.query("COMMIT");
      return record;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async auditEvents() {
    const result = await this.pool.query("SELECT event_type AS type, event_data FROM protocol_audit_events ORDER BY event_number");
    return result.rows.map(row => ({ type: row.type, ...row.event_data }));
  }

  async #verifyRequest(client, request, actor, requestId) {
    const result = await client.query("SELECT public_key FROM protocol_agents WHERE agent_id = $1", [actor]);
    if (!result.rowCount) throw new Error("sender is not a credentialed agent");
    if (!verifyRecord(request, importPublicKey(result.rows[0].public_key))) throw new Error("invalid signature");
    if (new Date(request.expires_at).getTime() <= this.now().getTime()) throw new Error("request expired");
    const consumed = await client.query("SELECT 1 FROM protocol_consumed_requests WHERE request_id = $1 OR nonce = $2", [requestId, request.nonce]);
    if (consumed.rowCount) throw new Error("replayed request");
  }

  async #ensureAccount(client, agentId, seriesId) {
    await client.query("INSERT INTO protocol_accounts (agent_id, series_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [agentId, seriesId]);
  }

  async #consumeRequest(client, id, nonce, type) {
    await client.query("INSERT INTO protocol_consumed_requests (request_id, nonce, request_type) VALUES ($1,$2,$3)", [id, nonce, type]);
  }

  async #audit(client, type, data) {
    await client.query("INSERT INTO protocol_audit_events (event_type, event_data) VALUES ($1,$2::jsonb)", [type, JSON.stringify(data)]);
  }
}

// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.

export class InMemoryProofStore {
  constructor() { this.proofs = new Map(); }
  async add(proof) {
    if (this.proofs.has(proof.proof_id)) throw new Error("proof already exists");
    if ([...this.proofs.values()].some(item => item.interaction_id === proof.interaction_id && item.recipient_agent_id === proof.recipient_agent_id && item.language_profile === proof.language_profile)) {
      throw new Error("interaction already has a canonical proof");
    }
    this.proofs.set(proof.proof_id, structuredClone(proof));
  }
  async addBundle({ originAttestation, validationAttestations, proof }) { await this.add(proof); }
  async unconsumed(profile) {
    return [...this.proofs.values()]
      .filter(item => item.status === "unconsumed" && (!profile || item.language_profile === profile))
      .map(item => structuredClone(item));
  }
  async consume(ids, epochId) {
    for (const id of ids) {
      const proof = this.proofs.get(id);
      if (!proof || proof.status !== "unconsumed") throw new Error("proof already consumed or missing");
    }
    for (const id of ids) Object.assign(this.proofs.get(id), { status: "consumed", epoch_id: epochId });
  }
  async get(id) { return this.proofs.has(id) ? structuredClone(this.proofs.get(id)) : null; }
  async recordEpoch() {}
}

export class PostgresProofStore {
  constructor({ pool }) { this.pool = pool; }

  async addBundle({ originAttestation, validationAttestations, proof }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO protocol_attestations (attestation_id, interaction_id, attestation_type, record) VALUES ($1,$2,'origin',$3::jsonb)",
        [originAttestation.attestation_id, originAttestation.interaction_id, JSON.stringify(originAttestation)]
      );
      for (const item of validationAttestations) {
        await client.query(
          "INSERT INTO protocol_attestations (attestation_id, interaction_id, attestation_type, record) VALUES ($1,$2,'validation',$3::jsonb)",
          [item.attestation_id, item.interaction_id, JSON.stringify(item)]
        );
      }
      await client.query(
        `INSERT INTO protocol_language_proofs
          (proof_id, interaction_id, recipient_agent_id, language_profile, weight, record, status)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,'unconsumed')`,
        [proof.proof_id, proof.interaction_id, proof.recipient_agent_id, proof.language_profile, proof.weight, JSON.stringify(proof)]
      );
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async add() { throw new Error("PostgresProofStore requires addBundle with signed attestations"); }

  async unconsumed(profile) {
    const result = await this.pool.query(
      `SELECT p.record FROM protocol_language_proofs p
       WHERE p.status = 'unconsumed' AND ($1::text IS NULL OR p.language_profile = $1)
         AND NOT EXISTS (SELECT 1 FROM protocol_consumed_proofs c WHERE c.proof_id = p.proof_id)
       ORDER BY p.proof_id`,
      [profile ?? null]
    );
    return result.rows.map(row => row.record);
  }

  async consume(ids, epochId) {
    const result = await this.pool.query(
      `UPDATE protocol_language_proofs SET status = 'consumed', epoch_id = $2
       WHERE proof_id = ANY($1::text[]) AND status = 'unconsumed'`,
      [ids, epochId]
    );
    if (result.rowCount !== ids.length) throw new Error("proof already consumed or missing");
  }

  async get(id) {
    const result = await this.pool.query("SELECT record, status, epoch_id FROM protocol_language_proofs WHERE proof_id = $1", [id]);
    return result.rowCount ? { ...result.rows[0].record, status: result.rows[0].status, epoch_id: result.rows[0].epoch_id } : null;
  }

  async recordEpoch(report) {
    await this.pool.query(
      `INSERT INTO protocol_epochs (epoch_id, series_id, language_profile, budget, allocated_total, record, closed_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [report.epoch_id, report.series_id, report.language_profile, report.budget, report.allocated_total, JSON.stringify(report), report.closed_at]
    );
  }
}

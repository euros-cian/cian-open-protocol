# Independent reviewer pack index

Status: **PREPARED FOR REVIEW — NO INDEPENDENT APPROVAL RECORDED**

This index gives independent specialists a stable route through the Cian Open Protocol evidence. Reviewers must identify the exact Git commit, version, environment and date they assessed. Automated tests and statements by the implementation team are evidence inputs, not independent conclusions.

## External security assessor

1. `external-security-assessment-scope.md`
2. `security-evidence-matrix.md`
3. `docs/threat-model.md`
4. `openapi/cian-v0.1.yaml`
5. `database/001-durable-registry.sql` through `database/008-compute-operations.sql`
6. `test/`, `conformance/` and `scripts/scan-secrets.mjs`
7. `SECURITY.md` and `incident-response-plan.md`

Required output: independence declaration, methodology, environment boundary, dated findings, severity, reproduction evidence, remediation disposition and independent retest status.

## Production signing-key specialist

1. `production-key-custody-requirements.md`
2. `key-custody-decision-record.md`
3. `src/crypto.js`, `src/signing-service.js`, `src/registry-signer.js` and `src/credentials.js`
4. Trust-key loading in gateway, validator, proof, epoch, registry and governance paths
5. Incident exercises specified in `incident-response-plan.md`

Required output: approved architecture and provider, access policies, non-exportability evidence, signing compatibility, rotation/revocation/recovery procedure and rehearsal record.

## UK privacy/legal adviser

1. `privacy-legal-review-brief.md`
2. `privacy-data-inventory.md`
3. Conversation, session, validator, appeal, compute and audit implementations
4. Proposed privacy notice, contracts, deployment geography and retention configuration when available
5. Public claims, To Bach classification and Welsh/minority-language governance

Required output: entity/role analysis, applicable-law conclusions, lawful-basis and transparency advice, DPIA determination, retention/rights process, transfer assessment and written classification of public claims and To Bach.

## Recording a conclusion

Use `independent-review-signoff.example.json` as a neutral interchange template. Copy it outside the repository, complete it, and obtain the reviewer's verifiable signature through the agreed professional process. A project maintainer must not self-sign an independent gate.

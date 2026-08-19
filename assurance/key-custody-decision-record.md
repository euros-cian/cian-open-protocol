# Production signing-key custody decision record

Status: **OPEN — NO PRODUCTION PROVIDER OR ARCHITECTURE APPROVED**

The encrypted JSON credentials used by demonstrations are expressly excluded from production approval.

## Roles requiring separate keys

| Role | Current algorithm | Production key selected | Custodian | Rotation/recovery tested |
| --- | --- | --- | --- | --- |
| Settlement Registry | Ed25519 | NO | UNASSIGNED | NO |
| Interaction gateway | Ed25519 | NO | UNASSIGNED | NO |
| Welsh validator(s) | Ed25519 | NO | UNASSIGNED | NO |
| Proof controller | Ed25519 | NO | UNASSIGNED | NO |
| Epoch controller | Ed25519 | NO | UNASSIGNED | NO |
| Appeal governance | Ed25519 | NO | UNASSIGNED | NO |
| Compute provider(s) | Ed25519 | NO | Each provider, subject to admission review | NO |

## Candidate assessment questions

- Does the service provide non-exportable Ed25519 keys with the exact signing semantics required by canonical protocol records?
- Can permissions isolate every role and environment with least privilege?
- Can destructive trust-root changes require dual approval?
- Are all sign and administration operations exported to tamper-resistant monitoring?
- How are public-key transitions distributed without accepting the old and new key ambiguously?
- What happens during regional outage, account compromise, operator loss or provider insolvency?
- Can recovery be rehearsed without exporting private key material?

## Decision fields

- Provider/product: **UNDECIDED**
- Architecture owner: **UNASSIGNED**
- Independent reviewer: **UNAPPOINTED**
- Decision date: **OPEN**
- Approved environments: **NONE**
- Exceptions: **NONE APPROVED**

The `production_key_custody` release gate remains blocked until the architecture, access policy, audit evidence and recovery rehearsal have been independently reviewed and recorded.

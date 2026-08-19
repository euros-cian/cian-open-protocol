# Production signing-key custody requirements

The encrypted JSON credential files used by the demonstrations are not approved
for production. Production architecture must keep private signing material out
of application files, environment variables, logs, backups and developer
workstations.

## Required design

- Generate registry, validator, gateway and governance keys inside a managed KMS
  or HSM-backed service; prefer non-exportable keys.
- Separate keys by role, environment and operator, with least-privilege signing
  permissions and no shared administrator credentials.
- Require strong administrator authentication, protected break-glass access and
  dual approval for destructive or trust-root operations.
- Log every administrative action and signing operation to tamper-resistant,
  monitored audit storage.
- Define rotation, revocation, compromise, recovery and public-key transition
  procedures before launch; rehearse them with test keys.
- Back up configuration and public trust metadata without exporting private key
  material. Test regional/service recovery.
- Record algorithm support explicitly: the protocol currently uses Ed25519, so
  the selected service and SDK must support the required signing semantics or a
  versioned protocol change must be reviewed.

Selection must follow the UK NCSC guidance on protecting private keys and cloud
KMS configuration. A provider marketing claim alone is not evidence; retain the
service configuration, access policy, audit output and recovery-test record.

References:

- https://www.ncsc.gov.uk/collection/cloud/understanding-cloud-services/choosing-and-configuring-a-kms-for-secure-key-management-in-the-cloud
- https://www.ncsc.gov.uk/collection/in-house-public-key-infrastructure/pki-principles/protect-your-private-keys

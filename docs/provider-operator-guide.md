# Cian compute-provider operator guide

This guide is for organisations evaluating the experimental Cian Open Protocol. Participation is not a security, financial, linguistic, legal or production certification.

## Responsibilities

The provider controls its signing key, operating environment and execution infrastructure. The Cian coordinator administrator controls admission to a pool and issues a provider API token through a separate secure channel. The Settlement Registry alone controls the To Bach ledger.

## 1. Prepare a public profile

Copy `examples/provider-profile.example.json` outside the repository and replace the example organisation, contact and provider ID. Use an HTTPS redemption endpoint for any non-local service. Never add passwords, API tokens, database strings or private keys to this file.

Resource classes are exact protocol identifiers. A provider should advertise only execution behavior it actually implements and isolates.

## 2. Create the provider identity

Use a passphrase of at least 12 characters and store the encrypted `*.credentials.json` file outside source control. Cian's `.gitignore` excludes that filename pattern, but operators remain responsible for backups, host access controls and eventual production key custody.

Creating the onboarding bundle generates the identity on the first run and reloads the same identity on later runs. The public bundle contains only the profile, public key and signed commitment.

## 3. Submit and review the public bundle

Send the public bundle to the coordinator administrator. The administrator must verify organisational authority, endpoint ownership, the signed commitment, resource class, capacity and validity window before registration.

The coordinator administrator creates a high-entropy provider API token and delivers it separately. The PostgreSQL coordinator stores only its SHA-256 digest.

## 4. Operate the provider

Load the following only into the provider process environment:

- coordinator HTTPS URL;
- provider API token;
- signing-key passphrase; and
- path to the encrypted credentials file.

The reference safe executor accepts only `sha256` and `utf8-byte-count` jobs with a maximum serialized input of 65,536 bytes. It does not execute code, shell commands or arbitrary models.

## 5. Stop or rotate

Stop claiming new work before maintenance. Leased jobs that time out are safely requeued or refunded by the coordinator. API-token rotation may retain the same signing identity; signing-key replacement requires a new reviewed provider identity because registered keys cannot be silently overwritten.

Production operation remains blocked pending the external security assessment, production key-custody design and privacy/legal review.

# Milestone 14: public developer package

Milestone 14 makes the protocol consumable by an implementation outside this
repository. It prepares—but does not publish—`@cian-ai/open-protocol` version
`0.1.0-alpha.15`.

## Package surface

The package declares ESM and TypeScript entry points and includes implementation
modules, profiles, JSON schemas, SQL migrations, OpenAPI, conformance vectors and
the developer quick start. `publishConfig` requires public access and npm
provenance when a later authorised release is made.

## Local integration stack

Docker Compose starts PostgreSQL 16 and the durable Settlement Registry on port
8787. The registry applies migrations, creates an encrypted persistent signing
identity and exposes health, registration, balance, transfer and redemption
interfaces. Named volumes retain database and credential state.

All Compose passwords and tokens are deliberately public local-development
values. The stack binds a host port and is not suitable for network exposure.

## Third-party participant

The example creates an encrypted Ed25519 identity, signs and registers its
manifest, restores the same agent ID on restart and optionally queries a series
balance. Production integrations must obtain and pin the registry public key
through an authenticated bootstrap.

## Remaining publication boundary

No npm publish or GitHub release occurs in this milestone. Before publication,
the package name/scope must be confirmed, tarball contents reviewed, API stability
declared, release credentials protected and the security/public-alpha checklist
completed.

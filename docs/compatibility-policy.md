# Compatibility and versioning policy

The Cian Open Protocol v0.1 developer preview is experimental.

- Package `0.1.0-alpha.N` releases may change APIs and non-final wire behavior.
- `protocol_version: "0.1"` identifies the current wire family, not production stability.
- Additive optional fields should be ignored safely unless a schema forbids them.
- Removing or redefining a normative field, signature input, identifier, trust rule
  or settlement invariant requires a protocol proposal, migration statement and
  new conformance vectors.
- Implementations must advertise only profiles and capabilities they implement.
- A conformance pass means compatibility with published vectors; it does not imply
  security, linguistic quality, legal compliance or production readiness.

No stable `1.0.0` timeline is promised. Stability requires documented governance,
independent evidence and experience from controlled pilots.

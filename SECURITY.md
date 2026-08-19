# Security policy

This alpha is not production custody software. Do not place valuable compute
commitments or sensitive interaction content into it.

Please use GitHub's private vulnerability-reporting channel when enabled, with the
affected version, reproduction steps and likely impact. Do not include personal
data. Until that channel is enabled, open a minimal issue asking a maintainer for
a private reporting route; do not disclose exploit details publicly.

Production deployments require durable transactional storage, protected signing
keys, independent validators, rate limits, audit journals, recovery procedures,
provider assurance, privacy review and external security testing.

The maintained trust boundaries and known gaps are documented in
[`docs/threat-model.md`](docs/threat-model.md). A passing conformance report is
not a security assessment and must not be represented as one.

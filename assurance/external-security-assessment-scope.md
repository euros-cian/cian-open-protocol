# External security assessment scope

## Objective

Obtain an independent assessment of the reference implementation and proposed
public-alpha deployment. The assessor must be organisationally independent of
the implementation team and provide a written report with severity, evidence,
reproduction steps, remediation advice and retest status.

## In scope

- Gateway, session and cockpit HTTP interfaces
- Independent validator and signed validation path
- Settlement Registry allocation, transfer, redemption and replay controls
- PostgreSQL migrations, transaction isolation and concurrent-spend behaviour
- Agent, registry, validator and governance key lifecycle
- Authentication, authorisation, consent withdrawal and privacy minimisation
- OpenAI/provider boundary, error handling and prompt/data leakage risks
- Package, Docker, GitHub Actions and dependency supply chain
- Governance appeals and immutability guarantees
- Abuse cases: forged origin, replay, double spend, proof reuse, malicious
  payloads, denial of service, key compromise and privileged insider actions

## Required test environments

1. A disposable local/reference environment with test credentials and no real
   personal data or valuable compute commitments.
2. The proposed deployment architecture after key custody, TLS, monitoring and
   access controls are designed.

Production secrets, real conversation content and the owner-approved README
narrative are not assessment test data.

## Acceptance evidence

- Signed scope and assessor independence/conflict declaration
- Methodology and dated report
- No unresolved critical or high findings
- Documented disposition for medium and low findings
- Independent retest of remediated critical/high findings
- Commit hashes, versions and environment boundaries assessed

Automated tests, conformance and dependency audit are inputs, not substitutes
for this assessment.

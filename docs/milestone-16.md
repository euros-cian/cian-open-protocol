# Milestone 16: security and public-alpha gate

Milestone 16 makes release readiness explicit and machine-checkable. It does not
publish npm artifacts, create a GitHub release or expose a service.

Run `npm run release:check`. A blocked result is the correct result while any
required gate lacks evidence. Gates may only be changed through reviewed commits
that link durable evidence; passing a test is not a substitute for an external
security, linguistic, privacy or legal review.

Automated dependency review runs in pull requests, Dependabot proposes monthly
updates, and CI performs a high-severity production dependency audit. The threat
model records assets, trust boundaries, controls and deployment gaps.

Before publication, confirm ownership of the `@cian-ai` npm scope, use a GitHub
protected environment with npm trusted publishing/provenance, require a human
approval, build from a clean tag and verify the tarball again. Long-lived npm
tokens must not be stored in the repository or ordinary CI secrets.

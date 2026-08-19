# Contributing

Thank you for helping Cian develop an open Welsh-first protocol that can be
adapted responsibly for other minority languages. The project welcomes code,
documentation, security, privacy, interoperability and language-governance
contributions. It does not claim to have all the answers.

Open an issue before making a change that affects wire records, trust boundaries,
issuance, settlement or redemption. Small corrections may go directly to a pull
request.

All contributions are submitted under Apache-2.0 unless conspicuously marked
otherwise. By contributing, you confirm that you have the right to submit the
work under those terms.

Protocol changes must include:

- the problem and interoperability impact;
- security, privacy and abuse considerations;
- schema and specification updates;
- tests for normative behaviour; and
- a versioning or migration statement.

## Contribution routes

- Use the bug template for reproducible implementation defects.
- Use the protocol-proposal template for wire, schema, trust or allocation changes.
- Follow `SECURITY.md` rather than opening a public issue for vulnerabilities.
- Do not commit personal conversation content, real credentials, private review
  records or third-party material you cannot license.

## Local checks

Use Node.js 20 or later and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm conformance
pnpm openapi:check
pnpm security:scan
```

The PostgreSQL integration test additionally requires a disposable
`CIAN_TEST_DATABASE_URL`. Never point destructive test setup at a production or
shared database.

## Pull requests

Keep changes focused and explain observable behavior, compatibility impact and
remaining limitations. Maintainers may request changes or decline proposals
that weaken minority-language governance, consent, privacy, ledger conservation
or the separation between validators, providers and settlement.

Passing tests establish compatibility with the current reference vectors only.
They are not security, linguistic, legal or production certification.

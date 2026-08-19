# Milestone 25 — contributor-ready developer preview

Milestone 25 makes the public repository easier and safer for outside developers
to evaluate and contribute to without publishing an npm package.

It adds:

- a five-minute synthetic-data preview;
- expanded contribution, support and community-conduct policies;
- structured bug, protocol-proposal and pull-request templates;
- an explicit compatibility and versioning policy;
- a changelog; and
- a read-only GitHub release-candidate workflow that tests and packs but has no
  package publication command or write permission.

Run:

```powershell
npm run developer:check
```

A pass prints `MILESTONE_25_DEVELOPER_PREVIEW_READY` followed by
`PUBLICATION_BLOCKED`. The second line is intentional: external assurance and
Welsh-review gates still prevent an npm/public production release.

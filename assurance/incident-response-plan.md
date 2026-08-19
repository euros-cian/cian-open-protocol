# Incident response plan

Status: **DRAFT — ACCOUNTABLE OWNER NAMED; SUPPORTING ROLES PENDING**

No public service may launch until one accountable individual and at least one
deputy are named with tested contact routes. Publishing personal contact details
in this public repository is not required; the private contact register should
be referenced by controlled identifier.

## Roles

| Role | Named person | Responsibility |
| --- | --- | --- |
| Accountable incident owner | Euros Evans | Declares incidents, owns decisions and notifications |
| Technical lead | UNASSIGNED | Containment, evidence and remediation |
| Privacy/legal lead | UNASSIGNED | Personal-data and regulatory assessment |
| Communications lead | UNASSIGNED | Accurate user/community updates |
| Deputy/on-call | UNASSIGNED | Cover when primary roles are unavailable |

## Severity and immediate actions

- **Critical:** private signing-key compromise, unauthorised issuance/retirement,
  systemic authentication bypass or material personal-data exposure. Freeze
  affected signing/settlement paths, preserve evidence and invoke break-glass
  governance immediately.
- **High:** exploitable integrity or confidentiality failure without confirmed
  systemic impact. Contain affected component and begin investigation promptly.
- **Medium/Low:** limited or defence-in-depth issue. Track, prioritise and report
  through normal change control.

Never delete evidence, silently rewrite proofs or settlements, or make unverified
public claims. Record timestamps, decisions, affected identifiers, containment,
notifications and recovery validation. Legal/privacy leads determine applicable
notification duties and time limits from the actual facts.

## Exercises required before launch

1. Registry-key compromise and public-key transition
2. Validator compromise producing false qualifications
3. PostgreSQL corruption/recovery without double issuance
4. AI-provider or interaction-text privacy incident
5. Malicious package/release credential compromise

Each exercise needs a dated record, lessons, assigned fixes and a retest.

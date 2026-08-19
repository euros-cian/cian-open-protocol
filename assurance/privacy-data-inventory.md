# Privacy data inventory and flow

Status: factual implementation inventory for qualified UK review; not legal advice, a lawful-basis decision or a completed DPIA.

## Data flow

```text
Human -> consented session -> Cian conversation service -> AI response provider
                         |-> origin gateway -> independent validator
                         |                    -> signed proof (digest/IDs, no clear interaction text)
                         |-> optional appeal -> governance reviewer

To Bach holder -> redemption workload -> compute coordinator -> authenticated provider
                                      -> signed receipt -> Settlement Registry retirement
```

## Inventory

| Data | Recipients/storage in reference implementation | Clear content? | Current minimisation/controls | Retention or legal decision still required |
| --- | --- | --- | --- | --- |
| Interaction text | Conversation service, configured AI response provider, gateway/validator during processing | Yes | Consented session; proof binds a SHA-256 digest rather than embedding text | Provider retention, deployment logs, lawful basis, notice, transfers and deletion |
| Session metadata | Memory or PostgreSQL pilot-session store | No clear text; IDs, consent/notice version, timestamps, turn count, token digest | Expiry, turn limit, withdrawal, purge support; opaque token stored as digest | Final periods, backup deletion and rights handling |
| Origin/validation attestations | Proof pipeline/PostgreSQL | Digest, IDs, assurance, decision and evidence counts | Signed; proof excludes clear interaction text | Linkability, retention, access/objection and research reuse |
| Language proof/epoch allocation | PostgreSQL ledger pipeline | IDs, profile, decision, weight, recipient and amounts | One-time consumption; bounded allocation | Public/private visibility, retention and To Bach legal classification |
| Agent/provider identity | Registry/compute provider tables | Public keys, endpoints, capabilities, organisation/contact where submitted | Public signing material separated from private key; token stored as digest | Controller roles, verification records and contact retention |
| Redemption workload | PostgreSQL compute jobs; authenticated provider after claim | Potentially yes; arbitrary allowlisted input text in reference executor | Digest binding, authenticated lease, public job view omits workload, body limits | Purpose limitation, sensitive-content rules, encryption, deletion period and provider contract |
| Execution receipt/result | PostgreSQL compute/retirement records | Result/digest and operational metadata | Signed receipt; permanent settlement audit | Visibility, retention and dispute process |
| Appeal | PostgreSQL appeal store/governance reviewer | Session/interaction/proof IDs, reason and signed outcome | Session authorisation; prospective-only resolution | Reviewer access, retention, rights and fairness process |
| Operational/security events | Registry audit and compute operations tables | IDs, reason codes, timestamps; no workload in operations snapshot | Admin-only operations API; token digests/workloads omitted | Log retention, access, incident disclosure and employee/operator monitoring |
| Welsh review decisions | Local untracked review JSONL unless deliberately submitted | Case IDs, reviewer ID and decisions | Blinded packet omits provisional labels; local file excluded from package | Reviewer notice, pseudonymisation, research governance and publication policy |

## Known open risks for the reviewer

- PostgreSQL compute jobs currently retain workload JSON; no production retention/deletion schedule is implemented.
- The actual AI provider, hosting regions, subprocessors, logging configuration and contracts are deployment facts, not fixed by this repository.
- Interaction or workload text can contain special-category or third-party data even though the protocol does not require it.
- Digest and stable identifier records may remain linkable and are not automatically anonymous.
- Consent to a pilot interface does not by itself decide every lawful basis or controller/processor role.
- Children, equality, Welsh-language governance, dataset licensing and the legal classification of To Bach need written specialist conclusions.

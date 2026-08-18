# Milestone 4: live conversational agent

Milestone 4 connects a real generative AI model to the protocol gateway.

## Trust sequence

1. The human submits a turn through the conversational interface.
2. The gateway assigns an interaction ID, hashes the text and signs origin evidence.
3. Only after signing does the orchestrator call the model provider.
4. The agent responds with Welsh-first, learner-supportive instructions.
5. The independent validator evaluates the human input, not the model's output.
6. A qualifying turn creates a signed, privacy-minimised Language Proof.
7. Closing the demo epoch consumes its proofs and allocates a finite test balance.

## Provider boundary

`ConversationalProtocolAgent` depends on a minimal `respond` interface and is not
tied to one model vendor. `OpenAIResponsesProvider` is the first adapter and uses
`POST /v1/responses`. Other providers can implement the same interface without
changing gateway, proof or settlement records.

## Live run

Load an API key into the current shell without putting it in source control, then
run `npm run demo:live-agent`. Enter `/close` to close the local epoch.

The default model is `gpt-5.6-luna` and can be changed with `OPENAI_MODEL`. Model
availability depends on the API account. Clear text is sent to the configured
provider; do not use sensitive production conversations in this alpha.

## Remaining boundary

The live terminal uses ephemeral service and agent keys and an in-memory proof
store. A production pilot must use persistent keys, the PostgreSQL proof store,
authenticated user sessions, consent and privacy notices, rate controls, content
retention policy and an independently reviewed Welsh validator.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentClient, createRegistrySigner, importPublicKey, verifyRecord } from "../src/index.js";

test("agent identity survives encrypted credential reload", () => {
  const directory = mkdtempSync(join(tmpdir(), "cian-agent-"));
  try {
    const credentialsPath = join(directory, "agent.credentials.json");
    const options = {
      credentialsPath, passphrase: "correct horse battery staple",
      registryUrl: "http://127.0.0.1:8787", endpoint: "https://persistent-agent.example"
    };
    const first = AgentClient.createPersistent(options);
    const second = AgentClient.createPersistent(options);
    assert.equal(second.agentId, first.agentId);
    assert.equal(second.publicKeyPem, first.publicKeyPem);
    assert.throws(
      () => AgentClient.createPersistent({ ...options, passphrase: "this is the wrong passphrase" }),
      /decryption failed/
    );
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("registry signing identity survives encrypted credential reload", () => {
  const directory = mkdtempSync(join(tmpdir(), "cian-registry-"));
  try {
    const options = {
      registryId: "registry:persistent", credentialsPath: join(directory, "registry.credentials.json"),
      passphrase: "another correct battery staple"
    };
    const first = createRegistrySigner(options);
    const second = createRegistrySigner(options);
    assert.equal(second.publicKeyPem, first.publicKeyPem);
    const receipt = second.sign({ protocol_version: "0.1", settlement_id: "settle:test", status: "final" });
    assert.equal(verifyRecord(receipt, importPublicKey(first.publicKeyPem)), true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

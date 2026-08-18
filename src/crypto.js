// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from "node:crypto";
import { canonicalize, unsignedRecord } from "./canonical.js";

export function digest(value) {
  const bytes = typeof value === "string" ? value : canonicalize(value);
  return `sha256:${createHash("sha256").update(bytes, "utf8").digest("hex")}`;
}

export function generateAgentKeys() {
  return generateKeyPairSync("ed25519");
}

export function exportPublicKey(publicKey) {
  return publicKey.export({ type: "spki", format: "pem" }).toString();
}

export function exportPrivateKey(privateKey) {
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

export function importPublicKey(pem) {
  return createPublicKey(pem);
}

export function agentIdFromPublicKey(publicKeyOrPem) {
  const key = typeof publicKeyOrPem === "string" ? importPublicKey(publicKeyOrPem) : publicKeyOrPem;
  const der = key.export({ type: "spki", format: "der" });
  return `agent:cian:${createHash("sha256").update(der).digest("hex")}`;
}

export function signRecord(record, privateKey, keyId) {
  const bytes = Buffer.from(canonicalize(unsignedRecord(record)));
  return {
    ...unsignedRecord(record),
    signature: {
      algorithm: "Ed25519",
      key_id: keyId,
      value: sign(null, bytes, privateKey).toString("base64url")
    }
  };
}

export function verifyRecord(record, publicKey) {
  if (record.signature?.algorithm !== "Ed25519") return false;
  const bytes = Buffer.from(canonicalize(unsignedRecord(record)));
  return verify(null, bytes, publicKey, Buffer.from(record.signature.value, "base64url"));
}

// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";
import { canonicalize, unsignedRecord } from "./canonical.js";

export function digest(value) {
  const bytes = typeof value === "string" ? value : canonicalize(value);
  return `sha256:${createHash("sha256").update(bytes, "utf8").digest("hex")}`;
}

export function generateAgentKeys() {
  return generateKeyPairSync("ed25519");
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

// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const FORMAT = "cian-encrypted-credentials-v1";

function deriveKey(passphrase, salt) {
  if (typeof passphrase !== "string" || passphrase.length < 12) {
    throw new Error("credential passphrase must contain at least 12 characters");
  }
  return scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
}

export function encryptCredentials(credentials, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return {
    format: FORMAT,
    kdf: { name: "scrypt", N: 16384, r: 8, p: 1, salt: salt.toString("base64url") },
    cipher: { name: "aes-256-gcm", iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") },
    ciphertext: ciphertext.toString("base64url")
  };
}

export function decryptCredentials(envelope, passphrase) {
  if (envelope?.format !== FORMAT) throw new Error("unsupported credential file format");
  const salt = Buffer.from(envelope.kdf.salt, "base64url");
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.cipher.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.cipher.tag, "base64url"));
  try {
    return JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()
    ]).toString("utf8"));
  } catch {
    throw new Error("credential decryption failed");
  }
}

export function saveCredentials(path, credentials, passphrase) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(encryptCredentials(credentials, passphrase), null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* Windows ACLs are managed separately. */ }
}

export function loadCredentials(path, passphrase) {
  return decryptCredentials(JSON.parse(readFileSync(path, "utf8")), passphrase);
}

export function credentialsExist(path) { return existsSync(path); }

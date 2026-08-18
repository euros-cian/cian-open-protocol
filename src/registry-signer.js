// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createPrivateKey } from "node:crypto";
import { credentialsExist, loadCredentials, saveCredentials } from "./credentials.js";
import { exportPrivateKey, exportPublicKey, generateAgentKeys, signRecord } from "./crypto.js";

export function createRegistrySigner({ registryId, credentialsPath, passphrase } = {}) {
  let privateKey;
  let publicKeyPem;
  if (credentialsPath && credentialsExist(credentialsPath)) {
    const saved = loadCredentials(credentialsPath, passphrase);
    if (saved.registryId !== registryId) throw new Error("registry credential belongs to another registry_id");
    privateKey = createPrivateKey(saved.privateKeyPem);
    publicKeyPem = saved.publicKeyPem;
  } else {
    const pair = generateAgentKeys();
    privateKey = pair.privateKey;
    publicKeyPem = exportPublicKey(pair.publicKey);
    if (credentialsPath) {
      saveCredentials(credentialsPath, { registryId, publicKeyPem, privateKeyPem: exportPrivateKey(privateKey) }, passphrase);
    }
  }
  const keyId = `${registryId}#key-1`;
  return {
    registryId, keyId, publicKeyPem,
    sign(record) { return signRecord(record, privateKey, keyId); }
  };
}

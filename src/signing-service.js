// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createPrivateKey } from "node:crypto";
import { credentialsExist, loadCredentials, saveCredentials } from "./credentials.js";
import { exportPrivateKey, exportPublicKey, generateAgentKeys, signRecord } from "./crypto.js";

export function createSigningService({ serviceId, credentialsPath, passphrase } = {}) {
  if (!serviceId) throw new Error("serviceId is required");
  let privateKey;
  let publicKeyPem;
  if (credentialsPath && credentialsExist(credentialsPath)) {
    const saved = loadCredentials(credentialsPath, passphrase);
    if (saved.serviceId !== serviceId) throw new Error("credential belongs to another service_id");
    privateKey = createPrivateKey(saved.privateKeyPem);
    publicKeyPem = saved.publicKeyPem;
  } else {
    const pair = generateAgentKeys();
    privateKey = pair.privateKey;
    publicKeyPem = exportPublicKey(pair.publicKey);
    if (credentialsPath) {
      saveCredentials(credentialsPath, { serviceId, publicKeyPem, privateKeyPem: exportPrivateKey(privateKey) }, passphrase);
    }
  }
  return {
    serviceId, publicKeyPem, keyId: `${serviceId}#key-1`,
    sign(record) { return signRecord(record, privateKey, `${serviceId}#key-1`); }
  };
}

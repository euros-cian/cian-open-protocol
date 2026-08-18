import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createSigningService } from "../src/index.js";

const pilotPassphrase = process.env.CIAN_PILOT_KEY_PASSPHRASE;
const validatorPassphrase = process.env.CIAN_VALIDATOR_KEY_PASSPHRASE;
if (!pilotPassphrase || !validatorPassphrase) {
  console.error("CIAN_PILOT_KEY_PASSPHRASE and CIAN_VALIDATOR_KEY_PASSPHRASE are required.");
  process.exitCode = 1;
} else {
  const pilotDirectory = resolve(process.env.CIAN_PILOT_SECRETS_DIR ?? "secrets/pilot");
  const validatorDirectory = resolve(process.env.CIAN_VALIDATOR_SECRETS_DIR ?? "secrets/validator");
  mkdirSync(pilotDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(validatorDirectory, { recursive: true, mode: 0o700 });
  const gateway = createSigningService({
    serviceId: "gateway:cy:pilot", credentialsPath: join(pilotDirectory, "gateway.credentials.json"), passphrase: pilotPassphrase
  });
  const validator = createSigningService({
    serviceId: "validator:cy:independent", credentialsPath: join(validatorDirectory, "validator.credentials.json"), passphrase: validatorPassphrase
  });
  writeFileSync(join(pilotDirectory, "validator-public.pem"), validator.publicKeyPem, { mode: 0o644 });
  writeFileSync(join(validatorDirectory, "gateway-public.pem"), gateway.publicKeyPem, { mode: 0o644 });
  console.log("Public trust anchors exported. Private credentials remain encrypted in their separate directories.");
}

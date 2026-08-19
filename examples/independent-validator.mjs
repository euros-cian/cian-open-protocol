import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { WelshValidatorV2, createSigningService, createValidatorServer } from "../src/index.js";

const passphrase = process.env.CIAN_VALIDATOR_KEY_PASSPHRASE;
const apiToken = process.env.CIAN_VALIDATOR_API_TOKEN;
if (!passphrase || !apiToken) {
  console.error("CIAN_VALIDATOR_KEY_PASSPHRASE and CIAN_VALIDATOR_API_TOKEN are required.");
  process.exitCode = 1;
} else {
  const directory = resolve(process.env.CIAN_VALIDATOR_SECRETS_DIR ?? "secrets/validator");
  const signer = createSigningService({
    serviceId: "validator:cy:independent", credentialsPath: join(directory, "validator.credentials.json"), passphrase
  });
  const gatewayPublicKey = readFileSync(join(directory, "gateway-public.pem"), "utf8");
  const service = createValidatorServer({
    validator: new WelshValidatorV2({ signer }), apiToken,
    trustedGateways: [["gateway:cy:pilot#key-1", gatewayPublicKey]]
  });
  const address = await service.listen({ host: "127.0.0.1", port: Number(process.env.CIAN_VALIDATOR_PORT ?? 8791) });
  console.log(`Independent Welsh validator listening at ${address}`);
  console.log(`Validator key: ${signer.keyId}`);
  console.log("Clear interaction text is processed in memory and not retained. Press Ctrl+C to stop.");
  const close = async () => { await service.close(); process.exit(0); };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}

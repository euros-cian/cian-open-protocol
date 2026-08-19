import { readFileSync } from "node:fs";
import { parse } from "yaml";
const document = parse(readFileSync(new URL("../openapi/cian-v0.1.yaml", import.meta.url), "utf8"));
if (document.openapi !== "3.1.0") throw new Error("OpenAPI document must declare version 3.1.0");
if (!document.info?.title || !document.info?.version) throw new Error("OpenAPI info is incomplete");
if (!document.paths || Object.keys(document.paths).length < 10) throw new Error("OpenAPI path coverage is incomplete");
for (const [path, item] of Object.entries(document.paths)) {
  if (!path.startsWith("/")) throw new Error(`invalid OpenAPI path: ${path}`);
  if (!item || typeof item !== "object") throw new Error(`invalid OpenAPI path item: ${path}`);
}
console.log(`OpenAPI 3.1 contract valid: ${Object.keys(document.paths).length} paths`);

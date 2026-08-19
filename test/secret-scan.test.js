import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("tracked repository contains no unapproved secret patterns", () => {
  const output = execFileSync(process.execPath, ["scripts/scan-secrets.mjs"], { encoding: "utf8" });
  assert.match(output, /Secret scan passed/);
});

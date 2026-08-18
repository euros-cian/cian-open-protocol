import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Language Proof table is created before its index", () => {
  const sql = readFileSync(new URL("../database/002-language-proof-pipeline.sql", import.meta.url), "utf8");
  const table = sql.indexOf("CREATE TABLE IF NOT EXISTS protocol_language_proofs");
  const index = sql.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS protocol_language_proofs_one_interaction");
  assert.ok(table >= 0, "Language Proof table migration is present");
  assert.ok(index > table, "Language Proof index is created after its table");
});

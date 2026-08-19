import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("developer-preview workflow is read-only and cannot publish",()=>{
  const workflow=readFileSync(new URL("../.github/workflows/release-candidate.yml",import.meta.url),"utf8");
  assert.doesNotMatch(workflow,/\b(?:npm|pnpm|yarn)\s+publish\b/i);
  assert.doesNotMatch(workflow,/^\s*(?:packages|id-token|contents):\s*write\s*$/mi);
  assert.match(workflow,/contents: read/);
  const readiness=JSON.parse(readFileSync(new URL("../release/public-alpha-readiness.json",import.meta.url),"utf8"));
  assert.equal(readiness.status,"blocked");
  assert.ok(readiness.gates.some(gate=>gate.required&&!gate.complete));
});

test("contribution paths protect secrets, protocol compatibility and community governance",()=>{
  const contributing=readFileSync(new URL("../CONTRIBUTING.md",import.meta.url),"utf8");
  assert.match(contributing,/SECURITY\.md/);assert.match(contributing,/language-governance/);assert.match(contributing,/private review/);
  const proposal=readFileSync(new URL("../.github/ISSUE_TEMPLATE/protocol-proposal.yml",import.meta.url),"utf8");
  assert.match(proposal,/Compatibility and migration/);assert.match(proposal,/language-governance/);
  const preview=readFileSync(new URL("../docs/developer-preview.md",import.meta.url),"utf8");
  assert.match(preview,/Do not install an unofficial package/);
});

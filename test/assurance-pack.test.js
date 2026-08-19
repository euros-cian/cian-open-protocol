import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("independent-review pack is complete but cannot self-approve external gates", () => {
  const readiness=JSON.parse(readFileSync(new URL("../release/public-alpha-readiness.json",import.meta.url),"utf8"));
  for(const id of ["external_security_assessment","production_key_custody","privacy_and_legal_review"]){
    const gate=readiness.gates.find(item=>item.id===id);assert.equal(gate.complete,false);assert.match(gate.evidence,/pending/i);
  }
  const signoff=JSON.parse(readFileSync(new URL("../assurance/independent-review-signoff.example.json",import.meta.url),"utf8"));
  assert.equal(signoff.conclusion,"not_approved");assert.match(signoff.reviewer_name,/REPLACE/);
  const inventory=readFileSync(new URL("../assurance/privacy-data-inventory.md",import.meta.url),"utf8");
  assert.match(inventory,/retain workload JSON/);assert.match(inventory,/not automatically anonymous/);
  const custody=readFileSync(new URL("../assurance/key-custody-decision-record.md",import.meta.url),"utf8");
  assert.match(custody,/NO PRODUCTION PROVIDER OR ARCHITECTURE APPROVED/);
});

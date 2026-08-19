import { readFileSync } from "node:fs";

const required = [
  "assurance/reviewer-pack-index.md",
  "assurance/external-security-assessment-scope.md",
  "assurance/security-evidence-matrix.md",
  "assurance/production-key-custody-requirements.md",
  "assurance/key-custody-decision-record.md",
  "assurance/privacy-legal-review-brief.md",
  "assurance/privacy-data-inventory.md",
  "assurance/independent-review-signoff.schema.json",
  "assurance/independent-review-signoff.example.json"
];
for (const file of required) {
  const text=readFileSync(new URL(`../${file}`,import.meta.url),"utf8");
  if(text.trim().length<100)throw new Error(`assurance artifact is missing or incomplete: ${file}`);
}
const readiness=JSON.parse(readFileSync(new URL("../release/public-alpha-readiness.json",import.meta.url),"utf8"));
for(const id of ["external_security_assessment","production_key_custody","privacy_and_legal_review"]){
  const gate=readiness.gates.find(item=>item.id===id);
  if(!gate||gate.complete!==false)throw new Error(`${id} must remain blocked until genuine independent evidence is reviewed`);
}
const template=JSON.parse(readFileSync(new URL("../assurance/independent-review-signoff.example.json",import.meta.url),"utf8"));
if(template.conclusion!=="not_approved"||!String(template.reviewer_name).includes("REPLACE"))throw new Error("example sign-off must not resemble a completed approval");
const privacy=readFileSync(new URL("../assurance/privacy-data-inventory.md",import.meta.url),"utf8");
for(const disclosure of ["retain workload JSON","not automatically anonymous","does not by itself decide every lawful basis"]){if(!privacy.includes(disclosure))throw new Error(`privacy inventory lacks disclosure: ${disclosure}`);}
console.log("MILESTONE_24_PACK_READY");
console.log("External security, key custody and privacy/legal gates remain BLOCKED pending independent signed evidence.");

import { readFileSync } from "node:fs";

const required=[
  "CONTRIBUTING.md","CODE_OF_CONDUCT.md","SUPPORT.md","CHANGELOG.md",
  "docs/developer-preview.md","docs/developer-quickstart.md","docs/compatibility-policy.md",
  ".github/ISSUE_TEMPLATE/bug.yml",".github/ISSUE_TEMPLATE/protocol-proposal.yml",
  ".github/ISSUE_TEMPLATE/config.yml",".github/pull_request_template.md",
  ".github/workflows/test.yml",".github/workflows/dependency-review.yml",
  ".github/workflows/release-candidate.yml"
];
for(const file of required){const text=readFileSync(new URL(`../${file}`,import.meta.url),"utf8");if(text.trim().length<40)throw new Error(`developer-preview artifact missing or incomplete: ${file}`);}
const workflow=readFileSync(new URL("../.github/workflows/release-candidate.yml",import.meta.url),"utf8");
if(/\b(?:npm|pnpm|yarn)\s+publish\b/i.test(workflow))throw new Error("release-candidate workflow must not publish packages");
if(/^\s*(?:packages|id-token|contents):\s*write\s*$/mi.test(workflow))throw new Error("release-candidate workflow must not have write permissions");
const readiness=JSON.parse(readFileSync(new URL("../release/public-alpha-readiness.json",import.meta.url),"utf8"));
const blockers=readiness.gates.filter(gate=>gate.required&&!gate.complete);
if(readiness.status!=="blocked"||blockers.length===0)throw new Error("developer preview must remain non-publishable while external gates are open");
console.log("MILESTONE_25_DEVELOPER_PREVIEW_READY");
console.log(`PUBLICATION_BLOCKED — ${blockers.length} required gate(s) remain.`);

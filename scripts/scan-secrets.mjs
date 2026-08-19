import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rules = [
  ["OpenAI-style key", /\bsk-[A-Za-z0-9_-]{20,}/g],
  ["npm token", /\bnpm_[A-Za-z0-9]{20,}/g],
  ["GitHub token", /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/g],
  ["JWT-like token", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ["PEM private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g]
];
const allowed = new Set(["PEM private key:conformance/vectors-v0.1.json"]);
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const findings = [];
for (const path of tracked) {
  let text;
  try { text = readFileSync(path, "utf8"); } catch { continue; }
  for (const [name, pattern] of rules) {
    pattern.lastIndex = 0;
    if (pattern.test(text) && !allowed.has(`${name}:${path.replaceAll("\\", "/")}`)) findings.push({ rule: name, path });
  }
}
if (findings.length) {
  console.error("Potential secrets detected (values suppressed):");
  for (const finding of findings) console.error(`- ${finding.rule}: ${finding.path}`);
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed: ${tracked.length} tracked files; approved public test fixture excluded.`);
}

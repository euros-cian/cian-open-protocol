import { mkdir, readFile, writeFile } from "node:fs/promises";
import { analyseWelshV2, assessWelshReview, createBlindReviewPacket } from "../src/index.js";

const loadJsonl = async path => (await readFile(path, "utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const cases = await loadJsonl(new URL("../evaluation/cy-v0.2.seed.jsonl", import.meta.url));
const reviewUrl = new URL("../evaluation/cy-v0.2.reviews.jsonl", import.meta.url);
let reviews = [];
try { reviews = await loadJsonl(reviewUrl); } catch (error) { if (error.code !== "ENOENT") throw error; }
await mkdir(new URL("../tmp/", import.meta.url), { recursive: true });
const packet = createBlindReviewPacket(cases);
await writeFile(new URL("../tmp/cy-v0.2-blind-review.json", import.meta.url), `${JSON.stringify(packet, null, 2)}\n`);
const report = assessWelshReview({ cases, reviews, analyser: analyseWelshV2 });
await writeFile(new URL("../tmp/cy-v0.2-review-report.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  packet: "tmp/cy-v0.2-blind-review.json",
  report: "tmp/cy-v0.2-review-report.json",
  ...Object.fromEntries(["total_cases", "reviewer_count", "reviewed_cases", "awaiting_review", "needs_adjudication", "agreement_ppm", "independent_review_complete", "production_claim_allowed"].map(key => [key, report[key]]))
}, null, 2));
if (!report.independent_review_complete) console.error("\nIndependent review is not complete. Send the blind packet to at least two fluent Welsh reviewers; do not disclose validator outputs.");

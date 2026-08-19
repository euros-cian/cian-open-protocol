import { readFile } from "node:fs/promises";
import { createWelshReviewServer } from "../src/index.js";

const reviewerId = process.env.CIAN_WELSH_REVIEWER_ID;
if (!reviewerId) throw new Error("CIAN_WELSH_REVIEWER_ID is required (use a stable pseudonymous ID)");
const cases = (await readFile(new URL("../evaluation/cy-v0.2.seed.jsonl", import.meta.url), "utf8")).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const uiHtml = await readFile(new URL("../review-ui/index.html", import.meta.url), "utf8");
const logoPng = await readFile(new URL("../public/brand/cian-ai.png", import.meta.url));
const outputPath = new URL("../evaluation/cy-v0.2.reviews.jsonl", import.meta.url);
const service = createWelshReviewServer({ cases, reviewerId, outputPath, uiHtml, logoPng });
await service.restore();
const address = await service.listen({ port: Number(process.env.CIAN_WELSH_REVIEW_PORT ?? 8794) });
console.log(`Blinded Welsh review cockpit: ${address}`);
console.log(`Reviewer: ${reviewerId}`);
console.log("Press Ctrl+C after the cockpit says Wedi gorffen.");
const close = async () => { await service.close(); process.exit(0); };
process.once("SIGINT", close); process.once("SIGTERM", close);

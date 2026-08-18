const $ = selector => document.querySelector(selector);
const stages = [...document.querySelectorAll("[data-stage]")];
let token;
let currentProtocol;
let proofs = 0;

function stage(name, state, detail) {
  const item = document.querySelector(`[data-stage="${name}"]`);
  item.classList.remove("active", "done");
  if (state) item.classList.add(state);
  if (detail) item.querySelector("small").textContent = detail;
}
function resetStages() { stages.forEach(item => item.classList.remove("active", "done")); }
function message(text, type) {
  const el = document.createElement("div"); el.className = `message ${type}`; el.textContent = text;
  $("#messages").append(el); el.scrollIntoView({ behavior: "smooth" });
}
function evidence(protocol) {
  const rows = [
    ["Decision", protocol.decision], ["Reward state", protocol.reward_state],
    ["Interaction", protocol.interaction_id], ["SHA-256 digest", protocol.interaction_digest],
    ["Origin attestation", protocol.origin_attestation_id], ["Validator", protocol.validator_id],
    ["Validation attestation", protocol.validation_attestation_id], ["Language Proof", protocol.proof_id ?? "No proof issued"],
    ["Persistence", protocol.persistence]
  ];
  $("#evidence").innerHTML = rows.map(([key,value]) => `<dt>${key}</dt><dd>${escapeHtml(value ?? "—")}</dd>`).join("");
}
function escapeHtml(value) { const div=document.createElement("div"); div.textContent=String(value); return div.innerHTML; }

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

try {
  const health = await json("/health");
  $("#systemStatus").textContent = `${health.validator_mode === "independent" ? "Independent validator" : "Validator fallback"} · ${health.persistence}`;
  $(".status").classList.add("live");
} catch { $("#systemStatus").textContent = "Protocol unavailable"; }

$("#begin").addEventListener("click", async () => {
  if (!$("#consent").checked) return alert("Please confirm consent before beginning.");
  $("#begin").disabled = true;
  try {
    const session = await json("/v0.1/demo/session", { method: "POST", body: JSON.stringify({ consent: true }) });
    token = session.token; $("#consentPanel").classList.add("hidden"); $("#cockpit").classList.remove("hidden");
    $("#sessionBadge").textContent = `Consented · expires ${new Date(session.expires_at).toLocaleTimeString()}`;
  } catch (error) { alert(error.message); $("#begin").disabled = false; }
});

$("#chatForm").addEventListener("submit", async event => {
  event.preventDefault(); const text = $("#message").value.trim(); if (!text) return;
  $("#message").value = ""; message(text, "user"); resetStages();
  stage("gateway", "active", "Signing origin digest…");
  const button = event.currentTarget.querySelector("button"); button.disabled = true;
  try {
    await new Promise(resolve => setTimeout(resolve, 260)); stage("gateway", "done", "Ed25519 origin signed"); stage("agent", "active", "Generating response…");
    const result = await json("/v0.1/conversations", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) });
    stage("agent", "done", `${result.response.provider} · ${result.response.model}`); message(result.response.text, "agent");
    stage("validator", "active", "Checking signed evidence…"); await new Promise(resolve => setTimeout(resolve, 320));
    stage("validator", "done", `${result.protocol.decision} · independent`);
    currentProtocol = result.protocol; evidence(currentProtocol);
    if (result.protocol.proof_id) {
      stage("proof", "done", result.protocol.reward_state); stage("database", "done", "Proof persisted");
      proofs += 1; $("#proofCount").textContent = proofs; $("#appeal").classList.remove("hidden");
    } else { stage("proof", "", "No qualifying proof"); stage("database", "done", "Decision completed"); }
  } catch (error) { message(error.message, "error"); resetStages(); }
  finally { button.disabled = false; }
});

$("#appeal").addEventListener("click", async () => {
  if (!currentProtocol) return;
  try {
    const appeal = await json("/v0.1/appeals", {
      method: "POST", headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ interaction_id: currentProtocol.interaction_id, proof_id: currentProtocol.proof_id,
        language_profile: "cy-v0.1", disputed_decision: currentProtocol.decision, reason_code: "other" })
    });
    $("#appeal").textContent = `Appeal open · ${appeal.appeal_id.slice(-8)}`; $("#appeal").disabled = true;
  } catch (error) { alert(error.message); }
});

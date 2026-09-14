const STORAGE_KEY = "florivo-step-calibration-v1";

const $ = (id) => document.getElementById(id);
const dateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const currentTime = () => new Intl.DateTimeFormat("uk-UA", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function todayRecord() {
  const all = loadAll();
  const day = dateKey();
  return { all, day, rec: all[day] || { whoop_total: null, checkpoints: [], ai_estimate: null } };
}

function fmt(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)).toLocaleString("uk-UA") : "—";
}

function render() {
  const { rec } = todayRecord();
  const whoop = Number(rec.whoop_total);
  const latest = rec.checkpoints?.length ? rec.checkpoints[rec.checkpoints.length - 1] : null;
  const manual = latest ? Number(latest.steps) : NaN;
  const ai = Number(rec.ai_estimate);

  $("whoopStepsValue").textContent = fmt(whoop);
  $("manualLatestValue").textContent = fmt(manual);
  $("manualLatestTime").textContent = latest?.time || "—";
  $("aiStepsValue").textContent = fmt(ai);

  const remainder = Number.isFinite(whoop) && Number.isFinite(manual) ? Math.max(0, whoop - manual) : NaN;
  $("remainingStepsValue").textContent = fmt(remainder);

  const list = $("stepCheckpointList");
  list.replaceChildren();
  for (const item of [...(rec.checkpoints || [])].reverse().slice(0, 8)) {
    const row = document.createElement("div");
    row.className = "step-log-row";
    const time = document.createElement("span");
    time.textContent = item.time || "—";
    const value = document.createElement("b");
    value.textContent = `${fmt(item.steps)} кроків`;
    row.append(time, value);
    list.append(row);
  }
  $("stepHistoryBlock").hidden = !rec.checkpoints?.length;
}

function setDefaultTime(force = false) {
  const input = $("manualStepTime");
  if (input && (force || !input.value)) input.value = currentTime();
}

window.addEventListener("DOMContentLoaded", () => {
  const saveBtn = $("saveManualSteps");
  const manualInput = $("manualStepsInput");
  const timeInput = $("manualStepTime");
  const whoopInput = $("whoopStepsInput");
  const saveWhoopBtn = $("saveWhoopSteps");

  setDefaultTime();
  render();

  manualInput?.addEventListener("input", () => {
    setDefaultTime(true);
  });

  saveBtn?.addEventListener("click", () => {
    const steps = Number(manualInput.value);
    const time = timeInput.value;
    if (!Number.isFinite(steps) || steps < 0 || !time) return;
    const { all, day, rec } = todayRecord();
    rec.checkpoints = Array.isArray(rec.checkpoints) ? rec.checkpoints : [];
    rec.checkpoints.push({ time, steps: Math.round(steps), saved_at: new Date().toISOString() });
    rec.checkpoints.sort((a, b) => String(a.time).localeCompare(String(b.time)));
    all[day] = rec;
    saveAll(all);
    manualInput.value = "";
    render();
  });

  saveWhoopBtn?.addEventListener("click", () => {
    const value = Number(whoopInput.value);
    if (!Number.isFinite(value) || value < 0) return;
    const { all, day, rec } = todayRecord();
    rec.whoop_total = Math.round(value);
    all[day] = rec;
    saveAll(all);
    whoopInput.value = "";
    render();
  });
});

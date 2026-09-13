import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ttvlgfzvgjcbomdlddbn.supabase.co";
const SUPABASE_KEY = "sb_publishable_30IrLFbkHE4cPXmu-hJoQA_u_sFSg3Y";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/healthlab-morning-v1`;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const quick = document.createElement("button");
quick.type = "button";
quick.className = "morning-quick";
quick.textContent = "☀ Проснувся";
quick.hidden = true;
quick.setAttribute("aria-label", "Ранкова оцінка");
document.querySelector(".top-actions")?.prepend(quick);

const overlay = document.createElement("div");
overlay.className = "morning-overlay";
overlay.hidden = true;
overlay.innerHTML = `
  <section class="morning-card" role="dialog" aria-modal="true" aria-labelledby="morningTitle">
    <div class="morning-head">
      <div id="morningTitle" class="morning-title">Ранкова оцінка</div>
      <button class="morning-close" type="button" aria-label="Закрити">×</button>
    </div>
    <p class="morning-sub">Три базові оцінки + короткий опис. Згодом Florivo зможе запропонувати персональні додаткові метрики з повторюваних описів.</p>
    <div class="morning-row">
      <div class="morning-label"><span>Якість сну</span><span class="morning-value" data-value-for="sleepQuality">5</span></div>
      <input id="sleepQuality" type="range" min="0" max="10" step="1" value="5">
    </div>
    <div class="morning-row">
      <div class="morning-label"><span>Ранкова енергія</span><span class="morning-value" data-value-for="energy">5</span></div>
      <input id="energy" type="range" min="0" max="10" step="1" value="5">
    </div>
    <div class="morning-row">
      <div class="morning-label"><span>Сонливість</span><span class="morning-value" data-value-for="sleepiness">5</span></div>
      <input id="sleepiness" type="range" min="0" max="10" step="1" value="5">
    </div>
    <label class="morning-label" for="morningNotes"><span>Що відчуваєш / що було незвичного?</span></label>
    <textarea id="morningNotes" class="morning-notes" maxlength="2000" placeholder="Наприклад: прокидався кілька разів, важка голова, спина болить, навпаки дуже добре виспався…"></textarea>
    <div class="morning-actions">
      <button class="morning-save" type="button">Зберегти</button>
    </div>
    <div class="morning-status" aria-live="polite"></div>
  </section>`;
document.body.append(overlay);

const closeBtn = overlay.querySelector(".morning-close");
const saveBtn = overlay.querySelector(".morning-save");
const status = overlay.querySelector(".morning-status");
const notes = overlay.querySelector("#morningNotes");
const scoreIds = ["sleepQuality", "energy", "sleepiness"];

function syncValues() {
  for (const id of scoreIds) {
    const input = overlay.querySelector(`#${id}`);
    const out = overlay.querySelector(`[data-value-for="${id}"]`);
    out.textContent = input.value;
  }
}
for (const id of scoreIds) overlay.querySelector(`#${id}`).addEventListener("input", syncValues);

async function token() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.access_token) return data.session.access_token;
  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) throw new Error("Потрібно увійти знову.");
  return refreshed.data.session.access_token;
}

async function morningApi(api, { method = "GET", body = null } = {}) {
  const t = await token();
  const url = new URL(FUNCTION_URL);
  url.searchParams.set("api", api);
  const headers = { Authorization: `Bearer ${t}`, apikey: SUPABASE_KEY };
  if (body !== null) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body === null ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function prefill(checkin) {
  if (!checkin) return;
  const map = {
    sleepQuality: checkin.sleep_quality,
    energy: checkin.energy,
    sleepiness: checkin.sleepiness,
  };
  for (const [id, value] of Object.entries(map)) {
    if (Number.isInteger(value)) overlay.querySelector(`#${id}`).value = String(value);
  }
  notes.value = checkin.notes || "";
  syncValues();
}

async function openMorning() {
  overlay.hidden = false;
  status.className = "morning-status";
  status.textContent = "Фіксую пробудження…";
  saveBtn.disabled = true;
  try {
    const begun = await morningApi("begin", { method: "POST", body: {} });
    const current = await morningApi("status");
    prefill(current.checkin || begun.checkin);
    if (current.completed) {
      status.classList.add(current.checkin?.linked_to_ledger ? "morning-linked" : "morning-pending");
      status.textContent = current.checkin?.linked_to_ledger
        ? "Сьогоднішня оцінка вже збережена і прив’язана до ночі. Можна відредагувати."
        : "Сьогоднішня оцінка вже збережена. Ніч ще не прив’язана; HealthLab підхопить її після фіналізації ledger.";
    } else {
      status.textContent = "Пробудження зафіксовано. Оціни ранок.";
    }
  } catch (e) {
    status.textContent = `Не вдалося почати ранкову оцінку: ${e.message}`;
  } finally {
    saveBtn.disabled = false;
  }
}

async function saveMorning() {
  saveBtn.disabled = true;
  status.className = "morning-status";
  status.textContent = "Зберігаю…";
  try {
    const data = await morningApi("save", {
      method: "POST",
      body: {
        sleep_quality: Number(overlay.querySelector("#sleepQuality").value),
        energy: Number(overlay.querySelector("#energy").value),
        sleepiness: Number(overlay.querySelector("#sleepiness").value),
        notes: notes.value.trim(),
      },
    });
    status.classList.add(data.linked_to_ledger ? "morning-linked" : "morning-pending");
    status.textContent = data.linked_to_ledger
      ? "✓ Збережено і прив’язано до цієї ночі."
      : "✓ Збережено. Sleep/Night ledger ще не фіналізований; прив’язка відбудеться автоматично пізніше.";
  } catch (e) {
    status.textContent = `Не збережено: ${e.message}`;
  } finally {
    saveBtn.disabled = false;
  }
}

quick.addEventListener("click", openMorning);
saveBtn.addEventListener("click", saveMorning);
closeBtn.addEventListener("click", () => { overlay.hidden = true; });
overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.hidden = true; });
window.addEventListener("keydown", (e) => { if (e.key === "Escape") overlay.hidden = true; });

async function setAuth(session) {
  quick.hidden = !session;
  if (session) {
    try {
      const data = await morningApi("status");
      if (data.completed) quick.textContent = "☀ Ранок ✓";
      else quick.textContent = "☀ Проснувся";
    } catch {
      quick.textContent = "☀ Проснувся";
    }
  }
}
supabase.auth.onAuthStateChange((_event, session) => setAuth(session));
const { data: initial } = await supabase.auth.getSession();
await setAuth(initial.session);

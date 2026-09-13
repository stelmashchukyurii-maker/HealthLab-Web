import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ttvlgfzvgjcbomdlddbn.supabase.co";
const SUPABASE_KEY = "sb_publishable_30IrLFbkHE4cPXmu-hJoQA_u_sFSg3Y";
const CORE_URL = `${SUPABASE_URL}/functions/v1/florivo-chat-v1`;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

async function token() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  if (data.session?.access_token) return data.session.access_token;
  const refreshed = await supabase.auth.refreshSession();
  return refreshed.data.session?.access_token || null;
}

async function history() {
  const t = await token();
  if (!t) return [];
  const url = new URL(CORE_URL);
  url.searchParams.set("api", "history");
  url.searchParams.set("project", "HEALTHLAB");
  url.searchParams.set("limit", "100");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t}`, apikey: SUPABASE_KEY } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

function showBanner(text) {
  const banner = document.getElementById("serviceBanner");
  if (!banner) return;
  banner.textContent = text;
  banner.hidden = false;
}

function addRepeatButton(turn) {
  if (!turn?.turn_id || !turn?.user_text || turn.status !== "done") return;
  if (turn.action_type === "healthlab_event") return;
  if (Array.isArray(turn.attachments) && turn.attachments.length) return;

  const metas = [...document.querySelectorAll(".assistant-meta")];
  const meta = metas.find((el) => String(el.textContent || "").trim().startsWith(turn.turn_id));
  const bubble = meta?.closest(".assistant-bubble");
  if (!bubble || bubble.querySelector(`[data-repeat-turn="${CSS.escape(turn.turn_id)}"]`)) return;

  let tools = bubble.querySelector(".bubble-tools");
  if (!tools) {
    tools = document.createElement("div");
    tools.className = "bubble-tools";
    bubble.appendChild(tools);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-btn repeat-btn";
  button.dataset.repeatTurn = turn.turn_id;
  button.textContent = "↻ Повторити";
  button.title = "Надіслати це питання ще раз";
  button.addEventListener("click", () => {
    const composer = document.getElementById("composer");
    const input = document.getElementById("messageInput");
    const preview = document.getElementById("attachmentPreview");
    const send = document.getElementById("sendBtn");
    if (!navigator.onLine) return showBanner("Немає мережі — повторити запит зараз не можна.");
    if (send?.disabled) return showBanner("Зачекай, попередній запит ще обробляється.");
    if (preview && preview.children.length) return showBanner("Спочатку прибери прикріплене фото, щоб випадково не відправити його з повторним запитом.");
    if (!composer || !input) return;
    input.value = String(turn.user_text || "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    composer.requestSubmit();
  });
  tools.appendChild(button);
}

let busy = false;
async function syncRepeatButtons() {
  if (busy) return;
  busy = true;
  try {
    for (const turn of await history()) addRepeatButton(turn);
  } catch {} finally {
    busy = false;
  }
}

let timer = null;
const messages = document.getElementById("messages");
if (messages) {
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(syncRepeatButtons, 120);
  }).observe(messages, { childList: true, subtree: true });
}
window.addEventListener("load", () => setTimeout(syncRepeatButtons, 350));
supabase.auth.onAuthStateChange(() => setTimeout(syncRepeatButtons, 350));

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ttvlgfzvgjcbomdlddbn.supabase.co";
const SUPABASE_KEY = "sb_publishable_30IrLFbkHE4cPXmu-hJoQA_u_sFSg3Y";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/florivo-chat-v1`;
const PROJECT = "HEALTHLAB";
const PROJECT_TZ = "Europe/Oslo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const $ = (id) => document.getElementById(id);
const authView = $("authView");
const chatView = $("chatView");
const composer = $("composer");
const messages = $("messages");
const emptyState = $("emptyState");
const emailInput = $("emailInput");
const loginBtn = $("loginBtn");
const loginStatus = $("loginStatus");
const signOutBtn = $("signOutBtn");
const installBtn = $("installBtn");
const messageInput = $("messageInput");
const sendBtn = $("sendBtn");
const serviceBanner = $("serviceBanner");
const netBanner = $("netBanner");
const bubbleTemplate = $("bubbleTemplate");

let activeSession = null;
let sending = false;
let deferredInstall = null;

function formatTime(iso) {
  try {
    return new Intl.DateTimeFormat("uk-UA", {
      timeZone: PROJECT_TZ, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit"
    }).format(new Date(iso));
  } catch { return ""; }
}

function resizeComposer() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
}

function setNetworkBanner() {
  netBanner.hidden = navigator.onLine;
  sendBtn.disabled = !navigator.onLine || sending;
}

async function getToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.access_token) return data.session.access_token;
  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session?.access_token) throw new Error("Потрібно увійти знову.");
  return refreshed.data.session.access_token;
}

async function api(apiName, { method = "GET", body = null, params = {} } = {}) {
  const token = await getToken();
  const url = new URL(FUNCTION_URL);
  url.searchParams.set("api", apiName);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const headers = {
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_KEY,
  };
  if (body !== null) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body === null ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function renderTurn(turn) {
  const node = bubbleTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(`status-${turn.status || "done"}`);
  node.querySelector(".user-text").textContent = turn.user_text || "";
  node.querySelector(".user-meta").textContent = formatTime(turn.occurred_at);

  const assistant = node.querySelector(".assistant-text");
  assistant.textContent = turn.assistant_text || (turn.status === "working" ? "Думаю…" : "");
  const badge = node.querySelector(".action-badge");
  if (turn.action_result?.ok) badge.hidden = false;
  const statusLabel = turn.status === "done" ? "" : ` · ${turn.status || ""}`;
  node.querySelector(".assistant-meta").textContent = `${turn.turn_id || ""}${statusLabel}`;
  return node;
}

function renderHistory(turns) {
  messages.replaceChildren();
  emptyState.hidden = Array.isArray(turns) && turns.length > 0;
  for (const turn of turns || []) messages.append(renderTurn(turn));
  requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
}

async function loadHistory() {
  const data = await api("history", { params: { project: PROJECT, limit: 100 } });
  renderHistory(Array.isArray(data) ? data : []);
}

async function loadServiceInfo() {
  try {
    const info = await api("info");
    if (info.ai_configured === false) {
      serviceBanner.textContent = "Чат уже зберігає повідомлення й HealthLab-події, але AI-відповіді ще потребують серверного OPENAI_API_KEY.";
      serviceBanner.hidden = false;
    } else {
      serviceBanner.hidden = true;
    }
  } catch (e) {
    serviceBanner.textContent = `Сервіс недоступний: ${e.message}`;
    serviceBanner.hidden = false;
  }
}

async function syncAuth(session) {
  activeSession = session || null;
  const signedIn = Boolean(activeSession);
  authView.hidden = signedIn;
  chatView.hidden = !signedIn;
  composer.hidden = !signedIn;
  signOutBtn.hidden = !signedIn;
  if (!signedIn) {
    serviceBanner.hidden = true;
    return;
  }
  if (location.hash || new URLSearchParams(location.search).has("code")) {
    history.replaceState({}, document.title, location.pathname);
  }
  try {
    await Promise.all([loadServiceInfo(), loadHistory()]);
  } catch (e) {
    serviceBanner.textContent = `Не вдалося завантажити чат: ${e.message}`;
    serviceBanner.hidden = false;
  }
  messageInput.focus({ preventScroll: true });
}

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) {
    loginStatus.textContent = "Введи email.";
    return;
  }
  loginBtn.disabled = true;
  loginStatus.textContent = "Надсилаю…";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.href, shouldCreateUser: false },
  });
  loginBtn.disabled = false;
  loginStatus.textContent = error ? `Помилка: ${error.message}` : "Посилання для входу надіслано на email. Відкрий його на цьому телефоні.";
});

emailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

signOutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  renderHistory([]);
});

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (sending || !navigator.onLine) return;
  const text = messageInput.value.trim();
  if (!text) return;
  sending = true;
  setNetworkBanner();
  messageInput.value = "";
  resizeComposer();

  const optimistic = {
    turn_id: "…",
    status: "working",
    user_text: text,
    assistant_text: "Думаю…",
    occurred_at: new Date().toISOString(),
    action_result: {},
  };
  emptyState.hidden = true;
  messages.append(renderTurn(optimistic));
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });

  try {
    await api("send", {
      method: "POST",
      body: { project: PROJECT, text, timezone: PROJECT_TZ },
    });
    await loadHistory();
    await loadServiceInfo();
  } catch (err) {
    serviceBanner.textContent = `Не відправлено: ${err.message}`;
    serviceBanner.hidden = false;
    await loadHistory().catch(() => {});
    messageInput.value = text;
    resizeComposer();
  } finally {
    sending = false;
    setNetworkBanner();
    messageInput.focus({ preventScroll: true });
  }
});

messageInput.addEventListener("input", resizeComposer);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

window.addEventListener("online", setNetworkBanner);
window.addEventListener("offline", setNetworkBanner);
setNetworkBanner();

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  installBtn.hidden = false;
});
installBtn.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  installBtn.hidden = true;
});
window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  installBtn.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

supabase.auth.onAuthStateChange((_event, session) => syncAuth(session));
const { data: initial } = await supabase.auth.getSession();
await syncAuth(initial.session);

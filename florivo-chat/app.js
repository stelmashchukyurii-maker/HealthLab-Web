import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ttvlgfzvgjcbomdlddbn.supabase.co";
const SUPABASE_KEY = "sb_publishable_30IrLFbkHE4cPXmu-hJoQA_u_sFSg3Y";
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/florivo-chat-v1`;
const PROJECT = "HEALTHLAB";
const PROJECT_TZ = "Europe/Oslo";
const PHOTO_BUCKET = "healthlab-event-photos";
const MAX_ATTACHMENTS = 3;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1600;

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
const attachBtn = $("attachBtn");
const photoInput = $("photoInput");
const attachmentPreview = $("attachmentPreview");
const serviceBanner = $("serviceBanner");
const netBanner = $("netBanner");
const bubbleTemplate = $("bubbleTemplate");

let activeSession = null;
let sending = false;
let deferredInstall = null;
let retryRequest = null;
let pendingFiles = [];
let previewUrls = [];

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
  attachBtn.disabled = sending;
}

async function copyText(text, button) {
  const value = String(text || "").trim();
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  if (button) {
    const old = button.textContent;
    button.textContent = "✓ Скопійовано";
    button.classList.add("copied");
    setTimeout(() => { button.textContent = old; button.classList.remove("copied"); }, 1200);
  }
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
  const headers = { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY };
  if (body !== null) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body === null ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

function revokePreviewUrls() {
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls = [];
}

function fileFingerprint(files = pendingFiles) {
  return files.map(f => `${f.name}:${f.size}:${f.lastModified}:${f.type}`).join("|");
}

function renderPendingAttachments() {
  revokePreviewUrls();
  attachmentPreview.replaceChildren();
  attachmentPreview.hidden = pendingFiles.length === 0;
  pendingFiles.forEach((file, index) => {
    const item = document.createElement("div");
    item.className = "attachment-chip";
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    const img = document.createElement("img");
    img.src = url;
    img.alt = file.name || `Фото ${index + 1}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "attachment-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "Прибрати фото");
    remove.addEventListener("click", () => {
      pendingFiles.splice(index, 1);
      retryRequest = null;
      renderPendingAttachments();
    });
    item.append(img, remove);
    attachmentPreview.append(item);
  });
}

async function hydrateTurnAttachments(node, attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return;
  const wrap = document.createElement("div");
  wrap.className = "turn-attachments";
  for (const a of attachments.slice(0, MAX_ATTACHMENTS)) {
    const path = String(a?.path || "");
    if (!path) continue;
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) continue;
    const img = document.createElement("img");
    img.src = data.signedUrl;
    img.alt = a?.name || "Фото";
    img.loading = "lazy";
    img.addEventListener("click", () => window.open(data.signedUrl, "_blank", "noopener,noreferrer"));
    wrap.append(img);
  }
  if (wrap.childElementCount) node.querySelector(".user-bubble").insertBefore(wrap, node.querySelector(".user-meta"));
}

function renderTurn(turn) {
  const node = bubbleTemplate.content.firstElementChild.cloneNode(true);
  node.classList.add(`status-${turn.status || "done"}`);
  node.querySelector(".user-text").textContent = turn.user_text || "";
  node.querySelector(".user-meta").textContent = formatTime(turn.occurred_at);
  hydrateTurnAttachments(node, turn.attachments).catch(() => {});

  const assistant = node.querySelector(".assistant-text");
  assistant.textContent = turn.assistant_text || (turn.status === "working" ? "Думаю…" : "");
  const badge = node.querySelector(".action-badge");
  if (turn.action_result?.ok) badge.hidden = false;
  const statusLabel = turn.status === "done" ? "" : ` · ${turn.status || ""}`;
  node.querySelector(".assistant-meta").textContent = `${turn.turn_id || ""}${statusLabel}`;

  const tools = document.createElement("div");
  tools.className = "bubble-tools";
  const copyAnswer = document.createElement("button");
  copyAnswer.type = "button";
  copyAnswer.className = "copy-btn";
  copyAnswer.textContent = "⧉ Копіювати";
  copyAnswer.addEventListener("click", () => copyText(turn.assistant_text || "", copyAnswer));
  tools.appendChild(copyAnswer);

  const copyTurn = document.createElement("button");
  copyTurn.type = "button";
  copyTurn.className = "copy-btn secondary-copy";
  copyTurn.textContent = "⧉ Весь turn";
  copyTurn.addEventListener("click", () => {
    const block = `TURN: ${turn.turn_id || "—"}\nUSER: ${turn.user_text || ""}\nFLORIVO: ${turn.assistant_text || ""}`;
    copyText(block, copyTurn);
  });
  tools.appendChild(copyTurn);
  node.querySelector(".assistant-bubble").appendChild(tools);
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
    } else serviceBanner.hidden = true;
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
  if (!signedIn) { serviceBanner.hidden = true; return; }
  if (location.hash || new URLSearchParams(location.search).has("code")) history.replaceState({}, document.title, location.pathname);
  try { await Promise.all([loadServiceInfo(), loadHistory()]); }
  catch (e) { serviceBanner.textContent = `Не вдалося завантажити чат: ${e.message}`; serviceBanner.hidden = false; }
  messageInput.focus({ preventScroll: true });
}

async function compressImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("Можна прикріпляти лише фото.");
  if (["image/heic", "image/heif"].includes(file.type)) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("HEIC/HEIF фото більше 8 MB. Зменш його перед відправленням.");
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 2_000_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Не вдалося стиснути фото.")), "image/jpeg", 0.82));
    const base = (file.name || "photo").replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 80) || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Фото більше 8 MB і браузер не зміг його стиснути.");
    return file;
  }
}

async function prepareFiles(files) {
  const result = [];
  for (const file of files.slice(0, MAX_ATTACHMENTS)) {
    const prepared = await compressImage(file);
    if (prepared.size > MAX_UPLOAD_BYTES) throw new Error("Фото після підготовки все ще більше 8 MB.");
    result.push(prepared);
  }
  return result;
}

function safeFileName(name, index) {
  const clean = String(name || `photo-${index + 1}.jpg`).replace(/[^A-Za-z0-9._-]+/g, "-").slice(-100);
  return clean || `photo-${index + 1}.jpg`;
}

async function uploadAttachments(requestId, files) {
  if (!files.length) return [];
  if (!activeSession?.user?.id) throw new Error("Немає активного користувача.");
  const result = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${activeSession.user.id}/florivo-chat/${requestId}/${i + 1}-${safeFileName(file.name, i)}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(`Фото ${i + 1}: ${error.message}`);
    result.push({ path, mime_type: file.type, name: file.name, size_bytes: file.size });
  }
  return result;
}

async function deleteUploadedAttachments(attachments) {
  const paths = (attachments || []).map(a => a?.path).filter(Boolean);
  if (!paths.length) return;
  await supabase.storage.from(PHOTO_BUCKET).remove(paths).catch(() => {});
}

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email) { loginStatus.textContent = "Введи email."; return; }
  loginBtn.disabled = true;
  loginStatus.textContent = "Надсилаю…";
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href, shouldCreateUser: false } });
  loginBtn.disabled = false;
  loginStatus.textContent = error ? `Помилка: ${error.message}` : "Посилання для входу надіслано на email. Відкрий його на цьому телефоні.";
});
emailInput.addEventListener("keydown", (e) => { if (e.key === "Enter") loginBtn.click(); });
signOutBtn.addEventListener("click", async () => {
  retryRequest = null;
  pendingFiles = [];
  renderPendingAttachments();
  await supabase.auth.signOut();
  renderHistory([]);
});

attachBtn.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", async () => {
  try {
    const selected = Array.from(photoInput.files || []);
    const merged = [...pendingFiles, ...selected].slice(0, MAX_ATTACHMENTS);
    pendingFiles = await prepareFiles(merged);
    retryRequest = null;
    renderPendingAttachments();
  } catch (e) {
    serviceBanner.textContent = `Фото не додано: ${e.message}`;
    serviceBanner.hidden = false;
  } finally {
    photoInput.value = "";
  }
});

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (sending || !navigator.onLine) return;
  const rawText = messageInput.value.trim();
  if (!rawText && pendingFiles.length === 0) return;
  const text = rawText || "Переглянь прикріплене фото.";
  const fingerprint = fileFingerprint();
  const canRetry = retryRequest?.text === text && retryRequest?.fingerprint === fingerprint;
  const clientRequestId = canRetry ? retryRequest.id : crypto.randomUUID();
  let uploadedAttachments = canRetry ? retryRequest.attachments : [];

  if (!canRetry && retryRequest?.attachments?.length) await deleteUploadedAttachments(retryRequest.attachments);

  sending = true;
  setNetworkBanner();
  messageInput.value = "";
  resizeComposer();
  const optimistic = {
    turn_id: "…", status: "working", user_text: text, assistant_text: "Думаю…",
    occurred_at: new Date().toISOString(), action_result: {}, attachments: pendingFiles.map((f, i) => ({ name: f.name, path: "", local_index: i }))
  };
  emptyState.hidden = true;
  messages.append(renderTurn(optimistic));
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  try {
    if (!canRetry) uploadedAttachments = await uploadAttachments(clientRequestId, pendingFiles);
    await api("send", {
      method: "POST",
      body: { project: PROJECT, text, timezone: PROJECT_TZ, client_request_id: clientRequestId, attachments: uploadedAttachments }
    });
    retryRequest = null;
    pendingFiles = [];
    renderPendingAttachments();
    await loadHistory();
    await loadServiceInfo();
  } catch (err) {
    retryRequest = { text, id: clientRequestId, fingerprint, attachments: uploadedAttachments };
    serviceBanner.textContent = `Не відправлено: ${err.message}`;
    serviceBanner.hidden = false;
    await loadHistory().catch(() => {});
    messageInput.value = rawText;
    resizeComposer();
  } finally {
    sending = false;
    setNetworkBanner();
    messageInput.focus({ preventScroll: true });
  }
});

messageInput.addEventListener("input", resizeComposer);
messageInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); composer.requestSubmit(); } });
window.addEventListener("online", setNetworkBanner);
window.addEventListener("offline", setNetworkBanner);
setNetworkBanner();
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; installBtn.hidden = false; });
installBtn.addEventListener("click", async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; installBtn.hidden = true; });
window.addEventListener("appinstalled", () => { deferredInstall = null; installBtn.hidden = true; });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
supabase.auth.onAuthStateChange((_event, session) => syncAuth(session));
const { data: initial } = await supabase.auth.getSession();
await syncAuth(initial.session);

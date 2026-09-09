// HealthLab Reserve/Battery v0.1 — client-side experimental model.
// Uses the existing 5-minute state API only; it does not write to production.
// Morning absolute seed is temporarily taken from today's DailyMetric.recovery.
// Charge/drain dynamics are independent and derived from HR + RMSSD + motion + sleep.
(() => {
  const API = 'https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
  const DAY = 86400000;
  const BUCKET = 300000;
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const epochMs = v => { const n = Number(v); return Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : 0; };
  async function api(p, opt = {}) {
    const u = new URL(API);
    Object.entries(p).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u, { cache: 'no-store', ...opt });
    if (!r.ok) throw Error('HTTP ' + r.status);
    const d = await r.json();
    if (d && d.error) throw Error(d.error);
    return d;
  }
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const q = (xs, p) => {
    const a = xs.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return null;
    const pos = (a.length - 1) * p, i = Math.floor(pos), d = pos - i;
    return a[i + 1] === undefined ? a[i] : a[i] + d * (a[i + 1] - a[i]);
  };
  const scale = (v, lo, hi) => {
    if (![v, lo, hi].every(Number.isFinite) || hi <= lo) return 0.5;
    return clamp((v - lo) / (hi - lo));
  };
  const fmtSigned = v => Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}` : '—';
  const clock = ms => new Date(ms).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

  let reserveSeries = [];

  function mapState(rs) {
    return (Array.isArray(rs) ? rs : []).map(r => ({
      ts: epochMs(r.bucket_ts),
      avgHr: num(r.avg_hr),
      motion: num(r.motion_score),
      rrCount: Number(r.rr_count || 0),
      rmssd: num(r.rmssd_ms),
      sleep: r.sleep_state === 'SLEEP'
    })).filter(r => r.ts && Number.isFinite(r.avgHr) && Number.isFinite(r.motion)).sort((a, b) => a.ts - b.ts);
  }

  function validRr(r) {
    return r.rrCount >= 100 && Number.isFinite(r.rmssd) && r.rmssd >= 5 && r.rmssd <= 250;
  }

  function baseline(rows, now) {
    const start = now - 7 * DAY;
    const b = rows.filter(r => r.ts >= start && r.ts <= now);
    return {
      hr20: q(b.map(r => r.avgHr), .20),
      hr80: q(b.map(r => r.avgHr), .80),
      hrv20: q(b.filter(validRr).map(r => r.rmssd), .20),
      hrv80: q(b.filter(validRr).map(r => r.rmssd), .80),
      mot20: q(b.map(r => r.motion).filter(v => v > 0), .20),
      mot80: q(b.map(r => r.motion).filter(v => v > 0), .80),
      n: b.length
    };
  }

  function scoreRow(r, b) {
    const hrMob = scale(r.avgHr, b.hr20, b.hr80);
    const motMob = scale(r.motion, b.mot20, b.mot80);
    const hrvRest = validRr(r) ? scale(r.rmssd, b.hrv20, b.hrv80) : 0.5;
    const mobilization = clamp(0.60 * hrMob + 0.40 * motMob);
    const restoration = clamp(0.45 * hrvRest + 0.35 * (1 - hrMob) + 0.20 * (1 - motMob));
    const delta = 0.25 * restoration - 0.50 * mobilization;
    return { ...r, mobilization, restoration, delta };
  }

  function latestSleepBlock(rows) {
    let end = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].sleep) { end = i; break; }
    }
    if (end < 0) return null;
    let start = end;
    while (start > 0 && rows[start - 1].sleep && rows[start].ts - rows[start - 1].ts <= BUCKET * 2) start--;
    return { start, end, rows: rows.slice(start, end + 1), wakeTs: rows[end].ts + BUCKET };
  }

  function latestDaily(rows) {
    return (Array.isArray(rows) ? rows : (rows?.rows || [])).slice().sort((a, b) => String(b.day || '').localeCompare(String(a.day || '')))[0] || null;
  }

  function renderGauge(value) {
    const bar = document.getElementById('reserveFill');
    const n = document.getElementById('reserveNow');
    if (!bar || !n) return;
    const v = clamp(value, 0, 100);
    bar.style.width = `${v}%`;
    n.textContent = Math.round(v);
  }

  function drawReserve(series) {
    const c = document.getElementById('reserveChart');
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(280, c.clientWidth || 320), h = Math.max(130, c.clientHeight || 150);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    if (series.length < 2) return;
    const pad = { l: 28, r: 8, t: 10, b: 20 };
    const minT = series[0].ts, maxT = series[series.length - 1].ts;
    const X = t => pad.l + (t - minT) / Math.max(1, maxT - minT) * (w - pad.l - pad.r);
    const Y = v => pad.t + (100 - v) / 100 * (h - pad.t - pad.b);
    x.strokeStyle = 'rgba(255,255,255,.10)'; x.lineWidth = 1;
    [25, 50, 75].forEach(v => { x.beginPath(); x.moveTo(pad.l, Y(v)); x.lineTo(w - pad.r, Y(v)); x.stroke(); });
    x.fillStyle = 'rgba(255,255,255,.46)'; x.font = '11px system-ui'; x.textAlign = 'right';
    [25, 50, 75, 100].forEach(v => x.fillText(String(v), pad.l - 5, Y(v) + 4));
    x.strokeStyle = '#63e6be'; x.lineWidth = 2.4; x.lineJoin = 'round'; x.lineCap = 'round';
    x.beginPath(); series.forEach((p, i) => { const px = X(p.ts), py = Y(p.reserve); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.55)'; x.textAlign = 'left'; x.fillText(clock(minT), pad.l, h - 4);
    x.textAlign = 'right'; x.fillText(clock(maxT), w - pad.r, h - 4);
  }

  async function loadReservePanel() {
    const badge = document.getElementById('reserveBadge');
    try {
      if (badge) badge.textContent = 'рахую…';
      const now = Date.now();
      const from = Math.floor((now - 8 * DAY) / 1000), to = Math.floor(now / 1000);
      const [state, dailyRaw] = await Promise.all([
        api({ api: 'state', from, to, bucket: 300 }),
        api({ api: 'table', name: 'dailyMetric', limit: 10 })
      ]);
      const rows = mapState(state);
      const b = baseline(rows, now);
      const scored = rows.map(r => scoreRow(r, b));
      const sleep = latestSleepBlock(scored);
      const daily = latestDaily(dailyRaw);
      const morningSeedRaw = Number(daily?.recovery);
      const morningSeed = Number.isFinite(morningSeedRaw) ? clamp(morningSeedRaw, 0, 100) : 70;
      const nightCharge = sleep ? sleep.rows.reduce((s, r) => s + Math.max(0, r.delta), 0) : 0;
      const wakeTs = sleep?.wakeTs || new Date().setHours(7, 0, 0, 0);
      const awake = scored.filter(r => r.ts >= wakeTs);
      let reserve = morningSeed;
      reserveSeries = [{ ts: wakeTs, reserve }];
      awake.forEach(r => {
        reserve = clamp(reserve + r.delta, 0, 100);
        reserveSeries.push({ ts: r.ts, reserve, delta: r.delta, mobilization: r.mobilization, restoration: r.restoration });
      });
      const dayDelta = reserve - morningSeed;
      const latest = awake.at(-1) || scored.at(-1);
      renderGauge(reserve);
      drawReserve(reserveSeries);
      const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
      set('reserveNight', fmtSigned(nightCharge));
      set('reserveDayDelta', fmtSigned(dayDelta));
      set('reserveWake', sleep ? clock(wakeTs) : '—');
      set('mobilizationNow', latest ? Math.round(latest.mobilization * 100) : '—');
      set('restorationNow', latest ? Math.round(latest.restoration * 100) : '—');
      set('reserveSeed', Number.isFinite(morningSeedRaw) ? `ранковий seed ${morningSeed.toFixed(1)} із Recovery; динаміка — HR/RR/рух/сон` : 'тимчасовий seed 70; динаміка — HR/RR/рух/сон');
      const active = Number(daily?.activeKcalEst);
      set('activeEnergy', Number.isFinite(active) ? Math.round(active).toLocaleString('uk-UA') : '—');
      const rec = Number(daily?.recovery);
      set('recoveryWeb', Number.isFinite(rec) ? rec.toFixed(1) : '—');
      set('reserveBaseline', b.n ? `персональна база: ${b.n} × 5 хв за 7 днів` : 'база недоступна');
      if (badge) { badge.textContent = 'EXPERIMENT v0.1'; badge.className = 'badge warn'; }
    } catch (e) {
      if (badge) { badge.textContent = 'немає даних'; badge.className = 'badge bad'; }
      const note = document.getElementById('reserveSeed'); if (note) note.textContent = `Reserve: ${e.message}`;
    }
  }

  window.addEventListener('resize', () => drawReserve(reserveSeries));
  const refresh = document.getElementById('refreshBtn');
  if (refresh) refresh.addEventListener('click', () => setTimeout(loadReservePanel, 250));
  loadReservePanel();
  setInterval(loadReservePanel, 60000);
})();

(() => {
  const canvas = document.getElementById('labDemoChart');
  const card = document.getElementById('labDemoChartCard');
  if (!canvas || !card) return;

  // VISUAL DEMO ONLY: 480 three-minute bins across 24 hours. No HealthLab/WHOOP data is read.
  const BIN_MIN = 3;
  const DAY_MIN = 24 * 60;
  const MIN_VIEW_MIN = 60;
  const values = Array.from({ length: DAY_MIN / BIN_MIN }, (_, i) => {
    const h = i / 20;
    const wave = 8 + 5 * Math.sin(i * 0.19) + 3 * Math.sin(i * 0.047);
    const morning = 27 * Math.exp(-Math.pow((h - 7.0) / 1.55, 2));
    const noon = 78 * Math.exp(-Math.pow((h - 12.2) / 1.45, 2));
    const afternoon = 34 * Math.exp(-Math.pow((h - 15.0) / 1.1, 2));
    const evening = 72 * Math.exp(-Math.pow((h - 17.2) / 1.35, 2));
    const quietNight = h < 4 ? -6 : 0;
    return Math.max(1, Math.min(98, wave + morning + noon + afternoon + evening + quietNight));
  });

  let viewStart = 0;
  let viewEnd = DAY_MIN;
  let selectedMin = null;
  const pointers = new Map();
  let pinchBase = null;
  let lastTapAt = 0;
  let lastTapX = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const viewSpan = () => viewEnd - viewStart;
  const fmtTime = (minute) => {
    const m = ((Math.round(minute / BIN_MIN) * BIN_MIN) % DAY_MIN + DAY_MIN) % DAY_MIN;
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  function plotBox() {
    const rect = canvas.getBoundingClientRect();
    const landscape = matchMedia('(orientation: landscape)').matches && document.body.classList.contains('lab-tab-active');
    const left = landscape ? 44 : 36;
    const right = 10;
    const top = 34;
    const bottom = landscape ? 30 : 28;
    return { rect, left, right, top, bottom, pw: rect.width - left - right, ph: rect.height - top - bottom };
  }

  function xToMinute(clientX) {
    const { rect, left, pw } = plotBox();
    if (pw <= 0) return viewStart;
    const x = clamp(clientX - rect.left - left, 0, pw);
    return viewStart + (x / pw) * viewSpan();
  }

  function minuteToX(minute, box) {
    return box.left + ((minute - viewStart) / viewSpan()) * box.pw;
  }

  function niceTickMinutes(span) {
    if (span <= 90) return 15;
    if (span <= 180) return 30;
    if (span <= 360) return 60;
    if (span <= 720) return 120;
    return 240;
  }

  function drawSelected(ctx, box) {
    if (!Number.isFinite(selectedMin) || selectedMin < viewStart || selectedMin > viewEnd) return;
    const x = minuteToX(selectedMin, box);
    ctx.save();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x, box.top);
    ctx.lineTo(x, box.top + box.ph);
    ctx.stroke();
    ctx.setLineDash([]);

    const label = fmtTime(selectedMin);
    ctx.font = '700 12px system-ui, sans-serif';
    const textW = ctx.measureText(label).width;
    const padX = 7;
    const bubbleW = textW + padX * 2;
    const bubbleH = 24;
    const bubbleX = clamp(x - bubbleW / 2, box.left, box.left + box.pw - bubbleW);
    const bubbleY = 3;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bubbleX, bubbleY, bubbleW, bubbleH, 7);
    else ctx.rect(bubbleX, bubbleY, bubbleW, bubbleH);
    ctx.fill();
    ctx.fillStyle = '#07101f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bubbleX + bubbleW / 2, bubbleY + bubbleH / 2 + .5);
    ctx.restore();
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    const box = plotBox();
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = 'rgba(148,163,184,.16)';
    ctx.lineWidth = 1;

    for (let v = 0; v <= 100; v += 20) {
      const y = box.top + box.ph - (v / 100) * box.ph;
      ctx.beginPath(); ctx.moveTo(box.left, y); ctx.lineTo(w - box.right, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), box.left - 6, y);
    }

    const tickMin = niceTickMinutes(viewSpan());
    const firstTick = Math.ceil(viewStart / tickMin) * tickMin;
    for (let m = firstTick; m <= viewEnd + .01; m += tickMin) {
      const x = minuteToX(m, box);
      ctx.beginPath(); ctx.moveTo(x, box.top); ctx.lineTo(x, box.top + box.ph); ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(fmtTime(m), x, box.top + box.ph + 7);
    }

    const firstIndex = Math.max(0, Math.floor(viewStart / BIN_MIN));
    const lastIndex = Math.min(values.length - 1, Math.ceil(viewEnd / BIN_MIN));
    const slot = box.pw * BIN_MIN / viewSpan();
    const barW = Math.max(.7, slot * .78);
    ctx.fillStyle = '#3b82f6';
    for (let i = firstIndex; i <= lastIndex; i++) {
      const minute = i * BIN_MIN;
      const xCenter = minuteToX(minute + BIN_MIN / 2, box);
      const bh = (values[i] / 100) * box.ph;
      ctx.fillRect(xCenter - barW / 2, box.top + box.ph - bh, barW, bh);
    }
    drawSelected(ctx, box);
  }

  function setSelectedFromX(clientX) {
    selectedMin = clamp(Math.round(xToMinute(clientX) / BIN_MIN) * BIN_MIN, 0, DAY_MIN - BIN_MIN);
    draw();
  }

  function resetZoom() {
    viewStart = 0;
    viewEnd = DAY_MIN;
    draw();
  }

  function pointerDistance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function pointerCenter(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    if (pointers.size === 1) {
      const now = performance.now();
      if (now - lastTapAt < 330 && Math.abs(event.clientX - lastTapX) < 36) {
        resetZoom();
        lastTapAt = 0;
      } else {
        lastTapAt = now;
        lastTapX = event.clientX;
        setSelectedFromX(event.clientX);
      }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const center = pointerCenter(a, b);
      pinchBase = {
        distance: Math.max(1, pointerDistance(a, b)),
        span: viewSpan(),
        start: viewStart,
        end: viewEnd,
        centerX: center.x,
        centerMinute: xToMinute(center.x)
      };
    }
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, type: event.pointerType });
    if (pointers.size === 1) {
      setSelectedFromX(event.clientX);
      return;
    }
    if (pointers.size === 2 && pinchBase) {
      event.preventDefault();
      const [a, b] = [...pointers.values()];
      const distance = Math.max(1, pointerDistance(a, b));
      const center = pointerCenter(a, b);
      const targetSpan = clamp(pinchBase.span * pinchBase.distance / distance, MIN_VIEW_MIN, DAY_MIN);
      const box = plotBox();
      const centerRatio = clamp((center.x - box.rect.left - box.left) / Math.max(1, box.pw), 0, 1);
      const baseBox = plotBox();
      const baseRatio = clamp((pinchBase.centerX - baseBox.rect.left - baseBox.left) / Math.max(1, baseBox.pw), 0, 1);
      const translatedMinute = pinchBase.centerMinute + ((pinchBase.centerX - center.x) / Math.max(1, box.pw)) * targetSpan;
      let start = translatedMinute - centerRatio * targetSpan;
      if (!Number.isFinite(start)) start = pinchBase.start + (baseRatio - centerRatio) * targetSpan;
      start = clamp(start, 0, DAY_MIN - targetSpan);
      viewStart = start;
      viewEnd = start + targetSpan;
      draw();
    }
  }, { passive: false });

  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchBase = null;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', (event) => { if (event.pointerType !== 'touch') endPointer(event); });

  function syncLandscape() {
    const landscape = matchMedia('(orientation: landscape)').matches;
    const active = document.body.classList.contains('lab-tab-active');
    document.body.classList.toggle('lab-chart-landscape', landscape && active);
    requestAnimationFrame(draw);
    setTimeout(draw, 120);
  }

  new ResizeObserver(draw).observe(canvas);
  window.addEventListener('orientationchange', () => setTimeout(syncLandscape, 120));
  window.addEventListener('resize', syncLandscape);
  document.getElementById('labTab')?.addEventListener('click', () => setTimeout(syncLandscape, 0));
  document.getElementById('chatTab')?.addEventListener('click', () => {
    document.body.classList.remove('lab-chart-landscape');
    requestAnimationFrame(draw);
  });
  document.addEventListener('fullscreenchange', draw);
  syncLandscape();
})();

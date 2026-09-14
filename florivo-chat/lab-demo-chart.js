(() => {
  const canvas = document.getElementById('labDemoChart');
  const card = document.getElementById('labDemoChartCard');
  if (!canvas || !card) return;

  // VISUAL DEMO ONLY: 480 three-minute bins across 24 hours. No HealthLab/WHOOP data is read.
  const values = Array.from({ length: 480 }, (_, i) => {
    const h = i / 20;
    const wave = 8 + 5 * Math.sin(i * 0.19) + 3 * Math.sin(i * 0.047);
    const morning = 27 * Math.exp(-Math.pow((h - 7.0) / 1.55, 2));
    const noon = 78 * Math.exp(-Math.pow((h - 12.2) / 1.45, 2));
    const afternoon = 34 * Math.exp(-Math.pow((h - 15.0) / 1.1, 2));
    const evening = 72 * Math.exp(-Math.pow((h - 17.2) / 1.35, 2));
    const quietNight = h < 4 ? -6 : 0;
    return Math.max(1, Math.min(98, wave + morning + noon + afternoon + evening + quietNight));
  });

  function draw() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    const left = 36, right = 8, top = 8, bottom = 28;
    const pw = w - left - right, ph = h - top - bottom;
    ctx.clearRect(0, 0, w, h);
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = 'rgba(148,163,184,.16)';
    ctx.lineWidth = 1;
    for (let v = 0; v <= 100; v += 20) {
      const y = top + ph - (v / 100) * ph;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), left - 6, y);
    }
    [0,4,8,12,16,20,24].forEach((hour) => {
      const x = left + (hour / 24) * pw;
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + ph); ctx.stroke();
      if (hour < 24) { ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(String(hour).padStart(2,'0') + ':00', x, top + ph + 7); }
    });
    const slot = pw / values.length;
    const barW = Math.max(.45, slot * .78);
    ctx.fillStyle = '#3b82f6';
    values.forEach((value, i) => {
      const bh = (value / 100) * ph;
      const x = left + i * slot + (slot - barW) / 2;
      ctx.fillRect(x, top + ph - bh, barW, bh);
    });
  }

  function syncLandscape() {
    const landscape = matchMedia('(orientation: landscape)').matches;
    document.body.classList.toggle('lab-chart-landscape', landscape && document.body.classList.contains('lab-tab-active'));
    requestAnimationFrame(draw);
  }
  new ResizeObserver(draw).observe(canvas);
  window.addEventListener('orientationchange', () => setTimeout(syncLandscape, 120));
  window.addEventListener('resize', syncLandscape);
  document.getElementById('labTab')?.addEventListener('click', () => setTimeout(syncLandscape, 0));
  document.getElementById('chatTab')?.addEventListener('click', () => { document.body.classList.remove('lab-chart-landscape'); });
  document.addEventListener('fullscreenchange', draw);
  draw();
})();

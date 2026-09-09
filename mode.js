const HL_API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';

function hlEnsureModeCss(){
  if(document.querySelector('link[data-hl-mode-css]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='./mode.css?v=20260908-5';l.dataset.hlModeCss='1';document.head.appendChild(l);
}
function hlPageName(){return (location.pathname.split('/').pop()||'index.html').toLowerCase()}
function hlNav(active){
  const items=[
    ['sleep','./index.html','🌙','Сон'],['state','./state.html','🫀','Стан'],['trend','./index.html#sleepTrend','↗','Тренди'],['events','./index.html#events','＋','Події'],['lab','./lab.html','🔬','Лаб']
  ];
  return `<nav class="bottom-nav hl-main-nav">${items.map(([k,href,ico,label])=>`<a class="nav-item ${active===k?'active':''}" href="${href}"><span>${ico}</span><b>${label}</b></a>`).join('')}</nav>`;
}
function hlInstallMainNav(active){
  document.querySelectorAll('nav.bottom-nav:not(.hl-main-nav)').forEach(n=>n.classList.add('hl-old-nav'));
  if(!document.querySelector('.hl-main-nav'))document.body.insertAdjacentHTML('beforeend',hlNav(active));
}
function hlSleepMarkup(){
  return `<section id="sleepDashboard" class="sleep-dashboard">
    <div class="eyebrow section-overline">ОСТАННЯ ЗАВЕРШЕНА НІЧ</div>
    <article class="sleep-hero">
      <div class="sleep-hero-top"><div id="sleepMood" class="sleep-mood">😐</div><div><h2 id="sleepTitle">Сон і відновлення</h2><small id="sleepDay" class="muted">завантаження…</small></div></div>
      <p id="sleepSummary">Формую короткий огляд нічних показників.</p>
    </article>
    <div class="sleep-grid">
      <article class="sleep-card"><span>Нічний HRV</span><b id="sleepHrv">—</b><small>мс</small></article>
      <article class="sleep-card"><span>Сон</span><b id="sleepDuration">—</b><small>тривалість</small></article>
      <article class="sleep-card"><span>Пульс спокою</span><b id="sleepRhr">—</b><small>уд/хв</small></article>
      <article class="sleep-card"><span>Recovery</span><b id="sleepRecovery">—</b><small>WHOOP · vendor score</small></article>
      <article class="sleep-card"><span>Дихання</span><b id="sleepResp">—</b><small>/хв · ніч</small></article>
    </div>
    <article class="sleep-lab-link"><div><b>Reserve / Battery v0.1</b><small>Наш експериментальний запас ресурсу: заряд, розряд, Mobilization і Restoration.</small></div><a href="./reserve.html">🔋 Відкрити →</a></article>
    <article id="sleepTrend" class="sleep-direction">
      <div class="eyebrow">НАПРЯМОК</div><h3>Тренд</h3>
      <div id="sleepTrendSummary" class="sleep-direction-summary">Напрямок ще формується.</div>
      <div id="sleepTrendChips" class="sleep-direction-row"></div>
      <div class="sleep-direction-note">↑/↓ — факт зміни. Нічні значення порівнюються з нічними; денний HRV сюди не домішується.</div>
    </article>
    <article class="sleep-lab-link"><div><b>Потрібні всі сигнали й докази?</b><small>Хронологія, LAB, H10, якість даних і алгоритми — у лабораторії.</small></div><a href="./lab.html">🔬 Лабораторія →</a></article>
  </section>`;
}
async function hlApi(params){const u=new URL(HL_API);Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d?.error)throw Error(d.error);return d}
function hlNum(v){const n=Number(v);return Number.isFinite(n)?n:null}
function hlSleepFormat(min){if(!Number.isFinite(min))return '—';const m=Math.round(min);return `${Math.floor(m/60)}г ${String(m%60).padStart(2,'0')}хв`}
async function hlLoadSleep(){
  try{
    const d=await hlApi({api:'table',name:'dailyMetric',limit:3});const rows=Array.isArray(d)?d:(d.rows||[]);const m=rows[0];if(!m)throw Error('Немає dailyMetric');
    const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    const h=hlNum(m.avgHrv),s=hlNum(m.totalSleepMin),rhr=hlNum(m.restingHr),rec=hlNum(m.recovery),resp=hlNum(m.respRateBpm);
    set('sleepHrv',h===null?'—':Math.round(h));set('sleepDuration',hlSleepFormat(s));set('sleepRhr',rhr===null?'—':Math.round(rhr));set('sleepRecovery',rec===null?'—':Math.round(rec)+'%');set('sleepResp',resp===null?'—':resp.toFixed(1));
    if(m.day){const dt=new Date(m.day+'T12:00:00');set('sleepDay',dt.toLocaleDateString('uk-UA',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}))}
  }catch(e){const s=document.getElementById('sleepSummary');if(s)s.textContent='Нічні дані тимчасово недоступні: '+e.message}
}
function hlTrendFriendly(){
  const src=document.getElementById('trendSummary'),box=document.getElementById('sleepTrendSummary'),chips=document.getElementById('sleepTrendChips'),mood=document.getElementById('sleepMood'),summary=document.getElementById('sleepSummary');
  if(!src||!box||!chips||!mood||!summary)return;
  const txt=src.textContent.trim();if(!txt||txt.includes('Формую')||txt.includes('недоступний')||txt.includes('рано')){box.textContent='Ще збираємо достатньо нічних даних.';chips.innerHTML='';mood.textContent='😐';summary.textContent='Нічні показники є; для надійного напрямку потрібно більше історії.';return}
  const parts=txt.split('·').map(x=>x.trim()).filter(Boolean),out=[],friendly=[];let fav=0,unfav=0;
  parts.forEach(p=>{const m=p.match(/(.+?)\s*([↑↓→])$/);if(!m)return;const name=m[1].trim(),a=m[2];const icon=a==='↑'?'↗':a==='↓'?'↘':'→';out.push(`<span class="sleep-direction-chip">${name} ${icon}</span>`);
    if(/HRV/i.test(name)){friendly.push(a==='↑'?'HRV вище':a==='↓'?'HRV нижче':'HRV стабільний');if(a==='↑')fav++;if(a==='↓')unfav++}
    else if(/пульс/i.test(name)){friendly.push(a==='↓'?'пульс спокою нижче':a==='↑'?'пульс спокою вище':'пульс спокою стабільний');if(a==='↓')fav++;if(a==='↑')unfav++}
    else if(/сон/i.test(name)){friendly.push(a==='↑'?'сну більше':a==='↓'?'сну менше':'сон стабільний');if(a==='↑')fav++;if(a==='↓')unfav++}
    else if(/Recovery/i.test(name)){if(a==='↑')fav++;if(a==='↓')unfav++}
  });
  box.textContent=friendly.length?friendly.join(' · '):txt;chips.innerHTML=out.join('');
  if(fav>=2&&fav>unfav){mood.textContent='🙂';summary.textContent='За доступними нічними трендами напрямок зараз переважно сприятливий.'}
  else if(unfav>=2&&unfav>fav){mood.textContent='😕';summary.textContent='Кілька нічних показників рухаються в менш сприятливий бік — варто стежити за трендом.'}
  else{mood.textContent='😐';summary.textContent='Нічні показники мають змішаний або стабільний напрямок.'}
}
function hlObserveSleep(){['trendSummary'].forEach(id=>{const e=document.getElementById(id);if(e)new MutationObserver(hlTrendFriendly).observe(e,{childList:true,subtree:true,characterData:true})});hlTrendFriendly()}
function hlInstallSleep(){
  document.body.classList.add('hl-sleep-page');const h=document.querySelector('.topbar h1');if(h)h.textContent='Сон';const eye=document.querySelector('.topbar .eyebrow');if(eye)eye.textContent='HEALTHLAB · НІЧНИЙ ОГЛЯД';
  const strap=document.querySelector('.strap-card');if(strap&&!document.getElementById('sleepDashboard'))strap.insertAdjacentHTML('afterend',hlSleepMarkup());
  [document.getElementById('pulseChart')?.closest('section'),document.getElementById('stateLab'),document.getElementById('trendLab'),document.getElementById('dbNav')?.closest('section'),document.querySelector('.metric-grid'),document.querySelector('.mini-card'),document.getElementById('database'),document.getElementById('status')].filter(Boolean).forEach(e=>e.classList.add('hl-legacy-research'));
  hlInstallMainNav('sleep');hlLoadSleep();hlObserveSleep();
  const rb=document.getElementById('refreshBtn');rb?.addEventListener('click',()=>hlLoadSleep());
  const openEvents=()=>{if(typeof window.openJournal==='function')window.openJournal()};if(location.hash==='#events')setTimeout(openEvents,80);window.addEventListener('hashchange',()=>{if(location.hash==='#events')openEvents()});
}
function hlInstallResearch(){document.body.classList.add('hl-research-page');hlInstallMainNav('lab')}
function hlInstallShell(){hlEnsureModeCss();const p=hlPageName();if(p==='index.html'||p==='')hlInstallSleep();else if(p==='lab.html'||p==='timeline.html')hlInstallResearch()}
function hlInstallModeSwitch(){}
function hlSetMode(){}
function hlSavedMode(){return 'sleep'}
function hlObserveSimple(){if(hlPageName()==='index.html'||hlPageName()==='')hlObserveSleep()}

document.addEventListener('DOMContentLoaded',hlInstallShell);

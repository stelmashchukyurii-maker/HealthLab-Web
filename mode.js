const HL_MODE_KEY='healthlab.ui.mode.v1';

function hlSavedMode(){
  const q=new URLSearchParams(location.search).get('mode');
  if(q==='user'||q==='research')return q;
  const s=localStorage.getItem(HL_MODE_KEY);
  return s==='research'?'research':'user';
}
function hlEnsureModeCss(){
  if(document.querySelector('link[data-hl-mode-css]'))return;
  const l=document.createElement('link');l.rel='stylesheet';l.href='./mode.css?v=20260908-1';l.dataset.hlModeCss='1';document.head.appendChild(l);
}
function hlPageName(){
  const p=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  return p||'index.html';
}
function hlSwitchMarkup(){
  return `<div id="modeSwitchWrap" class="mode-switch-wrap">
    <div class="mode-switch" role="group" aria-label="Режим HealthLab">
      <button type="button" data-hl-mode="user">Користувач</button>
      <button type="button" data-hl-mode="research">🔬 Дослідник</button>
    </div>
    <div class="mode-caption" data-hl-mode-caption>—</div>
  </div>`;
}
function hlInstallShell(){
  hlEnsureModeCss();
  const page=hlPageName(),isIndex=page==='index.html'||page==='';
  if(!isIndex)document.body.classList.add('research-page');
  const main=document.querySelector('main');
  const header=main?.querySelector('header');
  if(main&&header&&!document.getElementById('modeSwitchWrap'))header.insertAdjacentHTML('afterend',hlSwitchMarkup());

  const nav=document.querySelector('nav.bottom-nav');
  if(nav)nav.classList.add('research-nav');

  if(isIndex){
    const strap=document.querySelector('.strap-card');
    if(strap&&!document.getElementById('userDashboard')){
      strap.insertAdjacentHTML('afterend',`<section id="userDashboard" class="user-dashboard user-only">
        <div class="eyebrow section-overline">СЬОГОДНІ · ПРОСТО</div>
        <article class="user-hero">
          <div class="user-hero-top"><div id="userMood" class="user-mood">😐</div><div><h2 id="userStateTitle">Завантаження…</h2><small class="muted">HealthLab · поточний стан</small></div></div>
          <p id="userStateText">Формую простий висновок із доступних сигналів.</p>
          <a class="user-detail-link" href="./timeline.html" data-open-research>Детальніше у Хронології →</a>
        </article>
        <div id="userHealth" class="user-grid">
          <article class="user-card"><span>Пульс зараз</span><b id="userHr">—</b><small>поточний 5-хв рівень</small></article>
          <article class="user-card"><span>Нічний HRV</span><b id="userHrv">—</b><small>напрямок дивись нижче</small></article>
          <article class="user-card"><span>Дихання вночі</span><b id="userResp">—</b><small>WHOOP</small></article>
          <article class="user-card"><span>Пояснення</span><b>Без технічного шуму</b><small>деталі завжди доступні у режимі Дослідник</small></article>
        </div>
        <article id="userTrend" class="user-direction">
          <div class="eyebrow">НАПРЯМОК</div><h3>Куди рухаємося</h3>
          <div id="userTrendSummary" class="user-direction-summary">Напрямок ще формується.</div>
          <div id="userTrendChips" class="user-direction-row"></div>
          <div class="user-direction-note">Стрілка показує факт зміни. Підвищення навантаження не позначається автоматично як «добре» або «погано».</div>
        </article>
      </section>`);
    }
    const technical=[
      document.getElementById('pulseChart')?.closest('section'),
      document.getElementById('stateLab'),
      document.getElementById('trendLab'),
      document.getElementById('dbNav')?.closest('section'),
      document.querySelector('.metric-grid'),
      document.querySelector('.mini-card'),
      document.getElementById('database'),
      document.getElementById('status')
    ].filter(Boolean);
    technical.forEach(el=>el.classList.add('research-only'));

    if(nav&&!document.querySelector('nav.user-nav')){
      nav.insertAdjacentHTML('afterend',`<nav class="bottom-nav user-nav user-only">
        <a class="nav-item active" href="./index.html?mode=user"><span>▦</span><b>Сьогодні</b></a>
        <a class="nav-item" href="#userTrend"><span>↗</span><b>Тренди</b></a>
        <button class="nav-item" id="userEventsNav"><span>＋</span><b>Події</b></button>
        <a class="nav-item" href="#userHealth"><span>♡</span><b>Здоров’я</b></a>
        <a class="nav-item" href="#modeSwitchWrap"><span>•••</span><b>Ще</b></a>
      </nav>`);
    }
    document.getElementById('userEventsNav')?.addEventListener('click',()=>window.openJournal?.());
  }
}
function hlSetMode(mode,{navigate=false}={}){
  mode=mode==='research'?'research':'user';
  localStorage.setItem(HL_MODE_KEY,mode);
  const isResearchPage=document.body.classList.contains('research-page');
  if(isResearchPage&&mode==='user'){
    location.href='./index.html?mode=user';
    return;
  }
  document.body.classList.toggle('mode-user',mode==='user');
  document.body.classList.toggle('mode-research',mode==='research');
  document.querySelectorAll('[data-hl-mode]').forEach(el=>el.classList.toggle('active',el.dataset.hlMode===mode));
  document.querySelectorAll('[data-hl-mode-caption]').forEach(el=>el.textContent=mode==='user'?'Простий щоденний огляд':'Повні сигнали, якість і дослідницькі інструменти');
  if(mode==='research'){
    requestAnimationFrame(()=>{
      try{window.renderPulse?.();window.renderStateLab?.();window.dispatchEvent(new Event('resize'));}catch{}
    });
  }
  if(navigate&&mode==='research'&&hlPageName()==='index.html')location.hash='research';
}
function hlInstallModeSwitch(){
  document.querySelectorAll('[data-hl-mode]').forEach(el=>{
    el.addEventListener('click',ev=>{ev.preventDefault();hlSetMode(el.dataset.hlMode)});
  });
  document.querySelectorAll('[data-open-research]').forEach(el=>el.addEventListener('click',()=>localStorage.setItem(HL_MODE_KEY,'research')));
}
function hlMoodForState(state){
  const s=(state||'').toUpperCase();
  if(s.includes('СОН'))return ['😴','Сон','Організм зараз у стані сну.'];
  if(s.includes('ВІДПОЧИНОК'))return ['🙂','Спокійний стан','Навантаження зараз близьке до спокійного рівня.'];
  if(s.includes('РУХ'))return ['🚶','Фізичне навантаження','Зараз переважає фізична активність.'];
  if(s.includes('ВІДНОВЛЕНН'))return ['🙂','Відновлення','Організм відновлюється після недавнього руху.'];
  if(s.includes('АВТОНОМНЕ'))return ['😕','Навантаження на організм вище','Є ознаки підвищеного автономного навантаження. Це не обов’язково емоційний стрес.'];
  return ['😐','Даних недостатньо','HealthLab поки не має достатньо якісних даних для простого висновку.'];
}
function hlUpdateUserState(){
  const src=document.getElementById('stateNow'),mood=document.getElementById('userMood'),title=document.getElementById('userStateTitle'),text=document.getElementById('userStateText');
  if(!src||!mood||!title||!text)return;
  const [m,t,d]=hlMoodForState(src.textContent);mood.textContent=m;title.textContent=t;text.textContent=d;
  const hr=document.getElementById('pulseNow')?.textContent?.trim(),hrv=document.getElementById('hrvToday')?.textContent?.trim(),resp=document.getElementById('respToday')?.textContent?.trim();
  const set=(id,v,suffix)=>{const el=document.getElementById(id);if(el)el.textContent=v&&v!=='—'?`${v}${suffix}`:'—'};
  set('userHr',hr,' уд/хв');set('userHrv',hrv,' мс');set('userResp',resp,' /хв');
}
function hlTrendChip(label,arrow){const icon=arrow==='↑'?'↗':arrow==='↓'?'↘':'→';return `<span class="user-direction-chip">${label} ${icon}</span>`}
function hlUpdateUserTrend(){
  const src=document.getElementById('trendSummary'),box=document.getElementById('userTrendSummary'),chips=document.getElementById('userTrendChips');if(!src||!box||!chips)return;
  const txt=src.textContent.trim();if(!txt||txt.includes('Формую')||txt.includes('недоступний')){box.textContent='Напрямок ще формується.';chips.innerHTML='';return}
  const parts=txt.split('·').map(x=>x.trim()).filter(Boolean),friendly=[],out=[];
  parts.forEach(p=>{const m=p.match(/(.+?)\s*([↑↓→])$/);if(!m)return;const name=m[1].trim(),arrow=m[2];out.push(hlTrendChip(name,arrow));if(/HRV/i.test(name))friendly.push(arrow==='↑'?'HRV покращується':arrow==='↓'?'HRV знижується':'HRV стабільний');else if(/пульс/i.test(name))friendly.push(arrow==='↓'?'пульс спокою нижчий':arrow==='↑'?'пульс спокою вищий':'пульс спокою стабільний');else if(/сон/i.test(name))friendly.push(arrow==='↑'?'сну більше':arrow==='↓'?'сну менше':'сон стабільний')});
  box.textContent=friendly.length?friendly.join(' · '):txt;chips.innerHTML=out.join('');
}
function hlObserveSimple(){
  ['stateNow','pulseNow','hrvToday','respToday','trendSummary'].forEach(id=>{const el=document.getElementById(id);if(!el)return;new MutationObserver(()=>{hlUpdateUserState();hlUpdateUserTrend()}).observe(el,{childList:true,subtree:true,characterData:true})});
  hlUpdateUserState();hlUpdateUserTrend();
}

document.addEventListener('DOMContentLoaded',()=>{
  hlInstallShell();
  hlInstallModeSwitch();
  const isResearchPage=document.body.classList.contains('research-page');
  hlSetMode(isResearchPage?'research':hlSavedMode());
  hlObserveSimple();
});
// HealthLab primary navigation + additive secure extensions.
// Primary information architecture (2026-09-12):
//   Sleep -> Day (24/7) -> LAB -> OLD popup.
// OLD is a temporary migration/archive launcher. Legacy pages remain intact until their useful parts are moved.
(() => {
  function pageName(){return (location.pathname.split('/').pop()||'index.html').toLowerCase()}
  function activeSection(page){
    if(page==='lab.html')return 'lab';
    if(['timeline.html','activity.html','state.html','charts.html'].includes(page))return 'day';
    return 'sleep';
  }

  function oldMenuMarkup(){
    return `<div id="hlOldMenu" class="hl-old-menu" aria-hidden="true">
      <button class="hl-old-backdrop" type="button" data-hl-old-close aria-label="Закрити OLD"></button>
      <section class="hl-old-sheet" role="dialog" aria-modal="true" aria-label="OLD · старі розділи">
        <div class="hl-old-head">
          <div><span>АРХІВ / ПЕРЕНЕСЕННЯ</span><h2>OLD · старі розділи</h2></div>
          <button class="hl-old-close" type="button" data-hl-old-close aria-label="Закрити">×</button>
        </div>
        <p class="hl-old-note">Тут зберігаємо старі екрани, доки не перенесли потрібне у 🌙 Сон, ☀️ День або 🔬 LAB.</p>
        <div class="hl-old-grid">
          <a href="./charts.html"><strong>📈 24/7 графіки</strong><small>Старий набір денних графіків</small></a>
          <a href="./state.html"><strong>🫀 Стан</strong><small>HR · HRV · рух · пояснення</small></a>
          <a href="./index.html#sleepTrend"><strong>↗ Тренди</strong><small>Попередні тренди</small></a>
          <a href="./index.html#events"><strong>＋ Події</strong><small>Журнал і маркери</small></a>
          <a href="./sleep.html"><strong>◒ Sleep / Android</strong><small>Детальний старий sleep-екран</small></a>
          <a href="./reserve.html"><strong>🔋 Reserve / Battery</strong><small>Експериментальна метрика ресурсу</small></a>
        </div>
      </section>
    </div>`;
  }

  function ensureOldMenu(page){
    // The old inline migration block in LAB is superseded by the fourth bottom-nav button.
    if(page==='lab.html'){
      [...document.querySelectorAll('details')].forEach(d=>{
        if((d.textContent||'').includes('OLD · старі розділи'))d.remove();
      });
    }
    if(!document.getElementById('hlOldMenu'))document.body.insertAdjacentHTML('beforeend',oldMenuMarkup());
    const menu=document.getElementById('hlOldMenu');
    const trigger=document.querySelector('[data-hl-old-trigger]');
    const open=()=>{
      menu.classList.add('open');menu.setAttribute('aria-hidden','false');
      document.body.classList.add('hl-old-open');trigger?.classList.add('active');
    };
    const close=()=>{
      menu.classList.remove('open');menu.setAttribute('aria-hidden','true');
      document.body.classList.remove('hl-old-open');trigger?.classList.remove('active');
    };
    trigger?.addEventListener('click',open);
    menu.querySelectorAll('[data-hl-old-close]').forEach(x=>x.addEventListener('click',close));
    if(!window.__hlOldEscape){
      window.__hlOldEscape=true;
      document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    }
  }

  function installPrimaryNav(page){
    const navs=[...document.querySelectorAll('nav.bottom-nav')];
    if(!navs.length)return;
    const nav=navs[0];
    navs.slice(1).forEach(n=>n.remove());
    nav.classList.add('hl-main-nav');
    nav.classList.remove('sleep-web-nav');
    const active=activeSection(page);
    const items=[
      ['sleep','./index.html','🌙','Сон'],
      ['day','./timeline.html','☀️','День'],
      ['lab','./lab.html','🔬','LAB']
    ];
    nav.innerHTML=items.map(([k,href,icon,label])=>`<a class="nav-item ${active===k?'active':''}" href="${href}"><span>${icon}</span><b>${label}</b></a>`).join('')+
      `<button class="nav-item hl-old-trigger" type="button" data-hl-old-trigger><span>🗃️</span><b>OLD</b></button>`;
    nav.style.setProperty('grid-template-columns','repeat(4,minmax(0,1fr))','important');

    // Day is the canonical 24/7 view. Keep the underlying timeline implementation,
    // but present it as the Day surface in the primary UI.
    if(page==='timeline.html'){
      const h=document.querySelector('.topbar h1');if(h)h.textContent='День';
      const e=document.querySelector('.topbar .eyebrow');if(e)e.textContent='HEALTHLAB · 24/7';
      const back=document.querySelector('.timeline-lab-back');if(back)back.style.display='none';
      document.title='HealthLab · День';
    }
    ensureOldMenu(page);
  }

  function installSleepParity(page){
    if(page!=='sleep.html')return;
    document.documentElement.style.setProperty('overflow-x','hidden','important');
    document.body.style.setProperty('overflow-x','hidden','important');
    if(!document.querySelector('script[data-hl-sleep-parity]')){
      const s=document.createElement('script');
      s.src='./sleep-mirror-parity.js?v=20260911-1';
      s.dataset.hlSleepParity='1';
      s.onload=()=>{
        if(!document.querySelector('script[data-hl-sleep-uk]')){
          const u=document.createElement('script');u.src='./sleep-uk.js?v=20260911-1';u.dataset.hlSleepUk='1';document.body.appendChild(u);
        }
      };
      document.body.appendChild(s);
    } else if(!document.querySelector('script[data-hl-sleep-uk]')){
      const u=document.createElement('script');u.src='./sleep-uk.js?v=20260911-1';u.dataset.hlSleepUk='1';document.body.appendChild(u);
    }
  }

  function installSecureEvents(page){
    // Additive secure Event v2. Keep the legacy journal until authenticated migration is complete.
    if(document.getElementById('eventPhoto')&&!document.querySelector('script[data-hl-event-v2]')){
      if(!document.querySelector('link[data-hl-event-v2-css]')){
        const l=document.createElement('link');l.rel='stylesheet';l.href='./event-v2.css?v=20260912-1';l.dataset.hlEventV2Css='1';document.head.appendChild(l);
      }
      const s=document.createElement('script');s.src='./event-v2.js?v=20260912-1';s.dataset.hlEventV2='1';document.body.appendChild(s);
    }
    if(page==='timeline.html'&&!document.querySelector('script[data-hl-event-v2-timeline]')){
      const s=document.createElement('script');s.src='./event-v2-timeline.js?v=20260912-1';s.dataset.hlEventV2Timeline='1';document.body.appendChild(s);
    }
  }

  function install(){
    const page=pageName();
    installPrimaryNav(page);
    installSleepParity(page);
    installSecureEvents(page);
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  window.addEventListener('load',install);
})();
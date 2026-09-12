// HealthLab primary navigation + additive secure extensions.
// Primary information architecture (2026-09-12):
//   Sleep -> Day (24/7) -> LAB -> OLD legacy tray.
// OLD is a temporary launcher for legacy bottom-nav destinations that have not yet
// been migrated into the three canonical surfaces. Legacy pages remain intact.
(() => {
  function pageName(){return (location.pathname.split('/').pop()||'index.html').toLowerCase()}
  function activeSection(page){
    if(page==='lab.html')return 'lab';
    if(['timeline.html','activity.html','state.html','charts.html'].includes(page))return 'day';
    return 'sleep';
  }
  function ensureOldCss(){
    if(document.querySelector('link[data-hl-old-css]'))return;
    const l=document.createElement('link');l.rel='stylesheet';l.href='./old-menu.css?v=20260912-2';l.dataset.hlOldCss='1';document.head.appendChild(l);
  }

  function oldMenuMarkup(){
    return `<div id="hlOldMenu" class="hl-old-menu" aria-hidden="true">
      <nav class="hl-old-tray" aria-label="OLD · старі розділи">
        <a class="hl-old-item" href="./state.html" data-hl-old-link><span>🫀</span><b>Стан</b></a>
        <a class="hl-old-item" href="./index.html#sleepTrend" data-hl-old-link><span>↗</span><b>Тренди</b></a>
        <a class="hl-old-item" href="./index.html#events" data-hl-old-link><span>＋</span><b>Події</b></a>
        <a class="hl-old-item" href="./charts.html" data-hl-old-link><span>〽</span><b>Графіки</b></a>
      </nav>
    </div>`;
  }

  function ensureOldMenu(page){
    if(page==='lab.html'){
      [...document.querySelectorAll('details')].forEach(d=>{
        if((d.textContent||'').includes('OLD · старі розділи'))d.remove();
      });
    }
    if(!document.getElementById('hlOldMenu'))document.body.insertAdjacentHTML('beforeend',oldMenuMarkup());
    const menu=document.getElementById('hlOldMenu');
    const trigger=document.querySelector('[data-hl-old-trigger]');
    if(!menu||!trigger)return;
    const setOpen=(open)=>{
      menu.classList.toggle('open',open);
      menu.setAttribute('aria-hidden',open?'false':'true');
      trigger.classList.toggle('active',open);
      trigger.setAttribute('aria-expanded',open?'true':'false');
    };
    if(!trigger.dataset.hlOldBound){
      trigger.dataset.hlOldBound='1';
      trigger.setAttribute('aria-expanded','false');
      trigger.addEventListener('click',()=>setOpen(!menu.classList.contains('open')));
    }
    menu.querySelectorAll('[data-hl-old-link]').forEach(link=>{
      if(link.dataset.hlOldBound)return;
      link.dataset.hlOldBound='1';
      link.addEventListener('click',()=>setOpen(false));
    });
    if(!window.__hlOldEscape){
      window.__hlOldEscape=true;
      document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false)});
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
      `<button class="nav-item hl-old-trigger" type="button" data-hl-old-trigger aria-controls="hlOldMenu"><span>🗃️</span><b>OLD</b></button>`;
    nav.style.setProperty('grid-template-columns','repeat(4,minmax(0,1fr))','important');
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

  // Android/PWA browsers may restore Sleep/Day from the back-forward cache.
  // Canvas bitmaps can then be blank even though data and DOM are still alive.
  // Repaint on resume; only re-fetch when the page was actually restored.
  function repaintCharts(refreshData=false){
    const page=pageName();
    const repaint=()=>{
      try{window.dispatchEvent(new Event('resize'))}catch{}
      try{
        if(page==='timeline.html'&&typeof window.renderAll==='function')window.renderAll();
        if(page==='index.html'){
          if(typeof window.renderPulse==='function')window.renderPulse();
          if(typeof window.renderStateLab==='function')window.renderStateLab();
        }
      }catch(e){console.warn('HealthLab resume repaint',e)}
    };
    requestAnimationFrame(()=>requestAnimationFrame(repaint));
    setTimeout(repaint,120);
    setTimeout(repaint,420);
    if(refreshData&&typeof window.load==='function'){
      setTimeout(()=>{try{window.load()}catch(e){console.warn('HealthLab resume refresh',e)}},180);
    }
  }

  function installResumeFix(){
    if(window.__hlResumeFix)return;
    window.__hlResumeFix=true;
    window.addEventListener('pageshow',e=>repaintCharts(!!e.persisted));
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible')repaintCharts(false);
    });
    window.addEventListener('focus',()=>repaintCharts(false));
  }

  function install(){
    const page=pageName();
    ensureOldCss();
    installPrimaryNav(page);
    installSleepParity(page);
    installSecureEvents(page);
    installResumeFix();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  window.addEventListener('load',install);
})();
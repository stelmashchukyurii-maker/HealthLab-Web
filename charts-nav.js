// Additive HealthLab navigation extension.
// Timeline remains the preferred main Graphs page; legacy charts.html is preserved.
// Android Sleep mirror is a separate additive tab and does not replace the existing Sleep dashboard.
(() => {
  function install(){
    const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    const nav=document.querySelector('.hl-main-nav');
    if(nav){
      const lab=[...nav.querySelectorAll('.nav-item')].find(x=>/Лаб|LAB/i.test(x.textContent||''));

      if(!nav.querySelector('[data-hl-charts-tab]')){
        const a=document.createElement('a');
        a.className='nav-item'+(page==='timeline.html'?' active':'');
        a.href='./timeline.html';a.dataset.hlChartsTab='1';
        a.innerHTML='<span>⌁</span><b>Графіки</b>';
        if(lab)nav.insertBefore(a,lab);else nav.appendChild(a);
      }

      if(!nav.querySelector('[data-hl-sleep-tab]')){
        const a=document.createElement('a');
        a.className='nav-item'+(page==='sleep.html'?' active':'');
        a.href='./sleep.html';a.dataset.hlSleepTab='1';
        a.innerHTML='<span>◒</span><b>sleep</b>';
        const labNow=[...nav.querySelectorAll('.nav-item')].find(x=>/Лаб|LAB/i.test(x.textContent||''));
        if(labNow)nav.insertBefore(a,labNow);else nav.appendChild(a);
      }

      const count=nav.querySelectorAll('.nav-item').length;
      nav.style.setProperty('grid-template-columns',`repeat(${count},minmax(0,1fr))`,'important');
      if(page==='sleep.html'){
        document.documentElement.style.setProperty('overflow-x','hidden','important');
        document.body.style.setProperty('overflow-x','hidden','important');
        nav.style.setProperty('width','100vw','important');
        nav.style.setProperty('max-width','100vw','important');
        nav.style.setProperty('left','0','important');
        nav.style.setProperty('right','auto','important');
        nav.style.setProperty('margin-left','0','important');
        nav.style.setProperty('margin-right','0','important');
        nav.style.setProperty('padding-left','4px','important');
        nav.style.setProperty('padding-right','4px','important');
        if(!document.querySelector('script[data-hl-sleep-parity]')){
          const s=document.createElement('script');
          s.src='./sleep-mirror-parity.js?v=20260911-1';
          s.dataset.hlSleepParity='1';
          s.onload=()=>{
            if(!document.querySelector('script[data-hl-sleep-uk]')){
              const u=document.createElement('script');
              u.src='./sleep-uk.js?v=20260911-1';
              u.dataset.hlSleepUk='1';
              document.body.appendChild(u);
            }
          };
          document.body.appendChild(s);
        } else if(!document.querySelector('script[data-hl-sleep-uk]')){
          const u=document.createElement('script');
          u.src='./sleep-uk.js?v=20260911-1';
          u.dataset.hlSleepUk='1';
          document.body.appendChild(u);
        }
      }
    }

    // Additive secure Event v2. Keep legacy journal available until the user signs in,
    // so current HealthLab usage is not broken during the authenticated migration.
    if(document.getElementById('eventPhoto')&&!document.querySelector('script[data-hl-event-v2]')){
      if(!document.querySelector('link[data-hl-event-v2-css]')){
        const l=document.createElement('link');l.rel='stylesheet';l.href='./event-v2.css?v=20260912-1';l.dataset.hlEventV2Css='1';document.head.appendChild(l);
      }
      const s=document.createElement('script');s.src='./event-v2.js?v=20260912-1';s.dataset.hlEventV2='1';document.body.appendChild(s);
    }

    // When an authenticated Event v2 session exists, merge private context markers into
    // the preferred main timeline without replacing the existing physiology layers.
    if(page==='timeline.html'&&!document.querySelector('script[data-hl-event-v2-timeline]')){
      const s=document.createElement('script');s.src='./event-v2-timeline.js?v=20260912-1';s.dataset.hlEventV2Timeline='1';document.body.appendChild(s);
    }
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  window.addEventListener('load',install);
})();
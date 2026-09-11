// Additive HealthLab navigation extension.
// Timeline remains the preferred main Graphs page; legacy charts.html is preserved.
// Android Sleep mirror is a separate additive tab and does not replace the existing Sleep dashboard.
(() => {
  function install(){
    const nav=document.querySelector('.hl-main-nav');
    if(!nav)return;
    const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
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
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  window.addEventListener('load',install);
})();

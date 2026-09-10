// Additive HealthLab navigation extension. The user selected Timeline as the preferred main Graphs page.
// Legacy charts.html is preserved and not deleted.
(() => {
  function install(){
    const nav=document.querySelector('.hl-main-nav');
    if(!nav||nav.querySelector('[data-hl-charts-tab]'))return;
    const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    const a=document.createElement('a');
    a.className='nav-item'+(page==='timeline.html'?' active':'');
    a.href='./timeline.html';a.dataset.hlChartsTab='1';
    a.innerHTML='<span>⌁</span><b>Графіки</b>';
    const lab=[...nav.querySelectorAll('.nav-item')].find(x=>/Лаб|LAB/i.test(x.textContent||''));
    if(lab)nav.insertBefore(a,lab);else nav.appendChild(a);
    nav.style.gridTemplateColumns=`repeat(${nav.querySelectorAll('.nav-item').length},minmax(0,1fr))`;
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  window.addEventListener('load',install);
})();
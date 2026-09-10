// Additive HealthLab navigation extension: keep every existing tab and add Charts in parallel.
(() => {
  function install(){
    const nav=document.querySelector('.hl-main-nav');
    if(!nav||nav.querySelector('[data-hl-charts-tab]'))return;
    const a=document.createElement('a');
    a.className='nav-item'+((location.pathname.split('/').pop()||'index.html').toLowerCase()==='charts.html'?' active':'');
    a.href='./charts.html';a.dataset.hlChartsTab='1';
    a.innerHTML='<span>⌁</span><b>Графіки</b>';
    const lab=[...nav.querySelectorAll('.nav-item')].find(x=>/Лаб|LAB/i.test(x.textContent||''));
    if(lab)nav.insertBefore(a,lab);else nav.appendChild(a);
    nav.style.gridTemplateColumns=`repeat(${nav.querySelectorAll('.nav-item').length},minmax(0,1fr))`;
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
  window.addEventListener('load',install);
})();
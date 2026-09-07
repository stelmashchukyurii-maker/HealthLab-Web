(()=>{
  const chart=document.querySelector('.chart-card');
  const wrap=document.querySelector('.canvas-wrap');
  const tip=document.getElementById('pointTooltip');
  if(!chart||!wrap||!tip)return;

  tip.classList.add('point-inspector');
  wrap.insertAdjacentElement('afterend',tip);

  const strip=document.createElement('div');
  strip.className='selected-strip';
  strip.innerHTML=`<div class="selected-strip-left"><span id="stripDot" class="state-dot unknown"></span><span id="stripTime" class="selected-strip-time">—</span><b id="stripState" class="selected-strip-state">—</b></div><div class="selected-strip-right"><b id="stripLoad" class="selected-strip-load">HL —</b><span id="stripHr" class="selected-strip-hr">HR —</span></div>`;
  wrap.insertAdjacentElement('beforebegin',strip);

  const legend=chart.querySelector('.legend');
  if(legend){
    const details=document.createElement('details');
    details.className='timeline-color-help';
    details.innerHTML='<summary>Що означають кольори?</summary><div>Кольоровий фон показує стан, який HealthLab визначив для того самого 5-хвилинного відрізка: відпочинок, фізичне навантаження, відновлення, автономне навантаження, сон або невідомо. Це висновок моделі, а не окремий вимір датчика.</div>';
    legend.insertAdjacentElement('afterend',details);
  }

  const src={
    state:document.getElementById('stateName'),
    load:document.getElementById('loadScore'),
    time:document.getElementById('pointTime'),
    hr:document.getElementById('pointHr'),
    dot:document.getElementById('stateDot')
  };
  const dst={
    state:document.getElementById('stripState'),
    load:document.getElementById('stripLoad'),
    time:document.getElementById('stripTime'),
    hr:document.getElementById('stripHr'),
    dot:document.getElementById('stripDot')
  };
  const sync=()=>{
    if(dst.state)dst.state.textContent=src.state?.textContent||'—';
    if(dst.load)dst.load.textContent='HL '+(src.load?.textContent||'—')+'/100';
    if(dst.time)dst.time.textContent=src.time?.textContent||'—';
    if(dst.hr)dst.hr.textContent='HR '+(src.hr?.textContent||'—');
    if(dst.dot&&src.dot)dst.dot.className=src.dot.className;
  };
  const obs=new MutationObserver(sync);
  Object.values(src).filter(Boolean).forEach(el=>obs.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']}));
  sync();
})();

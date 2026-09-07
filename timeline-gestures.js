(()=>{
  const c=document.getElementById('timelineChart');
  const chart=document.querySelector('.chart-card');
  if(!c||!chart||typeof dayEnd!=='function'||typeof rangeStart!=='function')return;

  const DATA_DAY_END=dayEnd;
  const BASE_LOAD=load;
  let viewStart=null,viewEnd=null,bypassView=false;
  const MIN_SPAN=30*60*1000;
  const DAY_MS=24*60*60*1000;
  const pointers=new Map();
  let pinch=null,lastTap=0;

  function dataBounds(){
    return {start:selectedDay.getTime(),end:DATA_DAY_END()};
  }
  function clampView(start,end){
    const b=dataBounds(),full=Math.max(MIN_SPAN,b.end-b.start);
    let span=Math.min(Math.max(end-start,MIN_SPAN),Math.min(DAY_MS,full));
    let s=start,e=s+span;
    if(s<b.start){s=b.start;e=s+span}
    if(e>b.end){e=b.end;s=e-span}
    if(s<b.start)s=b.start;
    return [s,e];
  }
  function currentView(){
    const b=dataBounds();
    return [viewStart??Math.max(b.start,b.end-hours*3600000),viewEnd??b.end];
  }
  function setView(start,end,reason='zoom'){
    [viewStart,viewEnd]=clampView(start,end);
    document.querySelectorAll('#rangeButtons button').forEach(b=>b.classList.remove('active'));
    sliceVisible();renderAll();updateGestureUi(reason);
  }
  function resetView(){
    viewStart=null;viewEnd=null;
    sliceVisible();renderAll();updateGestureUi('reset');
  }

  dayEnd=function(){return bypassView?DATA_DAY_END():(viewEnd??DATA_DAY_END())};
  rangeStart=function(){return viewStart??Math.max(selectedDay.getTime(),dayEnd()-hours*3600000)};
  load=function(){
    bypassView=true;
    let p;
    try{p=BASE_LOAD()}finally{bypassView=false}
    return Promise.resolve(p).then(v=>{if(viewStart!==null){[viewStart,viewEnd]=clampView(viewStart,viewEnd);sliceVisible();renderAll();updateGestureUi('refresh')}return v});
  };

  ['prevDay','nextDay','todayBtn'].forEach(id=>{
    const el=document.getElementById(id);if(!el||!el.onclick)return;
    const old=el.onclick;el.onclick=function(e){viewStart=null;viewEnd=null;return old.call(this,e)};
  });
  document.querySelectorAll('#rangeButtons button').forEach(b=>{
    if(!b.onclick)return;const old=b.onclick;
    b.onclick=function(e){viewStart=null;viewEnd=null;const out=old.call(this,e);updateGestureUi('preset');return out};
  });

  const bar=document.createElement('div');
  bar.className='gesture-bar';
  bar.innerHTML=`<div class="gesture-left"><button id="gestureReset" type="button">↺ Весь діапазон</button><span id="gestureSpan">24 год</span></div><div class="gesture-right"><span class="gesture-hint">2 пальці: масштаб / зсув</span><button id="gestureFullscreen" type="button" aria-label="Повний екран">⛶</button></div>`;
  const wrap=c.parentElement;
  wrap.insertAdjacentElement('beforebegin',bar);
  const resetBtn=bar.querySelector('#gestureReset'),fullBtn=bar.querySelector('#gestureFullscreen'),spanEl=bar.querySelector('#gestureSpan');
  resetBtn.onclick=()=>resetView();
  fullBtn.onclick=async()=>{
    try{
      if(!document.fullscreenElement){
        await chart.requestFullscreen?.();
        try{await screen.orientation?.lock?.('landscape')}catch{}
      }else await document.exitFullscreen?.();
    }catch{}
  };
  document.addEventListener('fullscreenchange',()=>{fullBtn.textContent=document.fullscreenElement?'×':'⛶';if(!document.fullscreenElement){try{screen.orientation?.unlock?.()}catch{}};setTimeout(()=>renderChart(),80)});
  window.addEventListener('orientationchange',()=>setTimeout(()=>renderChart(),180));

  function updateGestureUi(){
    const [s,e]=currentView(),mins=Math.round((e-s)/60000);
    spanEl.textContent=mins>=60?(mins%60?`${Math.floor(mins/60)} год ${mins%60} хв`:`${Math.floor(mins/60)} год`):`${mins} хв`;
    resetBtn.classList.toggle('active',viewStart!==null);
  }

  function geom(){return c._chartGeom}
  function localX(ev){const r=c.getBoundingClientRect();return ev.clientX-r.left}
  function midpoint(a,b){return (a+b)/2}
  function distance(a,b){return Math.abs(a-b)}

  c.addEventListener('pointerdown',e=>{
    c.setPointerCapture?.(e.pointerId);pointers.set(e.pointerId,{x:localX(e),y:e.clientY});
    if(pointers.size===2){
      e.preventDefault();e.stopImmediatePropagation();
      const ps=[...pointers.values()],g=geom();if(!g)return;
      const [s,en]=currentView(),mid=midpoint(ps[0].x,ps[1].x),dist=Math.max(20,distance(ps[0].x,ps[1].x));
      const frac=clamp((mid-g.L)/g.W,0,1);
      pinch={startS:s,startE:en,startSpan:en-s,startDist:dist,anchor:s+frac*(en-s)};
    }
  },true);

  c.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:localX(e),y:e.clientY});
    if(pointers.size>=2&&pinch){
      e.preventDefault();e.stopImmediatePropagation();
      const ps=[...pointers.values()].slice(0,2),g=geom();if(!g)return;
      const mid=midpoint(ps[0].x,ps[1].x),dist=Math.max(20,distance(ps[0].x,ps[1].x));
      const b=dataBounds(),maxSpan=Math.max(MIN_SPAN,b.end-b.start);
      const span=clamp(pinch.startSpan*(pinch.startDist/dist),MIN_SPAN,maxSpan);
      const frac=clamp((mid-g.L)/g.W,0,1);
      const s=pinch.anchor-frac*span;
      setView(s,s+span,'pinch');
    }
  },true);

  function endPointer(e){
    pointers.delete(e.pointerId);
    if(pointers.size<2)pinch=null;
  }
  c.addEventListener('pointerup',endPointer,true);
  c.addEventListener('pointercancel',endPointer,true);

  c.addEventListener('dblclick',e=>{e.preventDefault();resetView()},true);
  c.addEventListener('pointerup',e=>{
    if(e.pointerType!=='touch'||pointers.size)return;
    const now=Date.now();if(now-lastTap<330){resetView();lastTap=0}else lastTap=now;
  });

  updateGestureUi('init');
})();

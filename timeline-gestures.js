(()=>{
  const c=document.getElementById('timelineChart');
  const chart=document.querySelector('.chart-card');
  if(!c||!chart||typeof dayEnd!=='function'||typeof rangeStart!=='function')return;

  const DATA_DAY_END=dayEnd;
  const BASE_LOAD=load;
  let viewStart=null,viewEnd=null,bypassView=false;
  const MIN_SPAN=30*60*1000;
  const DETAIL_MAX_SPAN=12*60*60*1000;
  const DAY_MS=24*60*60*1000;
  const pointers=new Map();
  let pinch=null,single=null,lastTap=0;

  function dataBounds(){
    return {start:selectedDay.getTime(),end:DATA_DAY_END()};
  }
  function isDetailMode(){
    return document.fullscreenElement===chart||(window.matchMedia?.('(orientation: landscape)').matches&&window.innerHeight<700);
  }
  function maxAllowedSpan(){
    const b=dataBounds(),full=Math.max(MIN_SPAN,b.end-b.start);
    return Math.min(isDetailMode()?DETAIL_MAX_SPAN:DAY_MS,full);
  }
  function clampView(start,end){
    const b=dataBounds();
    let span=Math.min(Math.max(end-start,MIN_SPAN),maxAllowedSpan());
    let s=start,e=s+span;
    if(s<b.start){s=b.start;e=s+span}
    if(e>b.end){e=b.end;s=e-span}
    if(s<b.start)s=b.start;
    return [s,e];
  }
  function currentView(){
    const b=dataBounds();
    if(viewStart!==null&&viewEnd!==null)return [viewStart,viewEnd];
    let span=Math.min(hours*3600000,b.end-b.start);
    if(isDetailMode())span=Math.min(span,DETAIL_MAX_SPAN);
    return [Math.max(b.start,b.end-span),b.end];
  }
  function setView(start,end,reason='zoom'){
    [viewStart,viewEnd]=clampView(start,end);
    document.querySelectorAll('#rangeButtons button').forEach(b=>b.classList.remove('active'));
    sliceVisible();renderAll();updateGestureUi(reason);
  }
  function resetView(){
    const b=dataBounds();
    if(isDetailMode()&&b.end-b.start>DETAIL_MAX_SPAN){
      setView(b.end-DETAIL_MAX_SPAN,b.end,'reset12');
      return;
    }
    viewStart=null;viewEnd=null;
    sliceVisible();renderAll();updateGestureUi('reset');
  }
  function capForDetail(){
    if(!isDetailMode())return;
    const [s,e]=currentView();
    if(e-s>DETAIL_MAX_SPAN)setView(e-DETAIL_MAX_SPAN,e,'detail12');
    else updateGestureUi('detail');
  }

  dayEnd=function(){return bypassView?DATA_DAY_END():(viewEnd??DATA_DAY_END())};
  rangeStart=function(){
    if(viewStart!==null)return viewStart;
    const b=dataBounds(),e=dayEnd();
    const span=Math.min(hours*3600000,isDetailMode()?DETAIL_MAX_SPAN:DAY_MS,e-b.start);
    return Math.max(b.start,e-span);
  };
  load=function(){
    bypassView=true;
    let p;
    try{p=BASE_LOAD()}finally{bypassView=false}
    return Promise.resolve(p).then(v=>{
      if(viewStart!==null){[viewStart,viewEnd]=clampView(viewStart,viewEnd);sliceVisible();renderAll()}
      updateGestureUi('refresh');return v;
    });
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
  bar.innerHTML=`<div class="gesture-left"><button id="gestureReset" type="button">↺ Весь діапазон</button><span id="gestureSpan">24 год</span></div><div class="gesture-right"><span class="gesture-hint">2 пальці: масштаб · 1 палець: зсув</span><button id="gestureFullscreen" type="button" aria-label="Повний екран">⛶</button></div>`;
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
  document.addEventListener('fullscreenchange',()=>{
    fullBtn.textContent=document.fullscreenElement?'×':'⛶';
    if(!document.fullscreenElement){try{screen.orientation?.unlock?.()}catch{}}
    setTimeout(()=>{capForDetail();renderChart()},80);
  });
  window.addEventListener('orientationchange',()=>setTimeout(()=>{capForDetail();renderChart()},180));

  function updateGestureUi(){
    const [s,e]=currentView(),mins=Math.round((e-s)/60000);
    spanEl.textContent=mins>=60?(mins%60?`${Math.floor(mins/60)} год ${mins%60} хв`:`${Math.floor(mins/60)} год`):`${mins} хв`;
    resetBtn.textContent=isDetailMode()?'↺ 12 год':'↺ Весь діапазон';
    resetBtn.classList.toggle('active',viewStart!==null);
  }

  function geom(){return c._chartGeom}
  function localX(ev){const r=c.getBoundingClientRect();return ev.clientX-r.left}
  function midpoint(a,b){return (a+b)/2}
  function distance(a,b){return Math.abs(a-b)}

  c.addEventListener('pointerdown',e=>{
    c.setPointerCapture?.(e.pointerId);
    const p={x:localX(e),y:e.clientY,startX:localX(e),startY:e.clientY,t:performance.now()};
    pointers.set(e.pointerId,p);
    if(pointers.size===1&&e.pointerType==='touch'){
      const [s,en]=currentView();
      single={id:e.pointerId,startX:p.x,startY:p.y,startTime:p.t,startS:s,startE:en,mode:null};
    }
    if(pointers.size===2){
      single=null;
      e.preventDefault();e.stopImmediatePropagation();
      const ps=[...pointers.values()],g=geom();if(!g)return;
      const [s,en]=currentView(),mid=midpoint(ps[0].x,ps[1].x),dist=Math.max(20,distance(ps[0].x,ps[1].x));
      const frac=clamp((mid-g.L)/g.W,0,1);
      pinch={startS:s,startE:en,startSpan:en-s,startDist:dist,anchor:s+frac*(en-s),anchorFrac:frac};
    }
  },true);

  c.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    const p=pointers.get(e.pointerId);p.x=localX(e);p.y=e.clientY;pointers.set(e.pointerId,p);

    if(pointers.size>=2&&pinch){
      e.preventDefault();e.stopImmediatePropagation();
      const ps=[...pointers.values()].slice(0,2),dist=Math.max(20,distance(ps[0].x,ps[1].x));
      const span=clamp(pinch.startSpan*(pinch.startDist/dist),MIN_SPAN,maxAllowedSpan());
      const s=pinch.anchor-pinch.anchorFrac*span;
      setView(s,s+span,'pinch');
      return;
    }

    if(pointers.size===1&&single&&single.id===e.pointerId&&e.pointerType==='touch'){
      const dx=p.x-single.startX,dy=p.y-single.startY,elapsed=performance.now()-single.startTime;
      if(single.mode===null){
        if(elapsed>=320)single.mode='cursor';
        else if(Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.15)single.mode='pan';
      }
      if(single.mode==='pan'){
        e.preventDefault();e.stopImmediatePropagation();
        const g=geom();if(!g)return;
        const span=single.startE-single.startS;
        const shift=-(dx/g.W)*span;
        setView(single.startS+shift,single.startE+shift,'pan');
      }
    }
  },true);

  function endPointer(e){
    const wasPan=single&&single.id===e.pointerId&&single.mode==='pan';
    pointers.delete(e.pointerId);
    if(pointers.size<2)pinch=null;
    if(single&&single.id===e.pointerId)single=null;
    if(wasPan){e.preventDefault();e.stopImmediatePropagation();lastTap=0;return}
    if(e.pointerType==='touch'&&pointers.size===0){
      const now=Date.now();
      if(now-lastTap<330){resetView();lastTap=0}else lastTap=now;
    }
  }
  c.addEventListener('pointerup',endPointer,true);
  c.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;if(single&&single.id===e.pointerId)single=null},true);

  c.addEventListener('dblclick',e=>{e.preventDefault();resetView()},true);

  updateGestureUi('init');
})();

(() => {
  const canvas=document.getElementById('labDemoChart'),card=document.getElementById('labDemoChartCard'),note=document.getElementById('labChartDataNote'),fullBtn=document.getElementById('labChartFullscreenBtn'),rotateHint=document.getElementById('labChartRotateHint');
  if(!canvas||!card)return;
  const BASE='http://127.0.0.1:18765',BIN=180,MAX_PAGES=40,LIMIT=5000;
  let points=[],viewStart=null,viewEnd=null,selected=null,pinchBase=null,analysis=false; const touches=new Map();
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),norm=t=>Number(t)<1e12?Number(t)*1000:Number(t);
  async function lf(url){try{return await fetch(url,{cache:'no-store',targetAddressSpace:'loopback'})}catch(e){return fetch(url,{cache:'no-store'})}}
  async function load(){
    const to=Math.floor(Date.now()/1000),from=to-86400; let cts=null,crid=null,rows=[];
    try{
      for(let page=0;page<MAX_PAGES;page++){
        const u=new URL(BASE+'/range');u.searchParams.set('table','hrSample');u.searchParams.set('from',from);u.searchParams.set('to',to);u.searchParams.set('limit',LIMIT);
        if(cts!=null){u.searchParams.set('cursor_ts',cts);u.searchParams.set('cursor_rowid',crid)}
        const r=await lf(u);const j=await r.json();if(!r.ok||j.ok!==true||j.route!=='LOCAL'||j.store!=='noop_whoop.db'||j.read_only!==true||j.api!=='historical_range_v1')throw new Error('LOCAL /range contract');
        rows.push(...(j.rows||[])); if(!j.has_more)break; cts=j.next_cursor_ts;crid=j.next_cursor_rowid;if(cts==null||crid==null)break;
      }
      const bins=new Map();
      for(const x of rows){const ts=Number(x.ts),bpm=Number(x.bpm);if(!Number.isFinite(ts)||!Number.isFinite(bpm)||bpm<=0)continue;const k=Math.floor(ts/BIN)*BIN;const b=bins.get(k)||{ts:k,sum:0,n:0,min:bpm,max:bpm};b.sum+=bpm;b.n++;b.min=Math.min(b.min,bpm);b.max=Math.max(b.max,bpm);bins.set(k,b)}
      points=[...bins.values()].map(b=>({ts:b.ts,bpm:b.sum/b.n,min:b.min,max:b.max,n:b.n})).sort((a,b)=>a.ts-b.ts);
      if(!points.length)throw new Error('NO HR ROWS');
      viewStart=from;viewEnd=to;note.textContent=`HealthLab local · HR · 3 хв · ${points.length} точок · ${rows.length} raw`;draw();
    }catch(e){points=[];note.textContent='HealthLab local · HR недоступний · відкрий HealthLab / Local Gateway';draw()}
  }
  function box(){const r=canvas.getBoundingClientRect(),land=matchMedia('(orientation:landscape)').matches;const left=land||analysis?48:40,right=12,top=34,bottom=42;return{r,left,right,top,bottom,pw:r.width-left-right,ph:r.height-top-bottom}}
  const span=()=>Math.max(1,(viewEnd??1)-(viewStart??0)),xFor=(ts,b)=>b.left+((ts-viewStart)/span())*b.pw,tsFor=x=>{const b=box();return viewStart+clamp((x-b.r.left-b.left)/Math.max(1,b.pw),0,1)*span()};
  const fmt=ts=>new Date(norm(ts)).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'});
  function visible(){return points.filter(p=>p.ts>=viewStart&&p.ts<=viewEnd)}
  function draw(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,r.width,r.height);const b=box(),v=visible();
    c.font='10px system-ui,sans-serif';c.fillStyle='#94a3b8';c.strokeStyle='rgba(148,163,184,.16)';c.lineWidth=1;
    if(!v.length){c.textAlign='center';c.fillText('Немає локальних HR-даних',b.left+b.pw/2,b.top+b.ph/2);return}
    let ymin=Math.floor(Math.min(...v.map(p=>p.min))/10)*10-10,ymax=Math.ceil(Math.max(...v.map(p=>p.max))/10)*10+10;if(ymax-ymin<40){ymin-=10;ymax+=10}
    for(let i=0;i<=4;i++){const val=Math.round(ymin+(ymax-ymin)*i/4),y=b.top+b.ph-(i/4)*b.ph;c.beginPath();c.moveTo(b.left,y);c.lineTo(b.left+b.pw,y);c.stroke();c.textAlign='right';c.textBaseline='middle';c.fillText(String(val),b.left-6,y)}
    for(let i=0;i<=6;i++){const ts=viewStart+span()*i/6,x=xFor(ts,b);c.beginPath();c.moveTo(x,b.top);c.lineTo(x,b.top+b.ph);c.stroke();c.textAlign='center';c.textBaseline='top';c.fillText(fmt(ts),x,b.top+b.ph+18)}
    c.save();c.beginPath();c.rect(b.left,b.top,b.pw,b.ph);c.clip();c.strokeStyle='#60a5fa';c.lineWidth=2;c.lineJoin='round';c.lineCap='round';c.beginPath();let started=false;
    for(const p of v){const x=xFor(p.ts,b),y=b.top+b.ph-((p.bpm-ymin)/(ymax-ymin))*b.ph;if(!started){c.moveTo(x,y);started=true}else c.lineTo(x,y)}c.stroke();c.restore();
    if(Number.isFinite(selected)){const p=v.reduce((a,z)=>Math.abs(z.ts-selected)<Math.abs(a.ts-selected)?z:a,v[0]),x=xFor(p.ts,b),y=b.top+b.ph-((p.bpm-ymin)/(ymax-ymin))*b.ph;c.strokeStyle='#f8fafc';c.setLineDash([5,4]);c.beginPath();c.moveTo(x,b.top);c.lineTo(x,b.top+b.ph);c.stroke();c.setLineDash([]);c.fillStyle='#f8fafc';c.font='700 12px system-ui';c.textAlign='center';c.fillText(`${fmt(p.ts)} · ${Math.round(p.bpm)} bpm`,clamp(x,b.left+55,b.left+b.pw-55),Math.max(b.top+14,y-10))}
  }
  function select(x){if(!points.length)return;selected=tsFor(x);draw()}
  function reset(){if(!points.length)return;viewStart=Math.floor(Date.now()/1000)-86400;viewEnd=Math.floor(Date.now()/1000);draw()}
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),center=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  function beginPinch(){if(touches.size!==2)return;const[a,b]=[...touches.values()],ct=center(a,b);pinchBase={distance:Math.max(1,dist(a,b)),span:span(),centerX:ct.x,centerTs:tsFor(ct.x)}}
  canvas.addEventListener('touchstart',e=>{for(const t of e.changedTouches)touches.set(t.identifier,{x:t.clientX,y:t.clientY});if(touches.size>=2){e.preventDefault();beginPinch()}else select([...touches.values()][0].x)},{passive:false});
  canvas.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(touches.has(t.identifier))touches.set(t.identifier,{x:t.clientX,y:t.clientY});if(touches.size>=2&&pinchBase){e.preventDefault();const[a,b]=[...touches.values()].slice(0,2),ct=center(a,b),target=clamp(pinchBase.span*pinchBase.distance/Math.max(1,dist(a,b)),3600,86400),bx=box(),ratio=clamp((ct.x-bx.r.left-bx.left)/Math.max(1,bx.pw),0,1),translated=pinchBase.centerTs+((pinchBase.centerX-ct.x)/Math.max(1,bx.pw))*target;let s=clamp(translated-ratio*target,Math.floor(Date.now()/1000)-86400,Math.floor(Date.now()/1000)-target);viewStart=s;viewEnd=s+target;draw()}else if(touches.size===1)select([...touches.values()][0].x)},{passive:false});
  const end=e=>{for(const t of e.changedTouches)touches.delete(t.identifier);if(touches.size<2)pinchBase=null};canvas.addEventListener('touchend',end,{passive:false});canvas.addEventListener('touchcancel',end,{passive:false});canvas.addEventListener('dblclick',reset);
  async function enter(){analysis=true;card.classList.add('chart-analysis-mode');fullBtn&&(fullBtn.textContent='×');try{await card.requestFullscreen?.()}catch{}try{await screen.orientation?.lock?.('landscape')}catch{}setTimeout(draw,100)}
  async function exit(){analysis=false;card.classList.remove('chart-analysis-mode');fullBtn&&(fullBtn.textContent='⛶');if(document.fullscreenElement)try{await document.exitFullscreen()}catch{}try{screen.orientation?.unlock?.()}catch{}rotateHint&&(rotateHint.hidden=true);setTimeout(draw,100)}
  fullBtn?.addEventListener('click',()=>analysis?exit():enter());document.addEventListener('fullscreenchange',()=>{if(analysis&&!document.fullscreenElement)exit();else setTimeout(draw,80)});window.addEventListener('resize',()=>requestAnimationFrame(draw));new ResizeObserver(draw).observe(canvas);
  document.getElementById('labTab')?.addEventListener('click',()=>{if(!points.length)load()});load();
})();
const $=id=>document.getElementById(id);
const API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
const META={
  SLEEP:{label:'Сон',cls:'sleep'},
  REST:{label:'Відпочинок',cls:'rest'},
  MOVEMENT:{label:'Фізичне навантаження',cls:'move'},
  RECOVERY:{label:'Відновлення після руху',cls:'recovery'},
  AUTONOMIC_LOAD:{label:'Автономне навантаження',cls:'load'},
  UNKNOWN:{label:'Невідомо',cls:'unknown'}
};
const COLORS={SLEEP:'#8f7bff',REST:'#4da3ff',MOVEMENT:'#ff9b4a',RECOVERY:'#ffd66b',AUTONOMIC_LOAD:'#ff5f7f',UNKNOWN:'#68748a',hr:'#ecf3ff',motion:'#6ed6d0',hrv:'#c895ff',event:'#ffffff',meal:'#5bd18f'};
let selectedDay=startOfDay(new Date()),hours=24,allRows=[],rows=[],events=[],model={},hoverIndex=null;
let layers={load:true,hr:true,motion:true,hrv:false,events:true};

$('refreshBtn').onclick=load;
$('prevDay').onclick=()=>{selectedDay=new Date(selectedDay.getTime()-86400000);load()};
$('nextDay').onclick=()=>{const n=new Date(selectedDay.getTime()+86400000);if(n<=startOfDay(new Date())){selectedDay=n;load()}};
$('todayBtn').onclick=()=>{selectedDay=startOfDay(new Date());load()};
document.querySelectorAll('#rangeButtons button').forEach(b=>b.onclick=()=>{hours=Number(b.dataset.hours);document.querySelectorAll('#rangeButtons button').forEach(x=>x.classList.toggle('active',x===b));sliceVisible();renderAll()});
document.querySelectorAll('#layerButtons button').forEach(b=>b.onclick=()=>{
  const key=b.dataset.layer;
  if(b.classList.contains('future')){$('layerHint').textContent=key==='glucose'?'Шар глюкози вже зарезервований. З’явиться автоматично після підключення CGM/глюкометра.':'Цей Garmin-шар зарезервований. Поки прямі хвилинні Stress / Body Battery ще не надходять у HealthLab.';return}
  layers[key]=!layers[key];b.classList.toggle('on',layers[key]);saveLayerPrefs();renderChart();
});

const canvas=$('timelineChart');
canvas.addEventListener('pointerdown',pickPoint);
canvas.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')pickPoint(e)});
window.addEventListener('resize',()=>renderChart());
loadLayerPrefs();load();

async function api(p){const u=new URL(API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d&&d.error)throw Error(d.error);return d}
function startOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
function dayEnd(){const today=startOfDay(new Date()).getTime(),d0=selectedDay.getTime();return d0===today?Date.now():d0+86400000-1}
function rangeStart(){return Math.max(selectedDay.getTime(),dayEnd()-hours*3600000)}
function epochMs(v){const n=Number(v);return Number.isFinite(n)?(n<1e12?n*1000:n):0}
function num(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function quantile(a,q){if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),p=(x.length-1)*q,b=Math.floor(p),d=p-b;return x[b+1]!==undefined?x[b]+d*(x[b+1]-x[b]):x[b]}
function median(a){return quantile(a.filter(Number.isFinite),.5)}
function signed(v){return `${v>=0?'+':''}${Math.round(v)}`}
function fmtTime(ts){return new Date(ts).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}
function fmtDate(d){return d.toLocaleDateString('uk-UA',{weekday:'short',day:'2-digit',month:'2-digit'})}
function validHrv(r){return r.rrCount>=100&&Number.isFinite(r.rmssd)&&r.rmssd>=5&&r.rmssd<=250}
function motionWord(r){if(!Number.isFinite(r.motion)||!Number.isFinite(model.movementThreshold))return '—';const k=r.motion/Math.max(model.movementThreshold,.001);if(k<.5)return 'дуже низький';if(k<1)return 'низький';if(k<2.5)return 'помірний';return 'високий'}
function shortReason(r){const s=String(r?.reason||'');return s.length>135?s.slice(0,132)+'…':s}

async function load(){
  $('status').textContent='Оновлюю хронологію…';
  $('selectedDate').textContent=fmtDate(selectedDay);
  $('nextDay').disabled=selectedDay.getTime()>=startOfDay(new Date()).getTime();
  try{
    const from=Math.floor(selectedDay.getTime()/1000),to=Math.floor(dayEnd()/1000);
    const [state,timeline]=await Promise.all([api({api:'state',from,to,bucket:300}),api({api:'timeline',limit:300})]);
    allRows=(Array.isArray(state)?state:[]).map(r=>({ts:epochMs(r.bucket_ts),avgHr:num(r.avg_hr),minHr:num(r.min_hr),maxHr:num(r.max_hr),motion:num(r.motion_score),rrCount:Number(r.rr_count||0),rmssd:num(r.rmssd_ms),sleep:r.sleep_state==='SLEEP'})).filter(r=>r.ts).sort((a,b)=>a.ts-b.ts);
    events=(Array.isArray(timeline)?timeline:[]).map(e=>({...e,ts:new Date(e.occurred_at).getTime()})).filter(e=>Number.isFinite(e.ts)&&e.ts>=selectedDay.getTime()&&e.ts<=selectedDay.getTime()+86400000).sort((a,b)=>a.ts-b.ts);
    classifyAll();sliceVisible();renderAll();
    $('status').textContent=`${allRows.length} п’ятихвилинних вікон · ${events.length} подій`;
  }catch(e){$('status').textContent='Помилка: '+e.message;allRows=[];rows=[];renderAll()}
}

function classifyAll(){
  if(!allRows.length)return;
  const motions=allRows.map(r=>r.motion).filter(v=>Number.isFinite(v)&&v>0);const q25=quantile(motions,.25),q75=quantile(motions,.75);let th=(Number.isFinite(q25)&&Number.isFinite(q75))?Math.sqrt(Math.max(q25,1e-6)*Math.max(q75,1e-6)):.02;th=clamp(th,.005,.05);
  const quiet=allRows.filter(r=>!r.sleep&&Number.isFinite(r.avgHr)&&Number.isFinite(r.motion)&&r.motion<th);
  const baselineHr=median(quiet.map(r=>r.avgHr));const baselineRmssd=median(quiet.filter(validHrv).map(r=>r.rmssd));model={movementThreshold:th,baselineHr,baselineRmssd};
  let lastActive=-Infinity;
  allRows.forEach((r,i)=>{
    r.context=findContext(r.ts);r.hrvValid=validHrv(r);r.residual=Number.isFinite(baselineHr)&&Number.isFinite(r.avgHr)?r.avgHr-baselineHr:null;
    if(r.sleep){setState(r,'SLEEP',.98,'Сон за даними сесії сну.');return}
    if(!Number.isFinite(r.avgHr)||!Number.isFinite(r.motion)){setState(r,'UNKNOWN',.15,'Не вистачає одночасних даних пульсу й руху.');return}
    if(r.motion>=th){lastActive=i;setState(r,'MOVEMENT',.85,`Рух вищий за персональний поріг (${r.motion.toFixed(3)} ≥ ${th.toFixed(3)}).`);return}
    const ageMin=Number.isFinite(lastActive)?(i-lastActive)*5:Infinity;
    if(ageMin<=30||(ageMin<=120&&Number.isFinite(r.residual)&&r.residual>8)){setState(r,'RECOVERY',ageMin<=30?.85:.65,`Рух уже низький, але активність була приблизно ${Math.round(ageMin)} хв тому${Number.isFinite(r.residual)?`; пульс ${signed(r.residual)} уд/хв відносно спокійного рівня`:''}.`);return}
    const hrvSupp=(r.hrvValid&&Number.isFinite(baselineRmssd)&&baselineRmssd>0)?(baselineRmssd-r.rmssd)/baselineRmssd:null;
    if(Number.isFinite(r.residual)&&r.residual>=12&&((Number.isFinite(hrvSupp)&&hrvSupp>=.15)||(!r.hrvValid&&r.residual>=16))){
      let why=`Рух низький, але пульс ${signed(r.residual)} уд/хв відносно спокійного рівня`;
      if(r.hrvValid)why+=`; RMSSD нижчий за спокійний орієнтир приблизно на ${Math.max(0,Math.round(hrvSupp*100))}%`;
      else why+='; RR/HRV у цьому вікні недостатньої якості';
      if(r.context.meal)why+='; є післяїжний контекст, тому це не трактуємо як емоційний стрес';
      setState(r,'AUTONOMIC_LOAD',r.hrvValid?.72:.55,why+'.');return;
    }
    setState(r,'REST',r.hrvValid?.82:.65,`Низький рух; пульс близький до персонального спокійного рівня${Number.isFinite(r.residual)?` (${signed(r.residual)} уд/хв)`:''}.`);
  });
  allRows.forEach(r=>r.loadScore=calcLoad(r));
}
function setState(r,state,confidence,reason){r.state=state;r.confidence=confidence;r.reason=reason}
function calcLoad(r){
  if(r.state==='SLEEP')return 0;if(r.state==='UNKNOWN')return null;
  if(r.state==='MOVEMENT')return Math.round(clamp(35+65*Math.min(1,r.motion/Math.max(model.movementThreshold*8,.001)),0,100));
  if(r.state==='RECOVERY')return Math.round(clamp(25+Math.max(0,r.residual||0)*2.5,20,80));
  if(r.state==='AUTONOMIC_LOAD'){let s=45+Math.max(0,r.residual||0)*2;if(r.hrvValid&&Number.isFinite(model.baselineRmssd)&&model.baselineRmssd>0)s+=Math.max(0,(model.baselineRmssd-r.rmssd)/model.baselineRmssd)*25;return Math.round(clamp(s,40,100))}
  return Math.round(clamp(8+Math.max(0,r.residual||0)*1.4,0,35));
}
function findContext(ts){
  const ctx={meal:null,user:[]};
  for(const e of events){if(e.ts>ts)break;const age=ts-e.ts;if(age<0)continue;
    if(['food','meal_start','meal_end'].includes(e.event_type)&&age<=3*3600000)ctx.meal=e;
    if(['stress','fatigue','physical_load','normal','symptom'].includes(e.event_type)&&age<=2*3600000)ctx.user.push(e);
  }
  return ctx;
}
function contextLabel(r){const p=[];if(r.context?.meal){const e=r.context.meal,age=Math.round((r.ts-e.ts)/60000);p.push(`після їжі · +${age} хв`)}if(r.context?.user?.length){const e=r.context.user.at(-1);p.push(`маркер: ${e.title}`)}return p.length?p.join(' · '):'—'}

function sliceVisible(){const s=rangeStart(),e=dayEnd();rows=allRows.filter(r=>r.ts>=s&&r.ts<=e);hoverIndex=rows.length?rows.length-1:null;$('rangeCaption').textContent=`${fmtTime(s)}–${fmtTime(e)} · один часовий масштаб для всіх шарів`}
function renderAll(){renderSummary();renderTotals();renderChart();updateQuality()}
function renderSummary(){
  if(hoverIndex===null||!rows[hoverIndex]){setText('stateName','—');setText('loadScore','—');setText('reasonLine','Немає даних у вибраному вікні.');hideTooltip();return}
  const r=rows[hoverIndex],m=META[r.state]||META.UNKNOWN;$('stateDot').className='state-dot '+m.cls;setText('stateName',m.label);setText('loadScore',Number.isFinite(r.loadScore)?r.loadScore:'—');setText('pointTime',fmtTime(r.ts));setText('pointHr',Number.isFinite(r.avgHr)?`${Math.round(r.avgHr)} уд/хв`:'—');setText('pointMotion',Number.isFinite(r.motion)?r.motion.toFixed(3):'—');setText('pointHrv',r.hrvValid?`${Math.round(r.rmssd)} мс`:'—');setText('contextLine','Контекст: '+contextLabel(r));setText('reasonLine',r.reason||'—');updateTooltipContent(r)
}
function updateTooltipContent(r){
  const tip=$('pointTooltip'),m=META[r.state]||META.UNKNOWN,end=Math.min(dayEnd(),r.ts+300000);
  setText('tipTime',`${fmtTime(r.ts)}–${fmtTime(end)}`);$('tipDot').className='state-dot '+m.cls;setText('tipState',m.label);setText('tipLoad',Number.isFinite(r.loadScore)?`HL ${r.loadScore}/100`:'HL —');
  const hr=Number.isFinite(r.avgHr)?`${Math.round(r.avgHr)} уд/хв`:'—',mv=Number.isFinite(r.motion)?`${motionWord(r)} · ${r.motion.toFixed(3)}`:'—',hv=r.hrvValid?`${Math.round(r.rmssd)} мс`:'немає надійного';
  setText('tipValues',`Пульс ${hr} · рух ${mv} · HRV ${hv}`);const c=contextLabel(r);setText('tipContext',c==='—'?'Контекст: немає маркера':'Контекст: '+c);setText('tipReason',shortReason(r));tip.style.borderLeftColor=COLORS[r.state]||COLORS.UNKNOWN;tip.classList.remove('hidden')
}
function hideTooltip(){const tip=$('pointTooltip');if(tip)tip.classList.add('hidden')}
function positionTooltip(hx,cssW){const tip=$('pointTooltip');if(!tip||tip.classList.contains('hidden'))return;const tw=Math.min(tip.offsetWidth||220,cssW-20);let left=hx+12;if(left+tw>cssW-10)left=hx-tw-12;left=clamp(left,10,Math.max(10,cssW-tw-10));tip.style.left=`${left}px`}
function renderTotals(){const box=$('stateTotals');if(!rows.length){box.innerHTML='';return}const c={};rows.forEach(r=>c[r.state]=(c[r.state]||0)+1);const order=['REST','MOVEMENT','RECOVERY','AUTONOMIC_LOAD','SLEEP','UNKNOWN'];box.innerHTML=order.filter(k=>c[k]).map(k=>`<div class="total-item"><span>${META[k].label}</span><b>${fmtDuration(c[k]*5)}</b></div>`).join('')}
function fmtDuration(min){if(min<60)return `${min} хв`;const h=Math.floor(min/60),m=min%60;return m?`${h} год ${m} хв`:`${h} год`}
function updateQuality(){if(!rows.length){$('dataQuality').textContent='Немає даних';return}const h=rows.filter(r=>Number.isFinite(r.avgHr)).length/rows.length,m=rows.filter(r=>Number.isFinite(r.motion)).length/rows.length,v=rows.filter(r=>r.hrvValid).length;let q=h>.9&&m>.85?'Добре':'Обмежено';$('dataQuality').textContent=`${q} · HR ${Math.round(h*100)}% · рух ${Math.round(m*100)}% · HRV ${v} вік.`}
function setText(id,v){$(id).textContent=v}

function renderChart(){
  const wrap=canvas.parentElement,cssW=Math.max(300,wrap.clientWidth),cssH=parseInt(getComputedStyle(canvas).height)||440,dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
  if(!rows.length){$('chartEmpty').classList.remove('hidden');hideTooltip();return}$('chartEmpty').classList.add('hidden');
  const L=46,R=12,T=16,B=34,W=cssW-L-R,H=cssH-T-B,x0=rangeStart(),x1=dayEnd(),x=ts=>L+(ts-x0)/(x1-x0)*W;
  rows.forEach(r=>{const xx=x(r.ts),next=x(Math.min(x1,r.ts+300000));ctx.globalAlpha=.09;ctx.fillStyle=COLORS[r.state]||COLORS.UNKNOWN;ctx.fillRect(xx,T,Math.max(1,next-xx),H);if(r.context?.meal){ctx.globalAlpha=.035;ctx.fillStyle=COLORS.meal;ctx.fillRect(xx,T,Math.max(1,next-xx),H)}});ctx.globalAlpha=1;
  const active=[];if(layers.load)active.push('load');if(layers.hr)active.push('hr');if(layers.motion)active.push('motion');if(layers.hrv)active.push('hrv');if(layers.events)active.push('events');
  const weights={load:1.25,hr:1.05,motion:.8,hrv:.8,events:.42},total=active.reduce((s,k)=>s+weights[k],0),gap=8,avail=H-gap*Math.max(0,active.length-1);let y=T;
  const lanes={};active.forEach(k=>{const h=avail*weights[k]/total;lanes[k]={top:y,h};y+=h+gap});
  drawGrid(ctx,L,T,W,H,x0,x1,x);
  if(lanes.load)drawLoad(ctx,lanes.load,L,W,x);
  if(lanes.hr)drawSeries(ctx,lanes.hr,L,W,x,'hr');
  if(lanes.motion)drawSeries(ctx,lanes.motion,L,W,x,'motion');
  if(lanes.hrv)drawSeries(ctx,lanes.hrv,L,W,x,'hrv');
  if(lanes.events)drawEvents(ctx,lanes.events,L,W,x,x0,x1);
  if(hoverIndex!==null&&rows[hoverIndex]){const hx=x(rows[hoverIndex].ts);ctx.strokeStyle='rgba(255,255,255,.82)';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(hx,T);ctx.lineTo(hx,T+H);ctx.stroke();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(hx,T+H+8,3.4,0,Math.PI*2);ctx.fill();positionTooltip(hx,cssW)}
  canvas._chartGeom={L,R,T,B,W,H,x0,x1};
}
function laneTitle(ctx,lane,text,right=''){ctx.fillStyle='#8fa0bd';ctx.font='700 10px system-ui';ctx.fillText(text,4,lane.top+11);if(right){ctx.textAlign='right';ctx.fillText(right,canvas.clientWidth-10,lane.top+11);ctx.textAlign='left'}}
function drawGrid(ctx,L,T,W,H,x0,x1,x){ctx.strokeStyle='rgba(112,132,166,.13)';ctx.lineWidth=1;for(let i=0;i<=4;i++){const xx=L+W*i/4;ctx.beginPath();ctx.moveTo(xx,T);ctx.lineTo(xx,T+H);ctx.stroke();const ts=x0+(x1-x0)*i/4;ctx.fillStyle='#7f8da7';ctx.font='10px system-ui';ctx.textAlign=i===0?'left':i===4?'right':'center';ctx.fillText(fmtTime(ts),xx,T+H+24)}ctx.textAlign='left'}
function drawLoad(ctx,lane,L,W,x){laneTitle(ctx,lane,'НАВАНТАЖЕННЯ HL','0–100');const top=lane.top+16,h=lane.h-19;ctx.strokeStyle='rgba(130,151,185,.17)';[0,.5,1].forEach(p=>{const yy=top+h-h*p;ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(L+W,yy);ctx.stroke()});rows.forEach(r=>{if(!Number.isFinite(r.loadScore))return;const xx=x(r.ts),x2=x(Math.min(dayEnd(),r.ts+300000)),bw=Math.max(1,x2-xx-1),bh=h*r.loadScore/100;ctx.fillStyle=COLORS[r.state]||COLORS.UNKNOWN;ctx.globalAlpha=.82;ctx.fillRect(xx,top+h-bh,bw,bh)});ctx.globalAlpha=1}
function drawSeries(ctx,lane,L,W,x,kind){const top=lane.top+16,h=lane.h-19;let vals,label,color,access;if(kind==='hr'){vals=rows.map(r=>r.avgHr).filter(Number.isFinite);label='ПУЛЬС';color=COLORS.hr;access=r=>r.avgHr}else if(kind==='motion'){vals=rows.map(r=>r.motion).filter(Number.isFinite);label='РУХ';color=COLORS.motion;access=r=>r.motion}else{vals=rows.filter(r=>r.hrvValid).map(r=>r.rmssd);label='HRV / RMSSD';color=COLORS.hrv;access=r=>r.hrvValid?r.rmssd:null}if(!vals.length){laneTitle(ctx,lane,label,'немає валідних даних');return}let lo,hi;if(kind==='motion'){lo=0;hi=Math.max(.001,quantile(vals,.95)||Math.max(...vals))}else{lo=quantile(vals,.05);hi=quantile(vals,.95);if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo){lo=Math.min(...vals);hi=Math.max(...vals)+1}}laneTitle(ctx,lane,label,kind==='hr'?`${Math.round(lo)}–${Math.round(hi)} уд/хв`:kind==='hrv'?`${Math.round(lo)}–${Math.round(hi)} мс`:'відносний рух');ctx.strokeStyle='rgba(130,151,185,.14)';ctx.beginPath();ctx.moveTo(L,top+h);ctx.lineTo(L+W,top+h);ctx.stroke();if(kind==='motion'){rows.forEach(r=>{const v=access(r);if(!Number.isFinite(v))return;const xx=x(r.ts),x2=x(Math.min(dayEnd(),r.ts+300000)),bh=h*clamp(v/hi,0,1);ctx.fillStyle=color;ctx.globalAlpha=.55;ctx.fillRect(xx,top+h-bh,Math.max(1,x2-xx-1),bh)});ctx.globalAlpha=1;return}ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.beginPath();let started=false;rows.forEach(r=>{const v=access(r);if(!Number.isFinite(v))return;const xx=x(r.ts),yy=top+h-clamp((v-lo)/(hi-lo),0,1)*h;if(!started){ctx.moveTo(xx,yy);started=true}else ctx.lineTo(xx,yy)});ctx.stroke();if(kind==='hrv'){ctx.fillStyle=color;rows.forEach(r=>{const v=access(r);if(!Number.isFinite(v))return;const xx=x(r.ts),yy=top+h-clamp((v-lo)/(hi-lo),0,1)*h;ctx.beginPath();ctx.arc(xx,yy,2,0,Math.PI*2);ctx.fill()})}}
function drawEvents(ctx,lane,L,W,x,x0,x1){laneTitle(ctx,lane,'ПОДІЇ / КОНТЕКСТ');const y=lane.top+lane.h*.65;const es=events.filter(e=>e.ts>=x0&&e.ts<=x1);if(!es.length){ctx.fillStyle='#6f7e98';ctx.font='11px system-ui';ctx.fillText('Подій немає',L,y);return}es.forEach(e=>{const xx=x(e.ts),meal=['food','meal_start','meal_end'].includes(e.event_type);ctx.fillStyle=meal?COLORS.meal:COLORS.event;ctx.beginPath();ctx.arc(xx,y,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle=ctx.fillStyle;ctx.globalAlpha=.35;ctx.beginPath();ctx.moveTo(xx,lane.top+14);ctx.lineTo(xx,lane.top+lane.h);ctx.stroke();ctx.globalAlpha=1})}
function pickPoint(e){if(!rows.length||!canvas._chartGeom)return;const rect=canvas.getBoundingClientRect(),px=e.clientX-rect.left,g=canvas._chartGeom;if(px<g.L||px>g.L+g.W)return;const ts=g.x0+(px-g.L)/g.W*(g.x1-g.x0);let best=0,dist=Infinity;rows.forEach((r,i)=>{const d=Math.abs(r.ts-ts);if(d<dist){dist=d;best=i}});hoverIndex=best;renderSummary();renderChart()}
function saveLayerPrefs(){try{localStorage.setItem('hl_timeline_layers',JSON.stringify(layers))}catch{}}
function loadLayerPrefs(){try{const p=JSON.parse(localStorage.getItem('hl_timeline_layers')||'null');if(p)layers={...layers,...p}}catch{}document.querySelectorAll('#layerButtons button:not(.future)').forEach(b=>b.classList.toggle('on',!!layers[b.dataset.layer]))}
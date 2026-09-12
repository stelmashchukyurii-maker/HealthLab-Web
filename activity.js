const ACT_API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
const act=id=>document.getElementById(id);
let actDay=actStartOfDay(new Date());
let actMotionRows=[];
let actDaily=[];

act('refreshBtn').onclick=actLoad;
act('prevDay').onclick=()=>{actDay=new Date(actDay.getTime()-86400000);actLoad()};
act('nextDay').onclick=()=>{const n=new Date(actDay.getTime()+86400000);if(n<=actStartOfDay(new Date())){actDay=n;actLoad()}};
act('todayBtn').onclick=()=>{actDay=actStartOfDay(new Date());actLoad()};
window.addEventListener('resize',()=>{actRenderMotion();actRenderSteps()});
actLoad();

function actStartOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
function actFmtDate(d){return d.toLocaleDateString('uk-UA',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'})}
function actEpoch(v){const n=Number(v);return Number.isFinite(n)?(n<1e12?n*1000:n):0}
function actNum(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function actDayKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function actClamp(v,a,b){return Math.max(a,Math.min(b,v))}
async function actApi(p){const u=new URL(ACT_API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d&&d.error)throw Error(d.error);return d}

async function actLoad(){
  act('selectedDate').textContent=actFmtDate(actDay);
  act('nextDay').disabled=actDay.getTime()>=actStartOfDay(new Date()).getTime();
  act('status').textContent='Оновлюю кроки та рух…';
  const start=actDay.getTime();
  const now=Date.now();
  const end=start===actStartOfDay(new Date()).getTime()?now:start+86400000-1;
  try{
    const [state,daily]=await Promise.all([
      actApi({api:'state',from:Math.floor(start/1000),to:Math.floor(end/1000),bucket:300}),
      actApi({api:'table',name:'dailyMetric',limit:40})
    ]);
    actMotionRows=(Array.isArray(state)?state:[]).map(r=>({ts:actEpoch(r.bucket_ts),motion:actNum(r.motion_score)})).filter(r=>r.ts&&Number.isFinite(r.motion)).sort((a,b)=>a.ts-b.ts);
    const dr=Array.isArray(daily)?daily:(daily?.rows||[]);
    actDaily=dr.map(r=>({day:String(r.day||''),steps:actNum(r.steps)})).filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.day)).sort((a,b)=>a.day.localeCompare(b.day));
    actRenderSummary();
    actRenderMotion();
    actRenderSteps();
    const stepDays=actDaily.filter(r=>Number.isFinite(r.steps)&&r.steps>0).length;
    act('status').textContent=`${actMotionRows.length} × 5-хв motion-вікон · ${stepDays} днів із кроками у поточному web-джерелі`;
  }catch(e){
    actMotionRows=[];actDaily=[];actRenderSummary();actRenderMotion();actRenderSteps();
    act('status').textContent='Помилка: '+e.message;
  }
}

function actRenderSummary(){
  const total=actMotionRows.reduce((s,r)=>s+(Number.isFinite(r.motion)?r.motion:0),0);
  act('motionTotal').textContent=actMotionRows.length?total.toFixed(2):'—';
  const expected=Math.max(1,Math.round(Math.min(Date.now(),actDay.getTime()+86400000)-actDay.getTime())/300000);
  const coverage=Math.round(actClamp(actMotionRows.length/expected,0,1)*100);
  act('motionBadge').textContent=actMotionRows.length?`5 хв · ${coverage}%`:'немає даних';
  act('motionBadge').className='badge '+(coverage>=80?'live':'warn');
  const key=actDayKey(actDay),row=actDaily.find(r=>r.day===key&&Number.isFinite(r.steps)&&r.steps>0);
  if(row){
    act('stepValue').textContent=Math.round(row.steps).toLocaleString('uk-UA');
    act('stepSource').textContent='NOOP estimate · ще не Garmin reference';
    act('stepBadge').textContent='NOOP estimate';
    act('stepBadge').className='badge warn';
  }else{
    act('stepValue').textContent='—';
    act('stepSource').textContent='Калібрування · Garmin буде еталоном';
    act('stepBadge').textContent='очікує еталону';
    act('stepBadge').className='badge warn';
  }
}

function actCanvas(id){
  const c=act(id),rect=c.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  c.width=Math.max(1,Math.round(rect.width*dpr));c.height=Math.max(1,Math.round(rect.height*dpr));
  const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{c,ctx,w:rect.width,h:rect.height};
}
function actGrid(ctx,w,h,left,top,right,bottom){
  ctx.strokeStyle='#26314d';ctx.lineWidth=1;ctx.fillStyle='#8492ad';ctx.font='11px system-ui';
  for(let i=0;i<=4;i++){const y=top+(h-top-bottom)*i/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke()}
}

function actRenderMotion(){
  const {ctx,w,h}=actCanvas('motionActivityChart');ctx.clearRect(0,0,w,h);
  const empty=act('motionEmpty');if(!actMotionRows.length){empty.classList.remove('hidden');return}else empty.classList.add('hidden');
  const left=42,right=12,top=16,bottom=30,plotW=w-left-right,plotH=h-top-bottom;
  actGrid(ctx,w,h,left,top,right,bottom);
  const max=Math.max(...actMotionRows.map(r=>r.motion),0.001)*1.08;
  ctx.fillStyle='#8492ad';ctx.font='10px system-ui';ctx.textAlign='right';
  for(let i=0;i<=4;i++){const v=max*(4-i)/4,y=top+plotH*i/4;ctx.fillText(v.toFixed(3),left-7,y+3)}
  ctx.textAlign='center';
  [0,6,12,18,24].forEach(hr=>{const x=left+plotW*(hr/24);ctx.fillText(String(hr).padStart(2,'0'),x,h-9)});
  ctx.strokeStyle='#6ed6d0';ctx.lineWidth=2;ctx.beginPath();
  actMotionRows.forEach((r,i)=>{const dayFrac=(r.ts-actDay.getTime())/86400000,x=left+plotW*actClamp(dayFrac,0,1),y=top+plotH*(1-r.motion/max);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();
  ctx.lineTo(left+plotW*actClamp((actMotionRows.at(-1).ts-actDay.getTime())/86400000,0,1),top+plotH);ctx.lineTo(left+plotW*actClamp((actMotionRows[0].ts-actDay.getTime())/86400000,0,1),top+plotH);ctx.closePath();ctx.fillStyle='rgba(110,214,208,.10)';ctx.fill();
}

function actRenderSteps(){
  const {ctx,w,h}=actCanvas('stepsChart');ctx.clearRect(0,0,w,h);
  const endKey=actDayKey(actDay),endDate=new Date(actDay),keys=[];
  for(let i=13;i>=0;i--){const d=new Date(endDate.getTime()-i*86400000);keys.push(actDayKey(d))}
  const map=new Map(actDaily.map(r=>[r.day,r.steps]));
  const vals=keys.map(k=>({day:k,steps:map.get(k)}));
  const real=vals.filter(v=>Number.isFinite(v.steps)&&v.steps>0);
  const empty=act('stepsEmpty');if(!real.length){empty.classList.remove('hidden');return}else empty.classList.add('hidden');
  const left=42,right=12,top=16,bottom=34,plotW=w-left-right,plotH=h-top-bottom,max=Math.max(...real.map(v=>v.steps),1000)*1.1;
  actGrid(ctx,w,h,left,top,right,bottom);
  ctx.fillStyle='#8492ad';ctx.font='10px system-ui';ctx.textAlign='right';
  for(let i=0;i<=4;i++){const v=max*(4-i)/4,y=top+plotH*i/4;ctx.fillText(Math.round(v/1000)+'k',left-7,y+3)}
  const gap=4,barW=Math.max(5,plotW/vals.length-gap);
  vals.forEach((v,i)=>{const x=left+i*(plotW/vals.length)+gap/2;if(Number.isFinite(v.steps)&&v.steps>0){const bh=plotH*(v.steps/max);ctx.fillStyle='#ffd66b';ctx.fillRect(x,top+plotH-bh,barW,bh)}if(i%3===0||i===vals.length-1){ctx.fillStyle='#8492ad';ctx.textAlign='center';const d=new Date(v.day+'T12:00:00');ctx.fillText(d.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'}),x+barW/2,h-10)}});
}

const STATE_API='https://ttvlgfzvgjcbomdlddbn.supabase.co/functions/v1/noop-db-viewer';
const se=id=>document.getElementById(id);
const sn=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
function epochMs(v){const n=Number(v);return Number.isFinite(n)?(n<1e12?n*1000:n):0}
async function stateApi(p){const u=new URL(STATE_API);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,v));const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d?.error)throw Error(d.error);return d}
async function stateRangeChunked(fromMs,toMs,bucket=300){
  const step=2*3600000,ranges=[];for(let s=fromMs;s<=toMs;s+=step)ranges.push([s,Math.min(toMs,s+step-1)]);
  async function getRange(a,b){return stateApi({api:'state',from:Math.floor(a/1000),to:Math.floor(b/1000),bucket})}
  const parts=await Promise.all(ranges.map(async([a,b])=>{try{return await getRange(a,b)}catch(e){const mid=Math.floor((a+b)/2);if(mid<=a)return [];const settled=await Promise.allSettled([getRange(a,mid),getRange(mid+1,b)]);return settled.flatMap(x=>x.status==='fulfilled'&&Array.isArray(x.value)?x.value:[])} }));
  const byTs=new Map();parts.flat().forEach(r=>{const ts=epochMs(r?.bucket_ts);if(ts)byTs.set(ts,r)});return [...byTs.values()].sort((a,b)=>epochMs(a.bucket_ts)-epochMs(b.bucket_ts));
}
function q(a,p){if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),i=(x.length-1)*p,b=Math.floor(i),d=i-b;return x[b+1]!==undefined?x[b]+d*(x[b+1]-x[b]):x[b]}
function median(a){return q(a.filter(Number.isFinite),.5)}
function validHrv(r){return r.rrCount>=100&&Number.isFinite(r.rmssd)&&r.rmssd>=5&&r.rmssd<=250}
function fmtTime(ms){return new Date(ms).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'})}
function classify(rows){
  if(!rows.length)return {kind:'unknown',row:null,reason:'Немає денних State Engine даних.'};
  const motions=rows.map(r=>r.motion).filter(v=>Number.isFinite(v)&&v>0),q25=q(motions,.25),q75=q(motions,.75);let th=(Number.isFinite(q25)&&Number.isFinite(q75))?Math.sqrt(Math.max(q25,1e-6)*Math.max(q75,1e-6)):.02;th=Math.max(.005,Math.min(.05,th));
  const quiet=rows.filter(r=>!r.sleep&&Number.isFinite(r.hr)&&Number.isFinite(r.motion)&&r.motion<th),baseHr=median(quiet.map(r=>r.hr)),baseHrv=median(quiet.filter(validHrv).map(r=>r.rmssd));
  let lastActive=-Infinity;rows.forEach((r,i)=>{if(Number.isFinite(r.motion)&&r.motion>=th)lastActive=i});
  const r=rows.at(-1);if(r.sleep)return {kind:'sleep',row:r,th,baseHr,baseHrv,reason:'Вікно перекривається зі сном.'};
  if(!Number.isFinite(r.hr)||!Number.isFinite(r.motion))return {kind:'unknown',row:r,th,baseHr,baseHrv,reason:'Недостатньо одночасних HR + motion даних.'};
  if(r.motion>=th)return {kind:'move',row:r,th,baseHr,baseHrv,reason:`Рух вище персонального денного порога ${th.toFixed(4)}.`};
  const age=Number.isFinite(lastActive)?(rows.length-1-lastActive)*5:Infinity,res=Number.isFinite(baseHr)?r.hr-baseHr:null,hv=validHrv(r),supp=(hv&&Number.isFinite(baseHrv)&&baseHrv>0)?(baseHrv-r.rmssd)/baseHrv:null;
  if(age<=30)return {kind:'recovery',row:r,th,baseHr,baseHrv,res,reason:`Рух зараз низький, але активність була приблизно ${Math.round(age)} хв тому.`};
  if(Number.isFinite(res)&&res>=12&&((Number.isFinite(supp)&&supp>=.15)||(!hv&&res>=16)))return {kind:'load',row:r,th,baseHr,baseHrv,res,supp,reason:`Рух низький; пульс ${res>=0?'+':''}${Math.round(res)} уд/хв від quiet baseline${hv&&Number.isFinite(supp)?`; RMSSD приблизно на ${Math.round(supp*100)}% нижче денного quiet baseline`:''}. Це автономне навантаження, не автоматично психологічний стрес.`};
  return {kind:'rest',row:r,th,baseHr,baseHrv,res,reason:`Рух низький; пульс близький до денного quiet baseline${Number.isFinite(res)?` (${res>=0?'+':''}${Math.round(res)} уд/хв)`:''}.`};
}
function render(s){
  const meta={sleep:['😴','Сон','Організм зараз у стані сну.'],move:['🚶','Фізичне навантаження','Зараз переважає рух.'],recovery:['🙂','Відновлення','Організм повертається до спокійнішого стану після руху.'],load:['😕','Навантаження на організм вище','Є ознаки автономної активації при низькому русі.'],rest:['🙂','Спокійний стан','Поточні сигнали близькі до денного спокійного рівня.'],unknown:['😐','Даних недостатньо','HealthLab не має достатньо якісних даних для висновку.']};
  const [m,t,txt]=meta[s.kind]||meta.unknown;se('stateMood').textContent=m;se('stateTitle').textContent=t;se('stateText').textContent=txt;const r=s.row;
  se('stateHr').textContent=r&&Number.isFinite(r.hr)?Math.round(r.hr)+' уд/хв':'—';se('stateHrv').textContent=r&&validHrv(r)?Math.round(r.rmssd)+' мс':'—';se('stateMotion').textContent=r&&Number.isFinite(r.motion)?r.motion.toFixed(4):'—';se('stateEvidence').textContent=(r?fmtTime(r.ts)+' · ':'')+s.reason;
}
async function loadStatePage(){const b=se('stateRefresh');if(b){b.disabled=true;b.textContent='…'};try{const now=Date.now(),from=now-6*3600000,d=await stateRangeChunked(from,now,300);const rows=(Array.isArray(d)?d:[]).map(x=>({ts:epochMs(x.bucket_ts),hr:sn(x.avg_hr),motion:sn(x.motion_score),rrCount:Number(x.rr_count||0),rmssd:sn(x.rmssd_ms),sleep:x.sleep_state==='SLEEP'})).filter(x=>x.ts).sort((a,b)=>a.ts-b.ts);if(!rows.length)throw Error('State Engine не повернув вікон');render(classify(rows));if(b)b.textContent='✓'}catch(e){render({kind:'unknown',row:null,reason:'Помилка оновлення: '+e.message});if(b)b.textContent='!'}finally{setTimeout(()=>{if(b){b.disabled=false;b.textContent='↻'}},900)}}
se('stateRefresh')?.addEventListener('click',loadStatePage);loadStatePage();setInterval(loadStatePage,60000);

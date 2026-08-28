const $=id=>document.getElementById(id);
let activePerson=null;
let sb=null;

function requireConfig(){
  const url=localStorage.getItem('healthlab_supabase_url');
  const key=localStorage.getItem('healthlab_supabase_key');
  if(!url||!key){
    $('authStatus').textContent='Потрібне одноразове налаштування HealthLab Web. Вкажи Supabase URL і publishable key у браузері.';
    return false;
  }
  sb=supabase.createClient(url,key);
  return true;
}

$('loginBtn').onclick=login;
$('logoutBtn').onclick=async()=>{if(sb)await sb.auth.signOut();showAuth();};
$('refreshBtn').onclick=()=>activePerson&&loadPerson(activePerson);
$('personSelect').onchange=e=>{activePerson=e.target.value;loadPerson(activePerson)};

boot();
async function boot(){if(!requireConfig()){showAuth();return}const {data:{session}}=await sb.auth.getSession();if(session)await showDashboard();else showAuth();}
function showAuth(){$('authCard').classList.remove('hidden');$('dashboard').classList.add('hidden');$('logoutBtn').classList.add('hidden');}
async function login(){if(!sb&&!requireConfig())return;$('authStatus').textContent='Вхід…';const email=$('email').value.trim(),password=$('password').value;const {error}=await sb.auth.signInWithPassword({email,password});if(error){$('authStatus').textContent=error.message;return}$('authStatus').textContent='';await showDashboard();}
async function showDashboard(){$('authCard').classList.add('hidden');$('dashboard').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');const {data:persons,error}=await sb.from('persons').select('id,display_name').order('created_at');if(error){$('dataStatus').textContent='Не вдалося прочитати профілі: '+error.message;return}const sel=$('personSelect');sel.innerHTML='';(persons||[]).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.display_name;sel.appendChild(o)});if(!persons?.length){$('dataStatus').textContent='Спочатку створи людину в Android HealthLab.';return}activePerson=persons[0].id;sel.value=activePerson;await loadPerson(activePerson);}
async function loadPerson(personId){$('dataStatus').textContent='Оновлення…';const since=new Date(Date.now()-24*3600*1000).toISOString();const [dev,hr,rr,batch,daily,sleep]=await Promise.all([sb.from('devices').select('external_id,name,last_seen_at').eq('person_id',personId).order('last_seen_at',{ascending:false}).limit(1),sb.from('heart_rate_samples').select('measured_at,bpm').eq('person_id',personId).gte('measured_at',since).order('measured_at'),sb.from('rr_intervals').select('measured_at,rr_ms').eq('person_id',personId).gte('measured_at',since).order('measured_at'),sb.from('ingest_batches').select('completed_at,status,record_count').eq('person_id',personId).order('started_at',{ascending:false}).limit(1),sb.from('daily_metrics').select('*').eq('person_id',personId).order('metric_date',{ascending:false}).limit(1),sb.from('sleep_sessions').select('*').eq('person_id',personId).order('start_at',{ascending:false}).limit(1)]);const errs=[dev,hr,rr,batch,daily,sleep].map(x=>x.error).filter(Boolean);if(errs.length){$('dataStatus').textContent='Помилка читання: '+errs[0].message;return}const d=dev.data?.[0];$('deviceName').textContent=d?.external_id||d?.name||'—';const hrs=hr.data||[],rrs=rr.data||[];const last=hrs.at(-1);$('liveHr').textContent=last?.bpm??'—';$('liveHrTime').textContent=last?new Date(last.measured_at).toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';$('rrCount').textContent=rrs.length;$('hrv').textContent=rmssd(rrs.map(x=>x.rr_ms))??'—';const b=batch.data?.[0];$('lastSync').textContent=b?.completed_at?new Date(b.completed_at).toLocaleString('uk-UA'):'—';const m=daily.data?.[0];$('restingHr').textContent=fmt(m?.resting_hr,' уд/хв');$('respiration').textContent=fmt(m?.respiratory_rate,' /хв');$('spo2').textContent=fmt(m?.spo2,' %');$('skinTemp').textContent=fmt(m?.skin_temp_c,' °C');$('recovery').textContent=fmt(m?.recovery_score,' %');$('strain').textContent=fmt(m?.strain_score,'');const s=sleep.data?.[0];$('sleep').textContent=s?.start_at&&s?.end_at?(((new Date(s.end_at)-new Date(s.start_at))/3600000).toFixed(1)+' год'):'—';drawChart(hrs);$('dataStatus').textContent=`HR: ${hrs.length} · RR: ${rrs.length} · останні 24 години`;}
function fmt(v,s){return v===null||v===undefined?'—':`${Number(v).toFixed(Number(v)%1?1:0)}${s}`}
function rmssd(values){const clean=values.filter(v=>v>=300&&v<=2000);if(clean.length<20)return null;let sum=0,n=0;for(let i=1;i<clean.length;i++){const d=clean[i]-clean[i-1];sum+=d*d;n++}return Math.round(Math.sqrt(sum/n));}
function drawChart(rows){const c=$('hrChart'),ctx=c.getContext('2d'),empty=$('chartEmpty'),w=c.width,h=c.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#0d131a';ctx.fillRect(0,0,w,h);if(!rows.length){empty.classList.remove('hidden');return}else empty.classList.add('hidden');const vals=rows.map(r=>r.bpm),min=Math.max(30,Math.min(...vals)-10),max=Math.min(220,Math.max(...vals)+10);ctx.strokeStyle='#243241';ctx.lineWidth=1;for(let i=1;i<5;i++){const y=h*i/5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}const t0=new Date(rows[0].measured_at).getTime(),t1=new Date(rows.at(-1).measured_at).getTime();ctx.strokeStyle='#5ca7f2';ctx.lineWidth=3;ctx.beginPath();rows.forEach((r,i)=>{const t=new Date(r.measured_at).getTime(),x=(t1===t0?i/Math.max(1,rows.length-1):(t-t0)/(t1-t0))*w,y=h-((r.bpm-min)/Math.max(1,max-min))*h;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.stroke();}

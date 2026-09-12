import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ttvlgfzvgjcbomdlddbn.supabase.co";
const SUPABASE_KEY = "sb_publishable_30IrLFbkHE4cPXmu-hJoQA_u_sFSg3Y";
const CORE_URL = `${SUPABASE_URL}/functions/v1/florivo-chat-v1`;
const CHART_URL = `${SUPABASE_URL}/functions/v1/florivo-hr-chart-v1`;
const PROJECT = "HEALTHLAB";
const TZ = "Europe/Oslo";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true} });

const isGraphRequest = (text) => /(графік|графіком|chart|plot)/iu.test(text) && /(пульс|чсс|\bhr\b|heart\s*rate)/iu.test(text);

async function token(){
  const {data}=await supabase.auth.getSession();
  if(data.session?.access_token) return data.session.access_token;
  const r=await supabase.auth.refreshSession();
  return r.data.session?.access_token || null;
}

async function call(url, body){
  const t=await token();
  if(!t) throw new Error("Потрібно увійти знову.");
  const res=await fetch(url,{method:"POST",headers:{Authorization:`Bearer ${t}`,apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data?.error||`HTTP ${res.status}`);
  return data;
}

function fmt(v){ return Number.isFinite(Number(v)) ? Number(v).toFixed(1).replace(/\.0$/,"") : "—"; }

function chartSvg(c){
  const pts=Array.isArray(c?.points)?c.points.filter(p=>Number.isFinite(Number(p.relative_min))&&Number.isFinite(Number(p.bpm))):[];
  if(!pts.length) return null;
  const W=640,H=250,L=44,R=14,T=18,B=36;
  const xmin=-Number(c.minutes_before||30), xmax=Number(c.minutes_after||30);
  let ymin=Math.min(...pts.map(p=>Number(p.min_bpm??p.bpm)),Number(c.min_bpm||999));
  let ymax=Math.max(...pts.map(p=>Number(p.max_bpm??p.bpm)),Number(c.max_bpm||0));
  ymin=Math.floor(ymin-3); ymax=Math.ceil(ymax+3); if(ymax<=ymin) ymax=ymin+10;
  const x=v=>L+((v-xmin)/(xmax-xmin))*(W-L-R);
  const y=v=>T+(1-(v-ymin)/(ymax-ymin))*(H-T-B);
  const line=pts.map(p=>`${x(Number(p.relative_min)).toFixed(1)},${y(Number(p.bpm)).toFixed(1)}`).join(" ");
  const ticks=[xmin,Math.round(xmin/2),0,Math.round(xmax/2),xmax];
  const yt=[ymin,Math.round((ymin+ymax)/2),ymax];
  return `<svg class="hr-chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Графік пульсу навколо події">
    ${yt.map(v=>`<line x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}" class="hr-grid"/><text x="${L-7}" y="${y(v)+4}" text-anchor="end" class="hr-axis-label">${v}</text>`).join("")}
    ${ticks.map(v=>`<text x="${x(v)}" y="${H-10}" text-anchor="middle" class="hr-axis-label">${v>0?"+":""}${v}</text>`).join("")}
    <line x1="${x(0)}" y1="${T}" x2="${x(0)}" y2="${H-B}" class="hr-event-line"/>
    <text x="${x(0)+5}" y="${T+12}" class="hr-event-label">подія</text>
    <polyline points="${line}" class="hr-line"/>
    <text x="${W-R}" y="${H-10}" text-anchor="end" class="hr-axis-title">хв від події</text>
  </svg>`;
}

function appendChart(turnId, chart){
  if(!chart?.points?.length) return;
  const metas=[...document.querySelectorAll(".assistant-meta")];
  const meta=metas.find(el=>String(el.textContent||"").trim().startsWith(turnId));
  const bubble=meta?.closest(".assistant-bubble");
  if(!bubble || bubble.querySelector(`[data-hr-chart-turn="${CSS.escape(turnId)}"]`)) return;
  const svg=chartSvg(chart); if(!svg) return;
  const card=document.createElement("div");
  card.className="hr-chart-card";
  card.dataset.hrChartTurn=turnId;
  card.innerHTML=`<div class="hr-chart-head"><strong>HR · ${chart.minutes_before} хв до / ${chart.minutes_after} хв після</strong><span>${chart.n} samples</span></div>${svg}<div class="hr-chart-stats"><span>min <b>${fmt(chart.min_bpm)}</b></span><span>avg <b>${fmt(chart.avg_bpm)}</b></span><span>max <b>${fmt(chart.max_bpm)}</b></span><span>уд/хв</span></div><div class="hr-chart-source">${chart.source||"HealthLab hrSample"} · 1-хв середні · Europe/Oslo</div>`;
  const tools=bubble.querySelector(".bubble-tools");
  bubble.insertBefore(card,tools||null);
}

let syncBusy=false;
async function syncCharts(){
  if(syncBusy) return; syncBusy=true;
  try{
    const t=await token(); if(!t) return;
    const url=new URL(CORE_URL); url.searchParams.set("api","history");
    const res=await fetch(url,{headers:{Authorization:`Bearer ${t}`,apikey:SUPABASE_KEY}});
    if(!res.ok) return;
    const turns=await res.json();
    for(const turn of turns||[]){ const chart=turn?.action_result?.hr_chart; if(chart) appendChart(turn.turn_id,chart); }
  }catch{} finally{syncBusy=false;}
}

const composer=document.getElementById("composer");
composer?.addEventListener("submit",async(event)=>{
  const input=document.getElementById("messageInput");
  const text=String(input?.value||"").trim();
  const preview=document.getElementById("attachmentPreview");
  const hasAttachments=Boolean(preview && preview.children.length);
  if(!text || !isGraphRequest(text) || hasAttachments) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const send=document.getElementById("sendBtn");
  const banner=document.getElementById("serviceBanner");
  if(send) send.disabled=true;
  if(banner){banner.textContent="Будую HR-графік з HealthLab raw time-series…";banner.hidden=false;}
  const rid=crypto.randomUUID();
  try{
    await call(CHART_URL,{project:PROJECT,timezone:TZ,text,client_request_id:rid});
    input.value=""; input.style.height="auto";
    if(banner) banner.hidden=true;
    location.reload();
  }catch(e){
    if(banner){banner.textContent=`Графік не побудовано: ${e.message}`;banner.hidden=false;}
    if(send) send.disabled=false;
  }
},true);

let timer=null;
const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(syncCharts,120);});
const messages=document.getElementById("messages");
if(messages) observer.observe(messages,{childList:true,subtree:true});
window.addEventListener("load",()=>setTimeout(syncCharts,350));
supabase.auth.onAuthStateChange(()=>setTimeout(syncCharts,350));

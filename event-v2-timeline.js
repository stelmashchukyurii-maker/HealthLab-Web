(function(){
  if(!/timeline\.html$/i.test(location.pathname))return;
  const SUPABASE='https://ttvlgfzvgjcbomdlddbn.supabase.co';
  const PUB='sb_publishable_30IrLFbkHE4cPXmu-hJoQA_u_sFSg3Y';
  const EVENT_API=SUPABASE+'/functions/v1/healthlab-event-v2';
  const SESSION_KEY='healthlab_event_v2_session';
  if(typeof api!=='function'||typeof load!=='function')return;
  const legacyApi=api;
  function getSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
  function saveSession(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s))}
  function clearSession(){localStorage.removeItem(SESSION_KEY)}
  async function refreshSession(){const s=getSession();if(!s?.refresh_token)return null;const r=await fetch(SUPABASE+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:PUB,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})});if(!r.ok){clearSession();return null}const d=await r.json();const n={access_token:d.access_token,refresh_token:d.refresh_token||s.refresh_token,expires_at:(d.expires_at?Number(d.expires_at)*1000:Date.now()+Number(d.expires_in||3600)*1000)};saveSession(n);return n}
  async function session(){const s=getSession();if(!s)return null;if(Number(s.expires_at||0)>Date.now()+60000)return s;return refreshSession()}
  async function secureEvents(limit){let s=await session();if(!s)return[];const req=async()=>fetch(EVENT_API+'?api=events&limit='+Math.min(300,Math.max(1,Number(limit||100))),{headers:{apikey:PUB,Authorization:'Bearer '+s.access_token},cache:'no-store'});let r=await req();if(r.status===401){s=await refreshSession();if(!s)return[];r=await req()}if(!r.ok)return[];const d=await r.json();return Array.isArray(d)?d.map(x=>({...x,_secure:true})):[]}
  function mergeEvents(legacy,secure,limit){const all=[...(Array.isArray(legacy)?legacy:[]).map(x=>({...x,_secure:false})),...secure];const seen=new Set();return all.filter(x=>{const k=(x._secure?'s:':'l:')+(x.id||x.occurred_at+'|'+x.title);if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at)).slice(0,limit)}
  api=async function(p){if(p?.api!=='timeline')return legacyApi(p);const limit=Math.min(300,Math.max(1,Number(p.limit||100)));const [legacy,secure]=await Promise.all([legacyApi(p).catch(()=>[]),secureEvents(limit)]);return mergeEvents(legacy,secure,limit)};
  setTimeout(()=>{try{load()}catch{}},0);
})();
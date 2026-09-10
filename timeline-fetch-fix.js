// HealthLab Timeline loader stabilizer.
// Keeps the existing Timeline UI/algorithm intact, but prevents one very large
// state request from blanking the chart. Large state ranges are fetched
// sequentially in 2-hour chunks, with 1-hour fallback on a failed chunk.
(()=>{
  const nativeFetch=window.fetch.bind(window);
  const MAX_CHUNK=2*3600;
  window.__hlStateChunkFailures=0;
  window.__hlStateChunkCount=0;

  function isStateUrl(u){
    return u.hostname==='ttvlgfzvgjcbomdlddbn.supabase.co' &&
      u.pathname.includes('/functions/v1/noop-db-viewer') &&
      u.searchParams.get('api')==='state';
  }

  async function fetchJsonRange(base,a,b,init){
    const u=new URL(base.toString());
    u.searchParams.set('from',String(a));
    u.searchParams.set('to',String(b));
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),10000);
    try{
      const r=await nativeFetch(u.toString(),{...init,cache:'no-store',signal:ctrl.signal});
      const text=await r.text();
      let d=null;
      try{d=text?JSON.parse(text):null}catch{}
      if(!r.ok||d?.error)throw new Error(d?.error||('HTTP '+r.status));
      return Array.isArray(d)?d:[];
    }finally{clearTimeout(timer)}
  }

  window.fetch=async function(input,init={}){
    let u;
    try{u=new URL(typeof input==='string'?input:input.url,location.href)}catch{return nativeFetch(input,init)}
    if(!isStateUrl(u))return nativeFetch(input,init);

    const from=Math.floor(Number(u.searchParams.get('from'))),to=Math.floor(Number(u.searchParams.get('to')));
    if(!Number.isFinite(from)||!Number.isFinite(to)||from<=0||to<from||to-from<=MAX_CHUNK){
      return nativeFetch(input,{...init,cache:'no-store'});
    }

    let failures=0,total=0;
    const out=[];
    for(let a=from;a<=to;a+=MAX_CHUNK){
      const b=Math.min(to,a+MAX_CHUNK-1);total++;
      try{
        out.push(...await fetchJsonRange(u,a,b,init));
      }catch{
        const mid=Math.floor((a+b)/2);
        for(const [x,y] of [[a,mid],[mid+1,b]]){
          if(y<x)continue;
          total++;
          try{out.push(...await fetchJsonRange(u,x,y,init))}
          catch{failures++}
        }
      }
    }

    const dedup=new Map();
    out.forEach(r=>{const k=String(r?.bucket_ts??'');if(k)dedup.set(k,r)});
    const merged=[...dedup.values()].sort((a,b)=>Number(a.bucket_ts)-Number(b.bucket_ts));
    window.__hlStateChunkFailures=failures;
    window.__hlStateChunkCount=total;

    if(!merged.length&&failures){
      return new Response(JSON.stringify({error:'state chunks failed'}),{status:500,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    }
    return new Response(JSON.stringify(merged),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  };

  document.addEventListener('DOMContentLoaded',()=>{
    const status=document.getElementById('status');
    if(!status)return;
    new MutationObserver(()=>{
      const f=window.__hlStateChunkFailures||0;
      if(f>0&&!status.textContent.includes('⚠'))status.textContent+=' · ⚠ пропущено фрагментів: '+f;
    }).observe(status,{childList:true,subtree:true,characterData:true});
  });
})();
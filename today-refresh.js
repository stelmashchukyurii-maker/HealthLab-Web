(()=>{
  const btn=document.getElementById('refreshBtn');
  if(!btn)return;
  btn.type='button';
  btn.title='Оновити зараз';
  btn.setAttribute('aria-label','Оновити дані HealthLab');
  let busy=false;
  const reset=()=>{busy=false;btn.disabled=false;btn.removeAttribute('aria-busy');btn.textContent='↻'};
  btn.addEventListener('click',async ev=>{
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if(busy)return;
    busy=true;btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent='…';
    try{
      if(typeof window.load==='function')await window.load();
      if(typeof window.loadTrend==='function')await window.loadTrend();
      if(typeof window.hlUpdateUserState==='function')window.hlUpdateUserState();
      if(typeof window.hlUpdateUserTrend==='function')window.hlUpdateUserTrend();
      btn.textContent='✓';
      btn.title='Оновлено '+new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
    }catch(e){
      btn.textContent='!';
      btn.title='Помилка оновлення: '+(e?.message||e);
    }finally{
      setTimeout(reset,900);
    }
  },true);
})();

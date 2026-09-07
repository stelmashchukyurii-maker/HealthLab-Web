(()=>{
  const btn=document.getElementById('refreshBtn');
  const status=document.getElementById('status');
  if(!btn)return;
  btn.type='button';
  btn.title='Оновити дані';
  const reset=()=>{btn.disabled=false;btn.removeAttribute('aria-busy');btn.textContent='↻'};
  btn.onclick=async()=>{
    if(btn.dataset.busy==='1')return;
    btn.dataset.busy='1';btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent='…';
    try{
      if(typeof window.load==='function')await window.load();
      else{location.reload();return}
      const base=status?.textContent||'';
      const t=new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
      if(status&&!base.startsWith('Помилка'))status.textContent=`Оновлено ${t} · ${base}`;
      btn.textContent='✓';
    }catch(e){
      if(status)status.textContent='Помилка оновлення: '+(e?.message||e);
      btn.textContent='!';
    }finally{
      btn.dataset.busy='0';setTimeout(reset,850);
    }
  };
})();

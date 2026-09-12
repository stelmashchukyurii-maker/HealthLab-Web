(() => {
  const byId=id=>document.getElementById(id);
  const canvas=byId('resourceBalanceChart');
  if(!canvas)return;

  const RB_COLORS={recovery:'#4da3ff',recoveryHigh:'#69d4c4',drain:'#ff9b4a',drainHigh:'#ff5f7f',sleep:'#8f7bff',hr:'#eef4ff',hrv:'#c895ff',motion:'#67d1cb',event:'#ffffff'};
  const overlay={hr:true,hrv:false,motion:false,sleep:true,events:true};

  function clamp2(v,a,b){return Math.max(a,Math.min(b,v))}
  function q(arr,p){const x=arr.filter(Number.isFinite).sort((a,b)=>a-b);if(!x.length)return null;const pos=(x.length-1)*p,b=Math.floor(pos),d=pos-b;return x[b+1]!==undefined?x[b]+d*(x[b+1]-x[b]):x[b]}

  function resourceFlow(r){
    if(!r||r.state==='UNKNOWN')return null;
    const baseHr=Number.isFinite(model?.baselineHr)?model.baselineHr:null;
    const baseHrv=Number.isFinite(model?.baselineRmssd)&&model.baselineRmssd>0?model.baselineRmssd:null;
    const residual=Number.isFinite(r.residual)?r.residual:(Number.isFinite(baseHr)&&Number.isFinite(r.avgHr)?r.avgHr-baseHr:0);
    const hrvRatio=(r.hrvValid&&baseHrv)?r.rmssd/baseHrv:null;

    if(r.state==='SLEEP'){
      let s=62;
      if(Number.isFinite(hrvRatio))s+=clamp2((hrvRatio-1)*28,-16,24);
      if(Number.isFinite(residual))s-=clamp2(Math.max(0,residual)*1.1,0,18);
      return Math.round(clamp2(s,30,100));
    }

    if(r.state==='REST'){
      let s=24;
      if(Number.isFinite(hrvRatio))s+=clamp2((hrvRatio-1)*34,-18,24);
      if(Number.isFinite(residual))s-=clamp2(Math.max(0,residual)*1.4,0,22);
      return Math.round(clamp2(s,3,55));
    }

    if(r.state==='RECOVERY'){
      let s=18;
      if(Number.isFinite(hrvRatio))s+=clamp2((hrvRatio-1)*30,-20,22);
      if(Number.isFinite(residual))s-=clamp2(Math.max(0,residual)*2.2,0,52);
      return Math.round(clamp2(s,-45,45));
    }

    if(r.state==='MOVEMENT'){
      const th=Math.max(Number(model?.movementThreshold)||.01,.001);
      const intensity=Number.isFinite(r.motion)?r.motion/th:1;
      const cost=6+clamp2((intensity-1)*9,0,52)+clamp2(Math.max(0,residual)*.8,0,24);
      return -Math.round(clamp2(cost,5,82));
    }

    if(r.state==='AUTONOMIC_LOAD'){
      const load=Number.isFinite(r.loadScore)?r.loadScore:55;
      return -Math.round(clamp2(28+load*.68,35,100));
    }
    return null;
  }

  function installButtons(){
    document.querySelectorAll('#resourceLayerButtons button').forEach(b=>{
      if(b.dataset.rbBound)return;b.dataset.rbBound='1';
      b.addEventListener('click',()=>{
        if(b.classList.contains('future')){
          byId('resourceLayerHint').textContent=b.dataset.layer==='glucose'?'Глюкоза зарезервована: підключимо після CGM і використаємо для калібрування моделі.':'Дихання зарезервоване: увімкнемо після підключення відповідного денного потоку.';
          return;
        }
        if(b.dataset.layer==='clear'){
          Object.keys(overlay).forEach(k=>overlay[k]=false);
          document.querySelectorAll('#resourceLayerButtons button:not(.future):not(.clear)').forEach(x=>x.classList.remove('on'));
        }else{
          const k=b.dataset.layer;overlay[k]=!overlay[k];b.classList.toggle('on',overlay[k]);
        }
        draw();
      });
    });
  }

  function drawOverlayLine(ctx,arr,access,color,L,T,W,H,x){
    const vals=arr.map(access).filter(Number.isFinite);if(vals.length<2)return;
    let lo=q(vals,.05),hi=q(vals,.95);if(!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo){lo=Math.min(...vals);hi=Math.max(...vals)+1}
    ctx.strokeStyle=color;ctx.lineWidth=1.7;ctx.globalAlpha=.9;ctx.beginPath();let started=false;
    arr.forEach(r=>{const v=access(r);if(!Number.isFinite(v))return;const xx=x(r.ts),yy=T+H-(clamp2((v-lo)/(hi-lo),0,1)*H);if(!started){ctx.moveTo(xx,yy);started=true}else ctx.lineTo(xx,yy)});
    ctx.stroke();ctx.globalAlpha=1;
  }

  function draw(){
    if(typeof rows==='undefined'||typeof rangeStart!=='function'||typeof dayEnd!=='function')return;
    const wrap=canvas.parentElement,cssW=Math.max(300,wrap.clientWidth),cssH=parseInt(getComputedStyle(canvas).height)||360,dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);
    if(!rows.length){ctx.fillStyle='#8d99aa';ctx.font='13px system-ui';ctx.fillText('Немає достатніх даних',18,28);return}

    const L=42,R=12,T=18,B=30,W=cssW-L-R,H=cssH-T-B,zero=T+H/2,x0=rangeStart(),x1=dayEnd(),x=ts=>L+(ts-x0)/(x1-x0)*W;
    ctx.strokeStyle='rgba(126,146,178,.13)';ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const xx=L+W*i/4;ctx.beginPath();ctx.moveTo(xx,T);ctx.lineTo(xx,T+H);ctx.stroke();ctx.fillStyle='#7f8da7';ctx.font='10px system-ui';ctx.textAlign=i===0?'left':i===4?'right':'center';ctx.fillText(fmtTime(x0+(x1-x0)*i/4),xx,T+H+21)}
    ctx.textAlign='left';

    ctx.fillStyle='rgba(77,163,255,.035)';ctx.fillRect(L,T,W,H/2);
    ctx.fillStyle='rgba(255,95,127,.028)';ctx.fillRect(L,zero,W,H/2);
    ctx.strokeStyle='rgba(235,242,250,.55)';ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(L,zero);ctx.lineTo(L+W,zero);ctx.stroke();
    ctx.fillStyle='#9fb0c4';ctx.font='700 10px system-ui';ctx.fillText('ВІДНОВЛЕННЯ',L+4,T+12);ctx.fillText('ВИТРАТА РЕСУРСУ',L+4,zero+14);

    if(overlay.sleep){rows.filter(r=>r.state==='SLEEP').forEach(r=>{const xx=x(r.ts),x2=x(Math.min(x1,r.ts+300000));ctx.fillStyle=RB_COLORS.sleep;ctx.globalAlpha=.08;ctx.fillRect(xx,T,Math.max(1,x2-xx),H)});ctx.globalAlpha=1}

    rows.forEach(r=>{
      const flow=resourceFlow(r);r.resourceFlow=flow;if(!Number.isFinite(flow))return;
      const xx=x(r.ts),x2=x(Math.min(x1,r.ts+300000)),bw=Math.max(1,x2-xx-1),mag=Math.min(1,Math.abs(flow)/100),bh=(H/2-4)*mag;
      if(flow>=0){ctx.fillStyle=flow>55?RB_COLORS.recoveryHigh:RB_COLORS.recovery;ctx.globalAlpha=.82;ctx.fillRect(xx,zero-bh,bw,bh)}
      else{ctx.fillStyle=(r.state==='AUTONOMIC_LOAD'||flow<-60)?RB_COLORS.drainHigh:RB_COLORS.drain;ctx.globalAlpha=.84;ctx.fillRect(xx,zero,bw,bh)}
    });ctx.globalAlpha=1;

    if(overlay.hr)drawOverlayLine(ctx,rows,r=>r.avgHr,RB_COLORS.hr,L,T,W,H,x);
    if(overlay.hrv)drawOverlayLine(ctx,rows,r=>r.hrvValid?r.rmssd:null,RB_COLORS.hrv,L,T,W,H,x);
    if(overlay.motion)drawOverlayLine(ctx,rows,r=>r.motion,RB_COLORS.motion,L,T,W,H,x);
    if(overlay.events&&typeof events!=='undefined')events.filter(e=>e.ts>=x0&&e.ts<=x1).forEach(e=>{const xx=x(e.ts);ctx.strokeStyle=RB_COLORS.event;ctx.globalAlpha=.32;ctx.beginPath();ctx.moveTo(xx,T);ctx.lineTo(xx,T+H);ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=RB_COLORS.event;ctx.beginPath();ctx.arc(xx,zero,3,0,Math.PI*2);ctx.fill()});

    if(typeof hoverIndex!=='undefined'&&hoverIndex!==null&&rows[hoverIndex]){const hx=x(rows[hoverIndex].ts);ctx.strokeStyle='rgba(255,255,255,.72)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(hx,T);ctx.lineTo(hx,T+H);ctx.stroke()}
    canvas._rbGeom={L,W,x0,x1};
  }

  canvas.addEventListener('pointerdown',e=>{
    if(typeof rows==='undefined'||!rows.length||!canvas._rbGeom)return;
    const rect=canvas.getBoundingClientRect(),px=e.clientX-rect.left,g=canvas._rbGeom;if(px<g.L||px>g.L+g.W)return;
    const ts=g.x0+(px-g.L)/g.W*(g.x1-g.x0);let best=0,dist=Infinity;rows.forEach((r,i)=>{const d=Math.abs(r.ts-ts);if(d<dist){dist=d;best=i}});hoverIndex=best;if(typeof renderSummary==='function')renderSummary();draw();
  });
  window.addEventListener('resize',draw);

  if(typeof renderAll==='function'&&!window.__hlResourceWrapped){
    window.__hlResourceWrapped=true;
    const original=renderAll;
    renderAll=function(){original();draw();};
  }
  installButtons();
  setTimeout(draw,50);
})();
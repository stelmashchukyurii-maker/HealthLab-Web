(()=>{
const exact=new Map(Object.entries({
'CARDIO / HRV':'СЕРЦЕ / HRV',
'RESPIRATION / OXYGEN':'ДИХАННЯ / КИСЕНЬ',
'SLEEP':'СОН',
'TEMPERATURE':'ТЕМПЕРАТУРА',
'ACTIVITY / MOVEMENT':'АКТИВНІСТЬ / РУХ',
'AUTONOMIC / RECOVERY':'АВТОНОМНА РЕГУЛЯЦІЯ / ВІДНОВЛЕННЯ',
'METABOLIC / FUTURE':'ОБМІН РЕЧОВИН / МАЙБУТНЄ',
'HR / heart rate':'Пульс (HR)',
'RR intervals':'RR-інтервали',
'ECG waveform':'Сигнал ЕКГ',
'R-peaks':'R-піки',
'PPG / raw optical':'PPG / сирий оптичний сигнал',
'Resting HR':'Пульс у спокої',
'Mean HR':'Середній пульс',
'Min HR':'Мінімальний пульс',
'Max HR':'Максимальний пульс',
'Mean NN':'Середній NN-інтервал',
'HRV frequency-domain':'Спектральні показники HRV',
'PVC / PAC-like burden':'Частка PVC/PAC-подібних подій',
'Brady / tachy episodes':'Епізоди повільного / швидкого пульсу',
'WHOOP nightly HRV':'Нічний HRV WHOOP',
'Raw respiration signal':'Сирий сигнал дихання',
'Respiratory rate':'Частота дихання',
'PPG red/IR carriers':'PPG червоний / ІЧ сирий сигнал',
'SpO₂ %':'SpO₂',
'Total sleep time':'Загальний час сну',
'Sleep efficiency':'Ефективність сну',
'Wake after sleep onset':'Час неспання після засинання',
'Sleep onset / final wake':'Засинання / остаточне пробудження',
'Awakenings / disturbances':'Пробудження / порушення сну',
'Sleep stages':'Фази сну',
'WHOOP Sleep Performance':'Оцінка сну WHOOP',
'Skin temperature raw':'Сира температура шкіри',
'Skin temperature deviation':'Відхилення температури шкіри',
'Overnight temperature trend':'Нічний тренд температури',
'Accelerometer / motion':'Рух / акселерометр',
'Gravity / posture motion':'Гравітація / зміни положення',
'Steps':'Кроки',
'Physical activity':'Фізична активність',
'HealthLab state':'Стан за HealthLab',
'WHOOP Recovery':'Відновлення WHOOP',
'WHOOP Strain':'Навантаження WHOOP',
'WHOOP Stress':'Стрес WHOOP',
'Garmin Stress':'Стрес Garmin',
'Garmin Body Battery':'Запас енергії Garmin',
'Garmin Training Readiness':'Готовність до тренування Garmin',
'Glucose':'Глюкоза',
'Glucose slope':'Зміна глюкози',
'Blood pressure':'Артеріальний тиск'
}));
const repl=[
[/\bPRIMARY\b/g,'ПЕРВИННИЙ'],[/\bRAW\b/g,'СИРІ ДАНІ'],[/\bREFERENCE\b/g,'КОНТРОЛЬНИЙ'],
[/\bEXPERIMENTAL\b/g,'ЕКСПЕРИМЕНТАЛЬНИЙ'],[/\bVALIDATING\b/g,'ПЕРЕВІРЯЄМО'],[/\bVALIDATED\b/g,'ПЕРЕВІРЕНО'],
[/\bPLANNED\b/g,'ЗАПЛАНОВАНО'],[/\bVENDOR\b/g,'ВИРОБНИК'],[/\bDEVICE-PROCESSED\b/g,'ОБРОБЛЕНО ПРИСТРОЄМ'],
[/\bNOT CONNECTED\b/g,'НЕ ПІДКЛЮЧЕНО'],[/\bNO DATA\b/g,'НЕМАЄ ДАНИХ'],[/\bAVAILABLE\b/g,'Є ДАНІ'],
[/\bGOOD\b/g,'ДОБРА ЯКІСТЬ'],[/\bLIMITED\b/g,'ОБМЕЖЕНА ЯКІСТЬ'],[/\bselected day\b/gi,'вибраний день'],
[/\bperiod min\b/gi,'мінімум за період'],[/\bperiod max\b/gi,'максимум за період'],[/\b5m median\b/gi,'медіана 5-хв вікон'],
[/\bavg\/median\b/gi,'середнє / медіана'],[/\brows\b/gi,'записів'],[/\blast\b/gi,'останнє'],
[/\bquality\b/gi,'якість'],[/\bsource\b/gi,'джерело'],[/\bwindow\b/gi,'вікно'],[/\bcoverage\b/gi,'покриття даними']
];
function convert(s){let t=exact.get(s.trim())||s;for(const [r,v] of repl)t=t.replace(r,v);return t}
function walk(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const a=[];while(w.nextNode())a.push(w.currentNode);for(const n of a){const p=n.parentElement;if(!p||['SCRIPT','STYLE'].includes(p.tagName))continue;const x=convert(n.nodeValue);if(x!==n.nodeValue)n.nodeValue=x}}
let busy=false;const mo=new MutationObserver(()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{walk(document.body);busy=false})});
mo.observe(document.body,{subtree:true,childList:true,characterData:true});
walk(document.body);
})();

(()=>{const s=document.createElement('script');s.src='./mode.js?v=20260908-2';s.async=false;s.onload=()=>{if(document.readyState!=='loading'&&typeof hlInstallShell==='function'){hlInstallShell();hlInstallModeSwitch();hlSetMode('research');hlObserveSimple()}};document.head.appendChild(s)})();

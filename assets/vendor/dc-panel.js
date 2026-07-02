/* Panneau de réglage (tuner) du fond datacenter. Chargé seulement si window.DC_PANEL. */
export function buildPanel(ctx){
  const { config, DEFAULTS, applyLive, buildLEDs, regen, getStats } = ctx;
  const controls = document.getElementById('controls'); if(!controls) return;
  const REGEN = ['density','palette'];
  const SLIDERS = [
    { group:'Allée' },
    { key:'camSpeed', label:'Vitesse caméra', min:0, max:3, step:0.05, fmt:v=>v.toFixed(2) },
    { key:'fog', label:'Brouillard', min:0, max:0.12, step:0.005, fmt:v=>v.toFixed(3) },
    { group:'LED' },
    { key:'blink', label:'Clignotement', min:0, max:3, step:0.05, fmt:v=>v.toFixed(2) },
    { key:'density', label:'Densité', min:0.4, max:2, step:0.05, fmt:v=>v.toFixed(2) },
    { key:'ledSize', label:'Taille', min:0.01, max:0.12, step:0.005, fmt:v=>v.toFixed(3) },
    { key:'glow', label:'Bloom / lueur', min:0, max:2, step:0.05, fmt:v=>v.toFixed(2) },
    { key:'traffic', label:'Trafic réseau', min:0, max:1, step:0.05, fmt:v=>v.toFixed(2) },
    { group:'Éclairage' },
    { key:'ramp', label:'Rampes plafond', min:0, max:2, step:0.05, fmt:v=>v.toFixed(2) },
    { key:'shaft', label:'Faisceaux', min:0, max:1, step:0.05, fmt:v=>v.toFixed(2) },
    { key:'dust', label:'Poussière', min:0, max:1, step:0.05, fmt:v=>v.toFixed(2) },
    { key:'screens', label:'Écrans (vitesse)', min:0, max:3, step:0.1, fmt:v=>v.toFixed(1) },
    { group:'Lisibilité' },
    { key:'veil', label:'Voile central', min:0, max:1, step:0.02, fmt:v=>v.toFixed(2) }
  ];
  SLIDERS.forEach(def=>{
    if(def.group){ const t=document.createElement('div'); t.className='group-title'; t.textContent=def.group; controls.appendChild(t); return; }
    const row=document.createElement('div'); row.className='row';
    row.innerHTML=`<div class="lab"><span>${def.label}</span><span class="val" id="val-${def.key}"></span></div><input type="range" id="in-${def.key}" min="${def.min}" max="${def.max}" step="${def.step}">`;
    controls.appendChild(row);
    const input=row.querySelector('input'), val=row.querySelector('.val');
    input.value=config[def.key]; val.textContent=def.fmt(config[def.key]);
    input.addEventListener('input', ()=>{ config[def.key]=parseFloat(input.value); val.textContent=def.fmt(config[def.key]); if(REGEN.includes(def.key)) buildLEDs(); applyLive(); });
  });
  const palRow=document.createElement('div'); palRow.className='row';
  palRow.innerHTML=`<div class="lab"><span>Ambiance LED</span></div><select id="in-pal"><option value="green">Vert (réf.)</option><option value="datacenter">Bleu</option><option value="multi">Multicolore</option><option value="cyan">Cyan / bleu</option><option value="amber">Ambre / or</option><option value="warm">Chaud (rouge/violet)</option><option value="violet">Violet (YouKyi)</option><option value="violetPremium">Violet premium (pro)</option></select>`;
  controls.appendChild(palRow);
  const palSel=palRow.querySelector('select'); palSel.value=config.palette; palSel.addEventListener('change', ()=>{ config.palette=palSel.value; buildLEDs(); });
  const bgRow=document.createElement('div'); bgRow.className='row'; bgRow.innerHTML=`<div class="lab"><span>Couleur de fond</span></div><input type="color" id="in-bg">`;
  controls.appendChild(bgRow);
  const bgInput=bgRow.querySelector('input'); bgInput.value=config.bg; bgInput.addEventListener('input', ()=>{ config.bg=bgInput.value; applyLive(); });
  const actRow=document.createElement('div'); actRow.className='btn-row'; actRow.innerHTML=`<button class="act" id="btn-regen">↻ Régénérer</button><button class="act primary" id="btn-copy">⧉ Copier la config</button>`;
  controls.appendChild(actRow);
  document.getElementById('btn-regen').addEventListener('click', ()=>{ regen(); });
  document.getElementById('btn-copy').addEventListener('click', ()=>{ const clean={}; Object.keys(DEFAULTS).forEach(k=>clean[k]=config[k]); const json=JSON.stringify(clean,null,2); if(navigator.clipboard) navigator.clipboard.writeText(json).then(showToast,()=>fb(json)); else fb(json); });
  function fb(text){ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); showToast(); }catch(e){} ta.remove(); }
  const toast=document.getElementById('toast'); let tt; function showToast(){ if(!toast)return; toast.classList.add('show'); clearTimeout(tt); tt=setTimeout(()=>toast.classList.remove('show'),1600); }
  const panel=document.getElementById('panel'), togBtn=document.getElementById('toggle-panel');
  function setPanel(open){ if(!panel)return; panel.classList.toggle('collapsed',!open); if(togBtn){ togBtn.style.opacity=open?'0':'1'; togBtn.style.pointerEvents=open?'none':'auto'; } }
  const colBtn=document.getElementById('btn-collapse'); if(colBtn) colBtn.addEventListener('click', ()=>setPanel(false));
  if(togBtn) togBtn.addEventListener('click', ()=>setPanel(true));
  setPanel(true);

  const perf = document.createElement('div');
  perf.style.cssText = 'margin-top:10px;font-size:11px;color:#9a92ad;font-variant-numeric:tabular-nums;';
  controls.appendChild(perf);
  setInterval(() => { const s = getStats(); perf.textContent = `${s.ms.toFixed(2)} ms/frame (CPU) · ${s.calls} draw calls`; }, 500);
}

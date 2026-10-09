/* Comparateur et réglages locaux, chargés exclusivement par le tuner. */
export function buildPanel(api) {
  const { config, stats }=api, controls=document.getElementById('controls');if(!controls)return;
  const descriptions={graphite:'Façades graphite, portes encadrées, serveurs et switches réseau.',hardware:'Serveurs, switches 24/48 ports et brassage en volume.'};
  const buttons=[...document.querySelectorAll('[data-render]')];
  function selected() {
    buttons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.render===config.rackStyle)));
    document.getElementById('render-description').textContent=descriptions[config.rackStyle];
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{
    api.setStyle(button.dataset.render);
    const url=new URL(location.href);url.searchParams.set('render',config.rackStyle);history.replaceState(null,'',url);
  }));
  window.addEventListener('dc:style',selected);selected();
  const pause=document.getElementById('pause-scene');
  function pauseLabel(){pause.textContent=api.paused?'Reprendre le travelling':'Mettre en pause';pause.setAttribute('aria-pressed',String(api.paused));}
  pause.addEventListener('click',()=>{api.setPaused(!api.paused);pauseLabel();});pauseLabel();
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  function motionLabel(){pause.disabled=motion.matches;pause.title=motion.matches?'La réduction des mouvements est activée sur cet appareil.':'';pauseLabel();}
  motion.addEventListener('change',motionLabel);motionLabel();
  document.getElementById('reset-view').addEventListener('click',()=>api.resetView());
  const inspect=document.getElementById('inspect-rack');
  inspect.addEventListener('click',()=>{api.setInspection(!api.inspecting);inspect.setAttribute('aria-pressed',String(api.inspecting));inspect.textContent=api.inspecting?'Voir l’allée':'Voir une baie';});

  const definitions=[
    {group:'Allée et lumière'},
    {key:'camSpeed',label:'Vitesse du travelling',min:0,max:0.6,step:0.01},
    {key:'fog',label:'Profondeur du brouillard',min:0.025,max:0.09,step:0.001},
    {key:'ramp',label:'Éclairage des rampes',min:0.25,max:1.5,step:0.05},
    {key:'glow',label:'Halo des lumières',min:0,max:1,step:0.02},
    {key:'shaft',label:'Faisceaux',min:0,max:1,step:0.05},
    {group:'Équipements'},
    {key:'density',label:'Proportion de voyants actifs',min:0.2,max:1,step:0.02},
    {key:'ledSize',label:'Taille des voyants',min:0.003,max:0.015,step:0.001},
    {key:'blink',label:'Clignotement',min:0,max:2,step:0.05},
    {key:'traffic',label:'Activité réseau',min:0,max:1,step:0.05},
    {group:'Ambiance'},
    {key:'dust',label:'Poussière en suspension',min:0,max:1,step:0.05},
    {key:'veil',label:'Voile derrière les liens',min:0,max:0.8,step:0.02}
  ];
  for(const d of definitions){
    if(d.group){const title=document.createElement('h2');title.textContent=d.group;controls.appendChild(title);continue;}
    const row=document.createElement('div');row.className='row';
    row.innerHTML=`<div class="lab"><label for="in-${d.key}">${d.label}</label><output for="in-${d.key}" id="val-${d.key}"></output></div><input type="range" id="in-${d.key}" min="${d.min}" max="${d.max}" step="${d.step}">`;
    const input=row.querySelector('input'),output=row.querySelector('output');
    const format=value=>Number(value).toFixed(d.step<0.01?3:2);
    input.value=config[d.key];output.value=format(config[d.key]);
    input.addEventListener('input',()=>{config[d.key]=input.valueAsNumber;output.value=format(config[d.key]);if(d.key==='density')api.buildLEDs();api.applyLive();});
    controls.appendChild(row);
  }
  const extras=document.createElement('div');extras.className='row';
  extras.innerHTML='<label class="check"><input id="in-mirror" type="checkbox"> Reflets au sol</label><label class="lab" for="in-pal">Accent lumineux</label><select id="in-pal"><option value="violet">Violet YouKyi</option><option value="violetPremium">Violet professionnel</option><option value="datacenter">Bleu froid</option><option value="cyan">Cyan</option><option value="green">Vert</option><option value="amber">Ambre</option></select>';
  const mirror=extras.querySelector('input');mirror.checked=config.mirror!==0;
  mirror.addEventListener('change',()=>{config.mirror=mirror.checked?1:0;api.applyLive();});
  const palette=extras.querySelector('select');palette.value=config.palette;
  palette.addEventListener('change',()=>{config.palette=palette.value;api.buildLEDs();api.applyLive();});controls.appendChild(extras);
  const actions=document.createElement('div');actions.className='actions';
  actions.innerHTML='<button id="btn-copy" type="button">Copier la config</button><button id="btn-poster" type="button">Capturer le poster</button>';
  controls.appendChild(actions);
  let toastTimer;
  function message(text){const toast=document.getElementById('toast');toast.textContent=text;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,2400);}
  document.getElementById('btn-copy').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(JSON.stringify(config,null,2));message('Configuration copiée.');}
    catch{message('La copie est indisponible dans ce navigateur.');}
  });
  document.getElementById('btn-poster').addEventListener('click',()=>api.capturePoster());
  const panel=document.getElementById('panel'),toggle=document.getElementById('toggle-panel');
  function setPanel(open){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)document.getElementById('btn-collapse').focus();else toggle.focus();}
  toggle.addEventListener('click',()=>setPanel(panel.hidden));
  document.getElementById('btn-collapse').addEventListener('click',()=>setPanel(false));
  panel.addEventListener('keydown',event=>{if(event.key==='Escape')setPanel(false);});
  const meter=document.getElementById('performance');
  setInterval(()=>{meter.textContent=`${api.paused?'Image fixe':stats.fps.toFixed(0)+' images/s'} · ${stats.ms.toFixed(2)} ms CPU · ${stats.calls} appels de rendu · ${Math.round(stats.triangles/1000)} k triangles`;},750);
  document.getElementById('loading-scene').hidden=true;
}

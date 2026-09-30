import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {initManifold,buildDesign,manifoldToThree} from './geometry';
import {defaultArtwork,rasterToSvg,buildArtwork} from './artwork';
import {download,meshToSTL,meshesTo3MF} from './export';
import {DEFAULTS,type DesignSettings,type DesignDocument,type ArtworkSource} from './types';
import {PRINTERS,printer} from './printers';
import './styles.css';

const app=document.querySelector<HTMLDivElement>('#app')!;
let settings:DesignSettings={...DEFAULTS};
let source:ArtworkSource='text';
let svg=defaultArtwork(settings);
let name='VNTR';
let imagePreview='';
let design:any=null;
let scene:THREE.Scene,camera:THREE.PerspectiveCamera,renderer:THREE.WebGLRenderer,controls:OrbitControls,root:THREE.Group;
let buildTimer:number|undefined;
let buildGeneration=0;
let dark=true,pressed=false;

const E=(tag:string,attrs:any={},html='')=>{const e=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));e.innerHTML=html;return e};
const q=(id:string)=>document.getElementById(id)!;
const active=(id:string,group:string[])=>group.forEach(x=>q(x)?.classList.toggle('active',x===id));
const fmt=(n:number)=>Number(n.toFixed(2)).toString();

function field(label:string,key:keyof DesignSettings,min:number,max:number,step:number){
  const w=E('div',{class:'field'}),l=E('label',{},label+'<span>'+settings[key]+'</span>');
  const i=E('input',{type:'range',min,max,step,value:settings[key]}) as HTMLInputElement;
  i.oninput=()=>{(settings as any)[key]=Number(i.value);(l.querySelector('span') as HTMLElement).textContent=i.value;queue()};
  w.append(l,i);return w;
}
function select(label:string,key:keyof DesignSettings,opts:string[]){
  const w=E('div',{class:'field'}),l=E('label',{},label),s=E('select') as HTMLSelectElement;
  opts.forEach(x=>s.add(new Option(x,x)));s.value=String(settings[key]);
  s.onchange=()=>{(settings as any)[key]=s.value;queue()};w.append(l,s);return w;
}
function check(label:string,key:keyof DesignSettings){
  const l=E('label',{class:'check'}),i=E('input',{type:'checkbox'}) as HTMLInputElement;
  i.checked=Boolean(settings[key]);
  i.onchange=async()=>{
    (settings as any)[key]=i.checked;
    if(key==='removeBackground' && source==='image' && imagePreview){
      svg=await rasterToSvg(imagePreview,settings.imageColors,settings.imageThreshold,settings.imageInvert,settings.removeBackground,settings.smoothing);
    }
    queue();
  };
  l.append(i,document.createTextNode(label));return l;
}

app.innerHTML=`
<div class="app">
<aside class="sidebar left">
  <div class="brand"><div class="logo-mark">V</div><div><strong>VNTR <span>Clicker Studio</span></strong><small>PARAMETRIC 3D CLICKER GENERATOR</small></div></div>
  <section class="section"><div class="section-head"><h3>View</h3><span class="badge">LIVE CSG</span></div>
    <div class="seg"><button class="btn active" id="assembled">Assembled</button><button class="btn" id="exploded">Exploded</button></div>
    <div class="seg view-actions"><button class="btn active" id="switch">Switch</button><button class="btn" id="cut">Cutaway</button></div>
  </section>
  <section class="section"><div class="section-head"><h3>Body</h3><span class="unit">mm</span></div><div id="shape"></div><div id="dims"></div></section>
  <section class="section"><div class="section-head"><h3>Switch & Fit</h3><span class="unit">CHERRY MX</span></div><div id="fit"></div><div id="switch-layout"></div></section>
  <section class="section"><div class="section-head"><h3>Printer Profile</h3><span id="printer-tag" class="unit">KOBRA X</span></div><div id="print"></div><div id="printer-info"></div></section>
  <section class="section"><h3>Options</h3><div id="opts"></div><div id="keychain"></div><div id="orientation"></div></section>
  <section class="section"><div class="actions"><button class="download" id="save">Save project</button><button class="download" id="load">Load project</button></div><button class="text-btn" id="reset-design">Reset all settings</button></section>
</aside>

<main class="viewport"><div class="stage-grid"></div><div id="viewport"></div>
  <div class="topbar"><div class="pillbar"><button class="active" id="mode-color">Flat</button><button id="mode-raised">Raise</button><button id="mode-engraved">Engrave</button></div>
    <div class="pillbar"><button id="top">Top</button><button id="front">Front</button><button id="home">Fit</button><button id="dark">☾</button></div></div>
  <div class="stage-label"><b>3D PREVIEW</b><span id="view-label">Assembled</span></div>
  <button class="press-key" id="press-key">PRESS</button>
  <div class="hint">Drag rotate · Shift/right-drag pan · Scroll zoom</div><div class="status" id="status">Starting…</div>
</main>

<aside class="sidebar right">
  <div class="brand panel-title"><div><strong>Design</strong><small>ARTWORK · MATERIALS · EXPORT</small></div></div>
  <section class="section"><div class="section-head"><h3>Import Artwork</h3><span id="source-name" class="unit">TEXT</span></div>
    <div class="seg source-tabs"><button class="btn" id="image-tab">Image</button><button class="btn" id="svg-tab">SVG</button><button class="btn active" id="text-tab">Text</button><button class="btn" id="icon-tab">Icon</button></div><div id="source"></div>
  </section>
  <section class="section"><div class="section-head"><h3>Artwork</h3><span class="unit">CSG RELIEF</span></div><div id="art"></div>
    <div class="micro-title">Artwork color</div><input class="color-input" id="art-color" type="color" value="${settings.artworkColor}">
    <div class="micro-title">Image detail</div>
    <div class="field compact"><label>Threshold<span id="threshold-value">${settings.imageThreshold}</span></label><input id="threshold" type="range" min="0" max="255" value="${settings.imageThreshold}"></div>
    <div class="field compact"><label>Colors<span id="colors-value">${settings.imageColors}</span></label><input id="colors" type="range" min="2" max="8" value="${settings.imageColors}"></div>
  </section>
  <section class="section"><div class="section-head"><h3>Filament</h3><span class="unit">3MF MATERIALS</span></div>
    <div class="swatches"><label>Base<input id="base-color" type="color" value="${settings.baseColor}"></label><label>Cap<input id="cap-color" type="color" value="${settings.capColor}"></label><label>Art<input id="art2" type="color" value="${settings.artworkColor}"></label></div>
  </section>
  <section class="section export-section"><div class="section-head"><h3>Export</h3><span class="badge green">PRINT READY</span></div>
    <div class="actions"><button class="download primary" id="mf">Export 3MF</button><button class="download" id="stl">Base STL</button><button class="download" id="capstl">Cap STL</button><button class="download" id="fullstl">Assembled STL</button><button class="download" id="png">Render PNG</button><button class="download" id="preset">Printer preset</button><button class="download" id="json">Project JSON</button></div>
    <p class="tiny">3MF exports separate base/cap/art objects with filament colors. Engraved artwork is boolean-cut into the cap.</p>
  </section>
  <section class="section"><div class="section-head"><h3>Validation & Model</h3><span class="unit">LIVE</span></div><div class="stats" id="stats"></div></section>
</aside>
</div>`;

const vp=q('viewport');
scene=new THREE.Scene();scene.background=new THREE.Color(0x0d1015);
camera=new THREE.PerspectiveCamera(42,1,.1,1000);camera.position.set(72,58,68);
renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x0d1015,1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;renderer.localClippingEnabled=true;vp.appendChild(renderer.domElement);
controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.screenSpacePanning=true;controls.target.set(0,0,4);
root=new THREE.Group();scene.add(root);
scene.add(new THREE.HemisphereLight(0xffffff,0x303743,2.6));
const key=new THREE.DirectionalLight(0xffffff,3.8);key.position.set(60,80,100);scene.add(key);
const fill=new THREE.DirectionalLight(0x91b5ff,1.7);fill.position.set(-70,20,35);scene.add(fill);
const rim=new THREE.DirectionalLight(0xff8068,1);rim.position.set(40,-50,25);scene.add(rim);
function resize(){const b=vp.getBoundingClientRect();renderer.setSize(b.width,b.height,false);camera.aspect=b.width/Math.max(1,b.height);camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();

function material(color:string,roughness=.7){return new THREE.MeshStandardMaterial({color,roughness,metalness:.04,clippingPlanes:settings.cutaway?[new THREE.Plane(new THREE.Vector3(-1,0,0),0)]:[]})}
function render(){
  while(root.children.length)root.remove(root.children[0]);if(!design)return;
  root.rotation.set(settings.printOrientation==='face-up'?Math.PI:0,0,0);
  const base=new THREE.Mesh(manifoldToThree(design.base,THREE),material(settings.baseColor,.76));
  const cap=new THREE.Mesh(manifoldToThree(design.cap,THREE),material(settings.capColor,.6));
  const switchGroup=new THREE.Group(); switchGroup.name='switch-group';
  const swMat=new THREE.MeshStandardMaterial({color:0x252a31,roughness:.42,metalness:.15,clippingPlanes:settings.cutaway?[new THREE.Plane(new THREE.Vector3(-1,0,0),0)]:[]});
  const placements=design.switchPlacements||[[0,0]];
  placements.forEach((p:number[],idx:number)=>{const sw=new THREE.Mesh(manifoldToThree(design.switchPart,THREE),swMat);sw.name='switch-key-'+idx;sw.position.x=p[0];sw.position.y=p[1];switchGroup.add(sw)});
  // switchPreview() is modeled relative to the cap's top face, so the
  // assembled switch must share the cap-top Z plane rather than the base-top.
  const assembledSwitchZ=settings.baseHeight+settings.capHeight;
  if(settings.viewMode==='exploded'){
    cap.position.z=assembledSwitchZ+7;
    switchGroup.position.z=assembledSwitchZ+7;
  }else{
    cap.position.z=settings.baseHeight;
    switchGroup.position.z=assembledSwitchZ;
  }
  root.add(base,cap);if(settings.showSwitch)root.add(switchGroup);
  if(design.artworkParts?.length){
    for(const part of design.artworkParts){
      const ag=new THREE.Mesh(manifoldToThree(part.mesh,THREE),material(settings.artworkColor,.58));
      ag.position.z=settings.viewMode==='exploded'?settings.baseHeight+settings.capHeight+7:settings.baseHeight;
      if(settings.cutaway)ag.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(-1,0,0),0)];
      root.add(ag);
    }
  }
  const p=printer(settings.printer),sz=design.stats.size;
  const bedWarn=sz[0]>p.bed[0]||sz[1]>p.bed[1]||sz[2]>p.bed[2];
  const warning=bedWarn?'Model exceeds '+p.name+' build volume.':design.validation.warning;
  q('view-label').textContent=settings.viewMode==='exploded'?'Exploded':settings.cutaway?'Cutaway':settings.printOrientation==='face-up'?'Face-up':'Assembled';
  q('stats').innerHTML='<div class="stat"><b>'+sz.map((x:number)=>fmt(x)).join(' × ')+'</b><span>overall size · mm</span></div>'+
    '<div class="stat"><b>'+fmt(design.stats.volume)+'</b><span>solid volume · mm³</span></div>'+
    '<div class="stat"><b>'+design.stats.vertices.toLocaleString()+'</b><span>vertices</span></div>'+
    '<div class="stat"><b>'+design.stats.triangles.toLocaleString()+'</b><span>triangles</span></div>'+
    '<div class="stat"><b>'+p.name+'</b><span>'+p.bed.join(' × ')+' mm bed</span></div>'+
    '<div class="stat"><b>'+p.recommendedSpeed+' mm/s</b><span>recommended speed</span></div>'+
    '<div class="validation '+(warning?'warn':'ok')+'"><span class="dot"></span>'+(warning||'Watertight Manifold geometry · within printer envelope')+'</div>';
  q('printer-tag').textContent=p.name.toUpperCase().replace('ANYCUBIC ','');
  const orient=q('orientation');
  if(orient) orient.innerHTML='<div class="profile-card"><b>Print orientation</b><span>'+settings.printOrientation.toUpperCase()+' · '+(settings.printOrientation==='face-down'?'best surface detail / minimal support':'top surface visible / support may be required')+'</span></div>';
  q('printer-info').innerHTML='<div class="profile-card"><b>'+p.name+'</b><span>Bed '+p.bed.join(' × ')+' mm · '+p.defaultNozzle+' mm standard nozzle</span><span>'+p.recommendedSpeed+' mm/s recommended · '+p.maxSpeed+' mm/s max</span><span>Layer '+p.layer[0]+'–'+p.layer[1]+' mm · '+p.slicer.join(' / ')+'</span></div>';
}
async function build(){
  const generation=++buildGeneration;
  try{
    q('status').textContent='Updating 3D model…';
    await initManifold();
    if(generation!==buildGeneration)return;
    if(design)for(const k of ['base','cap','switchPart','full','artwork'])try{design[k]?.delete?.()}catch{}
    const next=buildDesign(settings,svg);
    if(generation!==buildGeneration){for(const k of ['base','cap','switchPart','full','artwork'])try{next[k]?.delete?.()}catch{};return}
    design=next;
    render();
    q('status').textContent=design.validation.warning||'Model updated';
  }catch(e){
    console.error(e);
    if(generation===buildGeneration)q('status').textContent=(e as Error).message||'Check dimensions / fit settings';
  }
}
function queue(){clearTimeout(buildTimer);buildTimer=window.setTimeout(build,80)}

q('shape').append(select('Shape','shape',['rounded','square','circle','pill','bar']));
q('dims').append(field('Width','width',20,90,1),field('Depth','depth',20,90,1),field('Base height','baseHeight',4,16,.5),field('Cap height','capHeight',1.5,5,.1),field('Corner radius','cornerRadius',0,20,.5));
q('fit').append(field('MX tolerance','tolerance',.1,.6,.05),field('MX cavity depth','mxDepth',3,6.5,.1),field('Wall thickness','wall',1,4,.1),field('Cap clearance','capClearance',.1,.6,.05),field('Stem height','stemHeight',.6,2.5,.1));
q('switch-layout').append(select('Switch count','switchCount',['1','2','3']),field('Switch spacing','switchSpacing',12,38,1));
q('print').append(select('Printer','printer',PRINTERS.map(p=>p.name)),select('Nozzle','nozzle',['0.25','0.4','0.6','0.8']));
q('opts').append(check('Keychain attachment','keyring'),check('Show Cherry MX switch','showSwitch'),check('Cutaway section','cutaway'),check('Remove image background','removeBackground'));
q('keychain').append(select('Keychain style','keyringStyle',['loop','hole']),field('Hole diameter','keyringDiameter',3,10,.2),field('Angle','keyringAngle',0,330,15));
q('orientation').append(select('Orientation','printOrientation',['face-down','face-up']));

function syncPrinter(){const p=printer(settings.printer);if(!p.nozzles.includes(settings.nozzle))settings.nozzle=p.defaultNozzle;queue()}
const printerSelect=q('print').querySelector('select') as HTMLSelectElement;printerSelect.onchange=()=>{settings.printer=printerSelect.value;syncPrinter()};
const nozzleSelect=q('print').querySelectorAll('select')[1] as HTMLSelectElement;nozzleSelect.onchange=()=>{settings.nozzle=+nozzleSelect.value;queue()};
const switchCountSelect=q('switch-layout').querySelector('select') as HTMLSelectElement; switchCountSelect.onchange=()=>{settings.switchCount=+switchCountSelect.value;queue()};
const keyStyleSelect=q('keychain').querySelector('select') as HTMLSelectElement; keyStyleSelect.onchange=()=>{settings.keyringStyle=keyStyleSelect.value as any;queue()};
const orientationSelect=q('orientation').querySelector('select') as HTMLSelectElement; orientationSelect.onchange=()=>{settings.printOrientation=orientationSelect.value as any;render()};


async function readFileAsDataUrl(file:File):Promise<string>{
  return await new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=()=>resolve(String(fr.result||''));
    fr.onerror=()=>reject(fr.error||new Error('Could not read file'));
    fr.readAsDataURL(file);
  });
}
async function readFileAsText(file:File):Promise<string>{
  return await new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=()=>resolve(String(fr.result||''));
    fr.onerror=()=>reject(fr.error||new Error('Could not read file'));
    fr.readAsText(file);
  });
}
function setStatus(message:string){q('status').textContent=message}
function makeFilePicker(accept:string,onFile:(file:File)=>Promise<void>){
  const input=E('input',{class:'file',type:'file',accept}) as HTMLInputElement;
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];
    if(!file)return;
    try{setStatus('Reading '+file.name+'…');await onFile(file)}
    catch(e){console.error(e);setStatus((e as Error)?.message||'Could not import file')}
    finally{input.value=''}
  });
  return input;
}
function sourcePanel(){
  const box=q('source');box.innerHTML='';q('source-name').textContent=source.toUpperCase();
  if(source==='image'){
    const d=E('div',{class:'drop'},'<strong>Choose image</strong><span>PNG · JPG · WEBP · GIF</span><small>Click to browse or drag & drop</small>');
    const input=makeFilePicker('image/png,image/jpeg,image/webp,image/gif',async(file)=>{
      name=file.name;
      imagePreview=await readFileAsDataUrl(file);
      setStatus('Tracing image…');
      svg=await rasterToSvg(imagePreview,settings.imageColors,settings.imageThreshold,settings.imageInvert,settings.removeBackground,settings.smoothing);
      sourcePanel();
      queue();
    });
    d.addEventListener('click',()=>input.click());
    d.addEventListener('dragover',e=>{e.preventDefault();d.classList.add('dragover')});
    d.addEventListener('dragleave',()=>d.classList.remove('dragover'));
    d.addEventListener('drop',async e=>{
      e.preventDefault();d.classList.remove('dragover');
      const file=e.dataTransfer?.files?.[0];
      if(!file)return;
      try{
        name=file.name;imagePreview=await readFileAsDataUrl(file);setStatus('Tracing image…');
        svg=await rasterToSvg(imagePreview,settings.imageColors,settings.imageThreshold,settings.imageInvert,settings.removeBackground,settings.smoothing);
        sourcePanel();queue();
      }catch(err){console.error(err);setStatus((err as Error)?.message||'Could not import image')}
    });
    const preview=imagePreview?'<img src="'+imagePreview+'" alt="Artwork preview">':'<span class="tiny">No image selected</span>';
    box.append(d,input,E('div',{class:'source-preview'},preview));
  }else if(source==='svg'){
    const d=E('div',{class:'drop'},'<strong>Import SVG file</strong><span>SVG vector artwork</span><small>Click to browse or drag & drop</small>');
    const input=makeFilePicker('image/svg+xml,.svg',async(file)=>{
      name=file.name;
      svg=await readFileAsText(file);
      if(!/<svg[\s>]/i.test(svg))throw new Error('The selected file does not contain valid SVG markup.');
      setStatus('SVG loaded — generating preview…');
      sourcePanel();queue();
    });
    d.addEventListener('click',()=>input.click());
    d.addEventListener('dragover',e=>{e.preventDefault();d.classList.add('dragover')});
    d.addEventListener('dragleave',()=>d.classList.remove('dragover'));
    d.addEventListener('drop',async e=>{
      e.preventDefault();d.classList.remove('dragover');
      const file=e.dataTransfer?.files?.[0];
      if(!file)return;
      try{name=file.name;svg=await readFileAsText(file);if(!/<svg[\s>]/i.test(svg))throw new Error('The selected file does not contain valid SVG markup.');setStatus('SVG loaded — generating preview…');sourcePanel();queue()}
      catch(err){console.error(err);setStatus((err as Error)?.message||'Could not import SVG')}
    });
    const paste=E('button',{class:'text-btn svg-paste-toggle'},'Paste SVG code instead');
    const wrap=E('div',{class:'svg-paste-wrap'});wrap.style.display='none';
    const t=E('textarea',{class:'codebox',placeholder:'Paste SVG markup here…'},svg) as HTMLTextAreaElement;
    t.addEventListener('input',()=>{svg=t.value;setStatus('SVG changed — updating model…');queue()});
    paste.addEventListener('click',()=>{const open=wrap.style.display!=='none';wrap.style.display=open?'none':'block';paste.textContent=open?'Paste SVG code instead':'Hide SVG code editor'});
    wrap.append(t);box.append(d,input,paste,wrap);
  }else if(source==='icon'){
    const icons:any={star:'M12 2l2.8 6 6.2.5-4.7 4 1.4 6.1L12 15.4 6.3 18.6l1.4-6.1-4.7-4L9.2 8z',heart:'M12 21S4 16.2 4 9.7A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8 3.7C20 16.2 12 21 12 21z',check:'M5 12l4 4L19 6',bolt:'M13 2L4 14h6l-1 8 9-12h-6z',diamond:'M12 2l8 10-8 10L4 12z'};
    const g=E('div',{class:'icon-grid'});Object.keys(icons).forEach(k=>{const b=E('button',{class:'icon-btn'},'<svg viewBox="0 0 24 24"><path d="'+icons[k]+'" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span>'+k+'</span>');b.onclick=()=>{svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="'+icons[k]+'" fill="#000"/></svg>';queue()};g.append(b)});box.append(g);
  }else{
    const t=E('textarea',{class:'text-input',placeholder:'Type your text…'},settings.text) as HTMLTextAreaElement;t.oninput=()=>{settings.text=t.value;svg=defaultArtwork(settings);setStatus('Text changed — updating model…');queue()};
    const f=E('div',{class:'field'},'') as HTMLDivElement;f.append(select('Font','font',['Arial','Impact','Georgia','Courier New']));
    const fs=f.querySelector('select') as HTMLSelectElement;fs.onchange=()=>{settings.font=fs.value;svg=defaultArtwork(settings);setStatus('Font changed — updating model…');queue()};
    box.append(t,f);
  }
}
sourcePanel();
for(const [id,s] of [['image-tab','image'],['svg-tab','svg'],['text-tab','text'],['icon-tab','icon']] as any)q(id).onclick=()=>{source=s;active(id,['image-tab','svg-tab','text-tab','icon-tab']);sourcePanel()};

q('assembled').onclick=()=>{settings.viewMode='assembled';active('assembled',['assembled','exploded']);queue()};
q('exploded').onclick=()=>{settings.viewMode='exploded';active('exploded',['assembled','exploded']);queue()};
q('switch').onclick=()=>{settings.showSwitch=!settings.showSwitch;(q('switch') as HTMLElement).classList.toggle('active',settings.showSwitch);render()};
q('cut').onclick=()=>{settings.cutaway=!settings.cutaway;(q('cut') as HTMLElement).classList.toggle('active',settings.cutaway);render()};
q('mode-color').onclick=()=>{settings.artworkMode='flat';active('mode-color',['mode-color','mode-raised','mode-engraved']);queue()};
q('mode-raised').onclick=()=>{settings.artworkMode='raised';active('mode-raised',['mode-color','mode-raised','mode-engraved']);queue()};
q('mode-engraved').onclick=()=>{settings.artworkMode='engraved';active('mode-engraved',['mode-color','mode-raised','mode-engraved']);queue()};
function fitView(){camera.position.set(72,58,68);controls.target.set(0,0,settings.baseHeight/2);controls.update()}q('home').onclick=fitView;q('top').onclick=()=>{camera.position.set(0,0,125);controls.target.set(0,0,0);controls.update()};q('front').onclick=()=>{camera.position.set(0,95,12);controls.target.set(0,0,6);controls.update()};
q('dark').onclick=()=>{dark=!dark;document.body.classList.toggle('light',!dark);q('dark').textContent=dark?'☾':'☀'};
q('png').onclick=()=>renderer.domElement.toBlob(b=>{if(b)download(b,'vntr-clicker-preview.png')},'image/png');

function press(on:boolean){pressed=on;const g=root.getObjectByName('switch-group');if(g)g.position.z=on?-1.1:0}
q('press-key').onpointerdown=()=>press(true);q('press-key').onpointerup=()=>press(false);q('press-key').onpointerleave=()=>press(false);
addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat){e.preventDefault();press(true)}});addEventListener('keyup',e=>{if(e.code==='Space')press(false)});

q('reset-design').onclick=()=>{settings={...DEFAULTS};source='text';svg=defaultArtwork(settings);imagePreview='';sourcePanel();printerSelect.value=settings.printer;nozzleSelect.value=String(settings.nozzle);active('assembled',['assembled','exploded']);active('mode-color',['mode-color','mode-raised','mode-engraved']);queue()};
const projectPayload=()=>JSON.stringify({version:3,settings,artworkSource:source,artworkSvg:svg,artworkName:name,imagePreview},null,2);
q('save').onclick=()=>{const raw=projectPayload();localStorage.setItem('vntr-clicker-design',raw);download(new Blob([raw],{type:'application/json'}),'vntr-clicker-project.json')};
const loadInput=E('input',{type:'file',accept:'.json,application/json'}) as HTMLInputElement;loadInput.style.display='none';document.body.append(loadInput);
q('load').onclick=()=>loadInput.click();
loadInput.onchange=async()=>{try{const f=loadInput.files?.[0];if(!f)return;const d=JSON.parse(await f.text()) as Partial<DesignDocument>;settings={...DEFAULTS,...(d.settings||{})};source=d.artworkSource||'text';svg=d.artworkSvg||defaultArtwork(settings);name=d.artworkName||'VNTR';imagePreview=d.imagePreview||'';printerSelect.value=settings.printer;nozzleSelect.value=String(settings.nozzle);switchCountSelect.value=String(settings.switchCount);keyStyleSelect.value=settings.keyringStyle;orientationSelect.value=settings.printOrientation;sourcePanel();queue()}catch{q('status').textContent='Project file could not be loaded'}loadInput.value=''};

q('stl').onclick=()=>design&&download(meshToSTL(design.base),'vntr-base.stl');
q('capstl').onclick=()=>design&&download(meshToSTL(design.cap),'vntr-cap.stl');
q('fullstl').onclick=()=>design&&download(meshToSTL(design.full),'vntr-assembled.stl');
q('mf').onclick=()=>design&&download(meshesTo3MF([{name:'VNTR Base',mesh:design.base,color:settings.baseColor},{name:'VNTR Cap',mesh:design.cap,color:settings.capColor,z:settings.baseHeight},...(design.artworkParts||[]).map((p:any,i:number)=>({name:'VNTR Artwork '+(i+1),mesh:p.mesh,color:p.color,z:settings.baseHeight}))]),'vntr-clicker.3mf');
q('json').onclick=()=>download(new Blob([JSON.stringify({version:2,settings,artworkSource:source,artworkSvg:svg,artworkName:name},null,2)],{type:'application/json'}),'vntr-clicker.json');
q('preset').onclick=()=>{const p=printer(settings.printer);download(new Blob([JSON.stringify({printer:p.name,buildVolumeMm:p.bed,nozzleMm:settings.nozzle,layerHeightMm:p.layer,recommendedSpeedMmS:p.recommendedSpeed,maxSpeedMmS:p.maxSpeed,recommendedAccelerationMmS2:p.recommendedAcceleration,maxAccelerationMmS2:p.maxAcceleration,bedTempC:p.bedTemp,hotendMaxC:p.hotendMax,slicers:p.slicer,filaments:p.filaments,notes:p.notes},null,2)],{type:'application/json'}),p.id+'-vntr-profile.json')};

for(const [id,key] of [['art-color','artworkColor'],['base-color','baseColor'],['cap-color','capColor'],['art2','artworkColor']] as any)
  q(id).addEventListener('input',(e:any)=>{settings[key]=e.target.value;render();setStatus('Color updated');});
q('threshold').oninput=(e:any)=>{settings.imageThreshold=+(e.target as HTMLInputElement).value;q('threshold-value').textContent=String(settings.imageThreshold);if(source==='image'&&imagePreview)rasterToSvg(imagePreview,settings.imageColors,settings.imageThreshold,settings.imageInvert,settings.removeBackground,settings.smoothing).then(x=>{svg=x;queue()})};
q('colors').oninput=(e:any)=>{settings.imageColors=+(e.target as HTMLInputElement).value;q('colors-value').textContent=String(settings.imageColors);if(source==='image'&&imagePreview)rasterToSvg(imagePreview,settings.imageColors,settings.imageThreshold,settings.imageInvert,settings.removeBackground,settings.smoothing).then(x=>{svg=x;queue()})};

function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();build();

import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {initManifold,buildDesign,manifoldToThree} from './geometry';
import {defaultArtwork,rasterToSvg,buildArtwork} from './artwork';
import {download,meshToSTL,meshesTo3MF} from './export';
import {DEFAULTS,type DesignSettings,type DesignDocument,type ArtworkSource} from './types';
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
let dark=true;

const E=(tag:string,attrs:any={},html='')=>{
  const e=document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));
  e.innerHTML=html;
  return e;
};
const q=(id:string)=>document.getElementById(id)!;
const active=(id:string,group:string[])=>group.forEach(x=>q(x)?.classList.toggle('active',x===id));
const fmt=(n:number)=>Number(n.toFixed(2)).toString();

function field(label:string,key:keyof DesignSettings,min:number,max:number,step:number){
  const w=E('div',{class:'field'});
  const l=E('label',{},label+'<span>'+settings[key]+'</span>');
  const i=E('input',{type:'range',min,max,step,value:settings[key]}) as HTMLInputElement;
  i.oninput=()=>{(settings as any)[key]=Number(i.value);(l.querySelector('span') as HTMLElement).textContent=i.value;queue()};
  w.append(l,i);return w;
}
function select(label:string,key:keyof DesignSettings,opts:string[]){
  const w=E('div',{class:'field'}),l=E('label',{},label),s=E('select') as HTMLSelectElement;
  opts.forEach(x=>s.add(new Option(x,x)));
  s.value=String(settings[key]);
  s.onchange=()=>{(settings as any)[key]=s.value;queue()};
  w.append(l,s);return w;
}
function check(label:string,key:keyof DesignSettings){
  const l=E('label',{class:'check'}),i=E('input',{type:'checkbox'}) as HTMLInputElement;
  i.checked=Boolean(settings[key]);
  i.onchange=()=>{(settings as any)[key]=i.checked;queue()};
  l.append(i,document.createTextNode(label));return l;
}
function button(label:string,id:string,cls='btn'){return E('button',{class:cls,id},label)}

app.innerHTML=`
<div class="app">
  <aside class="sidebar left">
    <div class="brand"><div class="logo-mark">V</div><div><strong>VNTR</strong> <span>Clicker Studio</span><small>3D CLICKER GENERATOR</small></div></div>
    <section class="section">
      <div class="section-head"><h3>View</h3><span class="badge">LIVE</span></div>
      <div class="seg"><button class="btn active" id="assembled">Assembled</button><button class="btn" id="exploded">Exploded</button></div>
      <div class="seg view-actions"><button class="btn" id="switch">Switch</button><button class="btn" id="cut">Cutaway</button></div>
    </section>
    <section class="section">
      <div class="section-head"><h3>Body</h3><span class="unit">mm</span></div>
      <div id="shape"></div><div id="dims"></div>
    </section>
    <section class="section">
      <h3>Switch & fit</h3>
      <div id="fit"></div>
    </section>
    <section class="section">
      <h3>Printing</h3>
      <div class="micro-title">Orientation</div>
      <div class="seg"><button class="btn active" id="down">Face-down</button><button class="btn" id="up">Face-up</button></div>
      <div id="print"></div>
    </section>
    <section class="section">
      <h3>Options</h3>
      <div id="opts"></div>
    </section>
    <section class="section">
      <div class="actions"><button class="download" id="save">Save project</button><button class="download" id="load">Load project</button></div>
      <button class="text-btn" id="reset-design">Reset all settings</button>
    </section>
  </aside>

  <main class="viewport">
    <div class="stage-grid"></div>
    <div id="viewport"></div>
    <div class="topbar">
      <div class="pillbar">
        <button class="active" id="mode-color">Color</button><button id="mode-raised">Raise</button><button id="mode-engraved">Engrave</button>
      </div>
      <div class="pillbar">
        <button id="top">Top</button><button id="front">Front</button><button id="home">Fit</button><button id="dark">☾</button>
      </div>
    </div>
    <div class="stage-label"><b>3D PREVIEW</b><span id="view-label">Assembled</span></div>
    <div class="hint">Drag to rotate · Shift/right-drag to pan · Scroll to zoom</div>
    <div class="status" id="status">Starting…</div>
  </main>

  <aside class="sidebar right">
    <div class="brand panel-title"><div><strong>Design</strong><small>ARTWORK & EXPORT</small></div></div>
    <section class="section">
      <div class="section-head"><h3>Import artwork</h3><span id="source-name" class="unit">TEXT</span></div>
      <div class="seg source-tabs">
        <button class="btn active" id="image-tab">Image</button><button class="btn" id="svg-tab">SVG</button><button class="btn" id="text-tab">Text</button><button class="btn" id="icon-tab">Icon</button>
      </div>
      <div id="source"></div>
    </section>
    <section class="section">
      <div class="section-head"><h3>Artwork</h3><span class="unit">RELIEF</span></div>
      <div id="art"></div>
      <div class="micro-title">Artwork color</div>
      <input class="color-input" id="art-color" type="color" value="${settings.artworkColor}">
      <div class="micro-title">Image detail</div>
      <div class="field compact"><label>Threshold<span id="threshold-value">${settings.imageThreshold}</span></label><input id="threshold" type="range" min="0" max="255" value="${settings.imageThreshold}"></div>
      <div class="field compact"><label>Colors<span id="colors-value">${settings.imageColors}</span></label><input id="colors" type="range" min="2" max="8" value="${settings.imageColors}"></div>
    </section>
    <section class="section">
      <div class="section-head"><h3>Filament</h3><span class="unit">3MF</span></div>
      <div class="swatches">
        <label>Base<input id="base-color" type="color" value="${settings.baseColor}"></label>
        <label>Cap<input id="cap-color" type="color" value="${settings.capColor}"></label>
        <label>Art<input id="art2" type="color" value="${settings.artworkColor}"></label>
      </div>
    </section>
    <section class="section export-section">
      <div class="section-head"><h3>Export</h3><span class="badge green">READY</span></div>
      <div class="actions"><button class="download primary" id="mf">Export 3MF</button><button class="download" id="stl">Base STL</button><button class="download" id="capstl">Cap STL</button><button class="download" id="json">Project JSON</button></div>
      <p class="tiny">3MF contains separate base, cap and artwork objects for multicolor workflows.</p>
    </section>
    <section class="section">
      <div class="section-head"><h3>Model</h3><span class="unit">LIVE</span></div>
      <div class="stats" id="stats"></div>
    </section>
  </aside>
</div>`;

const vp=q('viewport');
scene=new THREE.Scene();
scene.background=new THREE.Color(0x0d1015);
camera=new THREE.PerspectiveCamera(42,1,.1,1000);
camera.position.set(72,58,68);
renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x0d1015,1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.2;
renderer.localClippingEnabled=true;
vp.appendChild(renderer.domElement);
controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.07;controls.screenSpacePanning=true;
controls.target.set(0,0,4);
root=new THREE.Group();scene.add(root);
scene.add(new THREE.HemisphereLight(0xffffff,0x343b48,2.5));
const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(60,80,100);scene.add(key);
const fill=new THREE.DirectionalLight(0x91b5ff,1.5);fill.position.set(-70,20,35);scene.add(fill);
const rim=new THREE.DirectionalLight(0xff8068,.8);rim.position.set(40,-50,25);scene.add(rim);

function resize(){const b=vp.getBoundingClientRect();renderer.setSize(b.width,b.height,false);camera.aspect=b.width/Math.max(1,b.height);camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

function material(color:string,roughness=.7){
  return new THREE.MeshStandardMaterial({color,roughness,metalness:.05,clippingPlanes:settings.cutaway?[new THREE.Plane(new THREE.Vector3(-1,0,0),0)]:[]});
}
function render(){
  while(root.children.length)root.remove(root.children[0]);
  if(!design)return;
  root.rotation.set(0,0,0);
  if(settings.printOrientation==='face-up')root.rotation.x=Math.PI;
  const base=new THREE.Mesh(manifoldToThree(design.base,THREE),material(settings.baseColor,.75));
  const cap=new THREE.Mesh(manifoldToThree(design.cap,THREE),material(settings.capColor,.62));
  const sw=new THREE.Mesh(manifoldToThree(design.switchPart,THREE),new THREE.MeshStandardMaterial({color:0x26282c,roughness:.45,metalness:.15,clippingPlanes:settings.cutaway?[new THREE.Plane(new THREE.Vector3(-1,0,0),0)]:[]}));
  if(settings.viewMode==='exploded'){
    cap.position.z=settings.baseHeight+settings.capHeight+7;
    sw.position.z=settings.baseHeight+settings.capHeight+14;
  }else{
    cap.position.z=settings.baseHeight;
    sw.position.z=settings.baseHeight;
  }
  root.add(base,cap);
  if(settings.showSwitch)root.add(sw);
  if(design.artwork){
    const ag=buildArtwork(svg,settings);
    if(ag){
      if(settings.viewMode==='exploded')ag.position.z+=settings.baseHeight+settings.capHeight+7;
      ag.traverse((o:any)=>{if(o.isMesh)o.material.clippingPlanes=settings.cutaway?[new THREE.Plane(new THREE.Vector3(-1,0,0),0)]:[]});
      root.add(ag);
    }
  }
  if(settings.artworkMode==='flat'&&svg){
    const ag=buildArtwork(svg,settings);
    if(ag)root.add(ag);
  }
  q('view-label').textContent=settings.viewMode==='exploded'?'Exploded':settings.cutaway?'Cutaway':settings.printOrientation==='face-up'?'Face-up':'Assembled';
  q('stats').innerHTML=
    '<div class="stat"><b>'+design.stats.size.map((x:number)=>fmt(x)).join(' × ')+'</b><span>overall size · mm</span></div>'+
    '<div class="stat"><b>'+fmt(design.stats.volume)+'</b><span>solid volume · mm³</span></div>'+
    '<div class="stat"><b>'+design.stats.vertices.toLocaleString()+'</b><span>vertices</span></div>'+
    '<div class="stat"><b>'+design.stats.triangles.toLocaleString()+'</b><span>triangles</span></div>'+
    '<div class="validation '+(design.validation.warning?'warn':'ok')+'"><span class="dot"></span>'+(design.validation.warning||'Geometry is manifold and printable')+'</div>';
}

async function build(){
  try{
    q('status').textContent='Generating geometry…';
    await initManifold();
    if(design)for(const k of ['base','cap','switchPart','full','artwork'])try{design[k]?.delete?.()}catch{}
    design=buildDesign(settings,svg);
    render();
    q('status').textContent=design.validation.warning||'Ready';
  }catch(e){
    console.error(e);q('status').textContent='Check dimensions / fit settings';
  }
}
function queue(){clearTimeout(buildTimer);buildTimer=window.setTimeout(build,120)}

q('shape').append(select('Shape','shape',['rounded','square','circle','pill','bar']));
q('dims').append(
  field('Width','width',20,90,1),field('Depth','depth',20,90,1),
  field('Base height','baseHeight',4,16,.5),field('Cap height','capHeight',1.5,5,.1),
  field('Corner radius','cornerRadius',0,20,.5)
);
q('fit').append(field('MX tolerance','tolerance',.1,.6,.05),field('MX cavity depth','mxDepth',3,6.5,.1),field('Wall thickness','wall',1,4,.1));
q('print').append(select('Nozzle','nozzle',['0.4','0.6','0.8']),select('Printer','printer',['Anycubic Vyper','CR-10S Pro V2','Generic']));
q('opts').append(check('Keyring loop','keyring'),check('Show Cherry MX switch','showSwitch'),check('Cutaway section','cutaway'));

function sourcePanel(){
  const box=q('source');box.innerHTML='';
  q('source-name').textContent=source.toUpperCase();
  if(source==='image'){
    const d=E('div',{class:'drop'},'<strong>Drop image here</strong><span>PNG · JPG · WEBP</span><small>or click to browse</small>');
    const input=E('input',{class:'file',type:'file',accept:'image/*'}) as HTMLInputElement;
    d.onclick=()=>input.click();
    input.onchange=async()=>{
      const f=input.files?.[0];if(!f)return;
      name=f.name;
      const data=await new Promise<string>(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result));fr.readAsDataURL(f)});
      imagePreview=data;svg=await rasterToSvg(data,settings.imageColors,settings.imageThreshold);
      sourcePanel();queue();
    };
    box.append(d,input);
    const p=E('div',{class:'source-preview'},imagePreview?'<img src="'+imagePreview+'" alt="Artwork preview">':'<span class="tiny">No image selected</span>');
    box.append(p);
  }else if(source==='svg'){
    const t=E('textarea',{class:'codebox',placeholder:'Paste SVG markup here…'},svg) as HTMLTextAreaElement;
    t.oninput=()=>{svg=t.value;queue()};box.append(t);
  }else if(source==='icon'){
    const icons:any={
      star:'M12 2l2.8 6 6.2.5-4.7 4 1.4 6.1L12 15.4 6.3 18.6l1.4-6.1-4.7-4L9.2 8z',
      heart:'M12 21S4 16.2 4 9.7A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8 3.7C20 16.2 12 21 12 21z',
      check:'M5 12l4 4L19 6',bolt:'M13 2L4 14h6l-1 8 9-12h-6z',diamond:'M12 2l8 10-8 10L4 12z'
    };
    const g=E('div',{class:'icon-grid'});
    Object.keys(icons).forEach(k=>{
      const b=E('button',{class:'icon-btn'},'<svg viewBox="0 0 24 24"><path d="'+icons[k]+'" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span>'+k+'</span>');
      b.onclick=()=>{svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="'+icons[k]+'" fill="#000"/></svg>';active(b.id,[b.id]);queue()};
      g.append(b);
    });box.append(g);
  }else{
    const t=E('textarea',{class:'text-input',placeholder:'Type your text…'},settings.text) as HTMLTextAreaElement;
    t.oninput=()=>{settings.text=t.value;svg=defaultArtwork(settings);queue()};
    const f=select('Font','font',['Arial','Impact','Georgia','Courier New']);
    box.append(t,f);
  }
}
sourcePanel();

for(const [id,s] of [['image-tab','image'],['svg-tab','svg'],['text-tab','text'],['icon-tab','icon']] as any){
  q(id).onclick=()=>{source=s;active(id,['image-tab','svg-tab','text-tab','icon-tab']);sourcePanel()};
}

q('assembled').onclick=()=>{settings.viewMode='assembled';active('assembled',['assembled','exploded']);queue()};
q('exploded').onclick=()=>{settings.viewMode='exploded';active('exploded',['assembled','exploded']);queue()};
q('switch').onclick=()=>{settings.showSwitch=!settings.showSwitch;(q('switch') as HTMLElement).classList.toggle('active',settings.showSwitch);render()};
q('cut').onclick=()=>{settings.cutaway=!settings.cutaway;(q('cut') as HTMLElement).classList.toggle('active',settings.cutaway);render()};
q('down').onclick=()=>{settings.printOrientation='face-down';active('down',['down','up']);render()};
q('up').onclick=()=>{settings.printOrientation='face-up';active('up',['down','up']);render()};

q('mode-color').onclick=()=>{settings.artworkMode='flat';active('mode-color',['mode-color','mode-raised','mode-engraved']);queue()};
q('mode-raised').onclick=()=>{settings.artworkMode='raised';active('mode-raised',['mode-color','mode-raised','mode-engraved']);queue()};
q('mode-engraved').onclick=()=>{settings.artworkMode='engraved';active('mode-engraved',['mode-color','mode-raised','mode-engraved']);queue()};

function fitView(){camera.position.set(72,58,68);controls.target.set(0,0,settings.baseHeight/2);controls.update()}
q('home').onclick=fitView;
q('top').onclick=()=>{camera.position.set(0,0,125);controls.target.set(0,0,0);controls.update()};
q('front').onclick=()=>{camera.position.set(0,95,12);controls.target.set(0,0,6);controls.update()};
q('dark').onclick=()=>{dark=!dark;document.body.classList.toggle('light',!dark);q('dark').textContent=dark?'☾':'☀';};
q('reset-design').onclick=()=>{settings={...DEFAULTS};source='text';svg=defaultArtwork(settings);imagePreview='';sourcePanel();active('assembled',['assembled','exploded']);active('down',['down','up']);active('mode-raised',['mode-color','mode-raised','mode-engraved']);queue()};

q('save').onclick=()=>localStorage.setItem('vntr-clicker-design',JSON.stringify({version:1,settings,artworkSource:source,artworkSvg:svg,artworkName:name,imagePreview}));
q('load').onclick=()=>{
  const raw=localStorage.getItem('vntr-clicker-design');if(!raw)return;
  const d=JSON.parse(raw) as DesignDocument&{imagePreview?:string};
  settings={...DEFAULTS,...d.settings};source=d.artworkSource;svg=d.artworkSvg||defaultArtwork(settings);name=d.artworkName||'VNTR';imagePreview=d.imagePreview||'';
  sourcePanel();queue();
};

q('stl').onclick=()=>design&&download(meshToSTL(design.base),'vntr-base.stl');
q('capstl').onclick=()=>design&&download(meshToSTL(design.cap),'vntr-cap.stl');
q('mf').onclick=()=>design&&download(meshesTo3MF([
  {name:'VNTR Base',mesh:design.base,color:settings.baseColor},
  {name:'VNTR Cap',mesh:design.cap,color:settings.capColor,z:settings.baseHeight},
  ...(design.artwork&&settings.artworkMode!=='flat'?[{name:'VNTR Artwork',mesh:design.artwork,color:settings.artworkColor,z:settings.baseHeight+settings.capHeight}]:[])
]),'vntr-clicker.3mf');
q('json').onclick=()=>download(new Blob([JSON.stringify({version:1,settings,artworkSource:source,artworkSvg:svg,artworkName:name},null,2)],{type:'application/json'}),'vntr-clicker.json');

for(const [id,key] of [['art-color','artworkColor'],['base-color','baseColor'],['cap-color','capColor'],['art2','artworkColor']] as any)
  q(id).addEventListener('input',(e:any)=>{settings[key]=e.target.value;queue()});
q('threshold').oninput=(e:any)=>{settings.imageThreshold=+(e.target as HTMLInputElement).value;q('threshold-value').textContent=String(settings.imageThreshold);queue()};
q('colors').oninput=(e:any)=>{settings.imageColors=+(e.target as HTMLInputElement).value;q('colors-value').textContent=String(settings.imageColors);if(source==='image'&&imagePreview)sourcePanel();queue()};

function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}
animate();
build();

import Module from 'manifold-3d';
import type {DesignSettings} from './types';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';

let api:any=null;
export async function initManifold(){if(api)return api;api=await (Module as any)();api.setup();return api;}

function roundedRect(w:number,d:number,r:number,n=24){
  r=Math.min(Math.max(r,0),Math.min(w,d)/2);
  const p:any[]=[];
  for(const [cx,cy,start] of [[w/2-r,d/2-r,0],[-w/2+r,d/2-r,90],[-w/2+r,-d/2+r,180],[w/2-r,-d/2+r,270]])
    for(let i=0;i<=n;i++){const a=(start+i*90/n)*Math.PI/180;p.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
  return p;
}
export function outline(s:DesignSettings){
  const {CrossSection}=api,w=s.width,d=s.depth;
  if(s.shape==='circle')return CrossSection.circle(Math.min(w,d)/2,96);
  if(s.shape==='square')return CrossSection.square([w,d],true);
  if(s.shape==='pill')return CrossSection.square([Math.max(.1,w-d),d],true).offset(Math.min(w,d)/2,'Round',2,64);
  if(s.shape==='bar')return CrossSection.square([w,d],true).offset(Math.min(2.5,d*.1),'Round',2,32);
  return CrossSection.ofPolygons([roundedRect(w,d,s.cornerRadius)]);
}
function cubeCut(x:number,y:number,z:number,s:DesignSettings){
  const {Manifold}=api,t=s.tolerance;
  return Manifold.cube([x+2*t,y+2*t,z+1],false).translate([0,0,s.baseHeight-z]);
}
/* MX-compatible cavity: 14 mm nominal square with four side retention reliefs.
   The nominal switch footprint is kept separate from the user-selected fit tolerance. */
function mxSocket(s:DesignSettings){
  const {Manifold}=api,t=Math.max(.05,s.tolerance);
  const depth=s.mxDepth+.35;
  let c=Manifold.cube([14+2*t,14+2*t,depth],false).translate([0,0,s.baseHeight-depth]);
  const tabs=[
    [7.05+t/2,4.8+t/2],[7.05+t/2,-4.8-t/2],
    [-7.05-t/2,4.8+t/2],[-7.05-t/2,-4.8-t/2]
  ];
  for(const [x,y] of tabs)c=c.add(Manifold.cube([2.7+t,3.0+t,depth],false).translate([x,y,s.baseHeight-depth]));
  // Small center clearance accommodates the MX stem housing without weakening the four retention lands.
  c=c.add(Manifold.cube([4.6+2*t,4.6+2*t,depth+.1],false).translate([0,0,s.baseHeight-depth-.05]));
  return c;
}
function addKeyring(base:any,s:DesignSettings){
  const {Manifold}=api,x=s.width/2-4.8,z=s.baseHeight;
  const outer=Manifold.cylinder(z+1,5.4,5.4,64).translate([x,0,0]);
  const hole=Manifold.cylinder(z+2,2.6,2.6,64).translate([x,0,-.5]);
  return base.add(outer).subtract(hole);
}
function svgCS(svg:string){
  const {CrossSection}=api,data=new SVGLoader().parse(svg),polys:any[]=[];
  for(const path of data.paths)for(const shape of path.toShapes(true)){
    const pts=shape.extractPoints(72).shape;
    if(pts.length>=3)polys.push(pts.map((p:any)=>[p.x,-p.y]));
  }
  if(!polys.length)return null;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of polys)for(const [x,y] of p){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  const norm=polys.map(p=>p.map(([x,y])=>[x-(minX+maxX)/2,y-(minY+maxY)/2]));
  return {cs:CrossSection.evenOdd(norm),w:Math.max(1,maxX-minX),h:Math.max(1,maxY-minY)};
}
function artSolid(svg:string,s:DesignSettings,height=s.artworkHeight){
  const p=svgCS(svg);if(!p)return null;
  const scale=Math.min(s.width*.72*s.artworkScale/p.w,s.depth*.58*s.artworkScale/p.h);
  return p.cs.scale(scale).extrude(Math.max(.08,height));
}
function artworkPlacement(svg:string,s:DesignSettings,mode:'raised'|'flat'|'engraved'){
  const a=artSolid(svg,s,mode==='flat'?Math.min(.18,s.artworkHeight):s.artworkHeight);if(!a)return null;
  if(mode==='engraved')return a.translate([0,0,Math.max(0,s.capHeight-s.artworkHeight+.02)]);
  return a.translate([0,0,mode==='raised'?s.capHeight-Math.min(.02,s.artworkHeight/10):Math.max(0,s.capHeight-.06)]);
}
function switchPreview(){
  const {Manifold}=api;
  let sw=Manifold.cube([13.8,13.8,5.2],true).translate([0,0,8.6]);
  sw=sw.add(Manifold.cube([11.8,11.8,4.0],true).translate([0,0,13.2]));
  sw=sw.add(Manifold.cube([4.2,4.2,3.0],true).translate([0,0,16.7]));
  return sw;
}
export interface Parts{
  base:any;cap:any;switchPart:any;full:any;artwork:any|null;artworkMode:DesignSettings['artworkMode'];
  stats:any;validation:any;
}
export function buildDesign(s:DesignSettings,svg?:string):Parts{
  const {Manifold}=api;
  if(s.width<18||s.depth<18)throw Error('Body is too small');
  const minWall=Math.max(s.wall,s.nozzle*1.5);
  if(minWall*2>=Math.min(s.width,s.depth))throw Error('Wall thickness is too large');
  if(s.mxDepth>s.baseHeight-.5)throw Error('MX cavity is deeper than the base');
  if(s.capHeight<1.2)throw Error('Cap is too thin for the current geometry');
  const body=outline(s);
  let base=body.extrude(s.baseHeight).subtract(mxSocket(s));
  if(s.keyring)base=addKeyring(base,s);
  const inset=Math.min(Math.max(s.capClearance,.05),Math.min(s.width,s.depth)/4);
  const capOutline=body.offset(-inset,'Round',2,32);
  let cap=capOutline.extrude(s.capHeight);
  let artwork:any=null;
  if(svg){
    if(s.artworkMode==='engraved'){
      const cut=artworkPlacement(svg,s,'engraved');
      if(cut)cap=cap.subtract(cut);
    }else artwork=artworkPlacement(svg,s,s.artworkMode);
  }
  const stem=Manifold.cube([4.2,4.2,s.stemHeight],true).translate([0,0,-s.stemHeight/2+.04]);
  cap=cap.add(stem);
  let full=base.add(cap.translate([0,0,s.baseHeight]));\n  if(artwork)full=full.add(artwork.translate([0,0,s.baseHeight]));
  const m=full.getMesh(),bb=full.boundingBox();
  const warning=s.tolerance<.2?'Low MX tolerance may fit tightly.':s.wall<s.nozzle*1.5?'Wall thickness is below the recommended nozzle multiplier.':s.capClearance<.15?'Cap clearance is tight; test-fit before printing.':null;
  return {
    base,cap,switchPart:switchPreview(),full,artwork,artworkMode:s.artworkMode,
    validation:{manifold:true,wall:minWall,warning},
    stats:{vertices:m.vertProperties.length/m.numProp,triangles:m.triVerts.length/3,volume:full.volume(),size:[bb.max[0]-bb.min[0],bb.max[1]-bb.min[1],bb.max[2]-bb.min[2]]}
  };
}
export function manifoldToThree(mesh:any,THREE:any){
  const m=mesh.getMesh(),stride=m.numProp,pos=new Float32Array(m.vertProperties.length/stride*3);
  for(let i=0,v=0;i<m.vertProperties.length;i+=stride,v+=3){pos[v]=m.vertProperties[i];pos[v+1]=m.vertProperties[i+1];pos[v+2]=m.vertProperties[i+2];}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(m.triVerts),1));g.computeVertexNormals();return g;
}

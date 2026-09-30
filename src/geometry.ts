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
  const {Manifold}=api,t=Math.max(.05,s.tolerance),depth=s.mxDepth+.35;
  const placements=switchPlacements(s);
  let all:any=null;
  for(const [ox,oy] of placements){
    let c=Manifold.cube([14+2*t,14+2*t,depth],false).translate([ox,oy,s.baseHeight-depth]);
    const tabs=[
      [7.05+t/2,4.8+t/2],[7.05+t/2,-4.8-t/2],
      [-7.05-t/2,4.8+t/2],[-7.05-t/2,-4.8-t/2]
    ];
    for(const [x,y] of tabs)c=c.add(Manifold.cube([2.7+t,3.0+t,depth],false).translate([ox+x,oy+y,s.baseHeight-depth]));
    c=c.add(Manifold.cube([4.6+2*t,4.6+2*t,depth+.1],false).translate([ox,oy,s.baseHeight-depth-.05]));
    all=all?all.add(c):c;
  }
  return all;
}
function addKeyring(base:any,s:DesignSettings){
  const {Manifold}=api;
  const angle=s.keyringAngle*Math.PI/180;
  const edgeX=Math.cos(angle)*Math.max(0,s.width/2-3);
  const edgeY=Math.sin(angle)*Math.max(0,s.depth/2-3);
  const r=Math.max(2.6,s.keyringDiameter/2);
  if(s.keyringStyle==='hole'){
    const hole=Manifold.cylinder(s.baseHeight+2,r,r,64).translate([edgeX,edgeY,-.5]);
    return base.subtract(hole);
  }
  const tabR=r+2.2;
  const outer=Manifold.cylinder(s.baseHeight+1,tabR,tabR,64).translate([edgeX,edgeY,0]);
  const hole=Manifold.cylinder(s.baseHeight+2,r,r,64).translate([edgeX,edgeY,-.5]);
  return base.add(outer).subtract(hole);
}
function switchPlacements(s:DesignSettings){
  const n=Math.max(1,Math.min(3,Math.round(s.switchCount||1)));
  if(n===1)return [[0,0]];
  const spacing=Math.max(12,Math.min(s.width-16,s.switchSpacing||18));
  if(n===2)return [[-spacing/2,0],[spacing/2,0]];
  return [[-spacing,0],[0,0],[spacing,0]];
}
function svgParts(svg:string,s:DesignSettings){
  const {CrossSection}=api,data=new SVGLoader().parse(svg),groups=new Map<string,any[]>();let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const path of data.paths){
    const color=String((path as any).userData?.style?.fill||path.color?.getStyle?.()||s.artworkColor).toUpperCase();
    for(const shape of path.toShapes(true)){const pts=shape.extractPoints(64),rings=[pts.shape,...(pts.holes||[])];
      for(const ring of rings)if(ring.length>=3){const poly=ring.map((p:any)=>[p.x,-p.y]);for(const [x,y] of poly){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}if(!groups.has(color))groups.set(color,[]);groups.get(color)!.push(poly)}
    }
  }
  if(!groups.size)return [];
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2,scale=Math.min(s.width*.72*s.artworkScale/Math.max(1,maxX-minX),s.depth*.58*s.artworkScale/Math.max(1,maxY-minY)),out:any[]=[];
  for(const [color,polys] of groups){const cs=CrossSection.evenOdd(polys.map((p:any)=>p.map(([x,y]:number[])=>[(x-cx)*scale,(y-cy)*scale])));const h=s.artworkMode==='flat'?Math.min(.18,s.artworkHeight):s.artworkHeight;let z=s.capHeight-(s.artworkMode==='raised'?Math.min(.02,s.artworkHeight/10):s.artworkMode==='flat'?Math.min(.06,s.artworkHeight):0);if(s.artworkMode==='engraved')z=Math.max(0,s.capHeight-s.artworkHeight+.02);out.push({mesh:cs.extrude(Math.max(.08,h)).translate([0,0,z]),color})}
  return out;
}
function unionArtwork(parts:any[]){if(!parts.length)return null;let u=parts[0].mesh;for(let i=1;i<parts.length;i++)u=u.add(parts[i].mesh);return u}
function switchPreview(){
  const {Manifold}=api;
  let sw=Manifold.cube([13.8,13.8,5.2],true).translate([0,0,8.6]);
  sw=sw.add(Manifold.cube([11.8,11.8,4.0],true).translate([0,0,13.2]));
  sw=sw.add(Manifold.cube([4.2,4.2,3.0],true).translate([0,0,16.7]));
  return sw;
}
export interface Parts{
  base:any;cap:any;switchPart:any;switchPlacements:number[][];full:any;artwork:any|null;artworkParts:{mesh:any;color:string}[];artworkMode:DesignSettings['artworkMode'];
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
  const placements=switchPlacements(s);
  let artwork:any=null;let artworkParts:{mesh:any;color:string}[]=[];
  if(svg){
    artworkParts=svgParts(svg,s);
    if(s.artworkMode==='engraved'){const cut=unionArtwork(artworkParts);if(cut)cap=cap.subtract(cut);artworkParts=[]}
    else artwork=unionArtwork(artworkParts);
  }
  for(const [ox,oy] of placements){
    const stem=Manifold.cube([4.2,4.2,s.stemHeight],true).translate([ox,oy,-s.stemHeight/2+.04]);
    cap=cap.add(stem);
  }
  let full=base.add(cap.translate([0,0,s.baseHeight]));
  if(artwork)full=full.add(artwork.translate([0,0,s.baseHeight]));
  const m=full.getMesh(),bb=full.boundingBox();
  const warning=s.tolerance<.2?'Low MX tolerance may fit tightly.':s.wall<s.nozzle*1.5?'Wall thickness is below the recommended nozzle multiplier.':s.capClearance<.15?'Cap clearance is tight; test-fit before printing.':null;
  return {
    base,cap,switchPart:switchPreview(),switchPlacements:switchPlacements(s),full,artwork,artworkParts,artworkMode:s.artworkMode,
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

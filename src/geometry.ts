import Module from 'manifold-3d';
import type {DesignSettings} from './types';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';

let api:any=null;
export async function initManifold(){if(api)return api;api=await (Module as any)();api.setup();return api;}

function roundedRect(w:number,d:number,r:number,n=24){
  r=Math.min(Math.max(r,0),Math.min(w,d)/2);const p:any[]=[];
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
function switchPlacements(s:DesignSettings){
  const n=Math.max(1,Math.min(3,Math.round(s.switchCount||1)));if(n===1)return [[0,0]];
  const spacing=Math.max(12,Math.min(s.width-16,s.switchSpacing||18));if(n===2)return [[-spacing/2,0],[spacing/2,0]];return [[-spacing,0],[0,0],[spacing,0]];
}
function mxSocket(s:DesignSettings){
  const {Manifold}=api,t=Math.max(.05,s.tolerance),depth=s.mxDepth+.35;let all:any=null;
  for(const [ox,oy] of switchPlacements(s)){
    let c=Manifold.cube([14+2*t,14+2*t,depth],false).translate([ox,oy,s.baseHeight-depth]);
    for(const [x,y] of [[7.05+t/2,4.8+t/2],[7.05+t/2,-4.8-t/2],[-7.05-t/2,4.8+t/2],[-7.05-t/2,-4.8-t/2]])c=c.add(Manifold.cube([2.7+t,3+t,depth],false).translate([ox+x,oy+y,s.baseHeight-depth]));
    c=c.add(Manifold.cube([4.6+2*t,4.6+2*t,depth+.1],false).translate([ox,oy,s.baseHeight-depth-.05]));all=all?all.add(c):c;
  }return all;
}
function addKeyring(base:any,s:DesignSettings){
  const {Manifold}=api,angle=s.keyringAngle*Math.PI/180,edgeX=Math.cos(angle)*Math.max(0,s.width/2-3),edgeY=Math.sin(angle)*Math.max(0,s.depth/2-3),r=Math.max(2.6,s.keyringDiameter/2);
  if(s.keyringStyle==='hole')return base.subtract(Manifold.cylinder(s.baseHeight+2,r,r,64).translate([edgeX,edgeY,-.5]));
  return base.add(Manifold.cylinder(s.baseHeight+1,r+2.2,r+2.2,64).translate([edgeX,edgeY,0])).subtract(Manifold.cylinder(s.baseHeight+2,r,r,64).translate([edgeX,edgeY,-.5]));
}
function parsedSvg(svg:string,s:DesignSettings){
  const data=new SVGLoader().parse(svg),groups=new Map<string,any[]>();let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const path of data.paths){const color=String((path as any).userData?.style?.fill||path.color?.getStyle?.()||s.artworkColor).toUpperCase();for(const shape of path.toShapes(true)){const pts=shape.extractPoints(64),rings=[pts.shape,...(pts.holes||[])];for(const ring of rings)if(ring.length>=3){const poly=ring.map((p:any)=>[p.x,-p.y]);for(const [x,y] of poly){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}if(!groups.has(color))groups.set(color,[]);groups.get(color)!.push(poly)}}}
  if(!groups.size)return null;const cx=(minX+maxX)/2,cy=(minY+maxY)/2,scale=Math.min(s.width*.82/Math.max(1,maxX-minX),s.depth*.82/Math.max(1,maxY-minY))*s.artworkScale;
  const mapped=new Map<string,any[]>();for(const [color,polys] of groups)mapped.set(color,polys.map(p=>p.map(([x,y]:number[])=>[(x-cx)*scale,(y-cy)*scale])));return {groups:mapped};
}
function artworkSection(svg:string,s:DesignSettings){
  const {CrossSection}=api,p=parsedSvg(svg,s);if(!p)return null;let section:any=null;
  for(const polys of p.groups.values()){const cs=CrossSection.ofPolygons(polys);section=section?section.add(cs):cs;}return section;
}
function artworkDrivenBody(svg:string,s:DesignSettings){
  const {CrossSection}=api,art=artworkSection(svg,s);if(!art)return outline(s);
  // Grow the artwork into a printable shell, then union a hidden MX keep-out island.
  // This makes the outside silhouette follow the uploaded art while guaranteeing enough material around every switch.
  let body=art.offset(Math.max(2.2,s.wall+1.0),'Round',2,48);
  const keep=Math.max(18,14+2*s.wall+2*s.tolerance);for(const [x,y] of switchPlacements(s)){const island=CrossSection.square([keep,keep],true).offset(3,'Round',2,32).translate([x,y]);body=body.add(island);}
  return body;
}
function svgParts(svg:string,s:DesignSettings){
  const {CrossSection}=api,p=parsedSvg(svg,s);if(!p)return [];const out:any[]=[];
  for(const [color,polys] of p.groups){const cs=CrossSection.ofPolygons(polys),h=s.artworkMode==='flat'?Math.min(.18,s.artworkHeight):s.artworkHeight;let z=s.capHeight-(s.artworkMode==='raised'?Math.min(.02,s.artworkHeight/10):s.artworkMode==='flat'?Math.min(.06,s.artworkHeight):0);if(s.artworkMode==='engraved')z=Math.max(0,s.capHeight-s.artworkHeight+.02);out.push({mesh:cs.extrude(Math.max(.08,h)).translate([0,0,z]),color});}return out;
}
function unionArtwork(parts:any[]){if(!parts.length)return null;let u=parts[0].mesh;for(let i=1;i<parts.length;i++)u=u.add(parts[i].mesh);return u}
function switchPreview(){const {Manifold}=api;let sw=Manifold.cube([13.8,13.8,6],true).translate([0,0,-3]);sw=sw.add(Manifold.cube([12,12,3.2],true).translate([0,0,1.2]));for(const [x,y] of [[6.9,0],[-6.9,0],[0,6.9],[0,-6.9]])sw=sw.add(Manifold.cube([1.4,3,2.4],true).translate([x,y,-1.1]));sw=sw.add(Manifold.cube([4.2,1,4.2],true).translate([0,0,4.3]));sw=sw.add(Manifold.cube([1,4.2,4.2],true).translate([0,0,4.3]));return sw;}
export interface Parts{base:any;cap:any;switchPart:any;switchPlacements:number[][];full:any;artwork:any|null;artworkParts:{mesh:any;color:string}[];artworkMode:DesignSettings['artworkMode'];stats:any;validation:any;}
export function buildDesign(s:DesignSettings,svg?:string):Parts{
  const {Manifold}=api;if(s.width<18||s.depth<18)throw Error('Body is too small');const minWall=Math.max(s.wall,s.nozzle*1.5);if(s.mxDepth>s.baseHeight-.5)throw Error('MX cavity is deeper than the base');if(s.capHeight<1.2)throw Error('Cap is too thin for the current geometry');
  // Artwork is now the primary design geometry when present, matching the workflow of dedicated image-to-clicker generators.
  const body=svg?artworkDrivenBody(svg,s):outline(s);let base=body.extrude(s.baseHeight).subtract(mxSocket(s));if(s.keyring)base=addKeyring(base,s);
  const inset=Math.min(Math.max(s.capClearance,.05),Math.min(s.width,s.depth)/4),capOutline=body.offset(-inset,'Round',2,32);let cap=capOutline.extrude(s.capHeight);const placements=switchPlacements(s);let artwork:any=null,artworkParts:{mesh:any,color:string}[]=[];
  if(svg){artworkParts=svgParts(svg,s);if(s.artworkMode==='engraved'){const cut=unionArtwork(artworkParts);if(cut)cap=cap.subtract(cut);artworkParts=[]}else artwork=unionArtwork(artworkParts);}
  for(const [ox,oy] of placements)cap=cap.add(Manifold.cube([4.2,4.2,s.stemHeight],true).translate([ox,oy,-s.stemHeight/2+.04]));
  let full=base.add(cap.translate([0,0,s.baseHeight]));if(artwork)full=full.add(artwork.translate([0,0,s.baseHeight]));const m=full.getMesh(),bb=full.boundingBox();const warning=s.tolerance<.2?'Low MX tolerance may fit tightly.':s.wall<s.nozzle*1.5?'Wall thickness is below the recommended nozzle multiplier.':s.capClearance<.15?'Cap clearance is tight; test-fit before printing.':null;
  return {base,cap,switchPart:switchPreview(),switchPlacements:placements,full,artwork,artworkParts,artworkMode:s.artworkMode,validation:{manifold:true,wall:minWall,warning},stats:{vertices:m.vertProperties.length/m.numProp,triangles:m.triVerts.length/3,volume:full.volume(),size:[bb.max[0]-bb.min[0],bb.max[1]-bb.min[1],bb.max[2]-bb.min[2]]}};
}
export function manifoldToThree(mesh:any,THREE:any){const m=mesh.getMesh(),stride=m.numProp,pos=new Float32Array(m.vertProperties.length/stride*3);for(let i=0,v=0;i<m.vertProperties.length;i+=stride,v+=3){pos[v]=m.vertProperties[i];pos[v+1]=m.vertProperties[i+1];pos[v+2]=m.vertProperties[i+2];}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(m.triVerts),1));g.computeVertexNormals();return g;}

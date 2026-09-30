import * as THREE from 'three';
import {SVGLoader} from 'three/examples/jsm/loaders/SVGLoader.js';
import ImageTracer from 'imagetracerjs';
import type {DesignSettings} from './types';
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function textSvg(t:string,font:string,size=175){return '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="300" viewBox="0 0 1000 300"><text x="500" y="210" text-anchor="middle" font-family="'+esc(font)+'" font-size="'+size+'" font-weight="800" fill="#000">'+esc(t||'VNTR')+'</text></svg>';}
export function defaultArtwork(s:DesignSettings){return textSvg(s.text,s.font);}
export function buildArtwork(svg:string,s:DesignSettings,three=THREE){
  const data=new SVGLoader().parse(svg),g=new three.Group();
  for(const p of data.paths)for(const shape of p.toShapes(true)){
    const geo=new three.ExtrudeGeometry(shape,{depth:Math.max(.08,s.artworkHeight),bevelEnabled:false,curveSegments:8});
    g.add(new three.Mesh(geo,new three.MeshStandardMaterial({color:s.artworkColor,roughness:.68,metalness:.03})));
  }
  const box=new three.Box3().setFromObject(g),size=new three.Vector3();box.getSize(size);
  const scale=Math.min(s.width*.72*s.artworkScale/Math.max(size.x,.01),s.depth*.58*s.artworkScale/Math.max(size.y,.01));
  g.scale.setScalar(scale);
  g.position.z=s.capHeight-(s.artworkMode==='raised'?Math.min(.02,s.artworkHeight/10):s.artworkMode==='flat'?Math.min(.06,s.artworkHeight):0);
  if(s.artworkMode==='flat')g.scale.z=.25;
  return g;
}
export function rasterToSvg(dataUrl:string,colors=4,threshold=128,invert=false,removeBackground=true,smoothing=.15):Promise<string>{
  return new Promise((resolve,reject)=>{
    const img=new Image();img.onload=()=>{try{
      const max=900,k=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*k)),h=Math.max(1,Math.round(img.height*k));
      const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true})!;
      ctx.drawImage(img,0,0,w,h);
      const data=ctx.getImageData(0,0,w,h);
      if(removeBackground){
        const samples=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([x,y])=>{const i=(y*w+x)*4;return [data.data[i],data.data[i+1],data.data[i+2]]});
        const bg=samples.reduce((a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]]).map(v=>v/4);
        const tol=36;
        for(let i=0;i<data.data.length;i+=4){
          const d=Math.hypot(data.data[i]-bg[0],data.data[i+1]-bg[1],data.data[i+2]-bg[2]);
          if(d<tol)data.data[i+3]=0;
        }
      }
      if(invert)for(let i=0;i<data.data.length;i+=4){data.data[i]=255-data.data[i];data.data[i+1]=255-data.data[i+1];data.data[i+2]=255-data.data[i+2];}
      resolve(ImageTracer.imagedataToSVG(data,{numberofcolors:Math.max(2,Math.min(8,colors)),ltres:Math.max(.2,threshold/255),qtres:Math.max(.15,.7-smoothing*.45),pathomit:Math.max(1,Math.round(4-smoothing*3)),strokewidth:0,colorsampling:2,scale:1,viewbox:true}));
    }catch(e){reject(e)}};img.onerror=reject;img.src=dataUrl;
  });
}

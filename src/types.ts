export type Shape='rounded'|'square'|'circle'|'pill'|'bar';
export type ArtworkMode='raised'|'engraved'|'flat';
export type ArtworkSource='image'|'svg'|'text'|'icon'|'blocks';
export type ViewMode='assembled'|'exploded';
export type PrintOrientation='face-down'|'face-up';

export interface DesignSettings{
  shape:Shape;width:number;depth:number;baseHeight:number;capHeight:number;cornerRadius:number;
  wall:number;tolerance:number;switchFit:number;stemFit:number;mxDepth:number;artworkMode:ArtworkMode;artworkScale:number;artworkHeight:number;
  imageThreshold:number;imageInvert:boolean;artworkColor:string;baseColor:string;capColor:string;
  keyring:boolean;keyringStyle:'loop'|'hole';keyringDiameter:number;keyringAngle:number;showSwitch:boolean;cutaway:boolean;viewMode:ViewMode;nozzle:number;printer:string;
  text:string;font:string;imageColors:number;printOrientation:PrintOrientation;capClearance:number;stemHeight:number;switchCount:number;switchSpacing:number;removeBackground:boolean;smoothing:number;
}
export interface DesignDocument{version:3;settings:DesignSettings;artworkSource:ArtworkSource;artworkSvg?:string;artworkName?:string;imagePreview?:string;}
export const DEFAULTS:DesignSettings={
  shape:'rounded',width:55,depth:32,baseHeight:7,capHeight:2.6,cornerRadius:5,wall:1.8,tolerance:.25,switchFit:.22,stemFit:.16,mxDepth:5.8,
  artworkMode:'raised',artworkScale:.78,artworkHeight:.55,imageThreshold:128,imageInvert:false,
  artworkColor:'#8e44ad',baseColor:'#f4f4f2',capColor:'#171717',keyring:false,keyringStyle:'loop',keyringDiameter:5.2,keyringAngle:0,showSwitch:false,cutaway:false,
  viewMode:'assembled',nozzle:.4,printer:'Anycubic Kobra X',text:'VNTR',font:'Arial',imageColors:4,
  printOrientation:'face-down',capClearance:.22,stemHeight:1.2,switchCount:1,switchSpacing:18,removeBackground:true,smoothing:.15
};

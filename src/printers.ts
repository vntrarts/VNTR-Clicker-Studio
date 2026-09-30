export interface PrinterProfile{
  id:string;name:string;manufacturer:string;
  bed:[number,number,number];nozzles:number[];defaultNozzle:number;
  layer:[number,number];recommendedSpeed:number;maxSpeed:number;recommendedAcceleration:number;maxAcceleration:number;
  bedTemp:number;hotendMax:number;filaments:string[];slicer:string[];
  notes:string;
}
export const PRINTERS:PrinterProfile[]=[
  {
    id:'kobra-x',name:'Anycubic Kobra X',manufacturer:'Anycubic',bed:[260,260,260],
    nozzles:[.25,.4,.6,.8],defaultNozzle:.4,layer:[.08,.28],recommendedSpeed:300,maxSpeed:600,
    recommendedAcceleration:10000,maxAcceleration:20000,bedTemp:100,hotendMax:300,
    filaments:['PLA','PETG','TPU','PVA','PLA-CF','PETG-CF','ASA'],slicer:['Anycubic Slicer','PrusaSlicer','Cura'],
    notes:'Native 4-color; expandable to 19 with ACE ecosystem. 0.4 mm hardened-steel nozzle is standard.'
  },
  {
    id:'vyper',name:'Anycubic Vyper',manufacturer:'Anycubic',bed:[245,245,260],
    nozzles:[.4,.6,.8],defaultNozzle:.4,layer:[.1,.3],recommendedSpeed:80,maxSpeed:180,
    recommendedAcceleration:2000,maxAcceleration:4000,bedTemp:110,hotendMax:260,
    filaments:['PLA','PETG','TPU','ABS'],slicer:['Cura','PrusaSlicer','Anycubic Slicer'],
    notes:'Conservative VNTR preset favors clean walls and reliable small mechanical features.'
  },
  {
    id:'cr10s-pro-v2',name:'CR-10S Pro V2',manufacturer:'Creality',bed:[300,300,400],
    nozzles:[.4,.6,.8],defaultNozzle:.4,layer:[.1,.3],recommendedSpeed:60,maxSpeed:120,
    recommendedAcceleration:1000,maxAcceleration:2500,bedTemp:100,hotendMax:260,
    filaments:['PLA','PETG','TPU','ABS'],slicer:['Cura','PrusaSlicer'],
    notes:'Conservative VNTR preset intended for dimensional accuracy and easy support removal.'
  },
  {
    id:'generic',name:'Generic FDM',manufacturer:'Generic',bed:[220,220,250],
    nozzles:[.4,.6,.8],defaultNozzle:.4,layer:[.1,.3],recommendedSpeed:60,maxSpeed:120,
    recommendedAcceleration:1000,maxAcceleration:2500,bedTemp:60,hotendMax:250,
    filaments:['PLA','PETG','TPU'],slicer:['Cura','PrusaSlicer'],
    notes:'Generic conservative profile.'
  }
];
export function printer(name:string){return PRINTERS.find(p=>p.name===name)||PRINTERS[0];}

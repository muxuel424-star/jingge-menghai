/**
 * @typedef {{x:number,y:number}} Point
 * @typedef {{key:string,tell:number,duration:number|null,next?:string,speed?:number}} ActionDef
 * @typedef {{kind:string,x:number,y:number,count:number,radius?:number}} Spawn
 * @typedef {{key:string,from:number,to:number,intent:string,spawns:Spawn[],hazards:string[],teachKey?:string}} Beat
 * @typedef {{id:number,x:number,y:number,r:number,textKey:string,condition:string|null,hidden:boolean}} Fragment
 * @typedef {{layer:'surface'|'deep'|'boss',width:number,height:number,spawn:Point,mainPath:Point[]}} Reef
 * @typedef {{key:string,level:number,pressure:number,client:{nameKey:string,lineKey:string,summaryKey:string},surface:Reef,deep:Reef,surfaceBeats:Beat[],deepBeats:Beat[],boss:string,fragments:Fragment[]}} Level
 * @typedef {{key:string,tier:number,hp:number,dmg:number,mem:number,food:number,size:{w:number,h:number},actions:ActionDef[]}} Species
 */
export {};

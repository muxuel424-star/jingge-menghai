export const VIEW = { w:960,h:540,dpr:2,cull:200,chunk:800,maxChunks:6 };
export const CAMERA = { leadForward:.41,leadBack:.53,deadX:36,deadY:28,ease:4.8,tierZoom:.06,top:-64,maxShake:10 };
export const ANIMATION = {
 cols:12,rows:8,width:320,margin:28,blendMargin:48,fade:.16,hurtFade:.045,turnHold:.22,minTurnWidth:.25,
 speedEase:10,rateEase:8,tiltEase:9,swimEnter:34,swimExit:19,eatPoseSpeed:95,
 maxTilt:.25,tiltSpeed:1000,face:[.72,.42],faceLock:.88,height:[128,192,281],
 idle:{frames:8,fps:6,power:.2,samples:16,loop:true,face:[.695,.417]},
 swim:{frames:8,fps:11,power:.66,samples:24,loop:true,face:[.797,.471]},
 dash:{frames:6,fps:16,power:.72,samples:10,loop:false,face:[.763,.56]},
 bite:{frames:6,fps:18,power:.5,samples:10,loop:false,face:[.776,.477]},
 sing:{frames:12,fps:10,power:.25,samples:16,loop:true,face:[.716,.393]},
 hurt:{frames:4,fps:14,power:.38,samples:8,loop:false,face:[.706,.406]},
 eat:{frames:6,fps:14,power:.23,samples:10,loop:false,face:[.708,.422]},
 celebrate:{frames:8,fps:10,power:.45,samples:12,loop:false,face:[.685,.39]},
};
export const FX = { limit:120,ttl:.6,shake:{eat:1.4,bite:4,hurt:8,evolve:6,'boss.phase':6,'boss.down':5}, lightAngle:15, lightWidth:220, lightAlpha:.12 };

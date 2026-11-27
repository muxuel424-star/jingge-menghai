export const VIEW = { w:960,h:540,dpr:2,cull:200,chunk:800,maxChunks:6 };
export const CAMERA = { leadForward:.41,leadBack:.53,deadX:36,deadY:28,ease:4.8,tierZoom:.06,top:-64,maxShake:10 };
export const ANIMATION = {
 cols:12,rows:8,width:320,fade:.06,turnHold:.16,
 idle:{frames:8,fps:6,power:.18},swim:{frames:8,fps:11,power:.65},dash:{frames:6,fps:16,power:.8},
 bite:{frames:6,fps:18,power:.5},sing:{frames:12,fps:10,power:.25},hurt:{frames:4,fps:14,power:.38},
 eat:{frames:6,fps:14,power:.2},celebrate:{frames:8,fps:10,power:.5},
};
export const FX = { limit:120,ttl:.6,shake:{eat:1.4,bite:4,hurt:8,evolve:6,'boss.phase':6,'boss.down':5}, lightAngle:15, lightWidth:220, lightAlpha:.12 };


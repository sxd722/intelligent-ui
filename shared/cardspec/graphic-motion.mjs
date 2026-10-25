// Stable identity is semantic (node/data ID), never array position.
export function interpolateGraphics(from,to,fields,progress){
 const prior=new Map(from.map(x=>[x.id,x])),t=Math.max(0,Math.min(1,progress))
 return to.map(target=>{const old=prior.get(target.id);if(!old)return target;const next={...target};for(const key of fields)if(Number.isFinite(old[key])&&Number.isFinite(target[key]))next[key]=old[key]+(target[key]-old[key])*t;return next})
}

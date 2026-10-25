export const MOTION_KEY='cards:display:motion:v1'
export const normalizeMotion=value=>['full','light','off'].includes(value)?value:'full'
export function createMotionPreference(storage,target){
 let value='full';try{value=normalizeMotion(storage?.getItem(MOTION_KEY))}catch{}
 const listeners=new Set(),notify=()=>listeners.forEach(fn=>fn())
 const changed=e=>{if(e.key===MOTION_KEY||e.key===null){value=normalizeMotion(e.newValue);notify()}}
 return {getSnapshot:()=>value,set(next){value=normalizeMotion(next);try{storage?.setItem(MOTION_KEY,value)}catch{}notify()},subscribe(fn){if(!listeners.size)target?.addEventListener('storage',changed);listeners.add(fn);return()=>{listeners.delete(fn);if(!listeners.size)target?.removeEventListener('storage',changed)}}}
}
let storage;try{storage=globalThis.localStorage}catch{}
export const motionPreference=createMotionPreference(storage,globalThis.window)
export function effectiveMotion(value=motionPreference.getSnapshot(),reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){return reduced?'off':normalizeMotion(value)}

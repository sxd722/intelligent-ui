export const CARD_SIZE_KEY = 'cards:display:size:v1'
import { normalizeCardSize } from '../shared/cardspec/generation-layout.mjs'
export { normalizeCardSize }

export function createCardSizePreference(storage, target) {
  let value='square'
  try { value=normalizeCardSize(storage?.getItem(CARD_SIZE_KEY)) } catch {}
  const listeners=new Set()
  const notify=()=>listeners.forEach(fn=>fn())
  const onStorage=event=>{
    if(event.key!==CARD_SIZE_KEY&&event.key!==null)return
    value=normalizeCardSize(event.key===null?null:event.newValue);notify()
  }
  return {
    getSnapshot:()=>value,
    set(next){value=normalizeCardSize(next);try{storage?.setItem(CARD_SIZE_KEY,value)}catch{}notify()},
    subscribe(fn){
      if(!listeners.size)target?.addEventListener('storage',onStorage)
      listeners.add(fn)
      return()=>{listeners.delete(fn);if(!listeners.size)target?.removeEventListener('storage',onStorage)}
    }
  }
}

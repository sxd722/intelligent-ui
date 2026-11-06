// Serialized into the isolated document. Only validated data is replayed.
export function drawCanvas(el,commands,resolveColor){
 const ctx=el.getContext('2d');if(!ctx)throw Error('Canvas2D is unavailable')
 // Reset bitmap and all context state without changing its layout size.
 el.width=Number(el.getAttribute('width'));el.height=Number(el.getAttribute('height'))
 for(const [op,...args]of commands){
  if(op==='set'){
   let [key,value]=args
   if(['fillStyle','strokeStyle','shadowColor'].includes(key)&&/^var\(--[\w-]+\)$/.test(value))value=resolveColor(value.slice(4,-1))||'#64748b'
   ctx[key]=value
  }else ctx[op](...args)
 }
}

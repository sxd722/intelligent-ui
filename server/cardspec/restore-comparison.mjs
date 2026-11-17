// Compare the saved persistence checkpoint, never an earlier UI observation.
// No numeric tolerance: a real loss of simulation state must still fail.
export function compareRestoredState(saved,restored){
 const differences=[]
 const walk=(a,b,path)=>{
  if(Object.is(a,b))return
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)){
   for(const key of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[key],b[key],path+'/'+key)
   return
  }
  if(differences.length<12)differences.push({path,saved:a,restored:b})
 }
 walk(saved,restored,'');return {matched:differences.length===0,differences}
}

import {collectImages} from '../../shared/cardspec/images.mjs'

// Reuse the same bounded photo resolution for initial cards and tool-generated pages.
export async function resolveCardResources(spec,photo,signal,onUpdate=()=>{}) {
  const jobs=collectImages(spec),resources={}
  for(const job of jobs)resources[job.key]={status:photo&&jobs.indexOf(job)<12?'loading':'error'}
  onUpdate({...resources})
  const queue=photo?jobs.slice(0,12):[]
  await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{
    while(queue.length&&!signal.aborted){
      const job=queue.shift()
      try{const result=await photo(job.query,signal,job.role);resources[job.key]=result?{...result,status:'loaded',url:result.content}:{status:'error'}}
      catch{resources[job.key]={status:'error'}}
      onUpdate({...resources})
    }
  }))
  signal.throwIfAborted()
  return resources
}

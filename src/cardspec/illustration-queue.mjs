import {collectImages,photoKey} from '../../shared/cardspec/images.mjs'

// One FIFO for the delivered deck and its mounted image consumers. Unmounting
// a slide must not cancel an illustration already requested at delivery.
export function createIllustrationQueue(load){
 const requests=new Map();let tail=Promise.resolve()
 const request=(query,role='hero')=>{
  const key=photoKey(query,role)
  if(requests.has(key))return requests.get(key)
  const task=tail.then(()=>load(query,role)).catch(()=>({status:'error'}))
  requests.set(key,task);tail=task.then(()=>{})
  return task
 }
 const preload=(spec,resources={})=>{
  let jobs;try{jobs=collectImages(spec)}catch{return []}
  return jobs.filter(j=>/^gen:/i.test(j.query)&&(!resources[j.key]||resources[j.key].status==='deferred')).map(j=>request(j.query,j.role))
 }
 return {request,preload}
}
export const illustrations=createIllustrationQueue(async(query,role)=>{
 const response=await fetch(`/api/photo?query=${encodeURIComponent(query)}&role=${encodeURIComponent(role)}`,{signal:AbortSignal.timeout(180000)})
 if(!response.ok)throw Error('illustration unavailable')
 return response.json()
})

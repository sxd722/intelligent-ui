import {createImageService} from '../server/image-service.mjs'
import {loadOpenAIImageKey} from '../server/env.mjs'
import {diskImageStorage} from '../server/image-storage.mjs'
const s=createImageService({key:loadOpenAIImageKey().value,storage:diskImageStorage(".cache/images"),fetchImpl:async(url,options)=>{try{const r=await fetch(url,options);console.log('upstream status',r.status);return r}catch(e){console.log({networkError:e.name,message:e.message,cause:e.cause?.code});throw e}}})
const r=await s.photo('gen: little fox walking on moon, glowing rabbit friend, soft pastel bedtime storybook illustration',new AbortController().signal)
console.log(r?{provider:r.provider,cacheHit:r.cacheHit,content:r.content}:null)

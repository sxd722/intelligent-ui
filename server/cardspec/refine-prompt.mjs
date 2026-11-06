import {generationModelOptions} from '../../shared/cardspec/generation-settings.mjs'
import {REFINE_SYSTEM,REFINE_POLICY_VERSION,refineContext} from './refine-policy.mjs'

export async function refinePrompt(payload,{streamUpstream,signal,timeoutMs=45000}){
 const prompt=payload?.prompt
 if(typeof prompt!=='string'||!prompt.trim()||prompt.length>12000)throw Object.assign(Error('请输入 1–12000 字的需求'),{statusCode:400})
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),started=Date.now()
 let usage
 try{
  const result=await streamUpstream([{role:'system',content:REFINE_SYSTEM}, {role:'user',content:JSON.stringify(refineContext(payload))}],{
   ...generationModelOptions(payload.modelProfile),temperature:.5,maxTokens:3072,maxReasoningCharacters:14000,reasoningEffort:'low',thinking:{type:'disabled'},signal:AbortSignal.any([controller.signal,...(signal?[signal]:[])]),onUsage:v=>{usage=v}
  })
  if(controller.signal.aborted||signal?.aborted)throw Error('提炼已取消或超时')
  const refined=String(result||'').trim().replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/,'$1').trim()
  if(!refined||refined.length>10000||/<card\b/i.test(refined))throw Error('需求提炼未返回有效规划，请修改原文后重试')
  return {prompt:refined,elapsedMs:Date.now()-started,usage,policyVersion:REFINE_POLICY_VERSION}
 }catch(error){
  if(controller.signal.aborted)throw Object.assign(Error('需求提炼超时，原始输入已保留，请重试'),{statusCode:504})
  throw error
 }finally{clearTimeout(timer)}
}

export async function handleRefineRequest(req,res,{readBody,streamUpstream}){
 const controller=new AbortController()
 res.once('close',()=>{if(!res.writableEnded)controller.abort()})
 try{
  let payload;try{payload=JSON.parse(await readBody(req))}catch{throw Object.assign(Error('invalid JSON'),{statusCode:400})}
  const result=await refinePrompt(payload,{streamUpstream,signal:controller.signal})
  if(!res.destroyed)res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(result))
 }catch(error){if(!res.destroyed)res.writeHead(error.statusCode||502,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({error:error.statusCode?error.message:'需求提炼暂不可用，原始输入已保留，请重试'}))}
}

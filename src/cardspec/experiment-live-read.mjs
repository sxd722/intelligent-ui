import {toolTransport} from './tool-session.mjs'
import {TOOLS,validateToolInput} from '../../shared/cardspec/tools.mjs'

// Explicit local QA transport. The normal debugger remains offline.
export function experimentLiveRead({allowed=[],calls=[],coverage=[],transport=toolTransport,hostname=globalThis.location?.hostname,maxCalls=12}={}){
 const ids=new Set(allowed)
 return async(payload,signal)=>{
  const tool=TOOLS[payload.tool]
  if(!['localhost','127.0.0.1'].includes(hostname)||!ids.has(payload.tool)||tool?.provider!=='opencli'||tool.readOnly!==true||payload.target!=='binding')throw Error('LIVE_QA_DENIED: explicit local read-only binding required')
  if(calls.length>=maxCalls)throw Error('LIVE_QA_BUDGET: read limit reached')
  validateToolInput(payload.tool,payload.input)
  const record={tool:payload.tool,input:structuredClone(payload.input),mode:'live-read',startedAt:new Date().toISOString()};calls.push(record)
  try{const result=await transport(payload,signal);record.result=structuredClone(result);return result}
  catch(e){record.error=e.message;coverage.push({tool:payload.tool,reason:e.message,mode:'live-read'});throw e}
  finally{record.completedAt=new Date().toISOString()}
 }
}

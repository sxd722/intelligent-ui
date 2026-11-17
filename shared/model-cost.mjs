// Public standard API prices; estimate, not a billing record. Alias price verified 2026-11-13.
export const GPT_PRICE={model:'chat-latest',input:5,cachedInput:0.5,output:30,currency:'USD',asOf:'2026-11-13',source:'https://developers.openai.com/api/docs/models/chat-latest'}
export function modelCost(model,usage){
 if(model!=='chat-latest')return null
 const input=usage?.prompt_tokens??usage?.input_tokens,output=usage?.completion_tokens??usage?.output_tokens,cached=usage?.prompt_tokens_details?.cached_tokens??usage?.input_tokens_details?.cached_tokens??0
 if(![input,output,cached].every(n=>Number.isFinite(n)&&n>=0)||cached>input)return {status:'unknown',model,reason:'Provider did not return complete usage',price:GPT_PRICE}
 return {status:'estimated',model,inputTokens:input,cachedTokens:cached,outputTokens:output,usd:((input-cached)*GPT_PRICE.input+cached*GPT_PRICE.cachedInput+output*GPT_PRICE.output)/1e6,price:GPT_PRICE}
}
export function appendCost(ledger,event){
 if(event?.type!=='model_cost'||typeof event.callId!=='string'||ledger.some(x=>x.callId===event.callId))return ledger
 if(!['estimated','unknown'].includes(event.cost?.status)||event.cost.status==='estimated'&&(!Number.isFinite(event.cost.usd)||event.cost.usd<0))return ledger
 return [...ledger,event]
}
export function costTotal(ledger){return {usd:ledger.reduce((n,e)=>n+(e.cost?.usd||0),0),calls:ledger.length,unknown:ledger.filter(e=>e.cost?.status==='unknown').length}}

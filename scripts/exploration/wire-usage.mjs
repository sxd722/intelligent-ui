// Report accounting from observed transport responses, not mutable run totals.
import fs from 'node:fs/promises'
import path from 'node:path'
export async function wireUsage(directory){
 let entries
 try{entries=JSON.parse(await fs.readFile(path.join(directory,'actual-requests.json'),'utf8'))}catch(e){if(e.code==='ENOENT')return {available:false,modelCalls:null,knownTokens:null,missingUsageCalls:null,inputTokens:null,outputTokens:null};throw e}
 let knownTokens=0,inputTokens=0,outputTokens=0,missingUsageCalls=0
 for(const e of entries){const u=e.usage;if(!u||!Number.isFinite(u.total_tokens)){missingUsageCalls++;continue}knownTokens+=u.total_tokens;if(Number.isFinite(u.prompt_tokens))inputTokens+=u.prompt_tokens;if(Number.isFinite(u.completion_tokens))outputTokens+=u.completion_tokens}
 return {available:true,basis:'actual-requests.json response usage; shared prefix excluded',modelCalls:entries.length,knownTokens,missingUsageCalls,inputTokens,outputTokens}
}

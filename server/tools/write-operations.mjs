import {randomUUID,createHash} from 'node:crypto'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import path from 'node:path'
export const operationSignature=p=>createHash('sha256').update(JSON.stringify({tool:p.tool,input:p.input||{},sessionId:p.sessionId,pageId:p.pageId,requestId:p.requestId,target:p.target||'binding',executionContext:p.executionContext})).digest('hex')
export function createWriteOperations(directory){
 const tickets=new Map();let active=false
 return {
  prepare(payload){
   for(const [id,t] of tickets)if(t.expires<Date.now())tickets.delete(id)
   if(tickets.size>=100)throw new Error('待确认操作过多')
   const token=randomUUID(),expires=Date.now()+120000
   tickets.set(token,{signature:operationSignature(payload),expires})
   return {token,expires}
  },
  async execute(payload,run){
   const signature=operationSignature(payload),ticket=tickets.get(payload.confirmationToken)
   if(!ticket||ticket.expires<Date.now()||ticket.signature!==signature)throw new Error('请先在卡片中确认本次操作和参数')
   if(active)throw new Error('另一个外部操作正在执行，请等待其结果')
   active=true;tickets.delete(payload.confirmationToken)
   try{
    await mkdir(directory,{recursive:true})
    const filename=path.join(directory,createHash('sha256').update(`${payload.sessionId}:${payload.requestId}`).digest('hex')+'.json')
    try{await writeFile(filename,JSON.stringify({signature,status:'running',at:new Date().toISOString()}),{flag:'wx'})}
    catch(e){if(e.code!=='EEXIST')throw e;const previous=JSON.parse(await readFile(filename,'utf8'));if(previous.signature!==signature)throw new Error('操作标识已用于其他参数');throw new Error('该操作已提交；请先核对原站点结果，不能重复执行')}
    try{
     const result=await run()
     await writeFile(filename,JSON.stringify({signature,status:'completed',at:new Date().toISOString()}))
     return result
    }catch(e){await writeFile(filename,JSON.stringify({signature,status:'unknown',at:new Date().toISOString()}));throw new Error(`操作未确认，可能已经生效；请到原站点核对，不要直接重复提交。${e.message}`)}
   }finally{active=false}
  }
 }
}

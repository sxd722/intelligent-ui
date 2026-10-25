// Framework-independent transport: neither CardSpec nor DIL is imported.
export async function invokeTool(tool,input,{signal,sessionId,pageId,requestId=crypto.randomUUID(),fetcher=fetch}={}){
 const payload={tool,input,requestId,pageId,sessionId,target:'binding',cause:'user'};
 const r=await fetcher('/api/tools/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
 if(!r.ok||!r.body)throw Error(`工具服务 HTTP ${r.status}`);
 const reader=r.body.getReader(),decoder=new TextDecoder();let buf='',result,done=false,error;
 while(true){const {value,done:end}=await reader.read();if(end)break;buf+=decoder.decode(value,{stream:true});let m;
 while((m=/\r?\n\r?\n/.exec(buf))){const block=buf.slice(0,m.index);buf=buf.slice(m.index+m[0].length);for(const l of block.split('\n'))if(l.startsWith('data:')){const e=JSON.parse(l.slice(5));if(e.requestId!==requestId||e.pageId!==pageId)throw Error('响应标识不匹配');if(e.type==='result')result=e.result;if(e.type==='error'){const detail=typeof e.errorInfo?.detail==='string'?e.errorInfo.detail.slice(0,350):'';error=Object.assign(Error(e.error+(detail&&detail!==e.error?'：'+detail:'')),{code:e.errorInfo?.code,errorInfo:e.errorInfo})}if(e.type==='done')done=true;}}}
 if(error)throw error;if(!done||result?.kind!=='json')throw Error('工具结果未完整返回');return result.value;
}

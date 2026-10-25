// One gateway round. Keep the complete assistant tool message for continuation.
export function createModelClient({base, key, model, fetchImpl=fetch}) {
  return async function round(messages, {temperature=.4,maxTokens=8192,signal,onPiece=()=>{},onUsage=()=>{},reasoningEffort,responseFormat,tools,toolChoice,modelOverride,thinking}={}) {
    const body={model:modelOverride||model,messages,stream:true,temperature,max_tokens:maxTokens}
    // Fast profiles use non-reasoning output. Do not send GLM's effort enum to
    // another provider, including planning turns that supply a default effort.
    const fast=['volcengine/deepseek-v4.1-flash','qwen3.8-flash'].includes(body.model)
    if(reasoningEffort&&!fast)body.reasoning_effort=reasoningEffort
    if(fast)body.thinking={type:'disabled'}
    else if(['enabled','disabled'].includes(thinking?.type))body.thinking={type:thinking.type}
    if(responseFormat)body.response_format=responseFormat
    if(tools?.length){body.tools=tools;body.tool_choice=toolChoice||'auto'}
    const res=await fetchImpl(`${base}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(body),signal})
    if(!res.ok||!res.body)throw new Error(`model gateway HTTP ${res.status}`)
    const decoder=new TextDecoder(),calls=new Map();let buffer='',content='',reasoning='',finish=null,done=false,usage,reportedModel
    function line(line){
      if(!line.startsWith('data:'))return
      const raw=line.slice(5).trim();if(raw==='[DONE]'){done=true;return}
      let j;try{j=JSON.parse(raw)}catch{return}
      const choice=j.choices?.[0],d=choice?.delta
      if(j.usage)usage=j.usage
      if(typeof j.model==='string')reportedModel=j.model
      if(choice?.finish_reason)finish=choice.finish_reason
      if(d?.reasoning_content){reasoning+=d.reasoning_content;onPiece({reasoning:d.reasoning_content})}
      if(d?.content){content+=d.content;onPiece({content:d.content})}
      for(const c of d?.tool_calls||[]){
        const index=c.index??0;if(!Number.isInteger(index)||index<0||index>15)throw Error('invalid tool call index')
        const old=calls.get(index)||{id:'',type:'function',function:{name:'',arguments:''}}
        if(c.id)old.id=c.id
        if(c.function?.name)old.function.name+=c.function.name
        if(c.function?.arguments)old.function.arguments+=c.function.arguments
        // Complete bounded DSL candidates need room for JSON-escaped source.
        if(old.function.arguments.length>(old.function.name==='card_test'?64000:16000))throw Error('tool arguments exceed limit')
        calls.set(index,old)
      }
    }
    for await(const chunk of res.body){
      buffer+=decoder.decode(chunk,{stream:true});let n
      while((n=buffer.indexOf('\n'))>=0){line(buffer.slice(0,n).trim());buffer=buffer.slice(n+1)}
      if(done)break
    }
    buffer+=decoder.decode();if(buffer.trim())line(buffer.trim())
    if(finish==='length')throw Object.assign(Error('upstream output truncated by token limit'),{code:'OUTPUT_TRUNCATED'})
    if(!done&&!['stop','tool_calls'].includes(finish))throw Error('upstream ended without a completion marker')
    const tool_calls=[...calls.values()]
    if(tool_calls.some(c=>!c.id||!c.function.name))throw Error('incomplete tool call')
    onUsage(usage)
    return {message:{role:'assistant',content,...(reasoning?{reasoning_content:reasoning}:{}),...(tool_calls.length?{tool_calls}:{})},usage,model:reportedModel||body.model,requestedModel:body.model}
  }
}

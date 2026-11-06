import {BUILD_OPERATION_TOOL} from '../cardspec/build-operation-tool.mjs'
// One gateway round. Keep the complete assistant tool message for continuation.
export function createModelClient({base, key, model, openaiKey, fetchImpl=fetch}) {
  return async function round(messages, {temperature=.4,maxTokens=8192,maxReasoningCharacters,buildPhase,signal,onPiece=()=>{},onUsage=()=>{},reasoningEffort,responseFormat,tools,toolChoice,modelOverride,thinking,extendedGeneration=false,webApplication=false}={}) {
    const body={model:modelOverride||model,messages,stream:true,temperature,max_tokens:maxTokens}
    const openai=body.model==='chat-latest'
    if(openai){
      if(!openaiKey)throw Error('GPT Instant unavailable: OpenAI API key is not configured')
      delete body.max_tokens;delete body.temperature;body.max_completion_tokens=maxTokens
      body.stream_options={include_usage:true}
    }
    // Fast profiles use non-reasoning output. Do not send GLM's effort enum to
    // another provider, including planning turns that supply a default effort.
    const fast=['volcengine/deepseek-v4.1-flash','qwen3.8-flash'].includes(body.model)
    if(reasoningEffort&&!fast&&!openai)body.reasoning_effort=reasoningEffort
    if(fast)body.thinking={type:'disabled'}
    // This gateway's GLM-5.3 family always reasons and rejects disabled thinking
    // (1210). A low effort request is its supported bounded-output mode.
    else if(/^glm-5\.3(?:-flash)?$/.test(body.model)&&thinking?.type==='disabled')body.reasoning_effort=reasoningEffort||'low'
    else if(!openai&&['enabled','disabled'].includes(thinking?.type))body.thinking={type:thinking.type}
    if(responseFormat)body.response_format=responseFormat
    if(tools?.length){body.tools=tools;body.tool_choice=toolChoice||'auto'}
    const buildSubmission=['implementation','test'].includes(buildPhase)
    if(buildSubmission){
      body.tools=[BUILD_OPERATION_TOOL];body.tool_choice={type:'function',function:{name:'submit_build_operation'}}
      delete body.response_format
    }
    const res=await fetchImpl(`${openai?'https://api.openai.com/v1':base}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${openai?openaiKey:key}`},body:JSON.stringify(body),signal,redirect:'error'})
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
        if(old.function.arguments.length>(['card_test','submit_build_operation'].includes(old.function.name)?(extendedGeneration||webApplication?256000:64000):16000))throw Error('tool arguments exceed limit')
        calls.set(index,old)
      }
      if(Number.isFinite(maxReasoningCharacters)&&reasoning.length>maxReasoningCharacters&&!content&&!calls.size)throw Object.assign(Error('reasoning budget exhausted without implementation output'),{code:'OUTPUT_TRUNCATED',usage,reasoningCharacters:reasoning.length,outputCharacters:content.length,maxTokens})
    }
    for await(const chunk of res.body){
      buffer+=decoder.decode(chunk,{stream:true});let n
      while((n=buffer.indexOf('\n'))>=0){line(buffer.slice(0,n).trim());buffer=buffer.slice(n+1)}
      if(done)break
    }
    buffer+=decoder.decode();if(buffer.trim())line(buffer.trim())
    onUsage(usage)
    if(finish==='length')throw Object.assign(Error('upstream output truncated by token limit'),{code:'OUTPUT_TRUNCATED',usage,outputCharacters:content.length,reasoningCharacters:reasoning.length,maxTokens})
    if(!done&&!['stop','tool_calls'].includes(finish))throw Error('upstream ended without a completion marker')
    const tool_calls=[...calls.values()]
    if(tool_calls.some(c=>!c.id||!c.function.name))throw Error('incomplete tool call')
    if(buildSubmission){
      // Some compatible gateways ignore forced tool_choice but return the same
      // complete JSON envelope as text. Preserve that valid operation instead
      // of spending another model call; mixed tool calls remain an error.
      if(!tool_calls.length&&content.trim()){
        let operation;try{operation=JSON.parse(content)}catch{}
        if(operation&&typeof operation.op==='string')return {message:{role:'assistant',content},usage,model:reportedModel||body.model,requestedModel:body.model}
      }
      if(tool_calls.length!==1||tool_calls[0].function.name!=='submit_build_operation')throw Error('Build must submit exactly one file/test operation')
      // Return data to the existing validator, never execute model-supplied code here.
      const operation=JSON.parse(tool_calls[0].function.arguments)
      if(!operation||typeof operation.op!=='string')throw Error('Build submission requires an operation')
      return {message:{role:'assistant',content:JSON.stringify(operation)},usage,model:reportedModel||body.model,requestedModel:body.model}
    }
    return {message:{role:'assistant',content,...(reasoning?{reasoning_content:reasoning}:{}),...(tool_calls.length?{tool_calls}:{})},usage,model:reportedModel||body.model,requestedModel:body.model}
  }
}

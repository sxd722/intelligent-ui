import test from 'node:test'
import assert from 'node:assert/strict'
import {createModelClient} from '../server/research/model-client.mjs'
import {createResearchSession,citationDiagnostics} from '../server/research/session.mjs'
import {createResearchProviders,publicWebUrl,focusExcerpt} from '../server/research/providers.mjs'
const item={url:'https://example.org/fact',title:'A fact',excerpt:'Evidence',kind:'page'}
const providers={search:async()=>({items:[{...item,kind:'search'}]}),read:async()=>item}
const call=(name='web_read',input={url:item.url},id='call1')=>({role:'assistant',content:'draft not for renderer',reasoning_content:'original reasoning',tool_calls:[{id,type:'function',function:{name,arguments:JSON.stringify(input)}}]})
const options={onPiece:()=>{},signal:new AbortController().signal}
test('stream fragments reconstruct tools, reasoning and usage',async()=>{
 const chunks=[{choices:[{delta:{reasoning_content:'think',tool_calls:[{index:0,id:'t',function:{name:'web_',arguments:'{"u'}}]}}]},{choices:[{delta:{tool_calls:[{index:0,function:{name:'read',arguments:'rl":"https://example.org"}'}}]}}]},{choices:[{delta:{},finish_reason:'tool_calls'}],usage:{total_tokens:12}}]
 const s=chunks.map(x=>'data: '+JSON.stringify(x)+'\n\n').join('')+'data: [DONE]\n\n';let sent
 const client=createModelClient({base:'https://gateway',key:'secret',model:'glm-5.3-flash',fetchImpl:async(u,o)=>{sent=JSON.parse(o.body);return new Response(s)}})
 const r=await client([],{tools:[{}]});assert.equal(r.message.tool_calls[0].function.name,'web_read');assert.equal(JSON.parse(r.message.tool_calls[0].function.arguments).url,'https://example.org');assert.equal(r.message.reasoning_content,'think');assert.equal(r.usage.total_tokens,12);assert.equal(sent.tools.length,1)
})
test('tool response preserves exact reasoning; intermediate content never rendered',async()=>{
 const s=createResearchSession({providers});let n=0,visible=''
 await s.run(async history=>{if(n++===0)return {message:call()};assert.equal(history.findLast(m=>m.role==='assistant').reasoning_content,'original reasoning');assert.equal(history.findLast(m=>m.role==='tool').tool_call_id,'call1');assert.match(history.findLast(m=>m.role==='tool').content,/S1/);return {message:{role:'assistant',content:'final [S1]'}}},[],{...options,onPiece:p=>{if(p.content)visible+=p.content}})
 assert.equal(visible,'final [S1]');assert.equal(s.snapshot().calls,1)
})
test('round limit closes tools and retains existing evidence during repair',async()=>{
 const s=createResearchSession({providers,maxRounds:1});let n=0
 const round=async(h,o)=>{if(n++===0)return {message:call()};assert.equal(o.tools,undefined);return {message:{content:'ok [S1]'}}}
 await s.run(round,[],options);await s.run(round,[],options);assert.equal(s.snapshot().calls,1);assert.equal(s.snapshot().modelCalls,3)
})
test('duplicate request cached, search budget enforced',async()=>{
 const s=createResearchSession({providers,maxSearches:1});await s.execute('web_search',{query:'test'},options.signal);await s.execute('web_search',{query:'test'},options.signal);assert.equal(s.snapshot().calls,1)
 await assert.rejects(s.execute('web_search',{query:'new'},options.signal),/budget/)
})
test('total tool context budget includes long URL and metadata',async()=>{
 const s=createResearchSession({providers:{...providers,read:async()=>({...item,url:item.url+'?q='+'a'.repeat(1200),excerpt:'x'.repeat(10000)})},maxContextChars:2500})
 await s.execute('web_read',{url:item.url},options.signal);assert.ok(s.snapshot().contextCharacters<=2500);assert.ok(s.snapshot().evidence[0].truncated)
})
test('cancelled response cannot add evidence',async()=>{
 const c=new AbortController(),s=createResearchSession({providers:{...providers,read:async()=>{c.abort();return item}}})
 await assert.rejects(s.execute('web_read',{url:item.url},c.signal));assert.equal(s.snapshot().evidence.length,0)
})
test('provider failures return tool error and generation may state unknown',async()=>{
 const s=createResearchSession({providers:{...providers,read:async()=>{throw Error('source HTTP 403')}}});let n=0
 const result=await s.run(async history=>{if(n++===0)return {message:call()};assert.match(history.findLast(m=>m.role==='tool').content,/403/);return {message:{content:'未能核实'}}},[],options)
 assert.equal(result,'未能核实');assert.equal(s.snapshot().evidence.length,0);assert.equal(s.snapshot().trace.some(t=>t.status==='failed'),true)
})
test('citations require host records and sessions are isolated',async()=>{
 const a=createResearchSession({providers}),b=createResearchSession({providers});await a.execute('web_read',{url:item.url},options.signal)
 assert.deepEqual(citationDiagnostics('fact [S1]',a.snapshot().evidence),[]);assert.equal(citationDiagnostics('[S1] [S99]',b.snapshot().evidence).length,2)
})
test('unknown tool, surplus arguments and private URLs rejected',async()=>{
 const s=createResearchSession({providers});for(const url of ['http://127.0.0.1','https://[::1]','http://2130706433','https://user:pass@example.org','file:///etc/passwd','http://a.local','http://localhost'])assert.throws(()=>publicWebUrl(url))
 await assert.rejects(s.execute('shell',{command:'x'},options.signal),/unknown/);await assert.rejects(s.execute('web_read',{url:item.url,cookie:'secret'},options.signal),/unknown/);assert.equal(s.snapshot().calls,0)
})
test('search ignores generated answer and only accepts structured source records',async()=>{
 const p=createResearchProviders({base:'https://gateway',key:'x',model:'m',fetchImpl:async()=>new Response(JSON.stringify({choices:[{message:{content:'invented fact https://fake.org'}}],web_search:[{title:'source',link:item.url,content:'real snippet'}]}))})
 const r=await p.search({query:'fact'},options.signal);assert.equal(r.items.length,1);assert.equal(r.items[0].excerpt,'real snippet');assert.equal(r.items[0].kind,'search')
})
test('domain constraints enforced on returned search sources; empty remains empty',async()=>{
 const p=createResearchProviders({base:'https://gateway',key:'x',model:'m',fetchImpl:async()=>new Response(JSON.stringify({web_search:[{link:'https://other.org',content:'off topic'}]}))})
 const r=await p.search({query:'fact',domain:'example.org'},options.signal);assert.deepEqual(r.items,[]);assert.match(r.warning,/未返回/)
})
test('reader always contacts fixed proxy, strips image markup, rejects inaccessible page',async()=>{
 let target;const p=createResearchProviders({fetchImpl:async u=>{target=u;return new Response('Title: Fact\nURL Source: https://example.org/fact\nMarkdown Content:\n'+('Useful factual text. '.repeat(10)))}})
 const r=await p.read({url:item.url},options.signal);assert.equal(target,'https://r.jina.ai/'+item.url);assert.equal(r.kind,'page')
 const bad=createResearchProviders({fetchImpl:async()=>new Response('Warning: Target URL returned error 403\nMarkdown Content: access denied')});await assert.rejects(bad.read({url:item.url},options.signal),/accessible/)
})
test('focused excerpt retains late relevant paragraph within bounds',()=>{
 const r=focusExcerpt('Unrelated text\n'.repeat(500)+'Launch date December 25 2021\n','Launch date',1000);assert.ok(r.excerpt.includes('December 25'));assert.ok(r.excerpt.length<=1100);assert.equal(r.truncated,true)
})
test('unfocused reader skips dense navigation and recommendation tiles before truncation',()=>{
 const nav=('### [Section](https://example.org)\n'+('[Headline with lots of navigation text](https://example.org/news)').repeat(40)+'\n').repeat(20)
 const body='The mission launched on December 25 2021 and studies early galaxies.\n'+'Useful article prose and an [inline source](https://example.org/fact) remain readable.\n'
 const r=focusExcerpt(nav+body+'Additional article content.\n'.repeat(100),'',1000)
 assert.match(r.excerpt,/December 25 2021/);assert.match(r.excerpt,/inline source/);assert.doesNotMatch(r.excerpt,/Headline/);assert.ok(r.excerpt.length<=1000)
})
test('search then read upgrades one source without changing citation id',async()=>{
 const s=createResearchSession({providers});await s.execute('web_search',{query:'fact'},options.signal);await s.execute('web_read',{url:item.url},options.signal);assert.equal(s.snapshot().evidence.length,1);assert.equal(s.snapshot().evidence[0].id,'S1');assert.equal(s.snapshot().evidence[0].kind,'page')
})

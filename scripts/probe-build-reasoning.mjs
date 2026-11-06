import {readFile,writeFile} from 'node:fs/promises'
import {loadApiKey} from '../server/env.mjs'
import {createModelClient} from '../server/research/model-client.mjs'
import {buildDeepCard} from '../server/cardspec/deep-build.mjs'
import {toolDiscoveryReference,expandedToolIds} from '../shared/cardspec/tool-discovery.mjs'
import {toolReference} from '../shared/cardspec/tools.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
const trace=JSON.parse(await readFile('artifacts/deep-build/03a39a80-b9bd-4e8e-9163-f1cb41d484b2/trace.json','utf8'))
const {tools:catalog}=await(await fetch('http://127.0.0.1:8787/api/tools')).json()
const active=expandedToolIds(catalog,trace.goal,[])
let captured
try{await buildDeepCard({input:{prompt:trace.goal},context:{expressionDialect:'js-v1',renderMode:'hybrid',cardSize:'full'},cardId:'probe-build-contract',resume:{goal:trace.goal,plan:trace.plan,workspace:{"main.cardspec":{content:"<card><text>尚未实现</text></card>"}}},debug:{},toolContract:toolDiscoveryReference(catalog,trace.goal,{compact:true})+'\n'+toolReference(true,active,{expressionDialect:'js-v1'}),streamUpstream:async(m)=>{captured=m;throw Object.assign(Error('capture only'),{code:'BUILD_STALLED'})}})}catch{}
await writeFile('artifacts/build-reliability-qa/probe-prompt.json',JSON.stringify(captured,null,2))
const round=createModelClient({base:process.env.MODEL_BASE_URL||'https://model-gateway.example.invalid/v1',key:loadApiKey().value,model:'glm-5.3'})
let reasoning='',content=''
try{const r=await round(captured,{maxTokens:1800,thinking:{type:'disabled'},reasoningEffort:'low',responseFormat:{type:'json_object'},tools:createGenerationTools({catalog,goal:trace.goal,allowPlanning:false}).tools(),signal:AbortSignal.timeout(60000),onPiece:p=>{reasoning+=p.reasoning||'';content+=p.content||''}});content=r.message.content}catch(e){console.log(e.message)}
await writeFile('artifacts/build-reliability-qa/probe-reasoning.json',JSON.stringify({reasoning,content},null,2));console.log(JSON.stringify({input:JSON.stringify(captured).length,reasoning:reasoning.length,content:content.length}))

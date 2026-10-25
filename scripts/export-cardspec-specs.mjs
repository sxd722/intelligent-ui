// Documentation snapshots only. No model, CLI, credentials or network calls.
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {REGISTRY,registryReference,THEMES,STATE_TYPES} from '../shared/cardspec/registry.mjs'
import {VISUAL_STYLE_IDS} from '../shared/cardspec/styles.mjs'
import {CARD_ANALYSIS_PROMPT,CARD_PLAN_PROMPT} from '../server/cardspec/prompt.mjs'
import {REACT_SURFACE_PROMPT} from '../shared/cardspec/react-surface-prompt.mjs'
import {generateCard} from '../server/cardspec/generation.mjs'
import {planExperience} from '../server/cardspec/experience.mjs'
import {RESEARCH_PROMPT,RESEARCH_TOOLS} from '../server/research/session.mjs'
import {GENERATION_TOOL_PROMPT,createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {createDatasetAnalyzer} from '../server/cardspec/model-analysis.mjs'
import {legacyPrompts} from '../server/prompt.mjs'
import {DEBUG_INSTRUCTION,CARD_TEST_TOOL,CARD_COMMIT_TOOL} from '../server/cardspec/debug-session.mjs'
const out=new URL('../docs/specs/',import.meta.url)
await mkdir(new URL('prompts/',out),{recursive:true})
const json=(name,value)=>writeFile(new URL(name,out),JSON.stringify(value,null,2)+'\n')
await json('component-contracts.json',REGISTRY)
await writeFile(new URL('component-reference.md',out),'# 当前组件契约（自动导出）\n\n属性类型是求值后的类型；表达式还须通过编译器。完整业务校验见 contracts.mjs。\n\n```text\n'+registryReference()+'\n```\n')
const expr={$ref:'#/$defs/expression'},record={type:'object',additionalProperties:expr}
const defs={expression:{description:'Compiler expression AST. This shape schema intentionally leaves AST internals open; use compileCard for expression/semantic validation.',type:'object',required:['type'],properties:{type:{type:'string'}},additionalProperties:true},node:{oneOf:[{type:'object',required:['type','value'],properties:{type:{const:'run'},value:expr}},...Object.entries(REGISTRY).map(([name,def])=>({type:'object',required:['type','props','children'],properties:{type:{const:name},id:{type:'string'},props:{type:'object',properties:Object.fromEntries(Object.entries(def.props).map(([k,t])=>[k,{...expr,description:'Evaluated type: '+t}])),additionalProperties:false},children:{type:'array',items:{$ref:'#/$defs/node'},...(def.children==='none'?{maxItems:0}:{})}},additionalProperties:true}))]}}
const stateDef={type:'object',required:['type','initial'],properties:{type:{enum:STATE_TYPES},initial:expr},additionalProperties:false}
const bindingDef={type:'object',required:['tool','input','initial','load','refresh','requires'],properties:{tool:{type:'string'},input:expr,initial:expr,load:{enum:['manual','visible']},refresh:{anyOf:[{const:0},{type:'integer',minimum:30,maximum:86400}]},requires:{type:'array',items:{type:'string'}}},additionalProperties:false}
const actionStep={type:'object',required:['type'],properties:{type:{enum:['set','toggle','increment','append','update','remove','invoke']},target:{type:'string'},key:expr,value:expr,when:expr,input:expr,binding:{type:'string'},onSuccess:{type:'string'},onError:{type:'string'}},additionalProperties:false}
await json('cardspec-runtime.schema.json',{
 $schema:'https://json-schema.org/draft/2020-12/schema',title:'CardSpec v1 compiled runtime — structural schema',
 description:'Documentation/export schema, not the production validator or model output format. Expressions, references, component values and semantics require compileCard and validateRichContent.',
 type:'object',required:['schemaVersion','cardId','revision','context','theme','palette','data','state','derived','bindings','actions','children'],
 properties:{schemaVersion:{const:1},cardId:{type:'string'},revision:{type:'integer'},context:{type:'object'},theme:{enum:THEMES},palette:{enum:['a','b','c']},design:{type:'string'},composition:{enum:['auto','focus','stage','menu','flow']},visualStyle:{enum:VISUAL_STYLE_IDS},actionMode:{enum:['snapshot','sequential']},intro:{type:'string'},outro:{type:'string'},data:record,derived:record,
 state:{type:'object',additionalProperties:stateDef},bindings:{type:'object',additionalProperties:bindingDef},actions:{type:'object',additionalProperties:{type:'array',minItems:1,maxItems:16,items:actionStep}},children:{type:'array',items:{$ref:'#/$defs/node'}}},
 additionalProperties:true,$defs:defs
})

for(const [name,prompt]of Object.entries({'staged-analysis':CARD_ANALYSIS_PROMPT,'staged-plan':CARD_PLAN_PROMPT,'react-svg':REACT_SURFACE_PROMPT,research:RESEARCH_PROMPT,'generation-tools':GENERATION_TOOL_PROMPT,debug:DEBUG_INSTRUCTION}))await writeFile(new URL('prompts/'+name+'.txt',out),prompt+'\n')
await json('prompts/research-debug-tools.json',[...RESEARCH_TOOLS,CARD_TEST_TOOL,CARD_COMMIT_TOOL])
const generationTools=createGenerationTools({catalog:[{id:'documentation.read',available:true,readOnly:true,provider:'example'}],goal:'三张卡片，多源比较助手',budget:{policy:{profile:'adaptive-v1'}},analyze:()=>{throw Error('not executed')}})
await json('prompts/generation-tool-schemas.json',generationTools.tools())
await json('prompts/cardplan-request.json',generationTools.planningRequest())
await createDatasetAnalyzer(async(messages,options)=>{await json('prompts/dataset-analysis.json',{messages,options});return {message:{content:'{"annotations":[]}'}}})({instruction:'按原文分类，无法确认写未知',records:[]})
await json('prompts/dil-legacy-square.json',legacyPrompts('square'))
const goal='解释两个数值的比例，使用滑杆调整并显示变化。'
for(const adaptive of [false,true])for(const expressionDialect of ['legacy','js-v1'])for(const renderMode of ['native','hybrid']){
 let captured
 try{await generateCard({streamUpstream:async(messages,options)=>{captured={messages,options:{temperature:options.temperature,maxTokens:options.maxTokens,reasoningEffort:options.reasoningEffort}};throw Error('documentation capture')},catalog:[],input:{prompt:goal},view:{generationMode:'direct',expressionDialect,renderMode,cardSize:'square'},budget:adaptive?{policy:{profile:'adaptive-v1'}}:undefined,signal:new AbortController().signal})}catch(e){if(e.message!=='documentation capture')throw e}
 if(!captured)throw Error('No captured prompt')
 // Remove wall-clock variance; preserve structure while clearly marking sample context.
 captured.messages=captured.messages.map(m=>({...m,content:m.content.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g,'<GENERATED_AT>').replace(/"localDate":"\d{4}-\d{2}-\d{2}"/g,'"localDate":"<LOCAL_DATE>"')}))
 await json(`prompts/${adaptive?'adaptive':'direct'}-${expressionDialect}-${renderMode}.json`,captured)
}
for(const target of ['page','slot:detail']){
 let captured
 await planExperience({goal,cardSize:'square',target,renderMode:'hybrid',streamUpstream:async(messages,options)=>{captured={messages,options:{temperature:options.temperature,maxTokens:options.maxTokens,responseFormat:options.responseFormat,reasoningEffort:options.reasoningEffort}};throw Error('capture only')}})
 await json('prompts/experience-'+(target==='page'?'page':'slot')+'.json',captured)
}
const sources=['shared/cardspec/registry.mjs','shared/cardspec/contracts.mjs','shared/cardspec/compiler.mjs','shared/cardspec/javascript-expression.mjs','shared/cardspec/sandbox-policy.mjs','shared/cardspec/logic-contract.mjs','server/cardspec/generation.mjs','server/cardspec/handler.mjs','server/cardspec/prompt.mjs','server/cardspec/compact-prompt.mjs','server/cardspec/language-core.mjs','server/cardspec/budget.mjs','server/cardspec/experience.mjs','server/cardspec/sandbox.mjs','server/cardspec/generation-tools.mjs','server/research/session.mjs','server/cardspec/model-analysis.mjs']
await json('source-manifest.json',await Promise.all(sources.map(async path=>({path,sha256:createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex')}))))
console.log('Exported component contracts, runtime shape schema and captured prompt examples; zero network/model calls.')

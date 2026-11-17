const unsafe=new Set(['__proto__','prototype','constructor'])
export function persistedValue(snapshot,owner,key){
 const components=snapshot.componentState||{}, matches=Object.keys(components).filter(k=>k===owner||k.endsWith('/'+owner))
 if(owner && matches.length!==1)return {found:false}
 const c=components[matches[0]],state=owner?(c?.webSandbox?.state??c?.sandbox?.state??c?.state):snapshot.state
 return state&&Object.hasOwn(state,key)?{found:true,value:state[key]}:{found:false}
}
export const JOURNEY_EXPECTATION_SCHEMA={
 terminal:{type:'object',additionalProperties:false,required:['outcome','key','value'],properties:{outcome:{type:'string',enum:['win','loss']},owner:{type:'string',description:'Sandbox id; omit for native state'},key:{type:'string'},value:{type:'string'}},description:'Actual persisted terminal state, not success text. Check after all consequences have settled.'},
 navigation:{anyOf:[{type:'boolean'},{type:'string',maxLength:2048}],description:'Actual external URL attempted by this click; true or exact http(s) URL. State changes alone cannot pass. Destination availability is not checked.'},
 relations:{type:'array',maxItems:6,items:{type:'object',additionalProperties:false,required:['left','op','right'],properties:{left:{type:'string',description:'state/derived/results snapshot path; before.state for pre-action value'},op:{type:'string',enum:['eq','ne','lt','lte','gt','gte']},right:{type:'string'}}}},
 controls:{type:'array',maxItems:4,items:{type:'object',additionalProperties:false,required:['name','enabled'],properties:{name:{type:'string',maxLength:100},enabled:{type:'boolean'}}}},
}
const validPath=p=>typeof p==='string'&&p.length<=180&&/^(?:before\.)?(?:state|derived|results)(?:\.[\w-]+)+$/.test(p)&&!p.split('.').some(k=>unsafe.has(k))
function pathValue(path,before,after){
 const parts=path.split('.');let value=parts[0]==='before'?(parts.shift(),before):after
 for(const key of parts){if(value==null||!Object.hasOwn(Object(value),key))return {found:false};value=value[key]}
 return {found:true,value}
}
export function validateExpectation(e){
 if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!['terminal','navigation','text','state','changed','visual','changedKeys','tool','sandboxChanged','changedResults','derived','relations','controls'].includes(k)))throw Error('invalid expectation')
 if(!Object.keys(e).length)throw Error('empty expectation')
 if(e.terminal!==undefined){const t=e.terminal;if(!t||typeof t!=='object'||Object.keys(t).some(k=>!['outcome','owner','key','value'].includes(k))||!['win','loss'].includes(t.outcome)||typeof t.key!=='string'||!t.key||unsafe.has(t.key)||typeof t.value!=='string'||!t.value||t.value.length>100||(t.owner!==undefined&&(typeof t.owner!=='string'||!t.owner||t.owner.length>120)))throw Error('invalid terminal: outcome win/loss, persisted key/value and optional sandbox owner')}
 if(e.navigation!==undefined&&e.navigation!==true&&!(typeof e.navigation==='string'&&e.navigation.length<=2048&&/^https?:\/\//i.test(e.navigation)))throw Error('navigation must be true or an exact http(s) URL')
 if(e.text!==undefined){const texts=Array.isArray(e.text)?e.text:[e.text];if(!texts.length||texts.length>6||texts.some(t=>typeof t!=='string'||!t||t.length>200))throw Error('expect.text must be short text or up to 6 short strings')}
 if(e.changed!==undefined&&typeof e.changed!=='boolean'||e.visual!==undefined&&typeof e.visual!=='boolean')throw Error('invalid boolean expectation')
 if(e.changedKeys!==undefined&&(!Array.isArray(e.changedKeys)||!e.changedKeys.length||e.changedKeys.length>8||e.changedKeys.some(k=>typeof k!=='string'||!/^[a-zA-Z][\w-]{0,80}$/.test(k))))throw Error('invalid changedKeys')
 if(e.sandboxChanged!==undefined&&(typeof e.sandboxChanged!=='string'||!e.sandboxChanged||e.sandboxChanged.length>120))throw Error('invalid sandboxChanged')
 if(e.tool!==undefined&&(typeof e.tool!=='string'||!e.tool||e.tool.length>120))throw Error('invalid tool expectation')
 if(e.state!==undefined&&(!e.state||Array.isArray(e.state)||typeof e.state!=='object'||JSON.stringify(e.state).length>1200||Object.keys(e.state).some(k=>['__proto__','constructor','prototype'].includes(k))))throw Error('invalid state expectation')
 if(e.changedResults!==undefined&&(!Array.isArray(e.changedResults)||!e.changedResults.length||e.changedResults.length>8||e.changedResults.some(k=>typeof k!=='string'||k.length>120)))throw Error('invalid changedResults')
 if(e.derived!==undefined&&(!e.derived||typeof e.derived!=='object'||Array.isArray(e.derived)||JSON.stringify(e.derived).length>1800))throw Error('invalid derived expectation')
 if(e.relations!==undefined&&(!Array.isArray(e.relations)||!e.relations.length||e.relations.length>6||e.relations.some(r=>!r||Object.keys(r).some(k=>!['left','op','right'].includes(k))||!validPath(r.left)||!validPath(r.right)||!['eq','ne','lt','lte','gt','gte'].includes(r.op))))throw Error('invalid relations: use snapshot paths and eq/ne/lt/lte/gt/gte')
 if(e.controls!==undefined&&(!Array.isArray(e.controls)||!e.controls.length||e.controls.length>4||e.controls.some(c=>!c||Object.keys(c).some(k=>!['name','enabled'].includes(k))||typeof c.name!=='string'||!c.name||c.name.length>100||typeof c.enabled!=='boolean')))throw Error('invalid controls: use exact visible name and enabled boolean')
 return e
}
export function assertSnapshot(expect,before,after){
 if(!expect)return undefined
 validateExpectation(expect);const failures=[]
 if(expect.terminal){const t=expect.terminal,v=persistedValue(after,t.owner,t.key);if(!v.found||v.value!==t.value)failures.push('persisted terminal '+t.key+' expected '+t.value+', observed '+(v.found?JSON.stringify(v.value):'missing')+'; visible victory text is not terminal evidence')}
 if(expect.navigation){const seen=new Set((before.navigation||[]).map(n=>n.id));const attempts=(after.navigation||[]).filter(n=>!seen.has(n.id));if(!attempts.some(n=>n.valid&&(expect.navigation===true||n.url===expect.navigation)))failures.push('expected actual external navigation target; state changes are not navigation')}
 for(const text of expect.text===undefined?[]:Array.isArray(expect.text)?expect.text:[expect.text])if(!after.text?.includes(text))failures.push('expected visible text: '+text)
 for(const [key,value]of Object.entries(expect.state||{}))if(JSON.stringify(after.state?.[key])!==JSON.stringify(value))failures.push('state.'+key+' did not equal expected value')
 if(expect.changed!==undefined){const changed=JSON.stringify([before.state,before.componentState,before.text])!==JSON.stringify([after.state,after.componentState,after.text]);if(changed!==expect.changed)failures.push('unexpected feedback change')}
 if(expect.visual===true&&!after.visualCount)failures.push('no visible graphic surface')
 for(const key of expect.changedKeys||[])if(JSON.stringify(before.state?.[key])===JSON.stringify(after.state?.[key]))failures.push('result state.'+key+' did not change')
 if(expect.sandboxChanged){const id=expect.sandboxChanged,key=Object.keys(before.sandboxOutputs||{}).find(k=>k===id||k.endsWith('/'+id)),a=before.sandboxOutputs?.[key],b=after.sandboxOutputs?.[key];if(!a||!b||a===b)failures.push('sandbox '+id+' visible output did not change')}
 if(expect.tool&&!after.calls?.slice(before.calls?.length||0).some(c=>c.tool===expect.tool||c.payload?.tool===expect.tool))failures.push('expected actual tool call: '+expect.tool)
 const missingResults=(expect.changedResults||[]).filter(key=>!Object.hasOwn(before.results||{},key)||!Object.hasOwn(after.results||{},key))
 for(const key of expect.changedResults||[])if(missingResults.includes(key))failures.push('Unknown result key '+key+'; available result keys: '+Object.keys(after.results||{}).slice(0,20).join(', ')+'. Correct the test target, not the implementation.')
 else if(before.results[key]?.omitted||after.results[key]?.omitted||JSON.stringify(before.results[key])===JSON.stringify(after.results[key]))failures.push('result '+key+' did not change (input echo does not count)')
 for(const [key,value]of Object.entries(expect.derived||{}))if(JSON.stringify(after.derived?.[key])!==JSON.stringify(value))failures.push('derived.'+key+' did not equal expected result')
 for(const r of expect.relations||[]){
  const a=pathValue(r.left,before,after),b=pathValue(r.right,before,after)
  const comparable=typeof a.value==='number'&&Number.isFinite(a.value)&&typeof b.value==='number'&&Number.isFinite(b.value)
  const equal=JSON.stringify(a.value)===JSON.stringify(b.value)
  const passed=a.found&&b.found&&(r.op==='eq'?equal:r.op==='ne'?!equal:comparable&&({lt:a.value<b.value,lte:a.value<=b.value,gt:a.value>b.value,gte:a.value>=b.value}[r.op]))
  if(!passed)failures.push(`relation ${r.left} ${r.op} ${r.right} failed${!a.found||!b.found?' (missing result path)':''}`)
 }
 for(const c of expect.controls||[]){const matches=(after.controls||[]).filter(x=>x.name===c.name);if(!matches.length||!matches.every(x=>!x.disabled===c.enabled))failures.push('expected visible control '+c.name+' enabled='+c.enabled)}
 return {passed:!failures.length,failures,...(missingResults.length&&failures.length===missingResults.length?{classification:'test_plan'}:{})}
}

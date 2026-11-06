export function validateExpectation(e){
 if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(k=>!['text','state','changed','visual','changedKeys','tool'].includes(k)))throw Error('invalid expectation')
 if(!Object.keys(e).length)throw Error('empty expectation')
 if(e.text!==undefined){const texts=Array.isArray(e.text)?e.text:[e.text];if(!texts.length||texts.length>6||texts.some(t=>typeof t!=='string'||!t||t.length>200))throw Error('expect.text must be short text or up to 6 short strings')}
 if(e.changed!==undefined&&typeof e.changed!=='boolean'||e.visual!==undefined&&typeof e.visual!=='boolean')throw Error('invalid boolean expectation')
 if(e.changedKeys!==undefined&&(!Array.isArray(e.changedKeys)||!e.changedKeys.length||e.changedKeys.length>8||e.changedKeys.some(k=>typeof k!=='string'||!/^[a-zA-Z][\w-]{0,80}$/.test(k))))throw Error('invalid changedKeys')
 if(e.tool!==undefined&&(typeof e.tool!=='string'||!e.tool||e.tool.length>120))throw Error('invalid tool expectation')
 if(e.state!==undefined&&(!e.state||Array.isArray(e.state)||typeof e.state!=='object'||JSON.stringify(e.state).length>1200||Object.keys(e.state).some(k=>['__proto__','constructor','prototype'].includes(k))))throw Error('invalid state expectation')
 return e
}
export function assertSnapshot(expect,before,after){
 if(!expect)return undefined
 validateExpectation(expect);const failures=[]
 for(const text of expect.text===undefined?[]:Array.isArray(expect.text)?expect.text:[expect.text])if(!after.text?.includes(text))failures.push('expected visible text: '+text)
 for(const [key,value]of Object.entries(expect.state||{}))if(JSON.stringify(after.state?.[key])!==JSON.stringify(value))failures.push('state.'+key+' did not equal expected value')
 if(expect.changed!==undefined){const changed=JSON.stringify([before.state,before.componentState,before.text])!==JSON.stringify([after.state,after.componentState,after.text]);if(changed!==expect.changed)failures.push('unexpected feedback change')}
 if(expect.visual===true&&!after.visualCount)failures.push('no visible graphic surface')
 for(const key of expect.changedKeys||[])if(JSON.stringify(before.state?.[key])===JSON.stringify(after.state?.[key]))failures.push('result state.'+key+' did not change')
 if(expect.tool&&!after.calls?.slice(before.calls?.length||0).some(c=>c.tool===expect.tool||c.payload?.tool===expect.tool))failures.push('expected actual tool call: '+expect.tool)
 return {passed:!failures.length,failures}
}

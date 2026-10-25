import test from 'node:test'
import assert from 'node:assert/strict'
import {browserDocumentCommand,allowedDocumentUrl,documentGate} from '../server/tools/browser-document.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {toolErrorInfo} from '../shared/cardspec/tool-errors.mjs'
const tool=TOOLS['opencli.dongchedi.search']
test('all supported Dongchedi tools disclose browser auth while retaining tool IDs and schemas',()=>{
 for(const t of Object.values(TOOLS).filter(t=>t.site==='dongchedi')){assert.equal(t.browser,true);assert.equal(t.browserDocument,true);assert.equal(t.auth,'browser');assert.equal(t.readOnly,true)}
 assert.equal(TOOLS['opencli.dianping.search'].browser,true)
 assert.equal(TOOLS['opencli.douban.top250'].browserDocument,undefined)
})
test('document transport restricts site, routes, credentials and writes',async()=>{
 for(const url of ['https://evil.test/search','http://www.dongchedi.com/search','https://user:pass@www.dongchedi.com/search','https://www.dongchedi.com/delete','https://www.dongchedi.com/search#hash'])assert.throws(()=>allowedDocumentUrl(tool,url))
 let navigated=false;const cmd=browserDocumentCommand({browser:false,func:()=>fetch('https://www.dongchedi.com/search',{method:'POST'})},tool)
 await assert.rejects(cmd.func({goto:()=>{navigated=true}},{}),{code:'INVALID_INPUT'});assert.equal(navigated,false)
})
test('login and verification are explicit failures, never empty successful datasets',()=>{
 assert.throws(()=>documentGate({url:'https://www.dongchedi.com/login-required'}),{code:'AUTH_REQUIRED'})
 assert.throws(()=>documentGate({url:'https://www.dongchedi.com/search',verification:true}),{code:'ACCESS_RESTRICTED'})
 assert.throws(()=>documentGate({url:'https://verify.example.org/'}),{code:'ACCESS_RESTRICTED'})
 documentGate({url:'https://www.dongchedi.com/search'})
 const missing=toolErrorInfo(Object.assign(Error('no rating yet'),{code:'EMPTY_RESULT'}));assert.equal(missing.code,'EMPTY_RESULT');assert.equal(missing.retryable,false);assert.equal(missing.recovery,'edit_input')
})
test('upstream parser consumes authenticated DOM through fixed fetch replacement and restores transport',async()=>{
 const original=globalThis.fetch;let url,code
 const page={goto:async u=>{url=u},evaluate:async s=>{code=s;return {url,ready:true,props:{searchData:{data:[{series_id:'42'}]}}}}}
 const native={browser:false,func:async args=>{const r=await fetch('https://www.dongchedi.com/search?keyword='+encodeURIComponent(args.keyword));const html=await r.text();return JSON.parse(html.match(/>(.*)<\/script>/)[1]).props.pageProps.searchData.data}}
 const rows=await browserDocumentCommand(native,tool).func(page,{keyword:'A & B'})
 assert.equal(rows[0].series_id,'42');assert.match(url,/A%20%26%20B/);assert.match(code,/searchData/);assert.doesNotMatch(code,/document.cookie|localStorage|sessionStorage/);assert.equal(globalThis.fetch,original)
})
test('SDK wrapping cannot hide auth error and transport is restored after failure',async()=>{
 const original=globalThis.fetch
 const native={browser:false,func:async()=>{try{await fetch('https://www.dongchedi.com/search')}catch(e){throw Error('network error: '+e.message)}}}
 const page={goto:async()=>{},evaluate:async()=>({url:'https://www.dongchedi.com/login-required',ready:true,props:{}})}
 await assert.rejects(browserDocumentCommand(native,tool).func(page,{}),{code:'AUTH_REQUIRED'});assert.equal(globalThis.fetch,original)
})

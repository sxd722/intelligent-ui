import test from 'node:test'
import assert from 'node:assert/strict'
import {staticBoard} from '../shared/cardspec/static-board.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {hasContentVisual,protectContentVisual} from '../shared/cardspec/visual-intent.mjs'
import {createDesignMockService,validateMockLayout} from '../server/design-mock-service.mjs'
import {generationSettings} from '../shared/cardspec/generation-settings.mjs'
test('static records use host layout without tool/provenance or invented metrics',()=>{
 const view=staticBoard([{id:'a',title:'森林',summary:'观察树叶',category:'户外',imageQuery:'forest leaves',metrics:[{label:'时间',value:30,unit:'分'}]}]);assert.equal(view.items[0].metrics[0].value,30);assert.deepEqual(view.mapItems,[]);assert.deepEqual(view.items[0].provenance,[])
 assert.throws(()=>staticBoard([{id:'a',title:'A'},{id:'a',title:'B'}]),/unique/)
 const c=compileCard('<card><data id="rows" value={[{id:"a",title:"森林"}]}/><task-board items={data.rows}/></card>',{final:true});assert.equal(c.complete,true,JSON.stringify(c.diagnostics))
})
test('declared visual intent survives a failed draft and allows equivalent host replacement',()=>{
 const first=compileCard('<card><image query="forest"/></card>',{final:true}).spec
 assert.ok(hasContentVisual(first));assert.equal(protectContentVisual(true,compileCard('<card><text>list</text></card>',{final:true}).spec).length,1)
 assert.equal(protectContentVisual(true,compileCard('<card><task-board items={[]}/></card>',{final:true}).spec).length,0)
})
test('image-first is optional and retained in settings',()=>{assert.equal(generationSettings().designMode,'host');assert.equal(generationSettings({designMode:'image-first'}).designMode,'image-first')})
const layout={layout:'hero',background:'#fafafa',ink:'#121212',accent:'#226644',art:{x:2,y:5,width:90,height:35},description:'paper illustration'}
test('mock generation analyzes actual bytes, caches both stages and preserves usage',async()=>{
 const files=new Map(),calls=[];const service=createDesignMockService({key:'test-only',storage:{read:async k=>files.get(k),write:async(k,v)=>files.set(k,v)},fetchImpl:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body});return Response.json(url.endsWith('generations')?{data:[{b64_json:Buffer.from([255,216,255,217]).toString('base64')}],usage:{total_tokens:1}}:{choices:[{message:{content:JSON.stringify(layout)}}],usage:{total_tokens:2}})}})
 const first=await service({goal:'观察树叶',cardSize:'square'}),second=await service({goal:'观察树叶',cardSize:'square'})
 assert.equal(calls.length,2);assert.ok(calls[1].body.messages[1].content[0].image_url.url.startsWith('data:image/jpeg;base64,'));assert.equal(first.status,'ready');assert.equal(second.cacheHit,true);assert.equal(first.url,second.url);assert.equal(first.usage.vision.total_tokens,2)
})
test('malformed crop/color does not become host CSS',()=>{assert.throws(()=>validateMockLayout({...layout,background:'url(http://bad)'}));assert.throws(()=>validateMockLayout({...layout,art:{x:90,y:0,width:90,height:10}}))})

test('failed browser draft establishes visual intent before a successful test exists',async()=>{
 const {createDebugSession}=await import('../server/cardspec/debug-session.mjs');let calls=0;
 const d=createDebugSession({artifactRoot:'artifacts/design-first-20261103/unit-debug',runner:async()=>{calls++;return {status:'tested',runs:[{scenario:'normal',initial:{errors:[]},final:{errors:['simulated interaction failure'],coverage:[],controls:[]},actions:[],pageErrors:[]}]}}});
 const a=await d.test({source:'<card><image query="forest"/><text>观察</text></card>'});assert.equal(a.status,'failed');
 const b=await d.test({source:'<card><text>观察</text></card>'});assert.equal(b.status,'failed');assert.ok(b.diagnostics.some(d=>d.code==='repair_visual_intent_lost'));assert.equal(calls,1);
});
test('mock ink is corrected when the proposed colors are unreadable',()=>{const a=validateMockLayout({...layout,ink:'#eeeeee'});assert.equal(a.ink,'#111111')});

test('vision failure retries analysis from cached image without buying a second picture',async()=>{
 const files=new Map();let images=0,vision=0;
 const service=createDesignMockService({key:'test-only',storage:{read:async k=>files.get(k),write:async(k,v)=>files.set(k,v)},fetchImpl:async(url)=>{if(url.endsWith('generations')){images++;return Response.json({data:[{b64_json:Buffer.from([255,216,255,217]).toString('base64')}]})}vision++;return vision===1?new Response('',{status:503}):Response.json({choices:[{message:{content:JSON.stringify(layout)}}]})}});
 await assert.rejects(service({goal:'learn',cardSize:'square'}),/503/);await service({goal:'learn',cardSize:'square'});assert.equal(images,1);assert.equal(vision,2);
});

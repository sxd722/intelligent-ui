import test from 'node:test'
import assert from 'node:assert/strict'
import {BOARD_SKINS,boardDesign} from '../shared/cardspec/board-design.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {cardGenerationPrompt} from '../server/cardspec/prompt.mjs'
import {generationToolDisclosure} from '../server/cardspec/tool-disclosure.mjs'
import {createGenerationTools} from '../server/cardspec/generation-tools.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
test('presentation choices are deterministic and independent; all skins compile',()=>{
 for(const skin of Object.keys(BOARD_SKINS))for(const layout of ['map','decision','detail','evidence','compare','plan']){
  const c=compileCard(`<card><binding id="b" tool="opencli.douban.movie-hot" input={{limit:5}}/><task-board skin="${skin}" layout="${layout}" view={compose({main:"b"},{primary:"main"})}/></card>`,{final:true,context:{expressionDialect:'js-v1'}})
  assert.ok(c.complete,JSON.stringify(c.diagnostics));assert.equal(boardDesign({mode:'entity'},{skin,layout}).skin,skin)
 }
 assert.deepEqual(boardDesign({mode:'entity'}),boardDesign({mode:'entity'}))
 assert.notDeepEqual(boardDesign({mode:'entity'}).tokens,boardDesign({mode:'map'}).tokens)
})
test('normal adaptive generation sees the actual host component without a discovery call',()=>{
 const p=cardGenerationPrompt(null,{adaptive:true,goal:'今晚看什么',expressionDialect:'js-v1'});assert.match(p,/<task-board>/);assert.match(p,/signal/);assert.match(p,/compose/)
})
test('single mapped tool is sufficient to disclose an exact compose example',async()=>{
 const tool={id:'opencli.douban.movie-hot',available:true,readOnly:true,purpose:'movies'}
 const d=await generationToolDisclosure([tool],'今晚看什么',{discover:async()=>({tools:[tool],retrieval:{catalogSize:1},instruction:''})})
 assert.match(d.binding,/<task-board/);assert.match(d.binding,/compose/)
})
test('successful mapped reads expose host display without another model or tool call',async()=>{
 const id='opencli.hackernews.search';let reads=0
 const tools=createGenerationTools({catalog:[{...TOOLS[id],available:true}],allowPlanning:false,invoke:async()=>{reads++;return {value:{items:[{id:1,title:'First',score:8,url:'https://example.com'}],source:'hackernews',fetchedAt:new Date().toISOString(),truncated:false}}}})
 const output=await tools.execute('cli_read',{id,input:{query:'AI',limit:2}},new AbortController().signal)
 assert.equal(reads,1);assert.equal(output.hostView.component,'task-board');assert.deepEqual(output.hostView.binding,{tool:id,input:{query:'AI',limit:2}});assert.match(output.hostView.usage,/compose/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {routeCoreTasks} from '../server/tools/task-routing.mjs'
import {TOOLS} from '../shared/cardspec/tools.mjs'
import {discoveryQuery,intentGroups} from '../server/tools/discovery-query.mjs'
import {entryTool,personalTool} from '../server/tools/capability-domain.mjs'
import {rankTools} from '../server/tools/semantic-discovery.mjs'
import {needsTerminalJourneys} from '../server/cardspec/terminal-journeys.mjs'
import {journeyRequirements,journeySummary,journeyCoverage} from '../server/cardspec/journey-coverage.mjs'
import {editorialGroups,disclosureTitle} from '../shared/cardspec/editorial-structure.mjs'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {relationPartRoles} from '../shared/cardspec/content-skeleton.mjs'
const catalog=Object.values(TOOLS).map(t=>({...t,available:true}))
test('layout-local bindings normalize without crossing conditional or repeated scopes',()=>{
 const binding='<binding id="books" tool="opencli.weread.search" input={{query:"西游记"}}/>'
 const options={final:true,context:{expressionDialect:'js-v1',tools:['opencli.weread.search']}}
 const r=compileCard(`<card><region><box>${binding}<tool-view binding="books"/></box></region></card>`,options)
 assert.ok(r.complete,JSON.stringify(r.diagnostics));assert.equal(Object.keys(r.spec.bindings).length,1)
 assert.ok(r.diagnostics.some(d=>d.code==='binding_scope_normalized'))
 assert.equal(r.spec.bindings.books.tool,'opencli.weread.search')
 for(const source of [`<card>${binding}<region>${binding}</region></card>`,`<card><if test={true}>${binding}</if></card>`,`<card><each items={[1]} as="item">${binding}</each></card>`]){
  assert.ok(compileCard(source,options).diagnostics.some(d=>d.severity==='error'))
 }
})
const task=domain=>({kind:'find',query:'检索文学原著及研究著作',domain,terms:[],data:'live',outcome:'选择书籍查看详情及阅读入口'})
const discover=async()=>({tools:['opencli.weread.search','opencli.weread.book-search','opencli.weread.notes','opencli.google.search'].map(id=>({id,score:.8,semanticScore:.6})),retrieval:{method:'controlled'}})

test('literature aliases retain public query entry and exclude unsolicited private notes',async()=>{
 for(const domain of ['literature','literary history','scholarship','reading','文学']){
  const {tasks:[r]}=await routeCoreTasks(catalog,{tasks:[task(domain)]},{discover})
  assert.ok(r.tools.some(t=>t.id==='opencli.weread.search'),domain)
  assert.ok(r.tools.some(t=>t.id==='opencli.weread.book-search'&&t.role==='entry'),domain)
  assert.ok(!r.tools.some(t=>t.id==='opencli.weread.notes'))
  assert.equal(r.requiresBinding,true)
 }
 assert.equal(entryTool(TOOLS['opencli.weread.book']),false)
 assert.equal(personalTool(TOOLS['opencli.weread.notes']),true)
})
test('unknown domain keeps strong query-capable retrieval, not weak unrelated matches',async()=>{
 const {tasks:[r]}=await routeCoreTasks(catalog,{tasks:[task('novel-field')]},{discover:async()=>({tools:[{id:'opencli.weread.book-search',score:.7,semanticScore:.65},{id:'opencli.ctrip.search',score:.5,semanticScore:.25}],retrieval:{}})})
 assert.ok(r.tools.some(t=>t.id==='opencli.weread.book-search'))
 assert.ok(!r.tools.some(t=>t.id==='opencli.ctrip.search'))
})
test('public book query ranks entry above equal-similarity private notes, explicit private requests remain discoverable',()=>{
 const c=['opencli.weread.notes','opencli.weread.search'].map(id=>({...TOOLS[id],available:true}))
 const opts={vectors:[[1,0],[1,0]],queries:[[1,0]]}
 assert.equal(rankTools(c,'查找原著研究著作',opts)[0].id,'opencli.weread.search')
 assert.equal(rankTools(c,'我的 opencli.weread.notes',opts)[0].id,'opencli.weread.notes')
})
test('long briefs preserve end-of-brief data needs in bounded discovery query',()=>{
 const q=discoveryQuery('文学解释\n'+Array.from({length:40},(_,i)=>`段落${i}：`+'主题内容'.repeat(30)).join('\n')+'\n资料：搜索图书书目和书内原文片段')
 assert.ok(q.length<=900);assert.match(q,/书内原文片段/);assert.ok(intentGroups(q).includes('reading'))
})
test('negated game scope and reviews do not require terminal game paths',()=>{
 for(const q of ['阅读专题，而非游戏化妖怪图鉴','历史战斗回顾，不是游戏','游戏研究和游戏新闻','不要做游戏。制作阅读卡片','An article, not a game.'])assert.equal(needsTerminalJourneys(q),false,q)
 for(const q of ['制作可玩的小游戏','不要复杂剧情，但制作围棋对战','游戏','build a playable game'])assert.equal(needsTerminalJourneys(q),true,q)
})
test('markdown CUJs retain multi-paragraph outcomes and optional status, not presentation sections',()=>{
 const q='## 用户旅程\n### CUJ-1【必需】主题阅读\n\n选择主题后更新案例集合。\n\n**完成结果：**看到不同解释。\n### CUJ-2【建议】查证\n打开书目。\n## 内容与构图\n不作为CUJ'
 const r=journeyRequirements(q);assert.equal(r.length,2);assert.equal(r[0].kind,'interaction');assert.match(r[0].quote,/看到不同解释/);assert.equal(r[1].required,false);assert.ok(!r[1].quote.includes('不作为CUJ'));assert.match(journeySummary(r[0].quote),/更新案例集合/)
 const coverage=journeyCoverage(q,{}, {status:'tested',runs:[{scenario:'normal',actions:[{ok:true,changed:true,resultChanged:false,assertion:{passed:true},step:{op:'click',requirement:'R1',expect:{text:'主题A'}}}]}]})
 assert.notEqual(coverage.items[0].status,'checked','selection highlight alone is not an outcome')
})
test('editorial grouping preserves adjacent heading, evidence and stable order; named disclosure needs no duplicate label',()=>{
 assert.deepEqual(relationPartRoles('compare',['title','caption','box','box','text']).map(r=>r.compare),[null,null,1,2,3])
 const kinds=['title','text','caption','title','facts','text','segmented','box','box']
 assert.deepEqual(editorialGroups(kinds),[[0,1,2],[3,4,5],[6],[7],[8]])
 assert.equal(disclosureTitle('',[{kind:'title',text:'青牛精 · 第50回'}]),'青牛精 · 第50回')
 assert.equal(disclosureTitle('展开原文',[{kind:'title',text:'A'}]),'展开原文')
 assert.equal(disclosureTitle(null,[{kind:'text',text:'不要把长正文当标题'}]),'查看详情')
})

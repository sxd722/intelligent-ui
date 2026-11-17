import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createStore,makeScope} from '../shared/cardspec/store.mjs'
import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const dir='artifacts/reading-navigation-qa';await mkdir(dir,{recursive:true})
const old=JSON.parse(await readFile('artifacts/reading-organization-qa/journey/result.json','utf8')),data=makeScope(old.spec,createStore()).data
const source=`<card schemaVersion="1" design="parchment" actionMode="snapshot">
<data id="cases" value={${JSON.stringify(data.cases.map(c=>({...c,query:c.id==='tiger'?'车迟国':c.id==='fish'?'通天河':c.name})))}}/><data id="topics" value={${JSON.stringify(data.topics)}}/>
<state id="topic" type="string" initial="power"/><state id="selected" type="string" initial="niu"/>
<derive id="related" value={data.cases.filter(x=>x.topics.includes(state.topic))}/><derive id="cur" value={data.cases.find(x=>x.id===state.selected)}/>
<binding id="evidence" tool="opencli.weread.book-search" input={{book:"34631845",query:derived.cur.query,limit:3,fragmentSize:120}} load="visible"/>
<title>妖怪与权力</title><caption>选择一个社会问题，从具体情节检验解释。</caption>
<segmented label="主题" value={state.topic} options={data.topics.map(x=>({value:x.id,label:x.label}))} onChange="topic"/>
<collection label="关联案例" items={derived.related} selectedId={state.selected} titleKey="name" subtitleKey="chap" detailMode="external" onSelect="pick"/>
<region id="case" overflow="destination" label={"解读 · "+derived.cur.name}>
 <segmented label="切换案例" value={state.selected} options={derived.related.map(x=>({value:x.id,label:x.name}))} onChange="select"/>
 <region presentation="compare"><title>{derived.cur.name}</title><box><caption>原著事实</caption><text>{derived.cur.fact}</text></box><box><caption>社会解释</caption><text>{derived.cur.reading}</text></box></region>
 <region overflow="inline" label="另一种解释与边界"><text>{derived.cur.alternative}</text><text>{derived.cur.limit}</text></region>
 <region id="evidencePage" overflow="destination" label="查阅书内证据"><caption>{derived.cur.name} · 《西游记》</caption><tool-view binding="evidence"/><link href="https://weread.qq.com/web/reader/64032210721070a5640294f">打开原著核对</link></region>
</region>
<action id="topic"><set target="topic" value={event.value}/><set target="selected" value={data.cases.find(x=>x.topics.includes(event.value)).id}/></action>
<action id="pick"><set target="selected" value={event.id}/></action><action id="select"><set target="selected" value={event.value}/></action>
</card>`
const c=compileCard(source,{final:true,cardId:'reading-destination-host',context:{expressionDialect:'js-v1',renderMode:'native',cardSize:'full',contentMode:'guided'}})
assert.ok(c.complete,JSON.stringify(c.diagnostics));await writeFile(dir+'/host.cardspec',source);await writeFile(dir+'/host-spec.json',JSON.stringify(c.spec))
// Controlled fixture uses the prior model's factual content unchanged. Browser
// transport here is explicitly fake; live CLI evidence is saved separately.
const browser=await chromium.launch({channel:'chrome',headless:true}),runs=[]
try{for(const width of [320,360,432]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto('http://127.0.0.1:8787/card-debug.html');await page.waitForFunction(()=>!!window.cardDebug)
 await page.evaluate(({spec,width})=>window.cardDebug.mount(spec,{width,size:'full'}),{spec:c.spec,width});await page.waitForFunction(()=>window.cardDebug.ready())
 const observe=()=>page.evaluate(()=>window.cardDebug.snapshot()),before=await observe();assert.equal(before.calls.length,0)
 await page.locator('.cs-stage').screenshot({path:`${dir}/host-${width}-home.png`})
 await page.getByRole('radio',{name:'地方豪强',exact:true}).click();await page.getByRole('button',{name:'车迟国三妖',exact:true}).click()
 await page.getByRole('button',{name:'解读 · 车迟国三妖',exact:true}).click();await page.getByRole('region',{name:'解读 · 车迟国三妖',exact:true}).waitFor()
 await page.getByText('原著事实',{exact:true}).waitFor();assert.equal((await observe()).calls.length,0)
 await page.locator('.cs-stage').screenshot({path:`${dir}/host-${width}-detail.png`})
 await page.getByRole('button',{name:'查阅书内证据',exact:true}).click();await page.waitForFunction(()=>window.cardDebug.snapshot().calls.length>0)
 const evidence=await observe();assert.equal(evidence.calls.at(-1).payload?.input?.query??evidence.calls.at(-1).input?.query,'车迟国')
 await page.getByRole('button',{name:'返回上一层',exact:true}).click();await page.getByRole('radio',{name:'灵感大王',exact:true}).click();await page.getByRole('button',{name:'查阅书内证据',exact:true}).click()
 await page.waitForFunction(()=>window.cardDebug.snapshot().calls.some(c=>(c.payload?.input?.query??c.input?.query)==='通天河'))
 const next=await observe();await page.evaluate(()=>window.cardDebug.save());await page.reload();await page.waitForFunction(()=>!!window.cardDebug)
 await page.evaluate(({spec,width})=>window.cardDebug.mount(spec,{width,size:'full',restore:true}),{spec:c.spec,width});await page.waitForFunction(()=>window.cardDebug.ready());await page.getByRole('region',{name:'查阅书内证据',exact:true}).waitFor()
 assert.equal((await observe()).state.selected,'fish');await page.getByRole('button',{name:'返回上一层',exact:true}).click();await page.getByRole('button',{name:'返回上一层',exact:true}).click()
 await page.getByRole('button',{name:'解读 · 灵感大王',exact:true}).waitFor();assert.equal((await observe()).state.topic,'local')
 await page.locator('.cs-stage').screenshot({path:`${dir}/host-${width}-restored.png`})
 const geometry=await page.locator('.cs-stage').evaluate(el=>({width:el.clientWidth,height:el.clientHeight,scrollWidth:el.scrollWidth}));assert.ok(geometry.scrollWidth<=geometry.width+2);assert.deepEqual(errors,[])
 runs.push({width,before,evidence,next,final:await observe(),geometry,errors,status:'passed'});await page.close()
 } }finally{await browser.close();await writeFile(dir+'/host-browser.json',JSON.stringify(runs,null,2))}
console.log(runs.map(r=>({width:r.width,status:r.status,geometry:r.geometry})))

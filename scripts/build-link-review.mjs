import fs from 'node:fs/promises'
import {build,loadConfigFromFile} from 'vite'
import {compileCard} from '../shared/cardspec/compiler.mjs'
import {createBuildWorkspace} from '../server/cardspec/build-workspace.mjs'
const captured=JSON.parse(await fs.readFile('artifacts/data-needs-qa/movie-spec.json','utf8'))
const record=Object.values(captured.context.datasets).map(value=>({value})).find(r=>r.value?.items?.some(x=>x.assetRef))
if(!record)throw Error('no captured real assets')
const w=createBuildWorkspace()
w.write([{name:'main.cardspec',content:`<card><data id="items" value={context.items}/><state id="selected" type="string" initial=""/><state id="query" type="string" initial=""/><state id="view" type="string" initial="list"/><title>模块联动与真实海报</title><caption>受控回归 · 真实工具数据回放，不计模型生成通过</caption><segmented label="视图" options={[{value:"list",label:"候选"},{value:"detail",label:"详情"}]} value={state.view} onChange="view"/><if test={state.view==="list"}><include module="list.cardspec"/></if><if test={state.view==="detail"}><include module="detail.cardspec"/></if><action id="view"><set target="view" value={event.value}/></action></card>`},
{name:'list.cardspec',content:`<input label="关键词" value={state.query} onChange="filter"/><derive id="shown" value={data.items.filter(row=>String(row.title).includes(state.query))}/><text>{derived.shown.length} 个候选</text><grid columns={2}><each items={derived.shown} as="row" itemKey={row.id}><stack><image assetRef={row.assetRef} query="redundant example ignored" alt={row.title} mediaRole="thumbnail"/><button onPress="pick" args={{id:row.id}}>{row.title}</button></stack></each></grid><action id="filter"><set target="query" value={event.value}/></action><action id="pick"><set target="selected" value={args.id}/><set target="view" value="detail"/></action>`},
{name:'detail.cardspec',content:`<derive id="current" value={data.items.find(row=>row.id===state.selected)}/><if test={derived.current}><title>{derived.current.title}</title><image assetRef={derived.current.assetRef} alt={derived.current.title} mediaRole="thumbnail"/><text>{derived.current.summary??"尚无详情"}</text></if><if test={!derived.current}><text>请先选择候选</text></if>`}])
const result=compileCard(w.assemble().source,{final:true,context:{items:record.value.items.slice(0,3),expressionDialect:'js-v1',renderMode:'native'}})
if(!result.complete)throw Error(JSON.stringify(result.diagnostics))
await fs.mkdir('artifacts/link-review',{recursive:true})
await fs.writeFile('artifacts/link-review/spec.json',JSON.stringify(result.spec))
await fs.writeFile('artifacts/link-review/index.html','<!doctype html><html lang="zh"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>模块联动回归</title><body style="margin:0;background:#eef0f5"><div id="root"></div><script type="module" src="/artifacts/link-review/review.jsx"></script></body></html>')
await fs.writeFile('artifacts/link-review/review.jsx',`import React from 'react';import{createRoot}from'react-dom/client';import{CardRenderer}from'../../src/cardspec/Renderer.jsx';import{CardSizeOverride}from'../../src/CardSize.jsx';import spec from './spec.json';import '../../src/styles/tokens.css';import '../../src/styles/themes.css';createRoot(document.getElementById('root')).render(<main style={{width:360,maxWidth:'calc(100% - 32px)',margin:'24px auto'}}><CardSizeOverride.Provider value="full"><CardRenderer spec={spec} toolsReady/></CardSizeOverride.Provider></main>);`)
const {config}=await loadConfigFromFile({command:'build',mode:'production'})
await build({configFile:false,plugins:config.plugins.filter(p=>p.name!=='copy-demos'),worker:config.worker,publicDir:false,base:'/link-review/',build:{outDir:'dist/link-review',rollupOptions:{input:'artifacts/link-review/index.html'}}})
await fs.copyFile('dist/link-review/artifacts/link-review/index.html','dist/link-review/index.html')

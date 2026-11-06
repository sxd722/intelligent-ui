import fs from 'node:fs/promises'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {ROOT,DEST} from './cases.mjs'
await fs.mkdir(DEST+'/runs',{recursive:true});await fs.mkdir(ROOT+'/screenshots',{recursive:true});await fs.mkdir(DEST+'/stitch',{recursive:true})
for(const f of await fs.readdir(ROOT))if(/^variant-.*\.(png|html)$/.test(f))await fs.copyFile(ROOT+'/'+f,DEST+'/stitch/'+f)
await fs.copyFile('artifacts/complex-p0-20261103/stitch/decision.png',DEST+'/stitch/signal-original.png')
const manifests=[]
for(const skin of ['signal','editorial','studio','poster'])for(const kind of ['decision','evidence','map']){
 const base=JSON.parse(await fs.readFile('artifacts/complex-p0-20261103/composite-'+(kind==='decision'?'decision':kind)+'.json'))
 let seed=base.spec.prefetched
 const id=skin+'-'+kind
 const bindings=seed.map((r,i)=>`<binding id="b${i}" tool="${r.tool}" input={${JSON.stringify(r.input)}} load="manual"/>`).join('')
 const source=`<card visualStyle="frosted-glass" backgroundQuery="soft texture">${bindings}<state id="chosen" type="array" initial={[]}/><task-board id="board" label="${kind==='decision'?'今晚，选一部好电影':kind==='evidence'?'讨论的不同声音':'周末，出发去看看'}" skin="${skin}" layout="${kind}" view={compose({${seed.map((r,i)=>`r${i}:"b${i}"`).join(',')}},{primary:"r0"})} onApply="apply" applyLabel="确认选择"/><action id="apply"><set target="chosen" value={event.ids}/></action></card>`
 const c=compileCard(source,{final:true,context:{expressionDialect:'js-v1'},cardId:id});if(!c.complete)throw Error(JSON.stringify(c.diagnostics));c.spec.prefetched=seed
 const run={id,title:skin+' · '+kind,status:'diagnostic',prompt:'宿主视觉与交互回归：录制真实工具响应；不是新生成，也不代表新的实时查询。',source,spec:c.spec,metadata:{}}
 await fs.writeFile(DEST+'/runs/'+id+'.json',JSON.stringify(run));await fs.writeFile(ROOT+'/'+id+'.json',JSON.stringify(run));manifests.push({id,skin,kind})
}
await fs.writeFile(ROOT+'/gallery.json',JSON.stringify(manifests))
const control=JSON.parse(await fs.readFile(DEST+'/runs/studio-map.json'))
control.id='map-control';control.title='受控地图联动';control.prompt='仅验证地图UI：合成WGS84坐标与测试名称，不是真实景点推荐。底图联网，CLI不执行。'
control.spec.prefetched[0].value.items=[{id:'test-a',name:'测试地点 A',lat:30.20,lon:120.15,coordSystem:'WGS84'},{id:'test-b',name:'测试地点 B',lat:30.205,lon:120.16,coordSystem:'WGS84'}]
await fs.writeFile(DEST+'/runs/map-control.json',JSON.stringify(control))
console.log(manifests.length+' host variants')

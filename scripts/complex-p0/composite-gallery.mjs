import fs from 'node:fs/promises'
import {compileCard} from '../../shared/cardspec/compiler.mjs'
import {ROOT,DEST} from './cases.mjs'
await fs.mkdir(DEST+'/runs',{recursive:true});await fs.mkdir(DEST+'/stitch',{recursive:true})
for(const f of await fs.readdir(ROOT+'/stitch'))if(/\.(png|html|json|txt)$/.test(f))await fs.copyFile(ROOT+'/stitch/'+f,DEST+'/stitch/'+f)
for(const layout of ['map','decision','detail','evidence','compare','plan']){
 const sample=layout==='map'||layout==='plan'?'trip':layout==='evidence'?'sentiment':'movie'
 const r=JSON.parse(await fs.readFile(ROOT+'/'+(sample==='movie'?'round1/':'')+sample+'.json'))
 const seed=r.spec.prefetched.filter(x=>sample==='movie'?x.tool==='opencli.douban.movie-hot':sample==='sentiment'?['opencli.bilibili.search','opencli.xiaohongshu.search'].includes(x.tool):['opencli.ctrip.search','opencli.wttr.forecast','opencli.dianping.search'].includes(x.tool)).filter((r,i,a)=>a.findIndex(x=>x.tool===r.tool)===i)
 const declarations=seed.map((r,i)=>`<binding id="b${i}" tool="${r.tool}" input={${JSON.stringify(r.input)}} load="manual"/>`).join('')
 const source=`<card theme="soft" palette="b" design="atlas">${declarations}<state id="sel" type="string" initial=""/><state id="chosen" type="array" initial={[]}/><derive id="v" value={compose({${seed.map((_,i)=>`r${i}:"b${i}"`).join(',')}},{primary:"r0",selectedId:state.sel})}/><task-board id="board" label="复合结构 · ${layout}" layout="${layout}" view={derived.v} onSelect="pick" onApply="apply" applyLabel="确认选择"/><action id="pick"><set target="sel" value={event.id}/></action><action id="apply"><set target="chosen" value={event.ids}/></action></card>`
 const c=compileCard(source,{final:true,context:{expressionDialect:'js-v1'},cardId:'composite-'+layout});if(!c.complete)throw Error(JSON.stringify(c.diagnostics));c.spec.prefetched=seed
 const out={id:'composite-'+layout,title:'Stitch 宿主实现 · '+layout,status:'diagnostic',prompt:'复合结构UI验收，使用已录制真实工具结果。确认选择验证宿主回调；不宣称生成业务计划。',source,spec:c.spec,metadata:{}}
 await fs.writeFile(DEST+'/runs/'+out.id+'.json',JSON.stringify(out));await fs.writeFile(ROOT+'/'+out.id+'.json',JSON.stringify(out))
}

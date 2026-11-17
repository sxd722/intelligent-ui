import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {compileCard} from '../../shared/cardspec/compiler.mjs';
import {cases,ROOT,DEST} from './cases.mjs';
await fs.mkdir(ROOT+'/calibrated',{recursive:true});
const read=async(id,round='round3')=>JSON.parse(await fs.readFile(ROOT+'/'+round+'/'+id+'.json','utf8'));
async function save(id,source,base,extra={}){
 const context={...base.spec.context,requireDesignChoice:false,bindingPlan:[],requirementLedger:undefined};
 const c=compileCard(source,{final:true,context});if(!c.complete)throw Error(id+': '+JSON.stringify(c.diagnostics));
 c.spec.cardId="convergence-"+id+"-"+createHash("sha256").update(source).digest("hex").slice(0,10);c.spec.prefetched=base.spec.prefetched||[];
 const r={...base,...extra,source,spec:c.spec,metadata:{...base.metadata,card_spec:c.spec,card_deck:undefined},status:'succeeded',authorship:'agent-calibrated-native',verification:'pending',calibration:'根据实际交互与真实来源校准；不是未经修改的模型输出。'};
 await fs.writeFile(ROOT+'/calibrated/'+id+'.cardspec',source);await fs.writeFile(ROOT+'/calibrated/'+id+'.json',JSON.stringify(r,null,2));await fs.writeFile(DEST+'/runs/'+id+'.json',JSON.stringify(r));return r;
}
const earth=await read('earth-sounds','round2');
const source=`<card theme="dark" design="atmospheric" actionMode="snapshot">
<title>地球声音博物馆</title><caption>探索三种声景 · 策展你的三站路线</caption>
<binding id="nature" tool="opencli.archive.search" input={{query:"field recording nature sounds",mediatype:"audio",limit:10}} load="visible"/>
<binding id="city" tool="opencli.archive.search" input={{query:"city street ambience sounds",mediatype:"audio",limit:10}} load="visible"/>
<binding id="voice" tool="opencli.archive.search" input={{query:"human voice oral history recording",mediatype:"audio",limit:10}} load="visible"/>
<binding id="detail" tool="opencli.archive.item" input={{identifier:state.open}} load="manual"/>
<state id="theme" type="string" initial="nature"/><state id="open" type="string" initial=""/><state id="sel" type="array" initial={[]}/><state id="map" type="boolean" initial={true}/>
<derive id="pool" value={(bindings[state.theme].value?.items??[])}/>
<derive id="cur" value={derived.pool.find(x=>x.identifier===state.open)??derived.pool[0]}/>
<derive id="detail" value={(bindings.detail.value?.items??[]).find(x=>x.identifier===derived.cur?.identifier)}/>
<derive id="added" value={state.sel.some(x=>x.identifier===derived.cur?.identifier)}/>
<segmented label="声景" variant="icons" value={state.theme} options={[{value:"nature",label:"自然",icon:"leaf"},{value:"city",label:"城市",icon:"home"},{value:"voice",label:"人声",icon:"music"}]} onChange="theme"/>
<region role="choices" label="真实档案" overflow="scroll">
<each items={derived.pool} as="x" itemKey={x.identifier}><pressable label={x.title} selected={state.open===x.identifier} onPress="pick" args={x}><caption>{x.creator||"未标注作者"}</caption><text clamp={2}>{x.title}</text></pressable></each>
<if test={derived.pool.length===0}><caption>当前主题未取得档案，可稍后重试。</caption><button label="重试" onPress="retry"/></if>
</region>
<region role="focus" label="探索展品">
<if test={state.map}><mindmap label="声景关系" nodes={[{id:"earth",label:"地球声音"},{id:"nature",label:"自然",parentId:"earth"},{id:"city",label:"城市",parentId:"earth"},{id:"voice",label:"人声",parentId:"earth"}]} direction="vertical" selectedId={state.theme} detailMode="external" onSelect="mapPick"/><caption>主题是策展分类；点击左侧档案查看真实内容。</caption></if>
<if test={!state.map && derived.cur}><badge>{state.theme==="nature"?"自然声景":state.theme==="city"?"城市声景":"人类声音"}</badge><strong>{derived.cur.title}</strong><caption>{derived.cur.creator||"作者未标注"} · {derived.cur.date||"日期未标注"}</caption>
<if test={derived.detail}><text clamp={5}>{derived.detail.description||"档案无文字说明"}</text><popover label="完整档案说明"><text>{derived.detail.description||"档案无文字说明"}</text></popover><caption>文件 {derived.detail.file_count??"未知"} · 合集 {derived.detail.collection||"未标注"}</caption></if>
<if test={!derived.detail}><caption>{bindings.detail.status==="loading"?"正在读取档案详情…":bindings.detail.error?"档案详情暂不可用；来源页仍可打开。":"选择展品后读取完整档案。"}</caption></if>
<button label={derived.added?"移出路线":"加入路线"} onPress="add" args={derived.cur} disabled={!derived.added && state.sel.length>=3}/><link url={derived.cur.url} label="打开真实档案"/><button variant="quiet" label="返回声音地图" onPress="back"/></if>
</region>
<region role="result" label="三站路线"><row justify="between"><strong>你的路线 · {state.sel.length}/3</strong><popover label="调整顺序"><each items={state.sel} as="x" itemKey={x.identifier}><text>{x.title}</text><row><button label="上移" onPress="up" args={x}/><button label="移除" onPress="drop" args={x}/></row></each></popover></row><text clamp={2}>{state.sel.length?state.sel.map((x,i)=>(i+1)+". "+x.title).join(" → "):"挑选三个声音，让下一位访客听见你的地球。"}</text></region>
<action id="theme"><set target="theme" value={event.value}/><set target="open" value=""/><set target="map" value={true}/></action>
<action id="mapPick"><set target="theme" value={event.id==="earth"?state.theme:event.id}/><set target="open" value=""/></action>
<action id="pick"><set target="open" value={args.identifier}/><set target="map" value={false}/><invoke binding="detail" input={{identifier:args.identifier}}/></action>
<action id="back"><set target="map" value={true}/></action>
<action id="add"><set target="sel" value={state.sel.some(x=>x.identifier===args.identifier)?state.sel.filter(x=>x.identifier!==args.identifier):state.sel.length<3?state.sel.concat([{...args,theme:state.theme}]):state.sel}/></action>
<action id="drop"><set target="sel" value={state.sel.filter(x=>x.identifier!==args.identifier)}/></action>
<action id="up"><set target="sel" value={state.sel.findIndex(x=>x.identifier===args.identifier)<=0?state.sel:state.sel.map((x,i)=>i===state.sel.findIndex(a=>a.identifier===args.identifier)-1?state.sel[i+1]:i===state.sel.findIndex(a=>a.identifier===args.identifier)?state.sel[i-1]:x)}/></action>
<action id="retry"><invoke binding="nature"/><invoke binding="city"/><invoke binding="voice"/></action>
</card>`;
await save('earth-sounds',source,earth);
const dodo=await read('dodo-detective');let d=dodo.source;
d=d.replace(/<caption>毛里求斯[\s\S]*?<\/caption>/,'<caption>事实 → 假说 → 你的解释</caption>');
d=d.replace('label:"地面巢、单枚卵"','label:"单枚卵的记录"').replace('label:"活体被运往欧洲"','label:"标本被带往欧洲"');
d=d.replace(/<region role="choices"[\s\S]*?<\/region>/,`<region role="choices" label="证据时间线" overflow="scroll"><list presentation="timeline"><each items={derived.clues} as="c" itemKey={c.id}><list-item onPress="open" args={c}><caption>{c.year} · {c.stance===state.hyp?"相关线索":c.stance==="unknown"?"不确定":"其他压力"}{state.bag.includes(c.id)?" · ✓":""}</caption><strong>{c.label}</strong></list-item></each></list></region>`);
d=d.replace('<caption>原文：{derived.current.quote}</caption>','');
d=d.replaceAll('支持当前假说','与当前假说相关').replaceAll('支持其他假说','与其他假说相关');
d=d.replace(/<region role="result"[\s\S]*?<\/region>/,`<region role="result" label="当前推论"><row justify="between"><strong>证据夹 · {state.bag.length} 条</strong><popover label="写下解释"><input label="我的解释" value={state.note} onChange="writeNote"/><text>{derived.verdict}</text><caption>{derived.gap}</caption></popover></row><caption>相关 {derived.supportCount} · 不确定 {derived.unsureCount} · 其他压力 {derived.otherCount}</caption><text clamp={2}>{state.note||derived.gap}</text></region>`);
d=d.replace('<text>{derived.current.fact}</text>', '<button label={state.bag.includes(derived.current.id)?"移出证据夹":"加入证据夹"} onPress="toggleBag" args={derived.current}/><text>{derived.current.fact}</text>');
d=d.replace(/<row>\s*<button label=\{state.bag.includes\(derived.current.id\)[\s\S]*?<link/, '<row><link');
// Keep the bag inspector beside the outcome, not among primary filters.
d=d.replace(/\s*<region role="details"[\s\S]*?<\/region>/,'');
await save('dodo-detective',d,dodo);
console.log('native calibrations written');

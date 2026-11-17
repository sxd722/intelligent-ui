import {mkdir,writeFile} from 'node:fs/promises'
import {compileCard} from '../shared/cardspec/compiler.mjs'
const root='artifacts/subject-composition-qa';await mkdir(root,{recursive:true})
const cases=[
 {id:'rail',title:'两条高铁，一次选择',subjects:[{id:'sh',title:'北京 → 上海',from:'北京南',to:'上海虹桥',city:'Shanghai',imageQuery:'high speed train'},{id:'hz',title:'北京 → 杭州',from:'北京南',to:'杭州东',city:'Hangzhou',imageQuery:'hangzhou lake'}],roles:{车次:'a',天气:'b'},tools:['opencli.12306.trains','opencli.wttr.current'],inputs:['{from:derived.cur.from,to:derived.cur.to,date:"2026-11-14"}','{location:derived.cur.city}'],rows:s=>[Array.from({length:7},(_,i)=>({code:'G'+(s.id==='sh'?i+1:i+101),train_no:'train-'+s.id+'-'+i,from_station:s.from,to_station:s.to,start_time:'08:00',arrive_time:'12:54',duration:'04:54',second_seat:'有'})),[{location:s.city,description:'多云',tempC:s.id==='sh'?12:18}]]},
 {id:'travel',title:'地点、周边与天气',subjects:[{id:'lake',title:'湘湖',query:'湘湖',city:'Hangzhou',imageQuery:'lake lakeside'},{id:'park',title:'西溪湿地',query:'西溪湿地',city:'Hangzhou',imageQuery:'wetland reeds'}],roles:{游玩:'a',周边:'b',天气:'c'},tools:['opencli.ctrip.search','opencli.dianping.search','opencli.wttr.current'],inputs:['{query:derived.cur.query}','{keyword:derived.cur.query,city:"杭州"}','{location:derived.cur.city}'],rows:s=>[[{id:s.id,name:s.title,address:'测试地点介绍',score:4.6}],[{shop_id:s.id+'-food',name:s.title+'附近餐厅',rating:4.4,price:80,address:'测试餐厅位置'}],[{location:'Hangzhou',description:'晴',tempC:18}]]},
 {id:'reading',title:'书内片段与相关讲解',subjects:[{id:'lock',title:'互斥锁',query:'互斥锁',imageQuery:'computer circuits'},{id:'cache',title:'缓存',query:'缓存',imageQuery:'computer memory'}],roles:{书内片段:'a',讲解视频:'b'},tools:['opencli.weread.book-search','opencli.bilibili.search'],inputs:['{book:"计算机系统",query:derived.cur.query,limit:3}','{query:derived.cur.query,limit:3}'],rows:s=>[[{book_title:'计算机系统',chapter_title:s.title+'的案例',snippet:s.title+'：这是可控测试用的不同解释文本。'}],[{bvid:'BV1abc',title:s.title+'的图解视频',author:'测试作者',play:102,url:'https://www.bilibili.com/video/BV1abc'}]]}
]
const out=[]
for(const c of cases){
 const bind=c.tools.map((tool,i)=>`<binding id="${'abc'[i]}" tool="${tool}" input={${c.inputs[i]}} initial={{items:[],source:"",fetchedAt:"",truncated:false}} load="visible"/>`).join('\n')
 const source=`<card schemaVersion="1" design="business"><data id="subjects" value={${JSON.stringify(c.subjects)}}/><state id="selected" type="string" initial="${c.subjects[0].id}"/><derive id="cur" value={data.subjects.find(x=>x.id===state.selected)}/>${bind}<title>${c.title}</title><segmented label="当前对象" value={state.selected} options={data.subjects.map(x=>({value:x.id,label:x.title}))} onChange="pick"/><task-board id="joined" label="联动资料" view={compose(${JSON.stringify(c.roles)},{subject:derived.cur})}/><action id="pick"><set target="selected" value={event.value}/></action></card>`
 const compiled=compileCard(source,{final:true,cardId:'subject-'+c.id,context:{expressionDialect:'js-v1',renderMode:'native',cardSize:'full'}})
 if(!compiled.complete)throw Error(JSON.stringify(compiled.diagnostics))
 const snapshots=c.subjects.flatMap(s=>c.tools.map((tool,i)=>({tool,input:Function('derived','return ('+c.inputs[i]+')')({cur:s}),value:{items:c.rows(s)[i],source:'CONTROLLED_FIXTURE_NOT_LIVE',fetchedAt:'2026-11-13T00:00:00Z',truncated:false}})))
 out.push({...c,source,spec:compiled.spec,snapshots});await writeFile(root+'/'+c.id+'.cardspec',source)
}
await writeFile(root+'/fixtures.json',JSON.stringify(out,null,2));console.log(out.map(c=>c.id))

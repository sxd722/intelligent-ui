import { validateMermaidSource } from './mermaid-policy.mjs'

const selection={onChange:{value:'string'}}
const options='strings or {value:string,label:string}[], unique values, 1–40 options'
const selectExample='<select label="时段" value={state.slot} options={["上午","下午"]} onChange="choose"/>; choose动作set slot={event.value}'
export const CONTRACTS = {
  experience:{required:['preset'],purpose:'渐进探索/多选比较/规划/模拟的组合壳；宿主管理筛选、选择、分页、原始资料及恢复',
   shape:'items为稳定id/rowKey记录；fields最多3个、facets最多3个真实标量字段；groupBy显示当前样本计数。visual=map直接接受latitude/longitude或lat/lon、lat/lng数字，无需改名或过滤：缺坐标不标点，显示缺失数并保留候选。compare/planner默认多选；selectedIds配onSelect受控；仅onApply时可先编辑草稿，selectedIds变化重置草稿。',
   behavior:'自带概览/候选/已选/原文视图、搜索、每页3项、图片与选择恢复；不再手写同套筛选分页。子组件常驻各视图，长表单应另设view，不能塞在地图下；宿主历史/后续按钮也占卡内空间。maxSelected为1–50整数，限制多选但始终允许取消；筛选不清空选择。planner的onApply携带完整event.items，接action保存或生成；simulator子树放logic，不自动计算。统计仅限当前样本。',
   events:{onSelect:{id:'string',value:'string',item:'object',ids:'array',items:'array'},onApply:{ids:'array',items:'array'}}},
  map:{required:['items'],purpose:'按真实坐标绘制可点击位置示意（非路线/街道地图）；缺坐标明确提示',
   shape:'items有唯一id/rowKey、title/name，坐标接受latitude/longitude或lat/lon、lat/lng数字；缺坐标跳过标点并提示数量。不编造或用0填缺失坐标。',events:{onSelect:{id:'string',value:'string',item:'object'}}},
  countdown:{required:['target'],purpose:'绝对时刻倒计时；宿主走时，恢复页面自动校准',behavior:'target为带Z或±HH:mm时区的ISO字符串；空串显示待确认。不推测官方起售时间，用户设置须在label注明；不触发工具或购买。datetime-local无时区，明确北京时间时拼接+08:00。'},
  copy:{required:['value'],purpose:'用户点击复制文本；失败显示可手动复制文本'},
  heatmap:{required:['label','rows','columns','values'],purpose:'可选中单元的数值矩阵；正负值以双色表达',shape:'rows/columns为1–12个唯一{id,label}；values为对应行列二维数组，有限数字或null（未知）；事件onSelect={rowId,columnId,value}，选中用selectedRow/selectedColumn',events:{onSelect:{rowId:'string',columnId:'string',value:'number|null'}}},
  sandbox:{required:['brief'],purpose:'高阶React/SVG视觉，仅hybrid模式。源码随整卡生成并预编译，无后续模型调用，不要求fallback。',behavior:'至多一个，显式id，不放each/logic/slot内，不嵌套。source固定JSX字符串，export default App({data,state,setState,bridge})，无imports/网络/DOM。brief简短说明；input显式JSON，actions固定别名到宿主action映射，initial局部状态，height=160–480。可选子组件不要求模型重复实现。'},
  collection:{required:['items'],purpose:'长候选集合的渐进披露；宿主提供搜索、按尺寸分组（方形每页2项/自然4项）、选择和完整详情',shape:'items为含稳定id或rowKey的对象数组；fields可选1–3个字段名，groupBy可选真实分组字段。titleKey可选标题字段，presentation=compact/gallery/timeline/poster/folio/spread；folio为章节插画，spread为三牌选择，revealed可绑定布尔状态；subtitleKey绑定短解释；poster用timeKey/subtitleKey指定时间和短标签字段，partial声明部分数据。真实图片自动读取assetRef。',events:{onSelect:{id:'string',value:'string',item:'object'}},behavior:'selectedId可受控，detailMode="external"隐藏内置详情；onSelect可省略；声明时event.item为完整选中行，event.id为rowKey或id。不要再加分页按钮。',example:'<collection label="候选" items={bindings.result.value.items} fields={["rating","year"]} onSelect="pick"/>'},
  logic:{required:['initial','source'],purpose:'复杂本地模拟/多步规则；普通表单仍用action',behavior:'initial为局部JSON对象；source为仅包含function update(state,event,input){...;return state}的JS字符串，可直接修改独立state草稿。内部UI用local.xxx；onPress/onChange等为局部事件名，无需action声明；函数读event.type/event.value/event.args。input显式传数据，默认{}。不能访问DOM/网络/工具/定时器，必须同步返回JSON对象。可直接用numeric.matmul(a,b)、numeric.softmax(vector)、numeric.norm(vector)（LayerNorm，减均值后除以标准差，ε=1e-5）、numeric.gelu(vector)；优先复用这些纯数值函数；矩阵/向量最多64维，有限数字，矩阵维度必须匹配。reactive={true}在完整卡可见时发送init及input变化事件，函数统一重算；恢复时保留用户选择。actions={{局部事件名:"宿主actionId"}}只在该用户事件计算成功后调用宿主，event.result为局部结果、event.input为本次输入；自动init/input/tick绝不调用宿主。宿主原子提交、恢复状态、局部报错。处理event.type==="tick"或switch(event.type)的tick分支时，宿主默认500ms提供播放/暂停/单步，可选tickMs=250–2000覆盖；event.dt为固定步长，离页暂停。不嵌套logic/slot，最多4个；图片仅assetRef，外链和图片查询放容器外。',example:'<logic id="heat" initial={{temp:20}} source={"function update(state,event,input){ if(event.type===\'heat\') state.temp+=5; return state; }"}><stat label="温度" value={local.temp} motion="emphasis"/><button onPress="heat">加热</button></logic>'},
  clock:{required:['timeZone'],purpose:'实时世界时钟；宿主自动走时与夏令时，按设备时间显示',behavior:'timeZone用IANA名称，例如Europe/Dublin、Europe/Helsinki、Asia/Shanghai；format默认HH:mm，可HH:mm:ss，showDate默认true。不可用硬编码时间、UTC偏移或手动推进模拟实时钟；天气独立binding refresh={3600}每小时刷新。',example:'<clock label="都柏林" timeZone="Europe/Dublin"/>'},
  region:{purpose:'语义区域；内容、摘要或操作',behavior:'scroll/paginate填剩余空间；details模态展开；magazine长文分片'},
  box:{purpose:'纵向组合容器；横向请用row'}, stack:{purpose:'纵向容器，不是滑动卡堆'}, row:{purpose:'横向排列；wrap允许换行'},
  grid:{purpose:'等分网格，columns默认2，范围1–12'},'grid-item':{purpose:'真实容器，可span/rowSpan；不是透明格'},
  title:{purpose:'主标题'},text:{purpose:'正文，允许strong/emphasis/code行内组合'},caption:{purpose:'次要说明'},strong:{purpose:'行内粗体'},emphasis:{purpose:'行内斜体'},
  code:{purpose:'代码字面内容；block默认false',example:'<code value={"const x = 1"} block={true} language="js"/>'},
  math:{required:['value'],purpose:'数学公式，KaTeX，block默认false；不含$分隔符',behavior:'表达式字符串内反斜杠写成\\\\，如value={"\\\\frac{a}{b}"}'},
  icon:{required:['name'],purpose:'图标名称限sprout,leaf,search,check,x,info,help-circle,chevron-left,chevron-right,sunrise,sparkles,star,heart,sun,moon,clock,thermometer,scissors,home,book-open,flag,droplet,bulb,book,alert,arrow-right,plus,music；别猜其它名称'},
  badge:{purpose:'简短状态标记'},divider:{purpose:'柔和分隔'},spacer:{purpose:'剩余空间弹性占位'},
  button:{events:{onPress:{}},purpose:'短操作；上下文通过args显式传入'},pressable:{events:{onPress:{}},purpose:'可选择内容区域；不嵌套其它交互控件'},chip:{events:{onPress:{}},purpose:'紧凑选项，选中用selected'},chips:{purpose:'一组短选项，长选项用radio-group'},
  input:{required:['label'],events:{onChange:{value:'string; inputType=number时number',text:'string'}},purpose:'单行输入；date可选择日期'},
  textarea:{required:['label'],events:{onChange:{value:'string'}},purpose:'多行文本'},
  checkbox:{required:['label'],events:{onChange:{checked:'boolean',value:'boolean'}},purpose:'独立勾选'},toggle:{required:['label'],events:{onChange:{checked:'boolean',value:'boolean'}},purpose:'开关'},
  segmented:{required:['label','options'],events:selection,shape:options,purpose:'少量短选项的滑动分段器；横向可滚动'},
  select:{required:['label','options'],events:selection,shape:options,purpose:'紧凑下拉单选',example:selectExample},
  'radio-group':{required:['label','options'],events:selection,shape:options,purpose:'纵向单选，适合长选项；value为稳定字符串'},
  table:{required:['label','columns','rows'],events:{onSelect:{id:'string',row:'object'}},shape:'columns=[{key:string,label:string,format?:text|number|currency}], rows=[{id:string,...cells}]，1–8列/最多100行，单元格为标量',purpose:'比较和明细；宿主横向滚动/表头/行选择',example:'<table label="价格" columns={[{key:"name",label:"商品"},{key:"price",label:"元",format:"number"}]} rows={[{id:"a",name:"苹果",price:3}]}/>'},
  popover:{required:['label'],events:{onOpenChange:{open:'boolean'}},purpose:'轻量锚定浮层；open省略时宿主管理；Escape/外点关闭，长正文用details'},
  'swipe-stack':{required:['label','items','onSwipe'],events:{onSwipe:{id:'string',index:'number',direction:'left|right',item:'object'}},shape:'items=[{id:string,title:string,description?:string}],最多40项',purpose:'左右滑动选择卡堆，有等价按钮；index默认0',behavior:'受控index需要动作set index={event.index+1}；末尾显示完成，不自动重复',example:'<swipe-stack label="知识取舍" items={data.choices} index={state.pos} onSwipe="decide" leftLabel="跳过" rightLabel="收藏"/>'},
  confetti:{required:['trigger'],purpose:'一次性庆祝反馈；trigger使用递增计数state，不用常量true',behavior:'初次挂载不播放；trigger改变只播一次，减少动画模式仅文字反馈'},
  mermaid:{required:['label','source'],events:{onSelect:{id:'string',label:'string',value:'string'}},purpose:'Mermaid流程/状态/时序/类/ER/XY图；语法子集，宿主配色、全貌与缩放',shape:'source为字符串，换行用\\n，最多6000字符/40实体；selectedId为图中实体ID，XY只展示/tooltip',behavior:'仅flowchart/graph/stateDiagram-v2/sequenceDiagram/classDiagram/erDiagram/xychart-beta；禁click、style、classDef、HTML、URL和初始化配置；onSelect可省略，宿主仍可选中；外部详情用detailMode="external"；声明onSelect必须定义对应action',example:'<mermaid label="请求流程" source={"flowchart TD\\n A[请求] --> B[响应]"}/>'},
  list:{purpose:'语义列表'},'list-item':{purpose:'列表项；可用onPress+args选择，label显示为标题，子组件为补充内容；可点击项内不嵌套其他控件',events:{onPress:{}}},progress:{purpose:'0–1进度，已带label和百分比'},stats:{purpose:'紧凑指标网格'},stat:{purpose:'值与标签'},
  carousel:{events:{onIndexChange:{index:'number',value:'number'}},purpose:'横向展示，内置导航，高度按全部页测量后固定；有图则上图下文'},'carousel-item':{purpose:'轮播页面，备注状态用item.id保存'},
  navigation:{required:['target'],purpose:'移动已有导航的位置；不新建页码状态'},
  slider:{required:['label'],events:{onChange:{value:'number'}},purpose:'连续参数；默认min=0,max=100,step=1'},
  mindmap:{required:['label','nodes'],events:{onSelect:{id:'string',value:'string'}},shape:'nodes=[{id,label,parentId?,description?}]，恰好一个根，其余有parentId；最多40',purpose:'有明确父子关系的树，不用于平铺文章目录'},
  flowchart:{required:['label','nodes','edges'],events:{onSelect:{id:'string',value:'string'}},shape:'nodes=[{id,label,description?}],edges=[{from,to,label?,value?:number}]；边value用于正负颜色和相对粗细，节点可带value数值，最多40节点80边，可有环',purpose:'简单可控流程，复杂时序/ER用mermaid'},
  chart:{required:['label','data'],events:{onSelect:{id:'string',value:'number',label:'string',series:'string',recordIds:'array'}},shape:'data=[{id,label,value:number,series?:string,recordIds?:string[]}]最多40点；多系列共用label，kind=stacked仅非负计数；proportion用于1–4个非负部分，共同形成整体；comparison为正负横向共用刻度，scaleMax指定固定绝对上限，须覆盖所有值',purpose:'bar/line受控数值图；需要点击数值时优先用此组件'},
  image:{purpose:'query（Pexels示意）或assetRef（工具返回的真实来源图片）二选一，mediaRole=hero/thumbnail/gallery；不接受src或URL',example:'<image assetRef={item.assetRef} alt={item.title} mediaRole="thumbnail"/>'},link:{required:['url'],purpose:'已知HTTP/HTTPS来源链接'},
  calendar:{events:{onSelect:{date:'string',value:'string'},onMonthChange:{month:'YYYY-MM',date:'YYYY-MM-DD'}},purpose:'完整月历，自带换月',shape:'markedDates为日期字符串数组；month为YYYY-MM'},
  each:{required:['items','itemKey'],purpose:'集合模板；itemKey稳定唯一，as默认item'},if:{required:['test'],purpose:'boolean条件视图；不是动作步骤'},
}
export function capabilityReference() {
  return '【组件能力目录】\n'+Object.entries(CONTRACTS).map(([name,c])=>`${name}: ${c.purpose||c.behavior||''}`).join('\n')
}
export function validateContract(type,p) {
  if(type==='chart'&&p.kind==='comparison'){
    if(p.data.some(d=>d.series))throw Error('comparison expects one value per item, without series')
    if(p.scaleMax!==undefined&&(!Number.isFinite(p.scaleMax)||p.scaleMax<=0||p.data.some(d=>Math.abs(d.value)>p.scaleMax)))throw Error('scaleMax must be positive and cover all values')
  }
  if(type==='chart'&&p.kind==='proportion'){
    if(!Array.isArray(p.data)||p.data.length>4)throw Error('proportion requires at most 4 parts')
    for(const [i,d] of p.data.entries()){
      if(!Number.isFinite(d.value))throw Error(`chart.data[${i}].value must be a number, received ${typeof d.value}. Use derived.x or state.x directly inside expressions, not {x} (an object).`)
      if(d.value<0||d.series)throw Error('proportion requires non-negative parts without series; use bar/line for signed values')
    }
  }
  if(type==='image'&&p.assetRef!=null&&(typeof p.assetRef!=='string'||!/^asset\.v1\.[\w-]+\.[\w-]+$/.test(p.assetRef)||p.assetRef.length>3000))throw Error('image.assetRef must be a host-issued reference')
  if(type==='clock') new Intl.DateTimeFormat('en-GB',{timeZone:p.timeZone}).format(0)
  // Required attributes are checked structurally by the compiler, including
  // itemKey which must be evaluated in an item scope rather than here.
  if(['segmented','select','radio-group'].includes(type)) {
    if(!Array.isArray(p.options)||!p.options.length||p.options.length>40) throw new Error(`${type}.options requires 1–40 options`)
    const values=p.options.map(o=>o&&typeof o==='object'?o.value:o)
    const valueTypes=type==='segmented'?['string','number','boolean']:['string']
    if(values.some((v,i)=>!valueTypes.includes(typeof v)||(typeof p.options[i]==='object'&&(!p.options[i]||typeof p.options[i].label!=='string')))||new Set(values).size!==values.length) throw new Error(`${type}.options requires unique strings or {value:string,label:string}; not id/label`)
  }
  if(type==='table') {
    if(!Array.isArray(p.columns)||!p.columns.length||p.columns.length>8||p.columns.some(c=>!c||typeof c.key!=='string'||typeof c.label!=='string'||(c.format&&!['text','number','currency'].includes(c.format)))||new Set(p.columns.map(c=>c.key)).size!==p.columns.length) throw new Error('table.columns requires 1–8 unique {key,label,format?} columns')
    if(!Array.isArray(p.rows)||p.rows.length>100||p.rows.some(r=>!r||typeof r.id!=='string'||!r.id)||new Set(p.rows.map(r=>r.id)).size!==p.rows.length) throw new Error('table.rows requires at most 100 rows with unique string id')
    if(p.rows.some(r=>p.columns.some(c=>r[c.key]!=null&&!['string','number','boolean'].includes(typeof r[c.key])))) throw new Error('table cells must be scalar')
  }
  if(type==='swipe-stack') {
    if(!Array.isArray(p.items)||p.items.length>40||p.items.some(i=>!i||typeof i.id!=='string'||!i.id||typeof i.title!=='string'||(i.description!=null&&typeof i.description!=='string'))||new Set(p.items.map(i=>i.id)).size!==p.items.length) throw new Error('swipe-stack.items requires at most 40 unique {id,title,description?}')
    if(p.index!=null&&(!Number.isInteger(p.index)||p.index<0||p.index>p.items.length)) throw new Error('swipe-stack.index must be 0..items.length')
  }
  if(type==='mermaid') validateMermaidSource(p.source)
  if(type==='math' && p.value.length>2000) throw new Error('math.value exceeds 2000 characters')
}
// The compiler probes event payloads from the same contract supplied to GLM.
export function eventSamples(type,p,context={}) {
  const first=p.options?.[0], item=p.items?.[p.index||0], node=p.nodes?.[0], point=p.data?.[0]
  const values={
    calendar:{onSelect:{date:p.selectedDate||context.localDate,value:p.selectedDate||context.localDate},onMonthChange:{month:p.month||context.localDate?.slice(0,7),date:p.selectedDate||context.localDate}},
    slider:{onChange:{value:p.value??p.min??0}},
    mindmap:{onSelect:{id:node?.id,value:node?.id}},flowchart:{onSelect:{id:node?.id,value:node?.id}},
    chart:point?{onSelect:{id:point.id,value:point.value,label:point.label,series:point.series||'',recordIds:point.recordIds||[]}}:{},
    heatmap:p.rows?.length&&p.columns?.length?{onSelect:{rowId:p.rows[0].id,columnId:p.columns[0].id,value:p.values?.[0]?.[0]??null}}:{},
    carousel:{onIndexChange:{index:p.index||0,value:p.index||0}},
    input:{onChange:{value:p.inputType==='number'?Number(p.value||0):String(p.value||''),text:String(p.value||'')}},
    textarea:{onChange:{value:String(p.value||'')}},
    checkbox:{onChange:{checked:!p.checked,value:!p.checked}},toggle:{onChange:{checked:!p.checked,value:!p.checked}},
    segmented:{onChange:{value:first?.value??first}},select:{onChange:{value:first?.value??first}},'radio-group':{onChange:{value:first?.value??first}},
    collection:p.items?.length?{onSelect:{id:p.items[0].rowKey??p.items[0].id,value:p.items[0].rowKey??p.items[0].id,item:p.items[0]}}:{},
    map:p.items?.length?{onSelect:{id:String(p.items[0].rowKey??p.items[0].id),value:String(p.items[0].rowKey??p.items[0].id),item:p.items[0]}}:{},
    experience:{onSelect:{id:String(p.items?.[0]?.rowKey??p.items?.[0]?.id??''),value:String(p.items?.[0]?.rowKey??p.items?.[0]?.id??''),item:p.items?.[0]||{},ids:p.items?.length?[String(p.items[0].rowKey??p.items[0].id)]:[],items:p.items?.slice(0,1)||[]},onApply:{ids:p.items?.length?[String(p.items[0].rowKey??p.items[0].id)]:[],items:p.items?.slice(0,1)||[]}},
    table:p.rows?.length?{onSelect:{id:p.rows[0].id,row:p.rows[0]}}:{},
    'swipe-stack':item?{onSwipe:{id:item.id,index:p.index||0,direction:'right',item}}:{},
    popover:{onOpenChange:{open:!p.open}},
    // Mermaid samples are extracted from actual rendered SVG on the server.
    mermaid:{},button:{onPress:{}},chip:{onPress:{}},pressable:{onPress:{}},
  }
  return values[type]||{}
}

# 当前组件契约（自动导出）

属性类型是求值后的类型；表达式还须通过编译器。完整业务校验见 contracts.mjs。

```text
所有组件共有：id:id priority:required|supporting|decorative size:small|normal|large tone:default|muted|success|warning|danger|info visible:boolean grow:boolean motion:none|fade|slide|emphasis motionKey:scalar surface:plain|soft|outlined|bare
布局属性组：space:tight|normal|loose align:start|center|end|stretch|baseline justify:start|center|end|between wrap:boolean surface:plain|soft|outlined|bare grow:boolean
<experience> preset:explore|compare|planner|simulator label:string items:array fields:array facets:array groupBy:string titleKey:string visual:list|map multiple:boolean selectedIds:array maxSelected:number partial:boolean onSelect:action onApply:action applyLabel:string args:json; children=flow; 必填=preset; 渐进探索/多选比较/规划/模拟的组合壳；宿主管理筛选、选择、分页、原始资料及恢复; 数据=items为稳定id/rowKey记录；fields最多3个、facets最多3个真实标量字段；groupBy显示当前样本计数。visual=map直接接受latitude/longitude或lat/lon、lat/lng数字，无需改名或过滤：缺坐标不标点，显示缺失数并保留候选。compare/planner默认多选；selectedIds配onSelect受控；仅onApply时可先编辑草稿，selectedIds变化重置草稿。; 事件={"onSelect":{"id":"string","value":"string","item":"object","ids":"array","items":"array"},"onApply":{"ids":"array","items":"array"}}; 自带概览/候选/已选/原文视图、搜索、每页3项、图片与选择恢复；不再手写同套筛选分页。子组件常驻各视图，长表单应另设view，不能塞在地图下；宿主历史/后续按钮也占卡内空间。maxSelected为1–50整数，限制多选但始终允许取消；筛选不清空选择。planner的onApply携带完整event.items，接action保存或生成；simulator子树放logic，不自动计算。统计仅限当前样本。
<map> label:string items:array selectedId:scalar onSelect:action args:json; children=none; 必填=items; 按真实坐标绘制可点击位置示意（非路线/街道地图）；缺坐标明确提示; 数据=items有唯一id/rowKey、title/name，坐标接受latitude/longitude或lat/lon、lat/lng数字；缺坐标跳过标点并提示数量。不编造或用0填缺失坐标。; 事件={"onSelect":{"id":"string","value":"string","item":"object"}}
<sandbox> brief:string source:string input:object initial:object actions:object height:number label:string; children=flow; 必填=brief; 高阶React/SVG视觉，仅hybrid模式。源码随整卡生成并预编译，无后续模型调用，不要求fallback。; 至多一个，显式id，不放each/logic/slot内，不嵌套。source固定JSX字符串，export default App({data,state,setState,bridge})，无imports/网络/DOM。brief简短说明；input显式JSON，actions固定别名到宿主action映射，initial局部状态，height=160–480。可选子组件不要求模型重复实现。
<collection> items:array label:string titleKey:string presentation:compact|gallery|timeline|poster|folio|spread revealed:boolean timeKey:string subtitleKey:string fields:array groupBy:string partial:boolean selectedId:scalar detailMode:inline|external onSelect:action args:json; children=none; 必填=items; 长候选集合的渐进披露；宿主提供搜索、按尺寸分组（方形每页2项/自然4项）、选择和完整详情; 数据=items为含稳定id或rowKey的对象数组；fields可选1–3个字段名，groupBy可选真实分组字段。titleKey可选标题字段，presentation=compact/gallery/timeline/poster/folio/spread；folio为章节插画，spread为三牌选择，revealed可绑定布尔状态；subtitleKey绑定短解释；poster用timeKey/subtitleKey指定时间和短标签字段，partial声明部分数据。真实图片自动读取assetRef。; 事件={"onSelect":{"id":"string","value":"string","item":"object"}}; selectedId可受控，detailMode="external"隐藏内置详情；onSelect可省略；声明时event.item为完整选中行，event.id为rowKey或id。不要再加分页按钮。
例：<collection label="候选" items={bindings.result.value.items} fields={["rating","year"]} onSelect="pick"/>
<logic> initial:object input:object source:string label:string tickMs:number reactive:boolean actions:object; children=flow; 必填=initial,source; 复杂本地模拟/多步规则；普通表单仍用action; initial为局部JSON对象；source为仅包含function update(state,event,input){...;return state}的JS字符串，可直接修改独立state草稿。内部UI用local.xxx；onPress/onChange等为局部事件名，无需action声明；函数读event.type/event.value/event.args。input显式传数据，默认{}。不能访问DOM/网络/工具/定时器，必须同步返回JSON对象。可直接用numeric.matmul(a,b)、numeric.softmax(vector)、numeric.norm(vector)（LayerNorm，减均值后除以标准差，ε=1e-5）、numeric.gelu(vector)；优先复用这些纯数值函数；矩阵/向量最多64维，有限数字，矩阵维度必须匹配。reactive={true}在完整卡可见时发送init及input变化事件，函数统一重算；恢复时保留用户选择。actions={{局部事件名:"宿主actionId"}}只在该用户事件计算成功后调用宿主，event.result为局部结果、event.input为本次输入；自动init/input/tick绝不调用宿主。宿主原子提交、恢复状态、局部报错。处理event.type==="tick"或switch(event.type)的tick分支时，宿主默认500ms提供播放/暂停/单步，可选tickMs=250–2000覆盖；event.dt为固定步长，离页暂停。不嵌套logic/slot，最多4个；图片仅assetRef，外链和图片查询放容器外。
例：<logic id="heat" initial={{temp:20}} source={"function update(state,event,input){ if(event.type==='heat') state.temp+=5; return state; }"}><stat label="温度" value={local.temp} motion="emphasis"/><button onPress="heat">加热</button></logic>
<countdown> target:string label:string expiredLabel:string; children=none; 必填=target; 绝对时刻倒计时；宿主走时，恢复页面自动校准; target为带Z或±HH:mm时区的ISO字符串；空串显示待确认。不推测官方起售时间，用户设置须在label注明；不触发工具或购买。datetime-local无时区，明确北京时间时拼接+08:00。
<copy> value:string label:string; children=none; 必填=value; 用户点击复制文本；失败显示可手动复制文本
<heatmap> label:string rows:array columns:array values:array selectedRow:scalar selectedColumn:scalar onSelect:action args:json; children=none; 必填=label,rows,columns,values; 可选中单元的数值矩阵；正负值以双色表达; 数据=rows/columns为1–12个唯一{id,label}；values为对应行列二维数组，有限数字或null（未知）；事件onSelect={rowId,columnId,value}，选中用selectedRow/selectedColumn; 事件={"onSelect":{"rowId":"string","columnId":"string","value":"number|null"}}
<clock> timeZone:string label:string format:HH:mm|HH:mm:ss showDate:boolean; children=none; 必填=timeZone; 实时世界时钟；宿主自动走时与夏令时，按设备时间显示; timeZone用IANA名称，例如Europe/Dublin、Europe/Helsinki、Asia/Shanghai；format默认HH:mm，可HH:mm:ss，showDate默认true。不可用硬编码时间、UTC偏移或手动推进模拟实时钟；天气独立binding refresh={3600}每小时刷新。
例：<clock label="都柏林" timeZone="Europe/Dublin"/>
<slot> label:string; children=flow
<region> 支持布局属性组；role:summary|content|actions overflow:scroll|paginate|details label:string resetKey:scalar navigation:auto|external presentation:plain|magazine; children=flow; 语义区域；内容、摘要或操作; scroll/paginate填剩余空间；details模态展开；magazine长文分片
<stack> 支持布局属性组；; children=flow; 纵向容器，不是滑动卡堆
<box> 支持布局属性组；; children=flow; 纵向组合容器；横向请用row
<row> 支持布局属性组；; children=flow; 横向排列；wrap允许换行
<grid> 支持布局属性组；columns:integer(1–12); children=flow; 等分网格，columns默认2，范围1–12
<grid-item> 支持布局属性组；span:integer(1–12) rowSpan:integer(1–12); children=flow; 真实容器，可span/rowSpan；不是透明格
<title> align:start|center|end; children=inline; 主标题
<text> clamp:integer(1–6) align:start|center|end; children=inline; 正文，允许strong/emphasis/code行内组合
<caption> align:start|center|end; children=inline; 次要说明
<strong> ; children=inline; 行内粗体
<emphasis> ; children=inline; 行内斜体
<code> value:string block:boolean language:string; children=inline; 代码字面内容；block默认false
例：<code value={"const x = 1"} block={true} language="js"/>
<math> value:string block:boolean; children=none; 必填=value; 数学公式，KaTeX，block默认false；不含$分隔符; 表达式字符串内反斜杠写成\\，如value={"\\frac{a}{b}"}
<badge> ; children=inline; 简短状态标记
<icon> name:string label:string; children=none; 必填=name; 图标名称限sprout,leaf,search,check,x,info,help-circle,chevron-left,chevron-right,sunrise,sparkles,star,heart,sun,moon,clock,thermometer,scissors,home,book-open,flag,droplet,bulb,book,alert,arrow-right,plus,music；别猜其它名称
<divider> ; children=none; 柔和分隔
<spacer> ; children=none; 剩余空间弹性占位
<button> disabled:boolean label:string onPress:action args:json variant:primary|secondary|quiet; children=flow; 短操作；上下文通过args显式传入; 事件={"onPress":{}}
<pressable> 支持布局属性组；disabled:boolean label:string onPress:action args:json selected:boolean; children=flow; 可选择内容区域；不嵌套其它交互控件; 事件={"onPress":{}}
<input> value:scalar label:string placeholder:string inputType:text|number|date|time|datetime-local onChange:action args:json disabled:boolean; children=none; 必填=label; 单行输入；date可选择日期; 事件={"onChange":{"value":"string; inputType=number时number","text":"string"}}
<textarea> value:string label:string placeholder:string onChange:action args:json disabled:boolean; children=none; 必填=label; 多行文本; 事件={"onChange":{"value":"string"}}
<checkbox> checked:boolean label:string onChange:action args:json disabled:boolean; children=none; 必填=label; 独立勾选; 事件={"onChange":{"checked":"boolean","value":"boolean"}}
<toggle> checked:boolean label:string onChange:action args:json disabled:boolean; children=none; 必填=label; 开关; 事件={"onChange":{"checked":"boolean","value":"boolean"}}
<chips> 支持布局属性组；label:string; children=flow; 一组短选项，长选项用radio-group
<chip> disabled:boolean label:string onPress:action args:json selected:boolean; children=inline; 紧凑选项，选中用selected; 事件={"onPress":{}}
<segmented> value:scalar options:array label:string onChange:action args:json; children=none; 必填=label,options; 少量短选项的滑动分段器；横向可滚动; 数据=strings or {value:string,label:string}[], unique values, 1–40 options; 事件={"onChange":{"value":"string"}}
<select> value:string options:array label:string onChange:action args:json disabled:boolean; children=none; 必填=label,options; 紧凑下拉单选; 数据=strings or {value:string,label:string}[], unique values, 1–40 options; 事件={"onChange":{"value":"string"}}
例：<select label="时段" value={state.slot} options={["上午","下午"]} onChange="choose"/>; choose动作set slot={event.value}
<radio-group> value:string options:array label:string onChange:action args:json disabled:boolean; children=none; 必填=label,options; 纵向单选，适合长选项；value为稳定字符串; 数据=strings or {value:string,label:string}[], unique values, 1–40 options; 事件={"onChange":{"value":"string"}}
<table> label:string columns:array rows:array selectedId:scalar onSelect:action args:json; children=none; 必填=label,columns,rows; 比较和明细；宿主横向滚动/表头/行选择; 数据=columns=[{key:string,label:string,format?:text|number|currency}], rows=[{id:string,...cells}]，1–8列/最多100行，单元格为标量; 事件={"onSelect":{"id":"string","row":"object"}}
例：<table label="价格" columns={[{key:"name",label:"商品"},{key:"price",label:"元",format:"number"}]} rows={[{id:"a",name:"苹果",price:3}]}/>
<popover> label:string open:boolean onOpenChange:action args:json; children=flow; 必填=label; 轻量锚定浮层；open省略时宿主管理；Escape/外点关闭，长正文用details; 事件={"onOpenChange":{"open":"boolean"}}
<swipe-stack> label:string items:array index:number onSwipe:action args:json disabled:boolean leftLabel:string rightLabel:string; children=none; 必填=label,items,onSwipe; 左右滑动选择卡堆，有等价按钮；index默认0; 数据=items=[{id:string,title:string,description?:string}],最多40项; 事件={"onSwipe":{"id":"string","index":"number","direction":"left|right","item":"object"}}; 受控index需要动作set index={event.index+1}；末尾显示完成，不自动重复
例：<swipe-stack label="知识取舍" items={data.choices} index={state.pos} onSwipe="decide" leftLabel="跳过" rightLabel="收藏"/>
<confetti> trigger:scalar label:string; children=none; 必填=trigger; 一次性庆祝反馈；trigger使用递增计数state，不用常量true; 初次挂载不播放；trigger改变只播一次，减少动画模式仅文字反馈
<mermaid> label:string source:string selectedId:scalar detailMode:inline|external onSelect:action args:json; children=none; 必填=label,source; Mermaid流程/状态/时序/类/ER/XY图；语法子集，宿主配色、全貌与缩放; 数据=source为字符串，换行用\n，最多6000字符/40实体；selectedId为图中实体ID，XY只展示/tooltip; 事件={"onSelect":{"id":"string","label":"string","value":"string"}}; 仅flowchart/graph/stateDiagram-v2/sequenceDiagram/classDiagram/erDiagram/xychart-beta；禁click、style、classDef、HTML、URL和初始化配置；onSelect可省略，宿主仍可选中；外部详情用detailMode="external"；声明onSelect必须定义对应action
例：<mermaid label="请求流程" source={"flowchart TD\n A[请求] --> B[响应]"}/>
<progress> value:number label:string; children=none; 0–1进度，已带label和百分比
<stats> columns:integer(1–12); children=flow; 紧凑指标网格
<stat> value:scalar label:string; children=none; 值与标签
<list> space:tight|normal|loose label:string; children=flow; 语义列表
<list-item> 支持布局属性组；disabled:boolean label:string onPress:action args:json; children=flow; 列表项；可用onPress+args选择，label显示为标题，子组件为补充内容；可点击项内不嵌套其他控件; 事件={"onPress":{}}
<carousel> label:string index:number onIndexChange:action args:json navigation:auto|external; children=flow; 横向展示，内置导航，高度按全部页测量后固定；有图则上图下文; 事件={"onIndexChange":{"index":"number","value":"number"}}
<carousel-item> 支持布局属性组；; children=flow; 轮播页面，备注状态用item.id保存
<navigation> target:id label:string; children=none; 必填=target; 移动已有导航的位置；不新建页码状态
<slider> label:string value:number min:number max:number step:number unit:string disabled:boolean onChange:action args:json; children=none; 必填=label; 连续参数；默认min=0,max=100,step=1; 事件={"onChange":{"value":"number"}}
<mindmap> label:string nodes:array selectedId:scalar direction:horizontal|vertical detailMode:inline|external onSelect:action args:json; children=none; 必填=label,nodes; 有明确父子关系的树，不用于平铺文章目录; 数据=nodes=[{id,label,parentId?,description?}]，恰好一个根，其余有parentId；最多40; 事件={"onSelect":{"id":"string","value":"string"}}
<flowchart> label:string nodes:array edges:array selectedId:scalar direction:horizontal|vertical detailMode:inline|external onSelect:action args:json; children=none; 必填=label,nodes,edges; 简单可控流程，复杂时序/ER用mermaid; 数据=nodes=[{id,label,description?}],edges=[{from,to,label?,value?:number}]；边value用于正负颜色和相对粗细，节点可带value数值，最多40节点80边，可有环; 事件={"onSelect":{"id":"string","value":"string"}}
<chart> label:string kind:bar|line|stacked|proportion|comparison data:array scaleMax:number unit:string selectedId:scalar onSelect:action args:json; children=none; 必填=label,data; bar/line受控数值图；需要点击数值时优先用此组件; 数据=data=[{id,label,value:number,series?:string,recordIds?:string[]}]最多40点；多系列共用label，kind=stacked仅非负计数；proportion用于1–4个非负部分，共同形成整体；comparison为正负横向共用刻度，scaleMax指定固定绝对上限，须覆盖所有值; 事件={"onSelect":{"id":"string","value":"number","label":"string","series":"string","recordIds":"array"}}
<image> query:string assetRef:scalar alt:string mediaRole:hero|thumbnail|gallery; children=none; query（Pexels示意）或assetRef（工具返回的真实来源图片）二选一，mediaRole=hero/thumbnail/gallery；不接受src或URL
例：<image assetRef={item.assetRef} alt={item.title} mediaRole="thumbnail"/>
<link> url:string label:string; children=inline; 必填=url; 已知HTTP/HTTPS来源链接
<calendar> month:string selectedDate:string markedDates:array onSelect:action onMonthChange:action args:json label:string navigation:auto|external; children=none; 完整月历，自带换月; 数据=markedDates为日期字符串数组；month为YYYY-MM; 事件={"onSelect":{"date":"string","value":"string"},"onMonthChange":{"month":"YYYY-MM","date":"YYYY-MM-DD"}}
<each> items:array as:id itemKey:scalar; children=flow; 必填=items,itemKey; 集合模板；itemKey稳定唯一，as默认item
<if> test:boolean; children=flow; 必填=test; boolean条件视图；不是动作步骤
```

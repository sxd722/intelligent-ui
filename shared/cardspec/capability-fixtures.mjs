// Generic deterministic examples; these fixtures do not execute external tools.
const quoted=JSON.stringify
export const AGGREGATE_SOURCE=`function update(state,event,input){
 const counts={};for(const row of input.rows)counts[row.source]=(counts[row.source]||0)+1;
 state.groups=Object.entries(counts).map(([id,value])=>({id,label:id,value}));state.total=input.rows.length;
 if(event.type==='pick')state.selected=event.id;
 if(event.type==='fault')throw Error('测试失败：保留之前的计算结果');return state;
}`
export const MATRIX_SOURCE=`function update(state,event,input){
 if(event.type==='residual')state.residual=!state.residual;
 if(event.type==='select'){state.row=event.rowId;state.column=event.columnId;}
 const x=[[input.scale,0.5],[-0.5,1]],w=[[0.8,-0.6],[0.4,0.9]],v=[[0.7,0.2],[-0.3,0.8]];
 const hidden=x.map(row=>w[0].map((_,j)=>Math.max(0,row.reduce((s,n,i)=>s+n*w[i][j],0))));state.values=hidden;
 const output=hidden.map((row,k)=>v[0].map((_,j)=>row.reduce((s,n,i)=>s+n*v[i][j],0)+(state.residual?x[k][j]:0)));
 state.output=output;state.total=output[0][0];
 state.nodes=[{id:'input',label:'输入',value:x[0][0]},{id:'hidden',label:'ReLU',value:hidden[0][0]},{id:'output',label:'输出',value:output[0][0]}];
 state.edges=[{from:'input',to:'hidden',label:'W₁',value:w[0][0]},{from:'hidden',to:'output',label:'W₂',value:v[0][0]}];
 if(state.residual)state.edges.push({from:'input',to:'output',label:'残差',value:x[0][0]});return state;
}`
export const CAPABILITY_FIXTURES={
 capabilityData:`<card actionMode="snapshot"><data id="rows" value={[{id:"a",source:"A"},{id:"b",source:"A"},{id:"c",source:"B"}]}/><state id="onlyA" type="boolean" initial={false}/><state id="saved" type="string" initial="未保存"/>
 <title>从数据到交互</title><button onPress="filter">切换来源筛选</button><action id="filter"><toggle target="onlyA"/></action>
 <logic id="aggregate" reactive={true} input={{rows:filter(data.rows,!state.onlyA||item.source=="A")}} initial={{groups:[],total:0,selected:"A"}} actions={{save:"commit"}} source={${quoted(AGGREGATE_SOURCE)}}>
 <chart label="来源样本数" data={local.groups} onSelect="pick"/><caption>样本 {local.total} · 选择 {local.selected}</caption><row><button onPress="save">保存选择</button><button onPress="fault">模拟局部错误</button></row></logic>
 <caption>宿主记录：{state.saved}</caption><action id="commit"><set target="saved" value={event.result.selected+" / "+event.result.total}/></action></card>`,
 capabilityMatrix:`<card actionMode="snapshot"><state id="scale" type="number" initial={1}/><state id="saved" type="number" initial={0}/><title>两 token 的 FFN 实验</title><caption>示例权重：线性 → ReLU → 线性 + 可切换残差</caption>
 <slider label="输入扰动" min={-2} max={2} step={0.5} value={state.scale} onChange="scale"/><action id="scale"><set target="scale" value={event.value}/></action>
 <logic id="matrix" reactive={true} input={{scale:state.scale}} initial={{residual:true,row:"a",column:"h1",values:[[0,0],[0,0]],output:[],total:0,nodes:[{id:"input",label:"输入"},{id:"hidden",label:"ReLU"},{id:"output",label:"输出"}],edges:[]}} actions={{save:"save"}} source={${quoted(MATRIX_SOURCE)}}>
 <heatmap label="隐藏层激活" rows={[{id:"a",label:"token A"},{id:"b",label:"token B"}]} columns={[{id:"h1",label:"h₁"},{id:"h2",label:"h₂"}]} values={local.values} selectedRow={local.row} selectedColumn={local.column} onSelect="select"/>
 <caption>观察 {local.row} / {local.column}；输出首项 {formatNumber(local.total,3)}</caption>
 <flowchart label="数值流向" nodes={local.nodes} edges={local.edges} detailMode="external"/>
 <row><button onPress="residual">{local.residual?"关闭残差":"开启残差"}</button><button onPress="save">保存输出</button></row></logic>
 <caption>保存的输出：{formatNumber(state.saved,3)}</caption><action id="save"><set target="saved" value={event.result.total}/></action></card>`,
 capabilityCollection:`<card actionMode="snapshot"><data id="items" value={[{id:"a",title:"湖边路线",duration:60},{id:"b",title:"城市路线",duration:90},{id:"c",title:"森林路线",duration:120}]}/><state id="selected" type="string" initial="a"/><state id="pinned" type="record" initial={{}}/><derive id="current" value={find(data.items,item.id==state.selected)}/>
 <title>选择与固定，共用一份状态</title><collection label="路线候选" items={data.items} fields={["duration"]} selectedId={state.selected} detailMode="external" onSelect="select"/>
 <region role="actions"><strong>{derived.current.title}</strong><caption>预计 {derived.current.duration} 分钟</caption><button onPress="pin">{state.pinned[state.selected]?"取消固定":"固定路线"}</button><button onPress="reset">回到第一条</button><caption>已固定 {count(data.items,state.pinned[item.id]==true)} 条</caption></region>
 <action id="select"><set target="selected" value={event.id}/></action><action id="pin"><toggle target="pinned" key={state.selected}/></action><action id="reset"><set target="selected" value="a"/></action></card>`,
 capabilityTime:`<card actionMode="snapshot"><state id="at" type="string" initial=""/><state id="out" type="string" initial="未选"/><state id="back" type="string" initial="未选"/>
 <title>两段安排 · 时间由你确认</title><row><button onPress="out">固定去程 A</button><button onPress="back">固定返程 B</button></row><caption>去程 {state.out} / 返程 {state.back}</caption>
 <input label="确认的开放时间（北京时间）" inputType="datetime-local" value={state.at} onChange="date"/>
 <countdown target={state.at==""?"":state.at+"+08:00"} label="距你设定的时间" expiredLabel="已到时间，请自行核实是否开放"/>
 <copy label="复制安排" value={"去程 "+state.out+" / 返程 "+state.back}/><caption>时间由用户输入，不代表官方开放时间；此处不自动预约。</caption>
 <action id="out"><set target="out" value="A"/></action><action id="back"><set target="back" value="B"/></action><action id="date"><set target="at" value={event.value}/></action></card>`
}

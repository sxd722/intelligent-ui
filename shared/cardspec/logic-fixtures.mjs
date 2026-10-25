const source=s=>JSON.stringify(s)
export const HEAT_SOURCE=`function update(state,event,input){
 if(event.type==='power')state.power=event.value;
 if(event.type==='tick'||event.type==='heat'){
  state.temperature=Math.min(100,state.temperature+state.power*0.5);
  state.steps++;state.phase=state.temperature>=60?'完成':'加热中';
  state.series=[{id:'now',label:'当前',value:state.temperature},{id:'target',label:'目标',value:60}];
 }
 if(event.type==='save')state.saved={temperature:state.temperature,power:state.power,steps:state.steps};
 if(event.type==='fault'){state.temperature=999;throw Error('故障演示：本次草稿不会提交');}
 if(event.type==='loop'){while(true){}}
 return state;
}`
export const ORDER_SOURCE=`function update(state,event,input){
 if(event.type==='quantity')state.quantity=event.value;
 if(event.type==='next'){
  if(state.stage===0){state.total=state.quantity*input.price;state.stage=1;}
  else if(state.stage===1){state.receipt={quantity:state.quantity,total:state.total};state.stage=2;}
 }
 if(event.type==='back')state.stage=Math.max(0,state.stage-1);
 return state;
}`
export const LOGIC_FIXTURES={
 logicHeat:`<card theme="precision"><state id="count" type="number" initial={0}/><action id="outside"><increment target="count"/></action>
 <logic id="heat" label="加热模拟器" initial={{temperature:20,power:10,steps:0,phase:"准备",series:[{id:"now",label:"当前",value:20},{id:"target",label:"目标",value:60}],saved:null}} tickMs={500} source={${source(HEAT_SOURCE)}}>
 <stats columns={2}><stat label="温度" value={local.temperature} motion="emphasis"/><stat label="阶段" value={local.phase}/></stats>
 <chart label="温度对照" data={local.series}/><slider label="功率" min={2} max={20} step={2} value={local.power} onChange="power"/>
 <row><button onPress="save">保存快照</button><button onPress="fault">模拟错误</button><button onPress="loop">超时测试</button></row>
 <caption>已推进 {local.steps} 步；快照温度 {local.saved==null?"未保存":local.saved.temperature}</caption></logic>
 <button onPress="outside">外部计数 {state.count}</button></card>`,
 logicOrder:`<card theme="soft"><title>本地订单演练</title><logic id="order" label="订单步骤" initial={{stage:0,quantity:2,total:0,receipt:null}} input={{price:15}} source={${source(ORDER_SOURCE)}}>
 <caption motion="slide" motionKey={local.stage}>步骤 {local.stage+1} / 3</caption>
 <if test={local.stage==0}><slider label="数量" min={1} max={10} step={1} value={local.quantity} onChange="quantity"/></if>
 <if test={local.stage==1}><stat label="待确认总额" value={local.total}/></if>
 <if test={local.stage==2}><text>收据：{local.receipt.quantity} 件，共 {local.receipt.total} 元</text></if>
 <row><button onPress="back" disabled={local.stage==0}>返回步骤</button><button onPress="next" disabled={local.stage==2}>下一步</button></row>
 </logic><caption>纯本地演示，不创建真实订单。</caption></card>`
}

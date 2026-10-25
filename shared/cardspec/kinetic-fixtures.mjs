// Deterministic native-only fixtures: rendering, not model or live-data claims.
export const KINETIC_FIXTURES={
 kineticPearl:`<card design="pearl"><state id="charge" type="number" initial={40}/><state id="saved" type="number" initial={0}/>
 <title>能量，流向哪里？</title><caption>调节储能，观察可用与剩余容量 · 示例</caption>
 <chart label="储能分配" data={[{id:"stored",label:"已存",value:state.charge},{id:"free",label:"可用空间",value:100-state.charge}]} kind="bar"/>
 <slider label="储能比例" min={0} max={100} value={state.charge} unit="%" onChange="adjust"/>
 <row justify="between"><button variant="primary" onPress="save">保存当前方案</button><text>已保存 {state.saved}%</text></row>
 <action id="adjust"><set target="charge" value={event.value}/></action><action id="save"><set target="saved" value={state.charge}/></action></card>`,
 kineticAtlas:`<card design="atlas"><state id="step" type="boolean" initial={false}/><state id="selected" type="string" initial="input"/>
 <title>一条信号的旅程</title><caption>选择节点，展开或收起中间变换 · 示例</caption>
 <flowchart label="信号路径" direction="horizontal" detailMode="external" selectedId={state.selected} nodes={state.step?[{id:"input",label:"输入"},{id:"transform",label:"变换"},{id:"output",label:"输出"}]:[{id:"input",label:"输入"},{id:"output",label:"输出"}]} edges={state.step?[{from:"input",to:"transform"},{from:"transform",to:"output"}]:[{from:"input",to:"output"}]} onSelect="select"/>
 <text motion="slide" motionKey={state.selected}>{state.selected=="input"?"输入保留原始信号。":state.selected=="transform"?"变换产生新的表示。":"输出汇总当前步骤的结果。"}</text>
 <button variant="primary" onPress="expand">{state.step?"收起中间步骤":"展开中间步骤"}</button>
 <action id="select"><set target="selected" value={event.id}/></action><action id="expand"><toggle target="step"/><set target="selected" value="input"/></action></card>`,
 kineticRebel:`<card design="rebel"><state id="selected" type="string" initial="night"/><state id="saved" type="string" initial=""/>
 <title>今晚，选你的频率</title><caption>虚构演出 · 切换阵容并保存选择</caption>
 <data id="acts" value={[{id:"night",title:"午夜回声",note:"独立摇滚 / A 舞台",time:"19:30"},{id:"pulse",title:"脉冲俱乐部",note:"电子 / B 舞台",time:"20:15"},{id:"sun",title:"日落列车",note:"另类流行 / A 舞台",time:"21:00"}]}/>
 <collection label="演出阵容" items={data.acts} titleKey="title" fields={["time","note"]} presentation="compact" selectedId={state.selected} detailMode="external" onSelect="select"/>
 <row justify="between"><button variant="primary" onPress="save">加入我的行程</button><text>{state.saved==""?"尚未保存":state.saved=="night"?"已保存：午夜回声":state.saved=="pulse"?"已保存：脉冲俱乐部":"已保存：日落列车"}</text></row>
 <action id="select"><set target="selected" value={event.id}/></action><action id="save"><set target="saved" value={state.selected}/></action></card>`,
 kineticList:`<card design="friendly"><state id="picked" type="number" initial={0}/><title>逐组检查设备</title><text>已选 {state.picked}</text><list label="设备列表"><each items={[1,2,3,4,5,6,7,8,9,10,11,12,13]} itemKey={item}><list-item><button onPress="pick" args={{id:item}}>设备 {item}</button></list-item></each></list><action id="pick"><set target="picked" value={args.id}/></action></card>`
}

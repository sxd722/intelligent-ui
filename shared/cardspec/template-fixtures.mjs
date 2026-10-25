import {KINETIC_FIXTURES} from './kinetic-fixtures.mjs'
export const TEMPLATE_FIXTURES={
 templateParchment:`<card design="parchment"><state id="chapter" type="string" initial="vow"/><state id="audience" type="boolean" initial={false}/>
 <data id="story" value={[{id:"vow",title:"立誓",description:"他承诺找出真相，却还不知道自己也在答案之中。"},{id:"search",title:"追查",description:"每一条证词都让追问更接近自己的过去。"},{id:"recognize",title:"发现",description:"线索合拢，行动的意义随认知改变。"}]}/>
 <data id="other" value={[{id:"vow",title:"立誓",description:"观众看见承诺与未知之间的裂缝。"},{id:"search",title:"追查",description:"观众的已知，使同一句追问有了第二层意味。"},{id:"recognize",title:"发现",description:"我们重新理解先前的选择，而非只看结局。"}]}/>
 <title>命运的手稿</title><caption>悲剧阅读路径 · 文学示例</caption>
 <collection label="章节" presentation="folio" titleKey="title" subtitleKey="description" items={state.audience?data.other:data.story} selectedId={state.chapter} onSelect="pick" detailMode="external"/>
 <button onPress="perspective">{state.audience?"返回人物视角":"揭开观众视角"}</button>
 <action id="pick"><set target="chapter" value={event.id}/></action><action id="perspective"><toggle target="audience"/></action></card>`,
 templateBusiness:`<card design="business"><state id="period" type="string" initial="month"/><state id="selected" type="string" initial="a"/><state id="saved" type="string" initial=""/>
 <data id="monthly" value={[{id:"a",label:"组合 A",value:1.4},{id:"b",label:"组合 B",value:-0.8},{id:"c",label:"组合 C",value:2.6}]}/><data id="daily" value={[{id:"a",label:"组合 A",value:-0.3},{id:"b",label:"组合 B",value:0.2},{id:"c",label:"组合 C",value:0.8}]}/>
 <title>Market brief.</title><caption>虚构数据 · 价格回报，不含股息</caption>
 <chart kind="comparison" label={state.period=="month"?"本月示例":"单日示例"} data={state.period=="month"?data.monthly:data.daily} scaleMax={4} unit="%" selectedId={state.selected} onSelect="pick"/>
 <segmented label="统计区间" options={[{value:"month",label:"本月"},{value:"day",label:"单日"}]} value={state.period} onChange="period"/>
 <row><button onPress="save">记录快照</button><text>{state.saved==""?"选择一项再切换区间":state.saved}</text></row>
 <action id="pick"><set target="selected" value={event.id}/></action><action id="period"><set target="period" value={event.value}/></action><action id="save"><set target="saved" value={"已记录 "+state.selected+" / "+state.period}/></action></card>`,
 templateAcademy:`<card design="academy"><state id="revealed" type="boolean" initial={false}/><state id="selected" type="string" initial="sun"/><state id="topic" type="string" initial="self"/>
 <data id="cards" value={[{id:"sun",title:"太阳",description:"先注意今天已经做到的一件小事。"},{id:"star",title:"星星",description:"把下一步缩小到可以开始的程度。"},{id:"world",title:"世界",description:"结束一件旧事，为新的选择留出空间。"}]}/>
 <title>辉石学院</title><caption>三个自省提示 · 非事实预测</caption>
 <collection label="三牌探索" presentation="spread" items={data.cards} titleKey="title" subtitleKey="description" selectedId={state.selected} revealed={state.revealed} onSelect="pick" detailMode="external"/>
 <button onPress="reveal">{state.revealed?"收起牌面":"揭示三张牌"}</button>
 <action id="pick"><set target="selected" value={event.id}/></action><action id="reveal"><toggle target="revealed"/></action></card>`,
 templatePearl:KINETIC_FIXTURES.kineticPearl.replace('kind="bar"','kind="proportion" unit="%"'),
 templatePersona:KINETIC_FIXTURES.kineticRebel.replace('presentation="compact"','presentation="poster" timeKey="time" subtitleKey="note"'),
 templateDefault:KINETIC_FIXTURES.kineticPearl.replace('design="pearl"','design="default"').replace('kind="bar"','kind="proportion" unit="%"'),
 templateAtlas:`<card design="atlas"><state id="phase" type="boolean" initial={false}/><state id="r" type="string" initial="我"/><state id="c" type="string" initial="d1"/><data id="before" value={[[0.8,-0.4,0.5,0.2],[0.2,0.6,-0.3,0.5],[0.4,0.3,0.7,-0.5],[-0.1,0.5,0.4,0.8]]}/><data id="after" value={[[1,-0.3,0.6,0.1],[0.1,0.8,-0.2,0.7],[0.6,0.2,0.8,-0.4],[-0.2,0.7,0.5,1]]}/><data id="rowIndex" value={{"我":0,"喜欢":1,"这场":2,"雨":3}}/><data id="colIndex" value={{"d1":0,"d2":1,"d3":2,"d4":3}}/><derive id="picked" value={(state.phase?data.after:data.before)[data.rowIndex[state.r]][data.colIndex[state.c]]}/>
 <title>让计算，显出形状。</title><caption>{state.phase?"保留原表示，叠加本层变化。":"选择一枚 token，再观察残差更新。"} · 示例</caption>
 <heatmap label={state.phase?"残差相加 · X + Δ":"输入表示 · X"} rows={[{id:"我",label:"我"},{id:"喜欢",label:"喜欢"},{id:"这场",label:"这场"},{id:"雨",label:"雨"}]} columns={[{id:"d1",label:"d₁"},{id:"d2",label:"d₂"},{id:"d3",label:"d₃"},{id:"d4",label:"d₄"}]} values={state.phase?[[1,-0.3,0.6,0.1],[0.1,0.8,-0.2,0.7],[0.6,0.2,0.8,-0.4],[-0.2,0.7,0.5,1]]:[[0.8,-0.4,0.5,0.2],[0.2,0.6,-0.3,0.5],[0.4,0.3,0.7,-0.5],[-0.1,0.5,0.4,0.8]]} selectedRow={state.r} selectedColumn={state.c} onSelect="pick"/>
 <row justify="between"><button variant="primary" onPress="step">{state.phase?"返回输入表示":"观察残差更新"}</button><text>{state.r} / {state.c} · {derived.picked}</text></row>
 <action id="pick"><set target="r" value={event.rowId}/><set target="c" value={event.columnId}/></action>
 <action id="step"><toggle target="phase"/></action></card>`,
 templateNested:`<card design="atlas"><state id="count" type="number" initial={0}/><title>完整内容仍然可达</title><caption>长内容与局部错误隔离验证</caption><region role="content" label="操作集合"><text>同一作用域中的原生组件</text><list><each items={[1,2,3,4,5,6,7,8,9,10,11,12]} itemKey={item}><list-item><button onPress="pick" args={{n:item}}>选择 {item}</button></list-item></each></list><button onPress="pick" args={{n:99}}>最后一个操作</button></region><text>结果 {state.count}</text><action id="pick"><set target="count" value={args.n}/></action></card>`,
 templateFallback:`<card design="pearl"><state id="count" type="number" initial={0}/><region role="content"><title>嵌套标题保留原结构</title><button onPress="increment">增加</button><text>结果 {state.count}</text></region><action id="increment"><set target="count" value={state.count+1}/></action></card>`,
}

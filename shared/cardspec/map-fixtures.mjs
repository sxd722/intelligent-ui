// Geographic regression fixture, not verified tourism or pricing advice.
export const MAP_FIXTURES={mapPins:`<card schemaVersion="1" visualStyle="frosted-glass" backgroundQuery="misty lake">
<data id="places" value={[
 {id:"lake",title:"湘湖",lat:30.1334067,lon:120.2159518},
 {id:"ocean",title:"长乔极地海洋公园",lat:30.1398132,lon:120.2246427},
 {id:"museum",title:"跨湖桥遗址博物馆",lat:30.1420488,lon:120.2216909},
 {id:"park",title:"杭州乐园",lat:30.1612944,lon:120.2447372},
 {id:"apple",title:"烂苹果乐园",lat:30.164505,lon:120.2422043},
 {id:"stadium",title:"奥体中心大莲花",lat:30.2291675,lon:120.2287524}
]}/>
<state id="selected" type="string" initial=""/>
<state id="mode" type="string" initial="完整"/>
<derive id="points" value={state.mode==="空结果"?[]:state.mode==="缺坐标"?[{id:"lake",title:"湘湖"},data.places[1],data.places[2],data.places[3],data.places[4],data.places[5]]:data.places}/>
<title>六个地点 · 真实底图</title>
<map id="placesMap" size="small" items={derived.points} selectedId={state.selected} onSelect="pick"/>
<caption>{state.selected===""?"点击编号查看地点":find(data.places,item.id==state.selected).title}</caption>
<region role="actions"><segmented label="坐标分支" options={["完整","缺坐标","空结果"]} value={state.mode} onChange="mode"/></region>
<action id="pick"><set target="selected" value={event.id}/></action>
<action id="mode"><set target="mode" value={event.value}/></action>
</card>`}

// A visual fixture, not a live travel recommendation. Photos are illustrative.
export const MATERIAL_FIXTURE=`<card schemaVersion="1" visualStyle="liquid-glass" backgroundQuery="misty alpine lake sunrise">
<state id="selected" type="number" initial={0}/><state id="saved" type="boolean" initial={false}/>
<data id="places" value={[{title:"沿湖慢行",query:"alpine lake morning",note:"观察倒影与水鸟，慢下来看看光线。"},{title:"林间探索",query:"forest sun rays path",note:"留意叶片、树皮和地面的不同纹理。"},{title:"山间眺望",query:"mountain landscape golden hour",note:"寻找远山轮廓，比较远近的颜色。"}]}/>
<title>把周末交给风景</title><caption>灵感示例 · 摄影素材不对应具体目的地</caption>
<carousel id="places" label="选择一种探索方式" onIndexChange="choose"><each items={data.places} itemKey={item.title}><carousel-item><image query={item.query} mediaRole="gallery" alt={item.title+"，示意摄影"}/><strong>{item.title}</strong></carousel-item></each></carousel>
<text motion="slide" motionKey={state.selected}>{data.places[state.selected].note}</text>
<row justify="between"><button onPress="save" variant="primary">{state.saved?"已加入周末灵感":"加入周末灵感"}</button><badge>{state.selected+1} / 3</badge></row>
<action id="choose"><set target="selected" value={event.index}/><set target="saved" value={false}/></action><action id="save"><toggle target="saved"/></action>
</card>`

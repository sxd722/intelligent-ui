// Relationships are explicitly authored test data, not inferred by the host.
export const CONSTELLATION_CARD = `<intro>以猎户座为中心组织周边星座的说明，连线仅为内容分组，不代表天球坐标。</intro>
<card schemaVersion=“1” theme=“soft” palette=“a” visualStyle=“smoked-glass” backgroundQuery=“starry night sky milky way silhouette”>
<data id="constellations" value={[
{"id":"orion","label":"猎户座 Orion","description":"腰带三星是辨识线索。"},
{"id":"taurus","label":"金牛座 Taurus","parentId":"orion","description":"查看毕星团和昴星团的辨识说明。"},
{"id":"canismajor","label":"大犬座 Canis Major","parentId":"orion","description":"天狼星是辨识线索。"},
{"id":"canisminor","label":"小犬座 Canis Minor","parentId":"orion","description":"南河三是辨识线索。"},
{"id":"gemini","label":"双子座 Gemini","parentId":"orion","description":"北河二、北河三是辨识线索。"},
{"id":"auriga","label":"御夫座 Auriga","parentId":"orion","description":"五车二是辨识线索。"},
{"id":"monoceros","label":"麒麟座 Monoceros","parentId":"orion","description":"查看暗淡星座的辨识说明。"}
]}/>
<state id="sel" type="string" initial="orion"/>
<derive id="cur" value={find(data.constellations,item.id==state.sel) ?? data.constellations[0]}/>
<region id="main" role="content" overflow="scroll" label="星座示意">
<mindmap id="sky" label="Orion 周边星座（点击节点）" nodes={data.constellations} direction="horizontal" selectedId={state.sel} onSelect="pick"/>
<stack id="detail"><strong>{derived.cur.label}</strong><text>{derived.cur.description}</text></stack>
</region>
<action id="pick"><set target="sel" value={event.id}/></action>
</card><outro>内容分组示意。</outro>`

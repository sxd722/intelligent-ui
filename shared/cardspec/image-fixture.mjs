export const IMAGE_PROVIDERS=`<intro>同一图片组件选择 OpenAI 插画或 Pexels 照片；图片独立加载，切换和计数无需等待。</intro><card theme="soft" design="parchment">
<state id="source" type="string" initial="generated"/><state id="count" type="number" initial={0}/>
<title>湖畔的一天</title><segmented label="图片来源" value={state.source} options={[{value:"generated",label:"生成插画"},{value:"photo",label:"图库照片"}]} onChange="source"/>
<image query={state.source=="generated"?"gen: watercolor family picnic by a lake, warm sage and cream":"family picnic lake"} mediaRole="hero" alt="湖畔野餐示意"/>
<caption>{"已选择 "+state.count+" 项活动"}</caption><button onPress="add">加入野餐活动</button>
<action id="source"><set target="source" value={event.value}/></action><action id="add"><increment target="count" value={1}/></action></card>`

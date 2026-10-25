export const OPENCLI_WEATHER=`<card schemaVersion="1" theme="soft">
<state id="city" type="string" initial="Shanghai"/>
<binding id="weather" tool="opencli.wttr.forecast" input={{location:state.city,days:3}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/>
<title>出门前看一眼</title><caption>真实三日天气，输入城市后查询。</caption>
<input label="城市" value={state.city} onChange="city"/>
<region role="content" overflow="scroll"><each items={bindings.weather.value.items} itemKey={item.rowKey}><stack><strong>{item.date}</strong><text>{item.description}</text><caption>{item.minTempC}–{item.maxTempC} °C · 日落 {item.sunset}</caption></stack></each></region>
<button onPress="load">查询天气</button>
<action id="city"><set target="city" value={event.value}/></action><action id="load"><invoke binding="weather"/></action>
</card>`
export const OPENCLI_MUSIC=`<card schemaVersion="1" theme="soft">
<state id="query" type="string" initial=""/>
<binding id="play" tool="opencli.spotify.play" input={{query:state.query}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/>
<binding id="status" tool="opencli.spotify.status" input={{}} initial={{items:[],source:"",fetchedAt:"",truncated:false}}/>
<title>音乐遥控器</title><caption>控制已授权 Spotify 的当前播放设备。</caption>
<input label="歌曲或歌手" value={state.query} onChange="query"/>
<button onPress="play">播放音乐</button><button onPress="status">查看播放状态</button>
<each items={bindings.status.value.items} itemKey={item.rowKey}><text>{item.track} · {item.artist} · {item.status}</text></each>
<action id="query"><set target="query" value={event.value}/></action><action id="play"><invoke binding="play"/></action><action id="status"><invoke binding="status"/></action>
</card>`

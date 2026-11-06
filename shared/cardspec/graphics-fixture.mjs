// Same shared state feeds SVG and Canvas; host controls remain native CardSpec.
export const GRAPHICS_SOURCE=`export const styles=".flow{stroke-dasharray:8 12;animation:flow 3s linear infinite}@keyframes flow{to{stroke-dashoffset:-80}}.dots{animation:breathe 3s ease-in-out infinite alternate}@keyframes breathe{to{opacity:.65}}";
export default function App({data,bridge}){
 const n=Number(data.level)||0;
 return <div style={{width:"100%",color:"var(--cs-ink)"}}>
 {data.mode==="SVG"?<svg role="img" aria-label="能量流示意图" viewBox="0 0 320 160" width="100%" height={160}>
 <defs><linearGradient id="energy"><stop stopColor="#38bdf8"/><stop offset="100%" stopColor="#a78bfa"/></linearGradient></defs>
 <path className="flow" d="M 40 80 C 100 0 220 160 280 80" fill="none" stroke="url(#energy)" strokeWidth={4}/>
 <circle id="energy-node" cx={160} cy={80} r={12+n/3} fill="url(#energy)" opacity={.8}/>
 <text x={160} y={85} textAnchor="middle" fill="var(--cs-ink)" fontSize={18}>{n}%</text>
 </svg>:<Canvas className="dots" role="img" aria-label="能量点阵" width={320} height={160} onClick={e=>bridge.call("adjust",{value:Math.round(e.x/320*100)})} draw={ctx=>{
 ctx.fillStyle="var(--cs-accent)";
 for(let row=0;row<4;row++)for(let col=0;col<12;col++){ctx.globalAlpha=row*12+col<n/100*48?1:.12;ctx.beginPath();ctx.arc(17+col*26,28+row*34,8,0,Math.PI*2);ctx.fill()}
 }}/>}</div>
}`
export const GRAPHICS_CARD=`<card theme="soft" design="default"><state id="level" type="number" initial={40}/><state id="mode" type="string" initial="SVG"/><title>可操纵的能量图</title><caption>示意图 · 拖动滑杆观察形状与密度</caption><segmented label="绘图方式" options={["SVG","Canvas"]} value={state.mode} onChange="mode"/><sandbox id="graphic" label="原创能量图" brief="无缝图形联动" height={160} input={{level:state.level,mode:state.mode}} actions={{adjust:"adjust"}} source={${JSON.stringify(GRAPHICS_SOURCE)}}/><slider label="能量" value={state.level} min={0} max={100} onChange="adjust"/><action id="adjust"><set target="level" value={clamp(event.value,0,100)}/></action><action id="mode"><set target="mode" value={event.value}/></action></card>`

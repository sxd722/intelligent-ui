// Deterministic design reference. Compiled by the normal sandbox compiler.
// All shared state remains in CardSpec; no network or model calls.
export const styles = `
.pearl-whole{height:100vh;min-height:300px;display:flex;flex-direction:column;padding:20px 24px;color:#edfaf7;background:radial-gradient(ellipse at 85% 26%,#234554 0%,transparent 59%),radial-gradient(ellipse at 20% 90%,#133438 0%,transparent 65%),#07141e;font-family:system-ui;gap:0}
.pearl-mark{display:flex;justify-content:space-between;align-items:center;font-size:10px;letter-spacing:.19em;color:#bad3d6;height:20px;padding-right:26px}
.pearl-hero{position:relative;flex:1;min-height:130px}
.pearl-title{position:relative;z-index:1;font:500 24px/1.25 Georgia,'Songti SC',serif!important;letter-spacing:-.04em!important;margin-top:14px;max-width:95%}
.pearl-sculpture{position:absolute;right:-8px;top:16%;width:76%;height:88%;pointer-events:none}
.pearl-orbit{transform-origin:180px 160px;animation:pearl-orbit 24s ease-in-out infinite}
.pearl-value{position:absolute;bottom:22px;left:0;z-index:1;font-size:72px;line-height:.88;letter-spacing:-.07em;font-weight:300;font-variant-numeric:tabular-nums;text-shadow:0 2px 20px #07141e}
.pearl-value span{font-size:22px;letter-spacing:0;margin-left:5px;color:#bad3d6}
.pearl-value small{display:block;font:11px/1 system-ui;letter-spacing:.12em;color:#c6e2df;margin-top:12px}
.pearl-controls{flex:none;position:relative}
.pearl-ratio{display:flex;justify-content:space-between;font-size:12px;color:#c2d6d5;margin-bottom:7px}
.pearl-track{height:5px;border-radius:3px;background:#ffffff24;overflow:hidden}
.pearl-track-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,#8bb1c4,#d9ffed);transition:width .35s ease;box-shadow:0 0 14px #b9ffeb70}
.pearl-slider-label{display:flex;align-items:center;gap:12px;height:52px;font-size:12px;color:#c2d6d5}
.pearl-slider-label input{min-width:0;flex:1;height:44px;margin:0;accent-color:#d4f9e9;background:transparent;cursor:ew-resize}
.pearl-bottom{display:flex;gap:12px;align-items:center;margin-top:4px}
.pearl-save{height:44px;min-width:130px;border-radius:24px;background:linear-gradient(120deg,#e3f9ee,#b0d3cf);color:#102f34;padding:0 20px;font-size:13px;font-weight:600;box-shadow:0 5px 18px #020c1255;transition:transform .2s,box-shadow .2s}
.pearl-save:hover{transform:translateY(-1px);box-shadow:0 8px 24px #020c1270}.pearl-save:active{transform:translateY(1px)}
.pearl-status{font-size:11px;color:#b9d5d3;line-height:1.4;min-width:0}
.pearl-whole :focus-visible{outline:2px solid #e2ffe8;outline-offset:3px}
@keyframes pearl-orbit{0%,100%{transform:rotate(-9deg) scale(.96)}50%{transform:rotate(9deg) scale(1.02)}}
@media(max-width:360px){.pearl-whole{padding:14px 18px}.pearl-title{font-size:21px!important;margin-top:8px}.pearl-value{font-size:58px;bottom:15px}.pearl-value small{margin-top:8px}.pearl-sculpture{top:13%;right:-12px;width:72%;height:95%}.pearl-slider-label{height:48px}.pearl-save{min-width:124px;padding:0 16px}.pearl-mark{font-size:9px;letter-spacing:.12em}}
@media(prefers-reduced-motion:reduce){.pearl-orbit{animation:none}.pearl-track-fill,.pearl-save{transition:none}}
`
export default function App({data,bridge}) {
 const charge=Math.max(0,Math.min(100,Number(data.charge)||0));
 const ribbons=[];
 for(let j=0;j<32;j++){
  const angle=j/31*Math.PI*2,points=[];
  for(let i=0;i<=96;i++){
   const t=i/96*Math.PI*2,rad=95+25*Math.cos(angle),x=180+rad*Math.cos(t),y=160+(rad*Math.sin(t)*.69)+25*Math.sin(angle)*Math.cos(t+.5);
   points.push((i?'L':'M')+x.toFixed(2)+','+y.toFixed(2));
  }
  ribbons.push(<path key={j} d={points.join(' ')+'Z'} fill="none" stroke={j%7===0?'#effff7':j%5===0?'#b0d1ec':'#6696aa'} strokeWidth={j%7===0?2:1.2} opacity={.24+.65*Math.pow(Math.abs(Math.cos(angle)),4)}/>);
 }
 return <section className="pearl-whole" data-layout-scroll="none" aria-label="储能分配样板">
  <header className="pearl-mark"><span>μ SELENE / 01</span><span>储能 · 示例</span></header>
  <div className="pearl-hero">
   <h1 className="pearl-title">能量，流向哪里？</h1>
   <svg className="pearl-sculpture" viewBox="0 0 360 320" aria-hidden="true">
    <defs><radialGradient id="halo"><stop stopColor="#6ddcdd" stopOpacity=".18"/><stop offset="1" stopColor="#102b38" stopOpacity="0"/></radialGradient><linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#edf9eb"/><stop offset=".28" stopColor="#628d9f"/><stop offset=".52" stopColor="#d6f4ff"/><stop offset=".8" stopColor="#46728c"/><stop offset="1" stopColor="#edcfe9"/></linearGradient></defs>
    <ellipse cx="180" cy="175" rx="173" ry="144" fill="url(#halo)"/>
    <g className="pearl-orbit"><g transform="rotate(-28 180 160)"><ellipse cx="180" cy="160" rx="120" ry="83" fill="none" stroke="#102530" strokeWidth="34"/><ellipse cx="180" cy="160" rx="113" ry="77" fill="none" stroke="url(#edge)" strokeWidth="19"/>{ribbons}<path d="M77 124 C103 66 224 56 279 128" fill="none" stroke="#e2ffff" strokeWidth="1.6" opacity=".8"/></g></g>
   </svg>
   <div className="pearl-value" aria-label={'已储能 '+charge+'%'}>{charge}<span>%</span><small>已储能 / STORED</small></div>
  </div>
  <div className="pearl-controls">
   <div className="pearl-ratio"><span>容量分配</span><span>剩余 {100-charge}%</span></div>
   <div className="pearl-track" role="img" aria-label={'储能'+charge+'%，剩余'+(100-charge)+'%'}><div className="pearl-track-fill" style={{width:charge+'%'}}/></div>
   <label className="pearl-slider-label">调节储能<input aria-label="储能比例" type="range" min="0" max="100" value={charge} onChange={e=>bridge.call('adjust',{value:Number(e.target.value)})}/></label>
   <footer className="pearl-bottom"><button className="pearl-save" onClick={()=>bridge.call('save',{})}>保存当前方案 ↗</button><span className="pearl-status" role="status">{data.saved===null?'调整后保存方案':data.saved===charge?'已保存 '+data.saved+'%':'已保存 '+data.saved+'% · 未保存更改'}</span></footer>
  </div>
 </section>
}

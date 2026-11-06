// An explicitly labelled author layout revision, not counted as model success.
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash,randomUUID} from 'node:crypto'
const parent=process.argv[2],old=JSON.parse(await readFile(`artifacts/deep-build/${parent}/trace.json`,'utf8')),id=randomUUID()
let code=old.workspace['app.jsx'].content
const css=`
.sg{height:100dvh;min-height:0;box-sizing:border-box;position:relative;overflow:hidden;background:radial-gradient(ellipse at 70% 0%,#3e3022,#17130f 65%);color:#f2e7cb;font:14px/1.4 system-ui;border-radius:12px}
.sg-game{display:grid;grid-template-rows:32px minmax(50px,1fr) 26px 76px 44px;gap:4px;padding:8px}
.fighter{display:flex;align-items:center;gap:8px;min-width:0}.fighter-info{flex:1;min-width:0}.fighter-title{display:flex;justify-content:space-between;gap:6px;align-items:baseline;font-size:12px}.fighter-title strong{font-size:14px;color:#f2ce77}.avatar{font-size:22px;width:30px;text-align:center}.hpbar{height:5px;background:#635340;border-radius:4px;margin-top:4px;overflow:hidden}.hpfill{height:100%;background:linear-gradient(90deg,#d34537,#f19c62);transition:width .25s}
.arena{display:grid;grid-template-columns:68px 1fr;gap:10px;min-height:0;padding:7px 9px;background:#0003;border-radius:10px}.table-card{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:2px;color:#f5d883;font-weight:600}.table-card .suit{font-size:18px;line-height:20px}.piles{font-size:10px;line-height:14px;white-space:nowrap;color:#bdac8b;text-align:center;font-weight:400}.log-wrap{display:flex;flex-direction:column;min-height:0;gap:4px}.phase{font-size:12px;line-height:18px;font-weight:600;color:#ead494}.log{min-height:0;overflow:auto;overscroll-behavior:contain;font-size:13px;line-height:19px;color:#ddcfaf}.log p{margin:0 0 4px}.log p:first-child{color:#fff0c8}
.hand{display:flex;gap:7px;overflow-x:auto;overflow-y:hidden;padding:4px 1px;align-items:center;min-height:0;overscroll-behavior:contain}.card{position:relative;flex:0 0 60px;height:68px;padding:15px 6px 7px;border:0;border-radius:8px;background:linear-gradient(140deg,#fff1cd,#d7be83);color:#332616;cursor:pointer;box-shadow:0 3px 8px #0004;font:600 16px/18px system-ui;overflow:hidden}.card .suit{position:absolute;left:6px;top:2px;font-size:12px;line-height:13px}.card.sel{box-shadow:inset 0 0 0 3px #fff8dd,0 0 0 2px #e8b854}.card:disabled{opacity:.5;cursor:default}.card-name{display:block;overflow-wrap:anywhere}.empty{color:#b6a88a;font-size:13px}
.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.btn{min-height:44px;border:1px solid #ad915452;border-radius:10px;background:#ffffff0c;color:#ebdfbf;font:600 14px system-ui;padding:8px 12px;cursor:pointer}.btn.gold{background:linear-gradient(135deg,#e3bf69,#bb9141);color:#241b0e;border:0}.btn:disabled{opacity:.38;cursor:default}.btn:focus-visible,.card:focus-visible{outline:2px solid white;outline-offset:-3px}
.sg-start{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:14px;text-align:center}.sg-title{font:700 30px KaiTi,serif;letter-spacing:5px;color:#f1d48c}.sg-start p{margin:0;font-size:14px;color:#ccb990}.crest{font-size:42px}.modal-cover{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:#100c09d9;z-index:5}.modal{width:100%;max-width:340px;max-height:100%;overflow:auto;padding:16px;box-sizing:border-box;background:#2b231b;border-radius:16px;box-shadow:0 16px 60px #0008;text-align:center}.modal h2{font-size:23px;color:#f6d991;margin:0 0 12px}.modal p{font-size:14px;line-height:1.6}.modal .actions{margin-top:14px}.modal .btn{width:100%}
.hand,.log{scrollbar-width:none}.hand::-webkit-scrollbar,.log::-webkit-scrollbar{display:none}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`
const start=code.indexOf('export const styles=`'),end=code.indexOf('`;',start)
if(start<0||end<0||!code.includes(' if(!s.started)'))throw Error('Unexpected module structure; do not apply blindly')
code=code.slice(0,start)+'export const styles='+JSON.stringify(css)+';'+code.slice(end+2)
code=code.slice(0,code.indexOf(' if(!s.started)'))+`
 if(!s.started)return <div className="sg sg-start"><div className="crest">⚔️</div><h1 className="sg-title">三国杀</h1><p>关羽对阵曹操<br/>出牌、应变，战至最后一滴体力</p><button className="btn gold" onClick={start}>开 始 游 戏</button></div>;
 const respondMode=!!s.pending&&s.pending.from==="ai",hasDodge=s.hand.some(c=>c.n==="闪");
 const canPlay=c=>s.turn==="player"&&!s.over&&!respondMode&&(c.n==="杀"?!s.shaUsed:c.n==="桃"?s.player.hp<s.player.max:["决斗","过河拆桥","顺手牵羊"].includes(c.n));
 const sel=s.sel>=0?s.hand[s.sel]:null;
 const fighter=(who,caption)=><div className="fighter"><div className="avatar">{who.emoji}</div><div className="fighter-info"><div className="fighter-title"><strong>{who.name} · {caption}</strong><span>{who.hp}/{who.max} 体力{caption==="AI"?" · 手牌 "+s.aiHandArr.length:""}</span></div><div className="hpbar"><div className="hpfill" style={{width:(who.hp/who.max*100)+"%"}}/></div></div></div>;
 return <div className="sg sg-game">
  {fighter(s.ai,"AI")}
  <div className="arena"><div className="table-card"><span className="suit">{s.center?s.center.s:"⚔"}</span><span>{s.center?s.center.n:"待出牌"}</span><span className="piles">牌{s.deck.length} · 弃{s.discard.length}</span></div><div className="log-wrap"><div className="phase" role="status">{s.over?"对局结束":respondMode?"请选择响应":s.turn==="ai"?"曹操正在行动…":"你的回合"} · 战斗日志</div><div className="log" aria-label="战斗日志">{s.log.slice(-30).reverse().map((l,i)=><p key={s.log.length-i}>{l}</p>)}</div></div></div>
  {fighter(s.player,"你")}
  <div className="hand" aria-label="手牌">{s.hand.map((c,i)=><button key={i} className={"card"+(s.sel===i?" sel":"")} aria-label={c.n} aria-pressed={s.sel===i} disabled={!canPlay(c)} onClick={()=>update(o=>({...o,sel:o.sel===i?-1:i}))}><span aria-hidden="true" className="suit">{c.s}</span><span className="card-name">{c.n}</span></button>)}{!s.hand.length&&<span className="empty">手牌已空，可结束回合摸牌</span>}</div>
  <div className="actions"><button className="btn gold" disabled={!sel||!canPlay(sel)} onClick={play}>出 牌</button><button className="btn" disabled={s.turn!=="player"||respondMode||!!s.over} onClick={endTurn}>结束回合</button></div>
  {respondMode&&!s.over&&<div className="modal-cover"><div className="modal" role="dialog" aria-modal="true" aria-label="响应攻击"><h2>曹操向你出杀</h2><p>{hasDodge?"打出一张闪抵消伤害，或保留手牌承受1点伤害。":"没有闪，本次将承受1点伤害。"}</p><p>当前体力 {s.player.hp}/{s.player.max}</p><div className="actions"><button className="btn gold" disabled={!hasDodge} onClick={()=>respond(true)}>使用【闪】</button><button className="btn" onClick={()=>respond(false)}>承受伤害</button></div></div></div>}
  {s.over&&<div className="modal-cover"><div className="modal" role="dialog" aria-modal="true" aria-label="对局结算"><h2>{s.over==="win"?"🏆 胜利":"败北 · 再战"}</h2><p>{s.over==="win"?"对手体力归零，本局获胜。":"你的体力归零，本局结束。"}</p><button className="btn gold" onClick={start}>再 来 一 局</button></div></div>}
 </div>;
}
`
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,16)
const main='<card schemaVersion="1" actionMode="snapshot" theme="precision"><sandbox id="stage" brief="卡牌对决游戏界面" source="@module:app.jsx" /></card>'
const trace={...old,workspace:{'main.cardspec':{content:main,version:hash(main)},'app.jsx':{content:code,version:hash(code)}},trace:[{kind:'author-layout-revision',sourceId:parent,scope:'UI/CSS only; functional handlers unchanged. Not credited to GLM auto convergence.'}],coverage:null,feedback:null,harness:null,elapsedMs:0}
await mkdir('artifacts/deep-build/'+id,{recursive:true});await writeFile('artifacts/deep-build/'+id+'/trace.json',JSON.stringify(trace,null,2));await writeFile('artifacts/sgs-harness-20261102/final-id.json',JSON.stringify({id,parent,producer:'model business patch + author UI revision'}));console.log(id)

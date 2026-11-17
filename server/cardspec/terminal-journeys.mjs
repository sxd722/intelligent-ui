import {persistedValue} from '../../shared/cardspec/debug-assertions.mjs'
export function needsTerminalJourneys(goal){
 // Only requested playable behavior needs terminal paths. Negated scope and
 // game/history articles must not acquire win/loss requirements from a noun.
 const clauses=String(goal||'').split(/[。；;\n]+/).map(s=>s.replace(/(?:而非|并非|不是|不要|不需要|无需|不做|不含|不扩展|不涉及|避免|not\s+(?:a\s+)?|without\s+)[^，,。；;\n]*/gi,''))
 const text=clauses.join('；')
 const explicit=/(通关|胜负判定|胜利条件|失败条件|对战|棋牌|五子棋|围棋|\bduel\b|win.{0,15}lose)/i
 const game=/(小游戏|游戏|\bgames?\b)/i
 return explicit.test(text)||clauses.some(s=>game.test(s)&&!/(游戏化|游戏史|游戏研究|游戏评测|游戏新闻|游戏评论|游戏推荐|game (?:history|review|news|recommendation))/i.test(s)&&(/(?:制作|做一|实现|可玩|玩家|控制|操作|小游戏|playable|build|create|play\b)/i.test(s)||s.trim()==='游戏'))
}
export function expandJourneySteps(steps){
 if(steps.reduce((n,s)=>n+(s.repeat||1),0)>160)throw Error('Path exceeds 160 actions; submit independent paths separately')
 return steps.flatMap(s=>Array.from({length:s.repeat||1},(_,i)=>{const {repeat,...step}=s;return {...step,...(i<(s.repeat||1)-1?{expect:undefined}:{}),...(repeat?{repeatIndex:i+1}:{} )}}))
}
export function terminalJourneyCoverage(goal,browser){
 if(!needsTerminalJourneys(goal))return {required:false,status:'not-applicable',checked:[],remaining:[]}
 const checked=new Set(),evidence=[]
 for(const run of browser?.runs||[]){
  if(run.scenario!=='normal'||run.pageErrors?.length||run.initial?.errors?.length||run.final?.errors?.length)continue
  const actions=run.actions||[]
  const clean=actions.every(a=>a.ok&&!a.skipped&&a.assertion?.passed!==false&&a.restored!==false&&!a.errors?.length)
  if(!clean)continue
  let progressed=false
  for(const [index,a] of actions.entries()){
   if(!['check','reload'].includes(a.step?.op)&&a.changed)progressed=true
   const t=a.step?.expect?.terminal
   if(t&&progressed&&a.assertion?.passed===true){
    const initial=persistedValue(run.initial,t.owner,t.key),final=persistedValue(run.final,t.owner,t.key)
    if(initial.found&&initial.value!==t.value&&final.found&&final.value===t.value){checked.add(t.outcome);evidence.push({outcome:t.outcome,path:run.path,width:run.width,step:index+1,key:t.key,value:t.value})}
   }
   if(a.step?.op==='reload'&&progressed&&a.restored===true&&actions.slice(index+1).some(x=>!['reload','check'].includes(x.step?.op)&&x.changed&&x.assertion?.passed===true)){checked.add('restore');evidence.push({outcome:'restore',path:run.path,width:run.width,step:index+1})}
  }
 }
 const remaining=['win','loss','restore'].filter(k=>!checked.has(k))
 return {required:true,status:remaining.length?'partial':'checked',checked:[...checked],remaining,evidence,scope:'Observed initial-to-terminal paths at a fixed seed; not proof of every random outcome or strategy.'}
}
export const TERMINAL_JOURNEY_GUIDANCE='游戏验收：分别从初始状态跑 win、loss、restore 路径（step.path），使用真实控件；重复推进用 repeat（最多30次，expect仅检查最后一次）。胜负用 expect.terminal:{outcome:"win"或"loss",owner:沙箱id,key:持久化终局字段,value:实际枚举值}，结算后再检查，不能只验成功文案。restore路径先改变状态、reload，再操作并断言。必需资源必须能通过正常操作获得；核对强制消耗与失败阈值、恢复道具的可获得路径。未跑通保留候选并列未验证项，不重复整卡重写。'

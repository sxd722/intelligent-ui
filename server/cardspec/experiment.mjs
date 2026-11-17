import {C1_CONTRACT} from '../../shared/cardspec/experimental-behaviors.mjs'
import {executableMechanismMaterial} from '../../shared/cardspec/experimental-mechanisms.mjs'
// Internal injected generation option. HTTP settings do not forward this key.
// No global/process switch: unrelated requests retain their baseline behavior.
export function experimentConfig(value){
 if(!value||value.study!=='round1-20261117')return null
 const out={study:value.study,condition:String(value.condition||'B1'),revision:['r2','r3','r4'].includes(value.revision)?value.revision:'r1'}
 for(const [key,accepted]of Object.entries({disclosure:'on-demand-v1',mechanisms:'executable-v1',behaviors:'inspect-return-v1',layout:['subject-first-v1','subject-first-v2'],logicSnapshots:'readonly-v1',feedback:'screenshot-v1'}))if(Array.isArray(accepted)?accepted.includes(value[key]):value[key]===accepted)out[key]=value[key]
 if(typeof value.frozenAt==='string'&&Number.isFinite(Date.parse(value.frozenAt)))out.frozenAt=value.frozenAt
 return out
}
export function experimentInstruction(e){
 if(!e)return ''
 return [e.mechanisms?executableMechanismMaterial({enabled:true}).prompt:'',e.behaviors?C1_CONTRACT:'',e.layout?'本条件宿主对主内容保留空间，并收紧标题与局部操作的间距。保持相同任务完整性，把操作放在其作用对象附近，次要设置使用已有settings/details按需访问；不要通过扩大外部卡片或删除内容获得空间。':'',e.logicSnapshots?'图形需要消费 logic 局部结果时，可在同级 sandbox 上写 logicSnapshot="该logic的id"。JSX 只读 data.logicSnapshot.state；宿主等待初始化，随 init/input/tick 更新并恢复。logic是唯一业务状态所有者；图形不另起时钟、不复制业务状态，不把sandbox嵌进logic。普通用户事件仍用原有action/bridge。':''].filter(Boolean).join('\n')
}

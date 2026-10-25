import {CASES} from '../scripts/direct-benchmark-cases.mjs'
import {WORKBENCH_CASES} from './workbench-cases.mjs'

export const AGENT_CASES=[...CASES.map(c=>({...c,id:'reg-'+c.id,suite:'regression'})),...WORKBENCH_CASES.map(c=>({...c,id:'wb-'+c.id,suite:'workbench',checks:['核心任务可完成，所有主要操作产生正确反馈','真实资料注明来源与时间；缺失数据不编造','返回与刷新保留用户选择，失败可恢复']}))]
export const TRACKS=['trae-cardspec','trae-html']
export function agentCase(id){const c=AGENT_CASES.find(c=>c.id===id);if(!c)throw Error('Unknown case: '+id);return c}
export function agentTrack(track){if(!TRACKS.includes(track))throw Error('Unknown track');return track}
export const PREFERENCES={version:1,hard:['真实数据与明确的示例标记','核心操作有效、状态一致、可恢复','纯CardSpec不依赖H5完成核心任务'],soft:['可操作主体 → 当前结果 → 按需细节','优先时间、空间、关系和对照表达','有解释价值的图片与图形','有用的后续流程而非按钮凑数'],promotion:'human',training:'data-only'}

import {CASES} from './direct-benchmark-cases.mjs'
export const SEMANTIC_CASES = [
  {...CASES.find(c=>c.id==='17-card-battle'), prompt:CASES.find(c=>c.id==='17-card-battle').prompt.replace('玩家法力恢复3','玩家法力恢复到3（设为3，不累加）')},
  {id:'32-quota',area:'固定恢复与增量补充',prompt:'做通用额度演示：初始剩余额度3，“使用一次”扣1且不能负数；“恢复到3”将剩余额度设为3，“补充3点”在当前值上加3。显示剩余额度，并允许“重新开始”恢复初始状态。不要图片。',checks:['消耗3→2','恢复到3得到3','补充3点得到6','重新开始得到3']},
]

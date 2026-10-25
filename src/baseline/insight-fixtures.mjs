import {compactRows} from './insights.mjs'
// Explicit test doubles. Never used to replace live GLM failures.
export function insightFixture(kind,rows){const c=compactRows(rows)
 if(kind==='sentiment')return {headline:'演示：不同用户对车辆表达了不同态度',labels:c.filter(r=>r.source!=='新闻检索').map((r,i)=>({ref:r.ref,attitude:['正向','负向','不确定'][i%3],quote:(r.body||r.title).slice(0,40),reason:'演示分类，用于测试追溯'})),highlights:c.filter(r=>r.source!=='新闻检索').slice(0,3).map(r=>({ref:r.ref,summary:r.title.slice(0,70)}))}
 if(kind==='family')return {headline:'演示：每天两站，午间留白',slots:c.map((r,i)=>({ref:r.ref,day:Math.floor(i/2),period:i%2,activity:'观察与探索（演示建议）',reason:'为亲子活动留出休息时间'})),cautions:['门票、开放时间和交通尚未核实']}
 return {headline:'演示：先比较差异，再做选择',highlights:c.slice(0,3).map(r=>({ref:r.ref,summary:r.title.slice(0,70)})),facets:[{label:'演示分组',refs:c.slice(0,2).map(r=>r.ref)}]}
}

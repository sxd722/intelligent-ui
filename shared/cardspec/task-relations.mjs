// One reviewed relation used both by execution and on-demand disclosure.
export const TASK_DETAIL_RELATIONS={
 'opencli.jd.search':{tool:'opencli.jd.reviews',key:'sku',parameter:'sku',input:{limit:3}},
 'opencli.bilibili.search':{tool:'opencli.bilibili.subtitle',key:'bvid',parameter:'bvid',input:{}},
 'opencli.12306.trains':{tool:'opencli.12306.price',key:'train_no',parameter:'trainNo',input:{},context:['from','to','date']}
}
export function taskDetailRequest(tool,row,context={}){
 const r=TASK_DETAIL_RELATIONS[tool];if(!r||typeof row[r.key]!=='string'||!row[r.key]||(r.context||[]).some(k=>typeof context[k]!=='string'||!context[k]))return null
 return {tool:r.tool,input:{...r.input,[r.parameter]:row[r.key],...Object.fromEntries((r.context||[]).map(k=>[k,context[k]]))},kind:'facts'}
}

// Presentation never truncates the source collection. Transport safety bounds
// fail explicitly; they are not a page size or a claim of upstream completeness.
export const MAX_TOOL_RESULT_ROWS=5000
export function assertResultRows(rows){
 if(rows.length>MAX_TOOL_RESULT_ROWS)throw Error('TOOL_RESULT_TOO_LARGE: narrow the query; source rows were not silently discarded')
 return rows
}
export function resultCoverage(value){
 const loaded=Array.isArray(value?.items)?value.items.length:0,c=value?.coverage
 const matched=Number.isInteger(c?.matched)?c.matched:null
 const partial=value?.truncated===true||c?.complete===false||(matched!==null&&matched>loaded)
 return {loaded,matched,partial,label:matched!==null?`已载入 ${loaded} / ${matched} 条匹配结果${partial?' · 部分结果':''}`:`已载入 ${loaded} 条${partial?' · 来源仅返回部分结果':''}`}
}
export function resultPage(rows,index,size){
 const pageSize=Math.max(1,Math.floor(size)||1),pages=Math.max(1,Math.ceil(rows.length/pageSize)),page=Math.max(0,Math.min(Math.floor(index)||0,pages-1))
 return {page,pages,items:rows.slice(page*pageSize,(page+1)*pageSize)}
}
export const HOST_PAGINATION_INSTRUCTION='集合展示由宿主管理分页，模型只绑定CLI及业务查询条件；不要用limit或slice把“每屏少显示”变成“少查询”。tool-view展示已返回的完整集合，不需要自写翻页state/action。上游仅返回部分结果时保留partial；不能声称全量或无匹配。'

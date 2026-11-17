export const CONTENT_MODES=Object.freeze({continuous:'连续阅读',concise:'精简概览',guided:'逐层阅读'})
export const contentMode=value=>Object.hasOwn(CONTENT_MODES,value)?value:'continuous'
export function readingInstruction(value){
 const mode=contentMode(value)
 if(mode==='continuous')return ''
 return `【内容组织：${CONTENT_MODES[mode]}】尺寸只决定容器，不要求全文同时展开。${mode==='concise'?'首页目标120–180字说明、3–4个候选；保留关键答案，完整候选仍可筛选或进入详情。':'首页目标180–260字说明、一个主题选择、当前案例集合与一句结论；不同时铺开所有章节。'}这是可见内容目标，不裁切事实、不删除要求。用 region overflow="destination" label="具体案例/查阅原文" 放次级内容：宿主在同卡内进入具名目的地并提供返回、位置/状态恢复，不写上一页下一页或自建导航。详情只解释当前选择，证据在其中继续进入；不把相同事实复制到首页、图下注释与详情。普通选择用state/derive，不调用GLM。
书内/详情检索：将binding.input直接绑定当前实体和原文关键词，load="visible"，在证据目的地用tool-view消费。检索词不必等于界面概括名；空结果保留编辑关键词和原著入口，不伪造证据。宿主在目的地打开且参数有效后取数；改变选择后自动取消旧参数请求，返回保留选择。无需同时写onChange里的invoke或手动刷新。工具契约按需cli_describe；搜索书目不等于已读书内证据。`
}

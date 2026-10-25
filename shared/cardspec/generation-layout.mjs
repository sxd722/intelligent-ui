// Host-owned layout choice; never ask the model to infer this from pixel height.
export const normalizeCardSize = value => value === 'auto' ? 'auto' : 'square'
export function generationViewport(view={},target='page',{toolsEnabled=false}={}){
 const width=Number.isFinite(Number(view.width))?Math.min(432,Math.max(320,Number(view.width))):320
 const slot=target.startsWith('slot:'),natural=normalizeCardSize(view.cardSize)==='auto'
 const height=natural?780:slot&&view.height!=null&&Number.isFinite(Number(view.height))?Math.min(432,Math.max(48,Number(view.height))):width
 // Collapsed tools and follow-ups share one 44px row + 20px padding; reserve
 // another 8px for label variation. Expanded tools/history remain separate.
 // The renderer remains authoritative; never present this estimate as a fit test.
 const reserve=slot?0:(toolsEnabled?72:0)+(view.summary?50:0)
 return {width,height,contentHeight:height===null?null:Math.max(48,height-reserve),hostReservedHeight:reserve,estimated:true}
}
export function generationLayout(value, target = 'page') {
  const cardSize = normalizeCardSize(value), slot = target.startsWith('slot:')
  return { cardSize, width: 320, height: cardSize === 'auto' ? 780 : 320,
    maxTokens: slot ? 6144 : 8192, maxSourceCharacters: slot ? 12000 : 24000,
    instruction: `【宿主布局】${cardSize === 'auto'
      ? '自然高度：宽度320–432px，高度按内容延展，最高约780px且不超过设备稳定视口。按一屏组织结论、主体与操作；超量内容由宿主左右分屏、圆点标记，细节按需打开，不增加段落或重复上一屏/下一屏控件。'
      : '方形：320–432px等宽高，主体可用高度见context.viewport.contentHeight。每屏只保留短标题/视图选择、一个视觉主体、一句选中反馈和一行操作；不在主体下重复整组stats。查询表单、参数面板、完整矩阵、固定权重放region overflow="details" label="设置/明细"，需要时打开；主任务的当前结果直接可见。用一个view/step切换候选、详情、已保存方案，不能只切换图却在所有视图下常驻完整表单。保留必要的即时操作，其余按需打开，不以缩小字体或长滚动容纳一切。'}${slot
      ? '本次为局部内容，最多3个短区块、6条条目，输出约2000 tokens以内。'
      : '容量不随高度增长：全卡最多6个主要区块，单个方形视图至多3个；12条模型撰写的条目、非长文任务初始说明目标180–260字、条目摘要通常不超过40字，必要全文按需可达；总正文至多约1200字，完整实现约4500 tokens以内。'}超额需求先交付可用的核心内容并说明范围，详情按用户操作展开；数据/动作复用，不预生成所有分支。工具返回数据不需逐条重写。`
  }
}
export function appendGenerationContent(current, piece, policy) {
  if (current.length + piece.length > policy.maxSourceCharacters) {
    throw Object.assign(new Error('生成内容超出容量预算；压缩正文和重复结构，输出一个完整可用的核心版本。'), { code: 'GENERATION_CAPACITY' })
  }
  return current + piece
}

// Strip presentation boilerplate, not domain constraints. No extra model turn.
export function discoveryQuery(goal){
 const parts=String(goal||'').split(/[\n；;]+/).map(s=>s.replace(/^\s*[-#*\d.、]+\s*/,'').trim()).filter(Boolean)
 const content=parts.filter(s=>!(/^(?:布局|配色|视觉|风格|字号|圆角|卡片尺寸|动效|design|layout|style)\s*[:：]/i.test(s)))
 const lines=content.length?content:parts,joined=lines.join('；')
 if(joined.length<=900)return joined
 // Refined briefs often put sourcing last. Reserve room across the brief.
 const selected=new Set([0,lines.length-1])
 const useful=/检索|原文|书目|著作|资料|搜索|工具|来源|数据|查询|查找|播放|预订|search|source|data|book|read/i
 for(const i of lines.map((s,i)=>useful.test(s)?i:-1).filter(i=>i>=0).reverse().slice(0,3))selected.add(i)
 for(let n=1;n<=3;n++)selected.add(Math.round((lines.length-1)*n/4))
 return [...selected].sort((a,b)=>a-b).map(i=>lines[i].slice(0,105)).join('；').slice(0,900)
}
export function intentGroups(query){
 const groups=[]
 if(/阅读|原著|书籍|书目|文学|著作|书内|论文|\b(reading|literature|literary|books?|scholarship)\b/i.test(query))groups.push('reading')
 for(const [group,pattern]of Object.entries({travel:/通勤|到站|地铁|出发|旅行|旅游|行程|火车|机票|酒店|景点|travel|train|flight/i,news:/新闻|选情|时事|报道|news|crisis/i,movies:/电影|观影|影片|movie|film/i,weather:/天气|气温|降水|weather|forecast/i,finance:/股票|股价|基金|证券|财报|stock|finance/i,dining:/餐馆|饭店|美食|restaurant/i,social:/舆情|评论|用户反馈|社交|social|reviews/i}))if(pattern.test(query))groups.push(group)
 return groups
}

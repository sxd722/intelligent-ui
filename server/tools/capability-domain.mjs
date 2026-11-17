// Host vocabulary, not another model schema. Preserve the caller's domain in traces.
const aliases={
 reading:/\b(reading|books?|literature|literary|scholarship|bibliography)\b|阅读|图书|书籍|文学|书目|原著|书内|著作|论文/i,
 learning:/\b(learning|education|tutorials?)\b|学习|教学|教程/i,
 travel:/\b(travel|tourism|trip)\b|旅行|旅游|景点/i,
 movies:/\b(movies?|films?|cinema)\b|电影|影视|观影/i,
 games:/\b(games?|gaming)\b|游戏|二次元/i,
 finance:/\b(finance|stocks?|investing)\b|股票|财经|金融/i,
 shopping:/\b(shopping|products?|commerce)\b|购物|商品/i,
 weather:/\bweather\b|天气|气温/i,
 travelTransport:/\b(transport|rail|trains?)\b|交通|火车|高铁/i,
 social:/\b(social|sentiment|opinion)\b|舆情|社交/i,
}
export function capabilityDomains(domain){return Object.entries(aliases).filter(([,r])=>r.test(String(domain||''))).map(([k])=>k==='travelTransport'?'travel':k)}
export function personalTool(tool){return /\b(your|my|personal|bookshelf)\b|本人|个人|书架/.test(tool.description||'')||['shelf','notebooks','highlights','notes','liked','marks','history'].includes(tool.command)}
export const personalIntent=q=>/\b(my|mine|personal|bookshelf)\b|我的|本人|书架|我.*(?:划线|笔记|收藏|标记)/i.test(q)
export function entryTool(tool){
 // Public query-first adapters can resolve entities themselves, e.g. book-search.
 const required=tool.inputSchema?.required||[]
 return /^(search|movie-hot|top250|book-hot|forecast|current|trains|hotel-search|flight|hot|ranking|attraction)$/.test(tool.command||'')||(!personalTool(tool)&&required.some(k=>/^(query|keyword|book|title)$/.test(k))&&!required.some(k=>/id$|^bvid$|^url$/i.test(k)))
}

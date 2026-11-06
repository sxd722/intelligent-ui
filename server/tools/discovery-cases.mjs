// Human-authored expectations, deliberately independent of the retriever/LLM.
// Each required group permits semantically valid alternatives. Dependencies are
// not mandatory unless the user actually requests the additional information.
const c=(id,prompt,groups,optional,note,live=[])=>({id,prompt,expected:{groups,optional,note},live})
export const DISCOVERY_CASES=[
 c('01-movies','今晚看什么',[['opencli.douban.movie-hot','opencli.douban.top250','opencli.douban.search']],['opencli.douban.subject','opencli.douban.photos','opencli.tvmaze.search'],'自然表达可先给电影候选；有明确片名再搜索，详情依赖真实ID。',['opencli.douban.movie-hot','opencli.douban.top250']),
 c('02-rain','明天在杭州出门需要带伞吗',[['opencli.wttr.forecast']],['opencli.wttr.current'],'明天是预报，不能仅查当前天气。',['opencli.wttr.forecast']),
 c('03-rail','周五杭州东去上海南，下午两点以后有哪些车，帮我比较票价',[['opencli.12306.trains'],['opencli.12306.price']],['opencli.12306.stations'],'先查车次，票价使用结果的train_no和区间；时间过滤交给工具。',['opencli.12306.stations','opencli.12306.trains']),
 c('04-family','周末在萧山带三岁孩子玩两天，先找适合的地方',[['opencli.ctrip.search','opencli.dianping.search','opencli.xiaohongshu.search']],['opencli.wttr.forecast','opencli.dianping.shop','opencli.xiaohongshu.note','opencli.xiaohongshu.comments'],'目的地/店铺或亲子经验均可；不选已停用的ctrip.attraction。'),
 c('05-food','杭州今晚想吃点清淡的，找几家适合带娃的店',[['opencli.dianping.search']],['opencli.dianping.shop','opencli.xiaohongshu.search','opencli.xiaohongshu.note'],'本地餐饮优先点评；详情使用shop_id，不能凭空给评分。'),
 c('06-cars','尊界这车最近口碑怎么样，看看车主评价和大家讨论',[['opencli.dongchedi.search'],['opencli.dongchedi.koubei'],['opencli.weibo.search','opencli.xiaohongshu.search','opencli.bilibili.search','opencli.zhihu.search']],['opencli.dongchedi.score','opencli.dongchedi.series','opencli.weibo.comments','opencli.xiaohongshu.comments','opencli.bilibili.comments','opencli.weibo.post','opencli.xiaohongshu.note','opencli.zhihu.question','opencli.zhihu.answer-detail'],'车系识别→车主评价，加一类社交样本；评分/参数不等于舆情。'),
 c('07-shop','想买个五百元以内的降噪耳机，比较价格和差评',[['opencli.jd.search','opencli.smzdm.search'],['opencli.jd.reviews']],['opencli.jd.item','opencli.jd.detail'],'查商品，真实SKU再查评价；值得买可补充好价。不得加入购物车。'),
 c('08-learn','找能看懂注意力机制的讲解视频，顺便提炼字幕重点',[['opencli.bilibili.search','opencli.youtube.search'],['opencli.bilibili.subtitle','opencli.youtube.transcript']],['opencli.bilibili.summary','opencli.bilibili.video','opencli.youtube.video'],'先查视频再读真实bvid/url字幕；不能把搜索摘要当字幕。'),
 c('09-listen','通勤路上想听点天文学，不要音乐',[['opencli.apple-podcasts.search']],['opencli.apple-podcasts.episodes','opencli.xiaoyuzhou.podcast','opencli.xiaoyuzhou.episode','opencli.xiaoyuzhou.podcast-episodes'],'播客检索+可选节目列表；不需要Spotify播放控制。',['opencli.apple-podcasts.search']),
 c('10-book','最近有什么值得读的书',[['opencli.douban.book-hot','opencli.weread.ranking']],['opencli.douban.search','opencli.douban.subject','opencli.weread.search','opencli.weread.book'],'图书榜单与详情；不查电影热门榜。'),
 c('11-notes','找一下我在微信读书里划过线的句子',[['opencli.weread.shelf','opencli.weread.notebooks'],['opencli.weread.highlights']],['opencli.weread.book'],'个人阅读记录需登录；先获得bookId再读取划线。'),
 c('12-dictionary','serendipity是什么意思，给我真实例句',[['opencli.dictionary.search'],['opencli.dictionary.examples']],['opencli.dictionary.synonyms'],'释义与例句分开工具；参数不是任意query。',['opencli.dictionary.search','opencli.dictionary.examples']),
 c('13-country','冰岛的首都、人口和货币是什么',[['opencli.rest-countries.country']],['opencli.wikipedia.search','opencli.wikipedia.summary','opencli.wikidata.search','opencli.wikidata.entity'],'国家结构化信息首选rest-countries；百科可补充背景。',['opencli.rest-countries.country']),
 c('14-market','今天A股哪些板块涨得多',[['opencli.eastmoney.sectors']],['opencli.eastmoney.index-board','opencli.eastmoney.rank','opencli.eastmoney.kuaixun'],'板块排行而非个股榜；实际来源失败需要保留错误。',['opencli.eastmoney.sectors']),
 c('15-games','最近有什么热门电脑游戏可以玩',[['opencli.steam.top-sellers']],['opencli.steam.search','opencli.steam.app'],'Steam热销是可用候选来源，不等同于质量排名。',['opencli.steam.top-sellers']),
 c('16-news','最近创业圈都在讨论什么',[['opencli.36kr.news','opencli.hackernews.top','autocli.hackernews.top','opencli.hackernews.search']],['opencli.hackernews.read','opencli.hackernews.show','opencli.hackernews.ask','opencli.google.news','opencli.v2ex.hot'],'36氪或创业技术社区；可以取一个主源，非所有新闻工具。',['opencli.36kr.news','opencli.hackernews.top']),
 c('17-multi','今天杭州冷不冷，晚上回家看什么放松',[['opencli.wttr.current'],['opencli.douban.movie-hot','opencli.douban.top250']],['opencli.wttr.forecast','opencli.douban.subject','opencli.douban.search','opencli.bilibili.hot'],'双意图应同时覆盖天气与观影，而非只选匹配分最高的领域。',['opencli.wttr.current','opencli.douban.movie-hot']),
 c('18-static','做一个会呼吸的圆，点击切换颜色，不需要实时信息',[],[],'纯本地视觉与状态交互：应选零CLI。'),
 c('19-write','把我Spotify正在放的音乐暂停',[['opencli.spotify.pause']],['opencli.spotify.status'],'可发现写能力，但不能在生成阶段执行；需要独立用户动作和宿主确认。'),
 c('20-hotel','下周六到下周日住杭州，想找三百元以内的酒店',[['opencli.ctrip.hotel-search']],['opencli.ctrip.hotel-suggest','opencli.ctrip.search','opencli.dianping.search'],'真实入住/退房日期+城市；不选旧版未支持的hotel详情。')
]

export function assessSelection(fixture,selected){
 const ids=[...new Set(selected.map(s=>s.id))],{groups,optional}=fixture.expected,allowed=new Set([...groups.flat(),...optional])
 const missing=groups.filter(g=>!g.some(id=>ids.includes(id))),unexpected=ids.filter(id=>!allowed.has(id))
 return {passed:missing.length===0&&unexpected.length===0,covered:groups.length-missing.length,required:groups.length,missing,unexpected,scope:'人工预设的能力覆盖及无关工具检查；不等于数据正确或卡片交互验收'}
}

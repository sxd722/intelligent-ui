import {CASES} from './direct-benchmark-cases.mjs'
const baseline=['01-counter','08-calendar','10-chart','12-flowchart','14-quiz','17-card-battle','19-media','20-cart']
export const AUDIT_CASES=[
 ...CASES.filter(c=>baseline.includes(c.id)).map((c,i)=>({...c,cardSize:i%2?'auto':'square'})),
 {id:'21-world-clock',area:'时间与真实数据',cardSize:'auto',prompt:'都柏林、赫尔辛基和上海世界时钟和天气状况，每小时刷新一次。',checks:['三地实际时区与自动走时','天气独立查询，3600秒刷新，失败不隐藏时钟']},
 {id:'22-pomodoro',area:'未支持的持续时间能力',cardSize:'square',prompt:'做一个25分钟番茄钟，可以开始、暂停、继续、重置，到时间提醒；带三项可勾选任务。',checks:['真实自动倒计时，不用手动推进冒充','暂停/继续保持剩余时间；若不支持应明确说明']},
 {id:'23-movie-analysis',area:'真实数据与内容依据',cardSize:'auto',prompt:'对豆瓣top3电影做一些简单的结构分析和观影赏析，互动性强一点。',checks:['真实榜单与分析的电影对应','分析依据明确；不能靠排名或译名编剧情']},
 {id:'24-weekend-movies',area:'工具结果与页面生成',cardSize:'square',prompt:'周末观影选择，先筛选影片加入候选，比较评分，再打开一部的详情和观影赏析。',checks:['多选、取消、比较正确','保留业务影片ID，详情依据真实资料']},
 {id:'25-rail-weather',area:'多工具组合',cardSize:'auto',prompt:'展示今日杭州天气，以及杭州东到上海南下午的车次，选车次查看详情。',checks:['日期使用当天，下午查询在服务端过滤','显示真实座位类型，不把布尔字段当数量']},
 {id:'26-hotel',area:'参数澄清与工具发现',cardSize:'square',prompt:'周末去杭州，做一张携程酒店比较卡，输入入住和离店日期，按价格筛选并查看详情，不下单。',checks:['不猜缺失日期，不自动下单','搜索与详情参数匹配，失败可重试']},
 {id:'27-news',area:'资讯与刷新',cardSize:'auto',prompt:'获取 Hacker News 当前前五条，选择一条展示摘要，手动刷新，并能进一步解释这条新闻。',checks:['新闻来自工具且有出处','摘要不是把标题扩写为未经证实的事实']},
 {id:'28-mermaid',area:'结构化知识与图表',cardSize:'square',prompt:'用交互式结构图解释浏览器从输入网址到页面显示：DNS、TLS、HTTP、HTML解析、布局与绘制。点节点看一句说明，并能针对当前节点出一道小题。',checks:['结构关系和节点可达','图选择与说明联动，出题上下文正确']},
 {id:'29-lebesgue',area:'数学与抽象可视化',cardSize:'auto',prompt:'面向本科生解释勒贝格测度，用公式和可交互的区间覆盖示例帮助理解；不要把有限覆盖演示当成完整证明。',checks:['公式可渲染，说明数学边界','参数变化驱动可视化或数值，不只是文字']},
 {id:'30-branch-story',area:'创作与多步业务',cardSize:'square',prompt:'做三轮荒诞太空海关小游戏。第1轮是否帮助外星旅客会影响第3轮结局；每轮两个有代价的选项，选完先显示后果，按继续才进入下一轮；可重开。',checks:['三轮严格推进且结果停留','前序选择影响结局，重开清空']},
 {id:'31-budget',area:'表单计算与零值',cardSize:'auto',prompt:'做旅行预算试算卡，交通、住宿、餐饮三项可改金额，人数可调；显示合计、人均和饼图或柱状图。0人数不能除零。可以保存一次方案再继续修改比较。所有数据是用户输入示例。',checks:['0人数有保护，图与值联动','保存是快照，不跟随之后修改']},
 {id:'32-reading-explore',area:'图片与局部生成',cardSize:'square',prompt:'做一张给孩子的森林观察卡，鸟、叶子、蘑菇三个图文观察项，点击后显示小任务；可记录发现，再让AI根据选中项生成一个追问，在同一卡片局部更新。不要让孩子采摘或食用蘑菇。',checks:['三项短图文、任务联动','局部生成有选中上下文，保留观察记录']},
]

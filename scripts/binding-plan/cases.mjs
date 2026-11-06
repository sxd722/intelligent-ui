export const ROOT='artifacts/binding-plan-20261103',DEST='dist/binding-plan';
export const cases=[
 {id:'travel',title:'GLM · 湘湖探索与天气',modelProfile:'deep',prompt:'做一张湘湖两天游玩卡片。先让我查询真实景点，多选候选，查看详情和比较；查询词可以修改并重新搜索。天气按我选择的城市查询，能手动更新。周六周日分栏展示我的安排，不能写死行程。保留来源与缺失信息，不把短期预报当周末预报。用真实工具，界面尽量紧凑，交互状态可以恢复。',requirements:['真实景点查询','参数变化重新取数','多选/详情/比较','天气绑定与刷新','刷新恢复']},
 {id:'weather',title:'DeepSeek · 城市天气切换',prompt:'杭州今天适合出门吗？给我一个真实天气小卡，能输入其他城市再查询，也能刷新当前城市。用天气图标和简短温度，失败时保留上次内容。',requirements:['真实天气','修改城市后重新取数','刷新与失败保留']},
 {id:'news',title:'DeepSeek · 科技新闻浏览',prompt:'做一个实时科技新闻卡，看看 Hacker News 热门内容，可手动刷新，按标题在已取得的内容里筛选，点一条看详情或原文。不要把新闻写死，保留阅读选择。',requirements:['真实新闻','本地筛选','详情或来源','刷新绑定']}
];

import {mkdir,writeFile,access} from 'node:fs/promises'
export const root='artifacts/stitch-samples-20261103'
export const styles=[
 {id:'pearl',name:'Pearl 珠光编辑',tokens:'暖白 #F5F2EC、墨色 #242730、雾紫 #8478B7、低饱和桃色。编辑式排版、柔和珠光、局部内发光、细腻环境阴影。内容锐利可读，避免所有区域套玻璃面板。'},
 {id:'atlas',name:'Atlas 暗色仪表',tokens:'深蓝黑 #101923、偏白 #EEF3F8、青色 #65DED0、琥珀色 #F2BD68。精确网格与刻度、局部辉光、等宽数字。图形与深色卡面融合，不得有白色SVG底板；不是拥挤的科幻驾驶舱。'},
 {id:'field',name:'Field 自然探索',tokens:'浅苔色 #EDF2E8、森林绿 #264F42、暖白 #FFFCF5、陶土色 #C47756。真实图片、自然色面、空间组织与柔和几何；轻盈排版，不层层套卡。'},
 {id:'persona',name:'Persona 活力海报',tokens:'奶油白 #FFF3D5、深墨 #241F2A、珊瑚红 #EF6654、钴蓝 #4265DF。大字号对比、局部倾斜、切片图片、醒目数字、票签标签。正文和控件保持正向易读；艺术性而非花哨。'}
]
export const cases=[
 {id:'places',name:'地点探索',tool:'opencli.dianping.search',body:'杭州亲子地点搜索。字段shop_id/name/district/cuisine/rating/price/url；图片与坐标是宿主条件资源，本设计可使用地理位置明确的示例地点作为样例，不将图片或坐标假装成工具必有字段。地图作为主视觉，占约45%空间，下方紧凑图片候选；点图片选入，角落勾选，不遮挡图片，地图对应pin同步高亮。按区域/人均筛选当前结果，最多选3处。不生成旅游行程。样例湘湖、浙江省科技馆、杭州长乔极地海洋公园，价格/评分只用设计样例，勿表现为实时事实。'},
 {id:'trains',name:'车次时间轨道',tool:'opencli.12306.trains',body:'指定日期杭州东到上海南下午车次。字段code/from_station/to_station/start_time/arrive_time/duration/second_seat，日期来自查询参数，train_no仅为内部实体ID。使用时间轨道和票券式焦点，对比出发到达时间与有票状态；可筛选下午时段/有票并固定一班，固定后显示清晰摘要。不添加票价、起售倒计时、支付或购票成功。使用G101/G103/G105作为设计用样例车次，时间14:00—15:10、15:20—16:35、17:00—18:05。'},
 {id:'movies',name:'电影海报牌阵',tool:'opencli.douban.top250',body:'从一次返回的电影中挑两部。字段id/title/rating/url，可选year/genres，海报由宿主提供；无海报用文字封面。主视觉是圆弧/空间聚焦的海报牌阵，一张主海报、两侧露出相邻候选，评分与简洁年份/类型同步切换，角落勾选并可比较两部。不要大面积翻页按钮。不虚构片长、剧情、票价、播放平台或推荐匹配分数。样例星际穿越、千与千寻、机器人总动员；设计数据不宣称实时榜单。'},
 {id:'weather',name:'三日温度景观',tool:'opencli.wttr.forecast',body:'杭州未来最多3天，字段date/description/avgTempC/minTempC/maxTempC，可选sunset。以统一刻度的最低—最高区间图为核心，选择日期联动温度数字和天气形态，轻量云雨动画只表达对应天气。样例11月4日多云12—20°C、5日小雨10—16°C、6日晴9—19°C，均为设计样例。不生成逐小时/7日天气、降雨概率、空气质量。0度不是缺失值，未知数据保留缺口。'},
 {id:'scores',name:'车型维度对比',tool:'opencli.dongchedi.score',body:'已选车型对比同级评分，字段dimension/score/same_level_avg；只展示评分，不展示舆情正负面、安全结论或投诉数量。主视觉为统一刻度的哑铃图/基准差异图，点击维度突出双方分数和差值，支持差值排序和绝对值/差值切换。样例5分制：空间4.5/4.1、舒适4.4/4.0、操控3.8/4.0、能耗4.0/4.2，标尺不可夸大差异。突出一个选中维度，其他维度保持可达，不用雷达图取代精确比较。'}
]
const common=`为现有生成式卡片系统设计一个单工具组件。只输出一张完整、精致的368×368正方形卡片，不是整款App、不做手机外框、不加状态栏/侧栏/全局底栏/聊天/账户。不生成设计说明页或多卡拼图。
本轮只是4套视觉语言×5工具=20张样板中的一张。每个风格家族跨工具保持一致：中文system sans/Noto Sans SC，主体数字32px，标题20px，正文14px，辅助文字12px；4/8px间距体系，卡片内边距16px，外圆角24px，内部圆角12px，细弱分隔、少边框，不堆叠面板。触控区域尽量44px。主要信息和操作在368px高度内，无纵向滚动，不能靠裁切或微小文字过关。
一个主要视觉主体+一个核心联动。地图优先于地点列表，图形优先于bullet points，海报优先于文字堆砌；有意义的图片/SVG丰富视觉。不同工具构图不同，不能全部用标题+统计数字+列表。照片选中只加角落勾选，不加遮挡蒙版。
首屏呈现一个自然的选中状态并使可交互区域易发现。允许在同卡内切换轻量详情/比较，不添加第二层整页导航。不要无意义保存A/B，不强行两个后续入口。来源/更新时间收在小信息入口，不占正文。不增加其他CLI能力。
未来将适配2×2/2×4/4×4/miniapp，但本轮只生成4×4方形样板。保持专业精确信息与趣味探索结合，不要同时输出三种模式。示例数据仅服务视觉设计，无需把免责声明印满卡片。只设计，不声称已接通真实工具。`
await mkdir(root+'/prompts',{recursive:true})
for(const s of styles)for(const c of cases){await writeFile(`${root}/prompts/${s.id}-${c.id}.txt`,`${common}\n\n统一风格：${s.name}\n${s.tokens}\n\n本组件：${c.name}\n工具：${c.tool}\n${c.body}\n同项目内保持已有同风格样板的材质、字型、圆角和控件语言。`)}
try{await access(root+'/manifest.json')}catch{await writeFile(root+'/manifest.json',JSON.stringify({createdAt:new Date().toISOString(),cli:'@google/stitch@0.12.1',status:'awaiting-auth',target:20,projects:{},screens:styles.flatMap(s=>cases.map(c=>({id:`${s.id}-${c.id}`,style:s.id,case:c.id,title:`${s.name} · ${c.name}`,tool:c.tool,status:'pending',prompt:`prompts/${s.id}-${c.id}.txt`})))},null,2))}
console.log('Prepared 20 scoped prompts; no remote generation performed.')

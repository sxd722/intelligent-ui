// Task defaults are composition guidance, not a second DSL or fixed content.
// A data-dependent view must still pass evidencePresentation's field gates.
export function taskPresentation(task,{opinion=false,candidateTools=false}={}){
 if(['understand','organize','practice'].includes(task.kind))return {recipe:'linked-reading',components:['segmented','collection','region','facts'],layout:'问题与结论 → 主题/对象选择 → 当前对象的事实与解释并置 → 过程或证据按需展开',interaction:'主题改变关联案例集合；选案例同步更新解释与证据，入口显示案例名。正文不是重复选择列表；普通阅读不强造按钮。',gate:'以实际资料建立主题→案例→证据关系。compare并置观点，sequence表达步骤；无可信关系不画连线图。测试选择后实际结果变化与详情信息增量，不能仅测试选中样式。'}
 if(opinion)return {recipe:'opinion-evidence',components:['chart','segmented','task-board'],layout:'一行结论与样本量 → 分类分布主视觉 → 来源/主题筛选 → 少量代表原文及展开详情',interaction:'选择分类或来源，计数与原文样本联动；原文可跳转。',gate:'仅已引用原文的分类可画分布；未分类单列。无分类时先呈现真实样本；媒体评测与用户发言分开。日期齐备才画时间线。'}
 if(task.kind==='monitor')return {recipe:'change-evidence',components:['stat','chart','segmented'],layout:'当前值与时间口径 → 趋势主视觉 → 异常/事件明细',interaction:'切换指标或时间范围，图和明细同步；刷新调用真实绑定。',gate:'无多时点数据不画趋势；抓取时间不是事件时间；缺数据保留空态。'}
 if(task.kind==='find')return candidateTools?
  {recipe:'candidate-explorer',components:['tool-view','task-board'],layout:'紧凑搜索条件 → 地图/海报/候选主体 → 同实体详情',interaction:'筛选改变完整候选集合，选择进入详情，返回保留条件。',gate:'优先工具的hostView；只有真实坐标才用地图。宿主负责字段、分页和选择。'}:
  {recipe:'fact-evidence',components:['facts','stat','list','link'],layout:'一句直接答案 → 2–4个带口径的关键事实 → 按需展开证据',interaction:'点击事实核对来源；若仅有报道或预测，分别标明口径。',gate:'无可靠数值不画图；事实、预测、用户评价不可混为同一指标。'}
 return undefined
}

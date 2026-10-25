export const RICH_CASES=[
  {id:'21-mermaid-flow',area:'Mermaid流程',prompt:'用Mermaid做一个可点击的退款流程图：申请→审核→退款，审核拒绝回到申请。点击节点下方显示节点ID。用mermaid组件，图要完整可查看，不需要图片。',checks:['有效SVG','选择ID联动','320px全貌与展开']},
  {id:'22-mermaid-sequence',area:'Mermaid时序',prompt:'用mermaid组件做缓存读取时序图，参与者为用户、服务、缓存；用户请求服务，服务查询缓存，缓存返回结果，服务回复用户。点击参与者显示其名称。不需要图片。',checks:['时序四消息','参与者选择']},
  {id:'23-mermaid-state',area:'Mermaid状态',prompt:'用mermaid组件展示文章从草稿到审核到发布的状态图，审核可以退回草稿，包含开始与结束节点。点击状态显示名称。',checks:['状态图与回退','选择']},
  {id:'24-mermaid-er',area:'Mermaid实体关系',prompt:'用mermaid组件做顾客与订单的ER图，一位顾客可以有多个订单。顾客有name，订单有amount。简短介绍关系含义。',checks:['ER实体与关系','手机全貌']},
  {id:'25-mermaid-class',area:'Mermaid类图',prompt:'用mermaid组件展示Animal与Cat的继承关系类图，Animal有name属性，Cat有meow方法。提供简短中文解释。',checks:['类关系','手机全貌']},
  {id:'26-mermaid-xy',area:'Mermaid数据图',prompt:'用mermaid的xychart-beta做示例柱状图，Mon=20、Tue=-10、Wed=30。不得增加数据。提供简短说明，不做节点选择功能。',checks:['正负数SVG','手机全貌']},
  {id:'27-choices',area:'新增选择控件',prompt:'做预约演示卡，用select选择上午或下午，用radio-group选择线上或线下。用segmented选择普通或加急。下方实时显示这三个选择。不需要提交和图片。',checks:['三个控件受控选择','摘要更新']},
  {id:'28-table',area:'表格',prompt:'用table做价格比较，示例苹果3元、牛奶8元、面包5元。两列商品和价格；点击某行显示选中商品名称和金额。不要增添数据。',checks:['三行两列','行选择']},
  {id:'29-swipe',area:'滑动卡堆',prompt:'用swipe-stack做3张学习方法卡，分别是主动回忆、间隔练习、费曼讲解。左划跳过、右划收藏，显示收藏数量，每项只处理一次，结束后可重新开始。收藏成功时用confetti轻量反馈。',checks:['左右决策','不重复计数','重开']},
  {id:'30-popover',area:'浮层',prompt:'做可调学习时长卡，slider从10到60分钟，点击“安排建议”用popover展示当前时长对应的建议，浮层中可填写“备注”，关闭再打开保留备注。',checks:['浮层关闭再开','输入保留']},
  {id:'31-code-math',area:'代码与公式',prompt:'用math显示平均数公式，用code块显示JavaScript的const mean = total / count;。提供总和120与数量3的数字输入，显示计算结果；数量不能小于1。',checks:['公式可渲染','代码字面量','计算更新']},
]

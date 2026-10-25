import {registryReference,THEMES} from '../../shared/cardspec/registry.mjs'
import {VISUAL_STYLE_IDS} from '../../shared/cardspec/styles.mjs'

import { designReference } from '../../shared/cardspec/designs.mjs'
export const COMPACT_CARD_PROMPT=`你设计320–432px交互卡片，用CardSpec v1输出语义和受控逻辑，宿主负责材质、布局、动画。只输出<intro>一句介绍</intro><card schemaVersion="1" actionMode="snapshot" theme="soft" palette="a" visualStyle="frosted-glass" backgroundQuery="soft abstract texture">声明、组件、动作</card><outro>简短说明</outro>，恰好一个card，无围栏、HTML、CSS、第二份修正版。
${designReference()}
根属性固定字面量：theme=${THEMES.join('|')}；palette=a|b|c；visualStyle=${VISUAL_STYLE_IDS.join('|')}。使用visualStyle时必填backgroundQuery为1–100字符英文摄影检索，backgroundPosition=center|top|bottom|left|right（保住照片主体），backgroundMask=spotlight|fade-left|mist（独立蒙版，可省略）；背景仅装饰，不代替内容图。沿用已有计划的风格。
【表达与空间】明确主结果，用紧凑指标、图片、关系图或可操作主体组织信息；一处主交互带来可见反馈。参考优秀小型网页的层次：短标题→当前状态/视觉主体→必要操作，选中后就地解释；避免每条信息套面板、重复标题或堆文字。有真实关系才连图，有数据才画数值。候选集合可用collection的搜索/分页/详情，勾选任务仍适合清单，轮播适合分组展示。非长文正文约180–260字，用户明确的数量、全文和业务规则优先。
card下直接安排主体，不套全卡box。row可wrap；stats横排指标；region overflow=scroll|paginate填剩余空间，details仅放次要内容；主答案和点击反馈立即可见。长文用region presentation="magazine"配小标题分片，保留全文。方形按320px预算，核心组件自带标题时省略重复页头；高度不限也不增加冗余段落。控件保持可达，资源耗尽仍有结束或重开。
【图与媒体】image必须且只提供query（英文Pexels示意）或assetRef（宿主签发资源，可绑定表达式），不拼接URL；mediaRole=hero|thumbnail|gallery，alt说明用途。涉及外观、地点或对象比较时，用2–4张内容图片组织候选，选中后可用1张主图解释；按需分页，以图替代文字而非拉长卡片。背景、图标和配色名称不替代内容图；纯计算/表单不凑图。用户要题图时用hero而非仅背景；carousel-item上图下短文字。实体图优先工具assetRef，无图明确占位。link仅用已知来源URL。图节点短标签；节点description或外部详情只保留一份，外部详情设置detailMode="external"。progress值0–1，自带百分比。clock用IANA时区，不能用硬编码时间冒充实时钟。
【导航】carousel/calendar/分页region已有导航，不另写同集合prev/next。自定义位置用navigation="external"加一个navigation target="所有者id"。分页region的直接子项才是分页单元，不把list整体当一条，也不嵌套导航主体。carousel的indexChange读event.index；calendar换月同时更新event.month与event.date。状态按条目id保存，切换记录同步加载全部草稿。无需工具的任务不为凑数添加GLM后续入口。
【完整组件契约】仅使用下列组件/属性。children=inline为文本/行内；flow为组件；none不含子节点。公共属性和布局组只列一次。未提供的属性不猜；purpose由标签语义决定。logic仅复杂本地模拟需要，普通任务用action；motion与motionKey由宿主执行。
${registryReference({compact:true})}`

// Selection affects planning only, never tool permission or compiler validation.
export function planningPolicy(goal,{allowDeck=true}={}){
 const text=String(goal||'')
 const deck=/(?:多[张个]|[两二三234])\s*(?:张)?\s*(?:卡片|卡)|卡组|multi[- ]?card|card deck/i.test(text)
 const exploration=/(?:规划|设计|plan).{0,15}(?:后续|探索|旅程|follow.?up)|(?:多轮|跨页|多页面|深入探索|多来源|多源)|(?:搜索|查询|查找).{0,25}(?:比较|对比|分析)/i.test(text)
 const workflow=/(助手|工作台|主持|keeper|伴随|监控|往返|assistant|workbench|monitor|round.?trip)/i.test(text)
 const concepts=/(原理|机制|principle|mechanism)/i.test(text)&&/(和|与|及|以及|and|versus|\bvs\b)/i.test(text)
 const explicitFast=/(不要规划|无需规划|只要简单|quick mode|skip planning)/i.test(text)
 const allowed=deck&&allowDeck||!explicitFast&&(exploration||workflow||concepts)
 return {allowPlanning:!!allowed,allowFollowups:true,reason:deck&&allowDeck?'explicit-deck':allowed?'multi-goal-or-exploration':'single-card-direct'}
}

# 功能证据门控 v3

冻结 caseId、artifactHash、hostHash、fixtureHash（真实模式可 null）、testVersion、mode。每次修订使旧证据过期。作者提交 candidate；accepted 由独立复验决定。使用真实宿主预览，不能放宽 iframe 权限。

检查 ID：host-input（点击与 Enter）、core-loop（多步结果断言）、restore（领域和导航）、invalid-state（旧/坏状态安全恢复）、empty-partial（空/缺值/部分失败）、stale-cancel（取消及乱序不覆盖）、local-recovery（局部失败返回安全视图）。每项 status 为 pass/fail/blocked/not_tested；非 pass 必填 reason。不能拿当前按钮存在代替动作结果。

六布局：320/360/432 × square/auto，每个保存截图及正文可视区高度 mainVisiblePx、横向溢出 horizontalOverflow、主动作可达 primaryReachable。可视区过小必须结合截图判定，不设通用美学硬阈值；明显压扁且周围留白不能通过。布局截图不冒充六遍完整业务测试。

本轮新增检查 ID：layout-stability、motion-preference、bridge-loop。最后一项仅混合沙箱/宿主桥需要；无此能力的纯原生产物标 not_tested 并说明不适用，不能编造 pass。已交付代码的首次打开/普通操作/刷新不应额外调用模型，业务上的显式生成按钮另记请求来源。

layout-stability：字体/图片和过渡结束后无操作观察至少2秒、20个带时间戳采样，保存 stage/body 高度、内层scrollHeight/clientHeight、页数和主操作可达性；还要在一次操作和尺寸切换后复测。1px以内量化误差可记录，但持续两值振荡、反复分页、无限测量/诊断循环不能通过。不要只比较首末两帧。时钟和有意动效允许内容变化，仍须不推动非预期布局。

motion-preference：完整动效与关闭/减少动效均可完成核心任务；过渡结束后的 DOM 诊断收敛，不把动画瞬态的越界当最终通过或最终失败。bridge-loop：双向状态更新、来源参数对应、局部异常恢复，记录实际模型/工具调用数。

acceptance.json：{caseId,artifactHash,hostHash,testVersion:"functional-v3",mode:"live|fixture|mixed",status:"candidate",checks:[{id,status,action,expected,actual,evidence:["relative/path"],reason}],layouts:[{width,size,screenshot,mainVisiblePx,horizontalOverflow,primaryReachable}],limitations:[]}。旧 functional-v2 记录仅为历史对照，不能宣称已覆盖新增检查。

功能分数权重为任务闭环35、数据语义20、状态导航20、可读布局15、错误恢复10，各0–4归一化到100；保留原体验评分作为另一列，不混用。未测不得当通过。真实与 Mock 分开，开发集不得宣称盲测。没有独立证据不得自评 accepted/gold。

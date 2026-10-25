# 功能证据门控 v2

冻结 caseId、artifactHash、hostHash、fixtureHash（真实模式可 null）、testVersion、mode。每次修订使旧证据过期。作者提交 candidate；accepted 由独立复验决定。使用真实宿主预览，不能放宽 iframe 权限。

检查 ID：host-input（点击与 Enter）、core-loop（多步结果断言）、restore（领域和导航）、invalid-state（旧/坏状态安全恢复）、empty-partial（空/缺值/部分失败）、stale-cancel（取消及乱序不覆盖）、local-recovery（局部失败返回安全视图）。每项 status 为 pass/fail/blocked/not_tested；非 pass 必填 reason。不能拿当前按钮存在代替动作结果。

六布局：320/360/432 × square/auto，每个保存截图及正文可视区高度 mainVisiblePx、横向溢出 horizontalOverflow、主动作可达 primaryReachable。可视区过小必须结合截图判定，不设通用美学硬阈值；明显压扁且周围留白不能通过。布局截图不冒充六遍完整业务测试。

acceptance.json：{caseId,artifactHash,hostHash,testVersion:"functional-v2",mode:"live|fixture|mixed",status:"candidate",checks:[{id,status,action,expected,actual,evidence:["relative/path"],reason}],layouts:[{width,size,screenshot,mainVisiblePx,horizontalOverflow,primaryReachable}],limitations:[]}。

功能分数权重为任务闭环35、数据语义20、状态导航20、可读布局15、错误恢复10，各0–4归一化到100；保留原体验评分作为另一列，不混用。未测不得当通过。真实与 Mock 分开，开发集不得宣称盲测。没有独立证据不得自评 accepted/gold。

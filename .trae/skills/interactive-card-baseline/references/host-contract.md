# H5 宿主兼容与恢复

以当前工作区 AUTHOR-API.md 为能力事实源。现有 iframe 为 sandbox=allow-scripts，无直接网络；用 call/request 访问白名单工具，不修改宿主权限。

当前宿主的 form onSubmit 可能被浏览器沙箱阻止，即使 preventDefault 也无事件。搜索用显式 type=button onClick，并在输入 onKeyDown 的 Enter 分支调用同一函数。禁止实际 form 提交；不要为此添加 allow-forms。先在同权限宿主验证点击和 Enter 各一次，确认输入值、请求参数与结果对应。

状态分三类：domain（选择、数据）、navigation（页/方向/阶段）、transient（busy、controller）。前两类恢复并验证版本和字段；后一类不存。非法视图回首页，无效选择移除且解释，旧数据未知不当零。避免 normalize(normalize(x)) 丢 ID；稳定 ID 用 source+源 ID，缺 ID 从已验证源链接派生，不能按数组索引做实体身份。

可复用模式：`useSaved('session',{version:1,domain:{},navigation:{view:'home'}})` 后用纯函数验证对象、数组、枚举及实体引用。Boundary 的 onReset 回调切回安全视图并清理该视图损坏选择，保留其他有效数据。不要把全卡 clear storage 当唯一恢复。

摘要/规划传短引用 ledger（ID、来源、必要片段），回传引用必须在 ledger 中。分批结果独立校验，保留成功批次；未处理/未知/失败分别呈现。统计只从有效已标注样本计算，明确分母；不通过字符串修补伪造合法引用。

布局使用概览、主体、动作三层，状态区可折叠；长列表先筛选/分页。自然高度显式 min/max 与 flex min-height:0 配合，不让标题和错误条挤没主体。验收检查主体实际可见空间，而非只看横向溢出。

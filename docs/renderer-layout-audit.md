# 真实 DOM 布局验收

`src/cardspec/layout-audit.js` 提供纯读取的 `auditLayout(root, {noScroll})`。它不修改布局、状态或错误恢复策略，也不调用模型。`attachLayout` 将结果附加到现有 `cardspec-layout` / 调试页；沙箱复用同一函数，由可信 iframe renderer 通过已有 token 通道报告，宿主不穿透 opaque origin。

- `outerOverflow`：原卡片外层实际超出，保留原本的 emergencyScroll 语义。
- `containers`：每个有超限的内层元素、轴、available/clientHeight、demand/scrollHeight、overflow、CSS overflow 策略、是否允许；显式滚动仍被记录。
- `innerOverflow` / `overflow`：非纯装饰的最大超限；不会因外层刚好432px就声称零溢出。
- `controls`：控件实际尺寸、相对卡片及裁切祖先的完整可见性、多点命中遮挡。浏览器视口外的命中标为 unknown，不伪造遮挡。
- `issues` / `pass`：必要内容裁切、非约定的内滚动、不可见主控件与遮挡。警告不导致卡片白屏。

宿主测试可给容器 `data-layout-scroll="none"` 明确要求不滚动；`allow` 表示允许。此为宿主/测试标记，不增加 CardSpec 模型契约。已有显式滚动 region、横向图/表/轮播保留滚动策略；其内容区仍可观测。`noScroll:true` 强制严格样板门控。

`aria-hidden` 装饰图形的裁切被记录为 decorativeOnly，不冒充必要内容溢出。折叠 details 的未展开部分不当作被遮挡控件。必要文字使用 DOM Range 测量，`overflow:hidden`、零高容器也不能掩盖裁切。

命令：

```powershell
node scripts/audit-card-layout.mjs --url http://127.0.0.1:8787/pearl-review.html --selector .pearl-reference --no-scroll
$env:PEARL_PRODUCTION_QA='1'
node node_modules/@playwright/test/cli.js test --config playwright.pearl.config.mjs
```

CLI 打开独立 Chrome 测试 profile，不接管现有 Owl。非通过返回退出码1。普通调试页的诊断更新来自 resize、内容/状态变化、滚动、输入和 sandbox 内部报告。

## 当前范围与下一步

首轮用整卡 React/SVG 样板验证构图自由度；保留原 Pearl 作对照，未把所有储能/滑杆任务改成硬编码模板。共享值由 CardSpec state 持有，纯原生 fallback 有完整功能。样板确认后再抽取 PearlVisual、统一的无外壳 Slider/Chart 和整卡区域接口。

布局通过只代表几何与可操作性，不代表视觉风格被用户认可、事实正确或模型能稳定生成。同一份 acceptance 仍是 candidate。开发预览的冷模块下载与生产构建分别记录；WASM初始化期间的输入现在合并到最新值，避免在初始化前启动短输入期限，未提高执行权限或超时预算。

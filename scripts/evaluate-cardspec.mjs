import { mkdir, writeFile } from 'node:fs/promises'
import { createDeltaApplier, isControlEvent } from '../src/delta.js'

const cases = {
  counter: '做一个可增加、减少、归零的计数卡，带一个备注输入框。',
  water: '做一张每日8杯喝水记录卡，记录一杯、撤销一杯、重置，显示进度。没有历史记录。',
  checklist: '做一个20项搬家检查清单，任务名为任务1到任务20，可以逐项勾选，显示完成进度，所有项目必须能访问。',
  silkworm: '给小朋友做养蚕成长卡：卵、蚁蚕、成长、熟蚕、结茧、成蛾6个可选阶段，每日喂食、清洁、通风清单，观察记录输入。不要虚构历史。',
  travel: '做旅行清单卡，证件、行李、电子设备三个分类，至少每类两项，可筛选和勾选，输入预算，显示总体打包进度。',
  longtext: '做一张阅读卡，主题是健康的学习习惯，8条建议，每条至少60字，可滚动读完，带一个我已读完开关。',
  calendar: '做2026年8月示例新闻月历小卡片，完整显示月份，点击日期后下方caption切换新闻具体内容。示例数据：8月2日“研究发布：社区实验室发布开放学习工具，供学生比较不同学习方法。”；8月15日“公共展览：图书馆开放科学作品展，包含动手实验和阅读活动。”；其它日期显示暂无新闻。可切换月份。不要添加图片或额外统计。'
}
const options = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, '').split('=')))
const defaultCases = Object.keys(cases)
Object.assign(cases, {
  nurgle:'做一个纳垢模拟器，叫“慈父的幸福社区”，更有趣且黑色幽默。七天微型经营，腐朽、幸福、宠爱相互牵制；处理居民和一口有脾气的大锅，每天二选一。早期决定在后续事件兑现，结局根据管理风格不同。手机正方形卡片，不要图片。原创同人小游戏。',
  station:'做一个太空食堂经营小游戏，五个班次。照顾外星船员，资源和满意度要取舍，有一个前期决定会影响后续事件，有不同结局。语气轻松荒诞，手机小卡片，不要图片。',
  cloudComparison:'世界各个云服务厂商服务比较，做手机小卡片。使用概括性示例资料，不需要图片或实时价格；让我能浏览并挑出感兴趣的厂商。',
  learningQuiz:'做一个关于减少重复劳动的手机学习卡，给一道两选一的小题，选择后给反馈，可展开解释。不要图片。',
  focusEstimate:'做专注安排小卡片，可以调每轮10到50分钟、选择1到3轮，显示预计总时长和休息提示。不需要实际计时。',
  carousel:'做一张手机上看的咖啡冲煮三步骤卡，使用carousel左右滑动，每步有标题说明和独立备注输入。不加图片。',
  slider:'做专注时间设置卡，slider从5到60分钟每步5分钟，显示当前选择。只设置时长，不需要后台计时。',
  mindmap:'用mindmap做学习计划：中心是学习，分支为阅读与实践，阅读下有做笔记，实践下有做项目，点击节点显示说明。',
  flowchart:'用flowchart做一个流程：填写材料→审核→完成，审核不通过回到填写材料。节点可点击选择。',
  chart:'用chart做柱状图，示例净收入周一20、周二-10、周三0、周四35元，点击数据后显示选中值，不添加虚构数据。',
  media:'做自然观察卡，用Pexels示意图：题图query=forest sunlight，下面两个图文item的小图query分别为small bird和green leaf。题图用hero，item用thumbnail。'
})
const rounds = Number(options.rounds || 3), modes = (options.modes || 'direct,staged').split(',')
const selected = (options.cases || defaultCases.join(',')).split(',')
const base = options.base || 'http://127.0.0.1:8787', out = options.out || 'artifacts/cardspec-qa/real'
await mkdir(out, { recursive: true })
const jobs = selected.flatMap((name) => modes.flatMap((mode) => Array.from({ length: rounds }, (_, i) => ({ name, mode, round: i + 1 }))))
const results = []
async function run(job) {
  const started = Date.now(), frames = [], envelope = {}, applier = createDeltaApplier()
  let terminal, done = false, error, timings
  try {
    const response = await fetch(`${base}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: cases[job.name] }], format: 'cardspec', mode: job.mode }), signal: AbortSignal.timeout(210000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let buffer = ''; const decoder = new TextDecoder()
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true })
      let boundary
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const block = buffer.slice(0, boundary.index); buffer = buffer.slice(boundary.index + boundary[0].length)
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (data === '[DONE]') { done = true; continue }
          const frame = JSON.parse(data); frames.push({ ms: Date.now() - started, frame })
          if (frame.type === 'message_stream_complete') terminal = frame.status
          if (frame.type === 'stream_error') error = frame.error?.message
          if (frame.type === 'server_ste_metadata') timings = frame.metadata
          if (!isControlEvent(frame)) applier.apply(envelope, frame)
        }
      }
    }
  } catch (e) { error = e.message }
  const result = { ...job, status: terminal === 'succeeded' && done && !error ? 'succeeded' : 'failed', error, timings, elapsed: Date.now() - started, diagnostics: envelope.message?.metadata?.diagnostics, repairs: envelope.message?.metadata?.repair_count }
  const id = `${job.name}-${job.mode}-${job.round}`
  await writeFile(`${out}/${id}.json`, JSON.stringify({ ...result, source: envelope.message?.content?.parts?.[0], spec: envelope.message?.metadata?.card_spec, resources: envelope.message?.metadata?.resources, frames }, null, 2))
  results.push(result); console.log(`${id}: ${result.status} ${result.elapsed}ms${error ? ` ${error}` : ''}`)
  await writeFile(`${out}/summary.json`, JSON.stringify(results, null, 2))
}
await Promise.all(Array.from({ length: Math.min(2, jobs.length) }, async () => { while (jobs.length) await run(jobs.shift()) }))
console.log(JSON.stringify({ total: results.length, passed: results.filter((r) => r.status === 'succeeded').length, failed: results.filter((r) => r.status === 'failed').length }))
if (results.some((r) => r.status === 'failed')) process.exitCode = 1

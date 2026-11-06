import fs from 'node:fs/promises'
export const ROOT='artifacts/design-first-20261103',DEST='dist/design-first'
const goal=await fs.readFile(ROOT+'/goal.txt','utf8')
export const cases=[
{id:'host-weekend',title:'宿主构图 · 杭州周末',prompt:goal,toolsEnabled:false,requirements:['内容主视觉','筛选','多选','详情恢复']},
{id:'image-weekend',title:'图片先行 · 杭州周末',prompt:goal,designMode:'image-first',toolsEnabled:false,requirements:['复用真实生成图','筛选','多选','详情恢复']},
{id:'host-observe',title:'泛化 · 森林观察',prompt:'做一张森林观察卡，给出6个可探索对象，用图片候选而非长篇文字。可搜索、选中多个对象、打开观察要点、记录选择；细节按需出现。不需要实时工具数据。',toolsEnabled:false,requirements:['主视觉','选择','详情']}
]

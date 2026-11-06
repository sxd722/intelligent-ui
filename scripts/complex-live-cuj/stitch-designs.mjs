import {spawn} from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
const root='artifacts/complex-p0-20261103/stitch';await fs.mkdir(root,{recursive:true})
const entry=path.join(process.env.APPDATA,'npm/node_modules/@google/stitch/dist/stitch.js')
const run=args=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,[entry,...args],{shell:false,windowsHide:true}),out=[];p.stdout.on('data',x=>out.push(x));p.stderr.on('data',()=>{});p.on('error',reject);p.on('exit',code=>{const text=Buffer.concat(out).toString();code?reject(Error(text.slice(0,400))):resolve(text)})})
const project='13998568972144615073'
const structures=[
 ['trip','地图行程板','位置地图为主体，三处地点pin；下方两个紧凑候选；选中篮和日期天气；设置在抽屉。未知坐标不放假pin。'],
 ['decision','候选决策板','真实海报位置的图片网格，类型与评分chips，两项比较底栏，选定一项与撤销；缺图用文字封面。'],
 ['detail','实体与关联资料','主实体详情，相关内容横向短卡；主实体事实与主题搜索相关明确分层；返回保留候选。'],
 ['evidence','证据分析台','左侧紧凑时间线，分类统计的已读分母与未知，点击统计筛证据，正文抽屉；未读不加入统计。'],
 ['compare','对比取舍板','两列对象，共同比较字段，缺失值显示未取得，突出关键差异；一项确认，一项替换，不写大段摘要。'],
 ['plan','约束方案工作台','紧凑设置入口，输入已改变提示，方案时间段，预算或进度条，主按钮重新计算；保存和返回保持快照。']
]
const manifest=[]
for(const [id,title,detail]of structures){
 const prompt=`设计 ${title}，只设计一个432×432可嵌入交互卡片组件，不做整个app，不要导航栏或手机外框。复用本项目动态学术风格。${detail} 用结构、图片/图形和紧凑信息层级；柔和边界，44px触控，主动作固定可达。示例数据为视觉示例，不发明真实统计。另展示一个部分来源失败状态的小注释区说明回调：select/filter/detail/back/refresh；但组件本身不放技术名。避免超过432px，不用大量item列表。`
 await fs.writeFile(`${root}/${id}-prompt.txt`,prompt)
 try{const result=JSON.parse(await run(['generate','screen','--project',project,'--prompt',prompt,'--device','MOBILE','--json']));await fs.writeFile(`${root}/${id}-response.json`,JSON.stringify(result,null,2));const sid=result.data?.id;if(!sid)throw Error('No screen id');manifest.push({id,title,screenId:sid,project});await run(['download','screen',sid,'--project',project,'-o',`${root}/${id}.html`]);await run(['download','screen',sid,'--project',project,'--format','png','-o',`${root}/${id}.png`]);console.log(id+' saved')}
 catch(e){manifest.push({id,title,error:e.message});console.log(id+' failed: '+e.message.slice(0,140))}
 await fs.writeFile(root+'/manifest.json',JSON.stringify(manifest,null,2))
}

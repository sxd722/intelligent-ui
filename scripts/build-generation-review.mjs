import {build,loadConfigFromFile} from 'vite'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
const root='artifacts/generation-review'
await mkdir(root,{recursive:true})
let jsx=await readFile('artifacts/data-needs-qa/review.jsx','utf8')
jsx=jsx.replaceAll('/data-needs-qa/','/generation-review/').replace('模型构建候选（电影为真实数据回放续修），未手工改写 DSL。核心交互已人工检查，自动整体门控尚未通过。','本轮从头生成产物，未手工改写 DSL。模型门控结果和独立人工验收请对照报告。')
await writeFile(root+'/review.jsx',jsx)
await writeFile(root+'/index.html',(await readFile('artifacts/data-needs-qa/index.html','utf8')).replaceAll('/artifacts/data-needs-qa/','/artifacts/generation-review/'))
const {config}=await loadConfigFromFile({command:'build',mode:'production'})
await build({configFile:false,plugins:config.plugins.filter(p=>p.name!=='copy-demos'),worker:config.worker,publicDir:false,base:'/generation-review/',build:{outDir:'dist/generation-review',rollupOptions:{input:root+'/index.html'}}})
await writeFile('dist/generation-review/index.html',await readFile('dist/generation-review/'+root+'/index.html'))
for(const [id,path] of [['learning','verified/learning'],['movie','quick-control/movie-flow']])try{
 const result=JSON.parse(await readFile('artifacts/refine-qa/'+path+'.json','utf8'))
 if(result.result.status==='succeeded'&&result.state.message.metadata.card_spec)await writeFile(`dist/generation-review/${id}-spec.json`,JSON.stringify(result.state.message.metadata.card_spec))
}catch{}

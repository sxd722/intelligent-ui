// Recheck saved DOM evidence without changing generated code or invoking the model.
import {readFile,writeFile} from 'node:fs/promises'
import {CASES} from './cases.mjs'
const dir='artifacts/tool-binding-qa/deepseek-v4-flash-20261102-v2'
const rows=JSON.parse(await readFile(dir+'/content-audit.json','utf8'))
for(const r of rows){
  if(!r.text)continue
  const c=CASES.find(c=>c.id===r.case)
  const fields=Object.keys(c.rows[0]).filter(key=>c.rows[0][key]!=null&&r.text.includes(key+'\n暂无'))
  r.checks=r.checks.filter(c=>c.name!=='no-false-missing-source-field')
  r.checks.push({name:'no-false-missing-source-field',passed:fields.length===0,fields})
  r.passed=r.checks.every(c=>c.passed)
}
await writeFile(dir+'/content-audit.json',JSON.stringify(rows,null,2))
console.log(JSON.stringify(['A0','A1','A2','A3','A4'].map(arm=>({arm,pass:rows.filter(r=>r.arm===arm&&r.passed).length,total:rows.filter(r=>r.arm===arm).length}))))

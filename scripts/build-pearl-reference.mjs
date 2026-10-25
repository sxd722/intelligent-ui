import {readFile,writeFile} from 'node:fs/promises'
import {compileSandbox} from '../server/cardspec/sandbox.mjs'
const source=await readFile('demos/pearl-whole-card.jsx','utf8')
const module=await compileSandbox(source,{input:{charge:40,saved:null},capabilities:['adjust','save']})
await writeFile('shared/cardspec/pearl-reference.generated.mjs','// Generated through the production sandbox compiler.\nexport default '+JSON.stringify(module)+'\n')
console.log('Compiled Pearl reference',module.id)

import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {OPENCLI_ROOT,OPENCLI_VERSION,OPENCLI_PROFILE,installed} from '../server/tools/opencli.mjs'
import {migrateOpenCliState} from '../server/tools/opencli-migration.mjs'
await mkdir(OPENCLI_ROOT,{recursive:true});await mkdir(path.join(OPENCLI_PROFILE,'.opencli'),{recursive:true})
const npm=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js')
await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[npm,'install','--prefix',OPENCLI_ROOT,'--save-exact','--ignore-scripts','--no-audit','--no-fund',`@jackwener/opencli@${OPENCLI_VERSION}`],{shell:false,windowsHide:true,stdio:'inherit'});p.on('error',reject);p.on('exit',code=>code?reject(new Error(`npm exit ${code}`)):resolve())})
await installed()
// Preserve state from the previous project release while leaving its backup intact.
if(OPENCLI_VERSION==='1.8.6')await migrateOpenCliState(path.join(OPENCLI_ROOT,'../1.8.8'),OPENCLI_ROOT)
console.log(`Verified OpenCLI ${OPENCLI_VERSION}. Browser connection is configured in the application's 工具连接 panel.`)

// Explicit user-run setup only; card/model tools never receive this entry point.
import {spawn} from 'node:child_process'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {mkdir} from 'node:fs/promises'
import {OPENCLI_PACKAGE,OPENCLI_PROFILE,workerEnv,installed} from '../server/tools/opencli.mjs'
await installed();await mkdir(path.join(OPENCLI_PROFILE,'.opencli'),{recursive:true})
const moduleURL=p=>pathToFileURL(path.join(OPENCLI_PACKAGE,p)).href
const script=`import {getRegistry} from ${JSON.stringify(moduleURL('dist/src/registry.js'))};await import(${JSON.stringify(moduleURL('clis/spotify/spotify.js'))});console.log(await getRegistry().get('spotify/auth').func({}));`
const child=spawn(process.execPath,['--input-type=module','--eval',script],{shell:false,windowsHide:true,env:workerEnv(),stdio:'inherit'})
child.on('exit',code=>{process.exitCode=code||0});child.on('error',e=>{console.error(e.message);process.exitCode=1})

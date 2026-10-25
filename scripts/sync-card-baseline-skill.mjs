// Sync only the project-owned skill into the existing dedicated Trae workspace.
// Does not launch Trae, rewrite tasks, touch queues, or modify running services.
import {readFile,writeFile,readdir,mkdir,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(fileURLToPath(new URL('../',import.meta.url)));
const name='interactive-card-baseline';
const source=path.join(root,'.trae','skills',name);
const args=process.argv.slice(2);
let workspaceKey='legacy',check=false;
for(let i=0;i<args.length;i++){
 if(args[i]==='--check')check=true;
 else if(args[i]==='--workspace' && ['legacy','round2'].includes(args[i+1]))workspaceKey=args[++i];
 else throw Error('Usage: node scripts/sync-card-baseline-skill.mjs [--check] [--workspace legacy|round2]');
}
const workspaceFolder=workspaceKey==='round2'?'trae-skill-round2':'rsi-agent';
const workspace=path.join(root,'artifacts',workspaceFolder,'workspace');
const target=path.join(workspace,'.trae','skills',name);
const marker=workspaceKey==='round2'?'# Fresh round2':'Trae agent reference workspace';
if(!(await readFile(path.join(workspace,'AGENTS.md'),'utf8')).includes(marker))throw Error('Dedicated Trae workspace marker missing');
// Reject symlink/junction ancestors: never write through a redirected workspace.
for(const dir of [path.join(root,'artifacts'),path.join(root,'artifacts',workspaceFolder),workspace,path.join(workspace,'.trae'),path.join(workspace,'.trae/skills'),target]){
 try{if((await lstat(dir)).isSymbolicLink())throw Error('Refusing redirected destination: '+dir)}catch(e){if(e.code!=='ENOENT')throw e}
}
const files=await readdir(source,{recursive:true,withFileTypes:true});let differences=0,count=0;
for(const entry of files){
 if(entry.isSymbolicLink())throw Error('Skill symlinks are unsupported');
 if(!entry.isFile())continue;
 const from=path.join(entry.parentPath??entry.path,entry.name),rel=path.relative(source,from),to=path.join(target,rel);
 for(let dir=path.dirname(to);dir!==target;dir=path.dirname(dir)){try{if((await lstat(dir)).isSymbolicLink())throw Error('Refusing redirected resource')}catch(e){if(e.code!=='ENOENT')throw e}}
 try{if((await lstat(to)).isSymbolicLink())throw Error('Refusing redirected file')}catch(e){if(e.code!=='ENOENT')throw e}
 const content=await readFile(from);let previous;try{previous=await readFile(to)}catch(e){if(e.code!=='ENOENT')throw e}
 count++;if(!previous?.equals(content)){differences++;if(!check){await mkdir(path.dirname(to),{recursive:true});await writeFile(to,content)}}
}
console.log(JSON.stringify({skill:name,files:count,differences,mode:check?'check':'sync',target}));
if(check&&differences)process.exitCode=1;

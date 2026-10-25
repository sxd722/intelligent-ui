const vscode=require('vscode'),fs=require('node:fs/promises'),path=require('node:path');
exports.activate=function(context){
 const root=vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
 if(!root)return;
 const dir=path.join(root,'.workbench-bridge');let busy=false;
 const out=vscode.window.createOutputChannel('CardSpec Workbench');context.subscriptions.push(out);
 async function write(file,value){await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,file),JSON.stringify(value,null,2))}
 async function tick(){if(busy)return;busy=true;try{
  // Only activate for the task workspace initialized by our harness.
  const marker=JSON.parse(await fs.readFile(path.join(dir,'config.json'),'utf8'));if(marker.kind!=='cardspec-workbench-v1')return;
  const commands=await vscode.commands.getCommands(true),supported=commands.includes('workbench.action.chat.icube.open');
  await write('heartbeat.json',{at:Date.now(),supported,workspace:root,version:'0.1.0'});
  if(!supported)return;
  let job;try{job=JSON.parse(await fs.readFile(path.join(dir,'request.json'),'utf8'))}catch{return}
  if(!/^[a-f0-9-]{36}$/.test(job.id)||typeof job.prompt!=='string'||job.prompt.length>16000)throw Error('Invalid workbench task');
  try{await fs.rename(path.join(dir,'request.json'),path.join(dir,job.id+'.claimed.json'))}catch{return}
  try{
   // Clear only the active selection in this dedicated workspace so code
   // attachment does not intercept the query. Keep editors and Owl untouched.
   const editor=vscode.window.activeTextEditor;if(editor)editor.selection=new vscode.Selection(editor.selection.active,editor.selection.active);
   await vscode.commands.executeCommand('workbench.action.chat.icube.open',{newChat:true,keepOpen:true,query:job.prompt});
   await write(job.id+'.dispatch.json',{id:job.id,status:'submitted',at:Date.now()});out.appendLine('Submitted workbench task '+job.id);
  }catch(e){await write(job.id+'.dispatch.json',{id:job.id,status:'failed',error:String(e.message),at:Date.now()})}
 }catch(e){if(e.code!=='ENOENT')out.appendLine(String(e.message))}finally{busy=false}}
 const timer=setInterval(tick,2000);context.subscriptions.push({dispose(){clearInterval(timer)}});void tick();
};

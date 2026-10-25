import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
export async function saveDebugArtifact(directory,source,record,index){
 await mkdir(directory,{recursive:true})
 await Promise.all([writeFile(resolve(directory,'candidate.cardspec'),source),writeFile(resolve(directory,`test-${index}.json`),JSON.stringify(record,null,2))])
}

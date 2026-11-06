import {build,loadConfigFromFile} from 'vite'
import {readFile,writeFile} from 'node:fs/promises'
const {config}=await loadConfigFromFile({command:'build',mode:'production'})
await build({configFile:false,plugins:config.plugins.filter(p=>p.name!=='copy-demos'),worker:config.worker,publicDir:false,base:'/data-needs-qa/',build:{outDir:'dist/data-needs-qa',rollupOptions:{input:'artifacts/data-needs-qa/index.html'}}})
await writeFile('dist/data-needs-qa/index.html',await readFile('dist/data-needs-qa/artifacts/data-needs-qa/index.html'))
for(const id of ['movie','learning'])try{await writeFile(`dist/data-needs-qa/${id}-spec.json`,await readFile(`artifacts/data-needs-qa/${id}-spec.json`))}catch{}

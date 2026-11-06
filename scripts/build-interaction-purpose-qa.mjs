import {build,loadConfigFromFile} from 'vite'
const {config}=await loadConfigFromFile({command:'build',mode:'production'})
await build({configFile:false,plugins:config.plugins.filter(p=>p.name!=='copy-demos'),worker:config.worker,publicDir:false,base:'/interaction-purpose-qa/',build:{outDir:'dist/interaction-purpose-qa',rollupOptions:{input:'artifacts/interaction-purpose-qa/index.html'}}})

import {build} from 'vite'
import react from '@vitejs/plugin-react'
import {resolve} from 'node:path'
await build({configFile:false,plugins:[react()],root:resolve('artifacts/glm-deep-eval-20261025'),base:'/glm-deep-eval-20261025/',publicDir:false,worker:{format:'es'},build:{outDir:resolve('dist/glm-deep-eval-20261025'),emptyOutDir:false,rollupOptions:{input:resolve('artifacts/glm-deep-eval-20261025/index.html')}}})

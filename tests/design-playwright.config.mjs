import {defineConfig} from '@playwright/test'
export default defineConfig({
 testDir:'./browser',testMatch:'design-recipes.spec.mjs',workers:1,timeout:30000,
 outputDir:'../artifacts/design-recipes-qa/results',
 use:{baseURL:'http://127.0.0.1:8894',viewport:{width:1000,height:900},screenshot:'only-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8894 --strictPort',cwd:process.cwd(),url:'http://127.0.0.1:8894',reuseExistingServer:false},
})

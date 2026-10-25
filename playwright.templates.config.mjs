import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'tests/browser',testMatch:['layout-templates.spec.mjs','kinetic-host.spec.mjs','design-recipes.spec.mjs'],timeout:60000,workers:1,
 outputDir:'artifacts/design-templates/browser',reporter:[['list'],['json',{outputFile:'artifacts/design-templates/results.json'}]],
 use:{baseURL:'http://127.0.0.1:8796',viewport:{width:1100,height:1000},screenshot:'only-on-failure',trace:'on',launchOptions:{channel:'chrome'}},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8796 --strictPort',url:'http://127.0.0.1:8796',reuseExistingServer:false}})

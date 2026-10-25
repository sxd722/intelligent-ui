import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'tests/browser',testMatch:['material-motion.spec.mjs','design-recipes.spec.mjs'],timeout:90000,workers:1,
 outputDir:'artifacts/material-motion-qa/browser',reporter:[['list'],['json',{outputFile:'artifacts/material-motion-qa/results.json'}]],
 use:{baseURL:'http://127.0.0.1:8796',viewport:{width:1100,height:1000},video:'on',screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{channel:'chrome'}},
 webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8796 --strictPort',url:'http://127.0.0.1:8796',reuseExistingServer:false}})

import base from './playwright.pearl.config.mjs'
const production=process.env.PEARL_PRODUCTION_QA==='1'
// The malformed-AST injection imports Vite source modules; retain it in dev,
// while production checks exercise the actual deployed asset bundle.
export default {...base,timeout:60000,grepInvert:production?/local component errors/:undefined,testMatch:['sandbox.spec.mjs','sandbox-linked.spec.mjs','sandbox-startup.spec.mjs','layout-templates.spec.mjs'],outputDir:'artifacts/pearl-composition/regression',reporter:[['list'],['json',{outputFile:'artifacts/pearl-composition/regression.json'}]],use:{...base.use,baseURL:production?'http://127.0.0.1:8787':'http://127.0.0.1:8797'},webServer:production?undefined:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8797 --strictPort',url:'http://127.0.0.1:8797',reuseExistingServer:false}}

import base from './playwright.config.mjs'
export default {...base,workers:1,outputDir:'artifacts/sandbox-linked-qa/results',reporter:[['list'],['json',{outputFile:'artifacts/sandbox-linked-qa/browser.json'}]],use:{...base.use,baseURL:'http://127.0.0.1:8794'},webServer:{...base.webServer,url:'http://127.0.0.1:8794/api/health',env:{CARDSPEC_QA_PORT:'8794',CARDSPEC_QA_UPSTREAM_PORT:'8795'}}}

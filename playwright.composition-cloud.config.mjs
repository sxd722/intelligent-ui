import base from './playwright.composition-v2.config.mjs'
// Cloud has no card-debug entry; the image resource contract is verified by
// cloud unit tests. Native sample interactions use the published UI bundle.
export default {...base,grepInvert:/resolved photo crop/,outputDir:'artifacts/composition-v2/cloud-trace',reporter:[['list'],['json',{outputFile:'artifacts/composition-v2/cloud-browser-results.json'}]],use:{...base.use,baseURL:'http://127.0.0.1:8798'}}

import base from './playwright.composition-v2.config.mjs'
export default {...base,testMatch:['six-styles.spec.mjs'],outputDir:'artifacts/six-styles/trace',reporter:[['list'],['json',{outputFile:'artifacts/six-styles/browser-results.json'}]]}

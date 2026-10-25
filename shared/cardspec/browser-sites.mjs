// Host-owned login destinations, never model-controlled URLs.
export const BROWSER_SITES = Object.freeze({
  dongchedi:{name:'懂车帝',loginUrl:'https://www.dongchedi.com/search?keyword=%E6%B1%BD%E8%BD%A6',browserDocument:true},
  dianping:{name:'大众点评',loginUrl:'https://www.dianping.com/'},
})
export function browserSiteContract(tool){
  const site=BROWSER_SITES[tool.site]
  return site?{browser:true,auth:'browser',strategy:'cookie',loginUrl:site.loginUrl,...(site.browserDocument?{browserDocument:true}:{})}:{}
}

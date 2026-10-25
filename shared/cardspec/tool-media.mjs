// Source-level media policies. Models cannot choose request headers or proxy hosts.
export function toolMediaPolicy(value){
  try{
    const url=new URL(value)
    if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash)return null
    if(/^img\d{1,2}\.doubanio\.com$/.test(url.hostname)&&/^\/view\/photo\/[a-z_]+\/public\/p\d+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname))
      return {url:url.href,referer:'https://movie.douban.com/'}
  }catch{}
  return null
}
export function toolMediaSrc(value){
  const policy=toolMediaPolicy(value)
  return policy?'/api/tools/media?url='+encodeURIComponent(policy.url):value
}

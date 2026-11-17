// Source-level media policies. Models cannot choose request headers or proxy hosts.
export function toolMediaPolicy(value){
  try{
    const url=new URL(value)
    if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null
    if(['shared.fastly.steamstatic.com','shared.akamai.steamstatic.com','cdn.akamai.steamstatic.com'].includes(url.hostname)&&/^\/(?:store_item_assets\/steam|steam)\/apps\/\d+\/(?:[a-f0-9]{40}\/)?(?:header|capsule_616x353|library_600x900)\.(?:jpg|png|webp)$/i.test(url.pathname)&&[...url.searchParams].every(([k,v])=>k==='t'&&/^\d{1,14}$/.test(v)))
      return {url:url.href,referer:'https://store.steampowered.com/'}
    if(url.search)return null
    if(/^img\d{1,2}\.doubanio\.com$/.test(url.hostname)&&/^\/view\/photo\/[a-z_]+\/public\/p\d+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname))
      return {url:url.href,referer:'https://movie.douban.com/'}
  }catch{}
  return null
}
export function toolMediaSrc(value){
  const policy=toolMediaPolicy(value)
  return policy?'/api/tools/media?url='+encodeURIComponent(policy.url):value
}

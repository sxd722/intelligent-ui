export const WORKBENCH_RUN='rsi-2026-10-16'
export const WORKBENCH_CASES=[
 ['01-sentiment','舆情观察','帮我监控当前尊界刹车断裂的舆情状况'],
 ['02-family','周末亲子','周末在萧山两天带娃，可以玩什么'],
 ['03-concert','演唱会伴随','邓紫棋演唱会，协助我抢票和伴随我观看'],
 ['04-movies','电影选择','有什么电影推荐的'],
 ['05-transformer','原理探索','Transformer里的注意力机制和FFN原理是什么'],
 ['06-challenge','28 天挑战','OpenAI Tibo的28天挑战日历'],
 ['07-keeper','Keeper 跑团','做一个COC跑团的Keeper卡片，自主规划剧情'],
 ['08-trains','往返订票','周五杭州去上海和周日上海回杭州的订票助手'],
 ['09-visa','签证准备','爱尔兰签证checklist'],
 ['10-home','家居采购','家具布置和ikea采购助手'],
].map(([id,title,prompt])=>({id,title,prompt}))

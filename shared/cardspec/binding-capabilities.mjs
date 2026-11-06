// Samples describe shape, never execution state. Shared with generation/probes.
export const BINDING_LIFECYCLE = 'binding.status: idle=尚未执行，loading=执行中，success=调用成功，error=失败，cancelled=中断（写入结果可能未知）；仅success展示返回回执。样本不是已执行结果，不用title推断调用状态。';
export function bindingCapabilities({key,detail,readOnly=true}) {
  return {actions:{filter:`filter_${key}`,select:`pick_${key}`,refresh:`refresh_${key}`,choose:`choose_${key}`,detail:detail?`detail_${key}`:null},detail:detail?{available:true,result:`bindings.d_${key}.value.items`}:{available:false,reason:'本来源未声明详情接口；可展示当前选中项，不构造detail动作'},...(readOnly?{}:{lifecycle:BINDING_LIFECYCLE})};
}

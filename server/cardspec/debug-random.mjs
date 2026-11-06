// Installed ONLY in the isolated verification browser (including child frames).
// Do not replace crypto.randomUUID or production randomness.
export function installDebugRandom(seed){
 let state=Number(seed)>>>0
 Math.random=()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}
}

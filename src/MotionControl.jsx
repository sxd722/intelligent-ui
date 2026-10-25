import React,{useSyncExternalStore} from 'react'
import {motionPreference} from './motion-preference.mjs'
export function useMotionPreference(){return useSyncExternalStore(motionPreference.subscribe,motionPreference.getSnapshot,()=> 'full')}
export function MotionControl(){const value=useMotionPreference();return <label className="chip card-size-control">卡片动效 <select aria-label="卡片动效" value={value} onChange={e=>motionPreference.set(e.target.value)}><option value="full">完整动效</option><option value="light">轻量动效</option><option value="off">关闭动效</option></select></label>}

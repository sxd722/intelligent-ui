import React,{useSyncExternalStore,createContext,useContext} from 'react'
import {createCardSizePreference} from './card-size.mjs'
import './styles/card-size.css'
let storage
try{storage=typeof window!=='undefined'?window.localStorage:null}catch{}
const preference=createCardSizePreference(storage,typeof window!=='undefined'?window:null)
export const CardSizeOverride=createContext(null)
export function useCardSize(){const local=useContext(CardSizeOverride),saved=useSyncExternalStore(preference.subscribe,preference.getSnapshot,()=> 'square');return local||saved}
export function CardSizeControl(){
  const size=useCardSize()
  return <label className="chip card-size-control">卡片尺寸 <select aria-label="卡片尺寸" value={size} onChange={event=>preference.set(event.target.value)}><option value="square">方形</option><option value="auto">自然高度 · 一屏上限</option></select></label>
}

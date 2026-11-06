import {createContext} from 'react'

// Only the host selects this environment; it is not a model-authored prop.
// Offline generation checks exercise the real map engine and pins without
// requesting external tiles or weakening the debug/sandbox network policy.
export const MapEnvironment=createContext('live')
export const OFFLINE_MAP_TILE='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e7eeeb"/><path d="M0 64H256M0 128H256M0 192H256M64 0V256M128 0V256M192 0V256" stroke="#cbd8d1" stroke-width="1"/></svg>')

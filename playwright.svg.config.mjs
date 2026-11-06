import {defineConfig} from '@playwright/test'
export default defineConfig({testDir:'./tests/browser',testMatch:'svg-readability.spec.mjs',workers:2,timeout:30000,use:{launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe'},baseURL:'http://127.0.0.1:8794'},webServer:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8794 --strictPort',url:'http://127.0.0.1:8794',reuseExistingServer:false},reporter:'list'})


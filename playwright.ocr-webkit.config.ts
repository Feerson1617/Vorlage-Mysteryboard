import {defineConfig}from'@playwright/test';
import base from './playwright.config';
export default defineConfig({...base,outputDir:'test-results/ocr-webkit',reporter:[['list']],use:{...base.use,browserName:'webkit',launchOptions:{executablePath:'/workspace/mysteryboard-browsers/webkit-2388/pw_run.sh',env:{...process.env,WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS:'1',XDG_CACHE_HOME:'/workspace/mysteryboard-ocr-webkit-deps/cache',GSETTINGS_BACKEND:'memory'}}}});

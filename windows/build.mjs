import {cp, mkdir, rm, readFile, writeFile, stat} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {api} from '@electron-forge/core';
import {integrity, root} from './integrity.mjs';
assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
await integrity();
process.chdir(root);
execFileSync(process.execPath, ['windows/build-ui.mjs'], {stdio:'inherit'});
await mkdir(join(root,'windows/evidence'),{recursive:true});
execFileSync(process.execPath, ['windows/localize-ui.mjs'], {stdio:'inherit'});
const stage=join(root,'windows/stage');
await rm(stage,{recursive:true,force:true}); await mkdir(join(stage,'windows'),{recursive:true});
await mkdir(join(stage,'studio/electron'),{recursive:true});
await cp(join(root,'studio/dist/studio'),join(stage,'studio/dist/studio'),{recursive:true});
await cp(join(root,'studio/electron/main.cjs'),join(stage,'studio/electron/main.cjs'));
await cp(join(root,'studio/electron/preload.cjs'),join(stage,'studio/electron/preload.cjs'));
for(const name of ['bootstrap.cjs','squirrel.cjs']) await cp(join(root,'windows',name),join(stage,'windows',name));
const original=JSON.parse(await readFile('package.json'));
assert.equal(original.version,'0.2.0'); assert.equal(original.devDependencies.electron,'45.3.3');
await writeFile(join(stage,'package.json'),JSON.stringify({
  name:'mysteryboard-studio',version:original.version,productName:original.productName,
  description:original.description,author:original.author,license:'UNLICENSED',
  main:'windows/bootstrap.cjs',devDependencies:{electron:original.devDependencies.electron},
  config:{forge:join(root,'windows/forge.config.cjs')},
},null,2));
const boundary=JSON.parse(await readFile('studio/dist/player-boundary.json'));
assert.equal(boundary.editorModules,0); assert.equal(boundary.ocrModules,0);
assert(boundary.modules.some(x=>x.startsWith('node_modules/')), 'Missing normalized module/license audit');
await api.make({dir:stage,platform:'win32',arch:'x64',outDir:join(root,'windows/out')});
await integrity();

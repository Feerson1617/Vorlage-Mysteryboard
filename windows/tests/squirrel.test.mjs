import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const {squirrelEvent}=createRequire(import.meta.url)('../squirrel.cjs');
for(const event of ['install','updated','uninstall']) test('Squirrel '+event+' finishes without UI bootstrap',()=>{
  const child=new EventEmitter(); let quit=0,call;
  assert.equal(squirrelEvent(['app','--squirrel-'+event],'/Applications/app-0.2.0/MysteryBoard Studio.exe',(...args)=>{call=args;return child;},()=>quit++),true);
  assert.equal(call[1][0],event==='uninstall'?'--removeShortcut':'--createShortcut');
  assert.equal(call[1][1],'MysteryBoard Studio.exe');assert.equal(quit,0);
  child.emit('close',0);child.emit('error',new Error('late'));assert.equal(quit,1);
});
test('Squirrel obsolete quits; normal and first run start real app',()=>{
 let quits=0;
 assert(squirrelEvent(['app','--squirrel-obsolete'],'app',()=>assert.fail(),()=>quits++));assert.equal(quits,1);
 for(const arg of [undefined,'--squirrel-firstrun','--user-data-dir=x'])assert.equal(squirrelEvent(['app',arg],'app',()=>assert.fail(),()=>assert.fail()),false);
});

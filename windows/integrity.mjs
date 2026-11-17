import { readFile, lstat, readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export async function integrity() {
  const ref = JSON.parse(await readFile(join(root, 'windows/macos-reference.json')));
  const original = new Map(ref.files.map(f => [f.path, f]));
  const caseGroups=new Map();for(const f of ref.files){const key=f.path.toLowerCase();caseGroups.set(key,[...(caseGroups.get(key)||[]),f.path]);}
  const collisions=new Set([...caseGroups.values()].filter(group=>group.length>1).flat());
  const blobOnly=[];
  const tree = execFileSync('git', ['ls-tree', '-rz', ref.commit], {cwd: root}).toString().split('\0').filter(Boolean);
  assert.equal(tree.length, original.size, 'Reference manifest must cover the entire original tree');
  for (const line of tree) {
    const [meta, path] = line.split('\t');
    const entry = original.get(path);
    assert(entry && entry.blob === meta.split(' ')[2], 'Wrong baseline blob: ' + path);
    let bytes;
    try { bytes=await readFile(join(root,path)); }
    catch(error){
      assert(process.platform==='win32' && error.code==='ENOENT' && collisions.has(path),'Missing protected file: '+path);
      bytes=execFileSync('git',['show',ref.commit+':'+path],{cwd:root});blobOnly.push(path);
    }
    assert.equal(bytes.length, entry.bytes, 'Changed size: ' + path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, 'Changed protected file: ' + path);
  }
  const changed = execFileSync('git', ['diff', '--name-status', ref.commit], {cwd: root}).toString().trim().split('\n').filter(Boolean);
  for (const line of changed) {
    const [status, path] = line.split('\t');
    assert(status === 'A' && (path.startsWith('windows/') || path === '.github/workflows/studio-windows.yml'), 'Forbidden change: ' + line);
  }
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], {cwd: root}).toString().split('\0').filter(Boolean);
  for (const path of untracked) assert(path.startsWith('windows/') || path === '.github/workflows/studio-windows.yml', 'Unexpected untracked file: ' + path);
  return {passed: true, baseCommit: ref.commit, protectedFiles: original.size, materializedFilesChecked:original.size-blobOnly.length, originalBlobsCheckedWithoutCheckout:blobOnly, changedOriginalFiles: 0, permittedAdditions: changed.length + untracked.length};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await integrity(), null, 2));

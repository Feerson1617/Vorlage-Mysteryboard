// Windows-only installer lifecycle. No updater or network operations.
const { basename, dirname, resolve } = require('node:path');
function squirrelEvent(argv, executable, spawn, quit) {
  const event = argv[1];
  if (!['--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete'].includes(event)) return false;
  if (event === '--squirrel-obsolete') { quit(); return true; }
  const updater = resolve(dirname(executable), '..', 'Update.exe');
  const action = event === '--squirrel-uninstall' ? '--removeShortcut' : '--createShortcut';
  const child = spawn(updater, [action, basename(executable)], {windowsHide: true, detached: true});
  let finished = false;
  let timer;
  const finish = () => { if (!finished) { finished = true; clearTimeout(timer); quit(); } };
  // The installer may hold Squirrel's mutex while it waits for this process.
  // Detach the shortcut helper and finish promptly, as Squirrel recommends.
  timer=setTimeout(finish,1000);timer.unref?.();child.unref?.();
  child.once('error', finish);
  child.once('close', finish);
  return true;
}
module.exports = {squirrelEvent};

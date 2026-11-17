// Windows-only installer lifecycle. No updater or network operations.
const { basename, dirname, resolve } = require('node:path');
function squirrelEvent(argv, executable, spawn, quit) {
  const event = argv[1];
  if (!['--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete'].includes(event)) return false;
  if (event === '--squirrel-obsolete') { quit(); return true; }
  const updater = resolve(dirname(executable), '..', 'Update.exe');
  const action = event === '--squirrel-uninstall' ? '--removeShortcut' : '--createShortcut';
  const child = spawn(updater, [action, basename(executable)], {windowsHide: true});
  let finished = false;
  const finish = () => { if (!finished) { finished = true; quit(); } };
  child.once('error', finish);
  child.once('close', finish);
  return true;
}
module.exports = {squirrelEvent};

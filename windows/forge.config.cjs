const {resolve} = require('node:path');
module.exports = {
  packagerConfig: {
    name: 'MysteryBoard Studio', executableName: 'MysteryBoard Studio',
    appVersion: '0.2.0', appBundleId: 'de.mysteryboard.studio',
    asar: true, prune: true,
    icon: resolve(__dirname, 'assets/studio.ico'),
    win32metadata: {CompanyName:'MysteryBoard', FileDescription:'MysteryBoard Studio', ProductName:'MysteryBoard Studio', InternalName:'MysteryBoardStudio'},
    ignore: path => !!path && !/^\/(package\.json|studio(?:\/|$)|windows(?:\/|$))/.test(path),
  },
  makers: [
    {name: resolve(__dirname, 'node_modules/@electron-forge/maker-squirrel/dist/MakerSquirrel.js'), platforms:['win32'], config: {
      name: 'MysteryBoardStudio', authors: 'MysteryBoard', description:'Lokale Lehrkräfte-App für Mysterys',
      exe:'MysteryBoard Studio.exe', setupExe:'MysteryBoard-Studio-0.2.0-Windows-x64-Setup.exe',
      setupIcon:resolve(__dirname,'assets/studio.ico'), noMsi:true,
    }},
    {name: resolve(__dirname, 'node_modules/@electron-forge/maker-zip/dist/MakerZIP.js'), platforms:['win32']},
  ],
};

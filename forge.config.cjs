module.exports={
 packagerConfig:{name:'MysteryBoard Studio',executableName:'MysteryBoard Studio',appBundleId:'de.mysteryboard.studio',appCategoryType:'public.app-category.education',asar:true,prune:true,ignore:(path)=>{if(!path)return false;return !/^\/(package\.json|studio(?:\/|$))/.test(path)||/^\/studio\/(ui|player)(?:\/|$)/.test(path)||/^\/studio\/dist\/player(?:\/|$)/.test(path)||path.endsWith('.ts')},osxSign:false,osxNotarize:false},
 makers:[{name:'@electron-forge/maker-zip',platforms:['darwin','linux']},{name:'@electron-forge/maker-dmg',config:{name:'MysteryBoard Studio',format:'ULFO',overwrite:true},platforms:['darwin']}],
};

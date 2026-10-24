let pendingWorkspaceBackup=null,backupReadGeneration=0;
function openBackupDialog(){
 if(typeof closeDropdown==='function')closeDropdown();
 pendingWorkspaceBackup=null;backupReadGeneration++;$('backupFile').value='';$('confirmImport').disabled=true;$('backupPreview').textContent='Choose a JSON backup to preview its contents.';
 $('backupDialog').showModal();
}
function restoreWorkspaceBackup(data){
 const restored=normalizeWorkspace(data);
 // Write first. A failed write leaves the active workspace untouched.
 localStorage.setItem(KEY,JSON.stringify(restored));
 state=restored;storageAvailable=true;storageReadFailed=false;
 for(const id of Object.keys(categoryLabels))delete categoryLabels[id];
 for(const category of state.categories)categoryLabels[category.id]=category.name;
 $('search').value='';$('filter').value='all';navigate('overview');$('saveState').textContent='Saved';
 return restored;
}
$('import').onclick=openBackupDialog;
$('closeBackup').onclick=()=>{backupReadGeneration++;pendingWorkspaceBackup=null;$('backupDialog').close();};
$('backupFile').addEventListener('change',async()=>{
 const generation=++backupReadGeneration,file=$('backupFile').files?.[0];pendingWorkspaceBackup=null;$('confirmImport').disabled=true;
 if(!file){$('backupPreview').textContent='Choose a JSON backup to preview its contents.';return;}
 try{
  if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');
  const content=await file.text();if(generation!==backupReadGeneration)return;
  pendingWorkspaceBackup=normalizeWorkspace(JSON.parse(content));
  $('backupPreview').textContent=pendingWorkspaceBackup.tasks.length+' tasks · '+pendingWorkspaceBackup.notes.length+' notes · '+pendingWorkspaceBackup.teams.length+' team spaces';
  $('confirmImport').disabled=false;
 }catch(e){if(generation!==backupReadGeneration)return;$('backupPreview').textContent=e instanceof SyntaxError?'This is not a valid JSON file.':e.message;}
});
$('confirmImport').onclick=()=>{
 if(!pendingWorkspaceBackup)return;
 if(!confirm('Replace the data on this browser with this backup? Export your current data first if you want to keep it.'))return;
 try{restoreWorkspaceBackup(pendingWorkspaceBackup);pendingWorkspaceBackup=null;$('backupDialog').close();toast('Backup restored');}
 catch(e){$('backupPreview').textContent='Could not restore: '+e.message;}
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&iso(new Date())!==today)location.reload();});

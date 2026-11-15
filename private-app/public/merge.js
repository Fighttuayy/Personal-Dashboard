(function(root){
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 function merge(base,local,remote,path=''){
  if(equal(local,remote)||equal(base,remote))return {value:structuredClone(local),conflicts:[]};
  if(equal(base,local))return {value:structuredClone(remote),conflicts:[]};
  const keyed=x=>Array.isArray(x)&&x.every(v=>v&&typeof v==='object'&&typeof v.id==='string');
  if(keyed(base)&&keyed(local)&&keyed(remote)){
   const maps=[base,local,remote].map(a=>new Map(a.map(x=>[x.id,x]))),value=[],conflicts=[];
   for(const id of new Set([...remote,...local].map(x=>x.id))){const r=merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),path+'/'+id);if(r.value!==undefined)value.push(r.value);conflicts.push(...r.conflicts);}return {value,conflicts};
  }
  if([base,local,remote].every(x=>x&&typeof x==='object'&&!Array.isArray(x))){const value={},conflicts=[];for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){const r=merge(base[key],local[key],remote[key],path+'/'+key);if(r.value!==undefined)value[key]=r.value;conflicts.push(...r.conflicts);}return {value,conflicts};}
  return {value:structuredClone(local),conflicts:[path]};
 }
 root.mergeWorkspace=merge;
})(globalThis);

function emptyWorkspace(){return {schemaVersion:1,tasks:[],notes:[],teams:[],categories:[{id:'freelance',name:'Freelance'},{id:'university',name:'University'}],categoryFilter:'all',theme:'dark',dashboardMode:'standard'};}
function workspaceDate(value,optional=false){
 if(optional&&(value===''||value==null))return '';
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('A deadline or payment date is invalid.');
 const d=new Date(value+'T12:00:00');
 if(Number.isNaN(d.getTime())||d.getFullYear()!==Number(value.slice(0,4))||d.getMonth()+1!==Number(value.slice(5,7))||d.getDate()!==Number(value.slice(8,10)))throw Error('A deadline or payment date is invalid.');
 return value;
}
function workspaceText(value,max,required=false){
 if(value==null)value='';
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error('A name or text field is invalid.');
 return value;
}
function workspaceId(value){if(typeof value!=='string'||!/^[-a-zA-Z0-9_]{1,150}$/.test(value)||['__proto__','constructor','prototype'].includes(value))throw Error('A record has an invalid ID.');return value;}
function workspaceColor(value){if(typeof value!=='string'||!/^#[0-9a-fA-F]{6}$/.test(value))throw Error('A work type color is invalid.');return value.toLowerCase();}
function workspaceList(value,max=10000){if(value==null)return [];if(!Array.isArray(value)||value.length>max)throw Error('A collection in this backup is invalid or too large.');return value;}
function workspaceStatus(value){if(!['ยังไม่เริ่ม','กำลังทำ','รอตรวจ','เสร็จแล้ว'].includes(value))throw Error('A task status is invalid.');return value;}
function workspaceTimestamp(value){if(value==null)return new Date().toISOString();if(typeof value!=='string'||Number.isNaN(Date.parse(value)))throw Error('A saved date is invalid.');return new Date(value).toISOString();}
function workspaceAmount(value){if(!['number','string'].includes(typeof value)||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e12)throw Error('A payment amount is invalid.');return Number(value);}
function workspaceUnique(items){const ids=new Set();for(const item of items){if(ids.has(item.id))throw Error('This backup contains duplicate record IDs.');ids.add(item.id);}return items;}
function workspaceLink(value){try{const url=new URL(value);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error();return url.href;}catch(e){throw Error('A team link is invalid. Use an http or https URL.');}}
function normalizeWorkspace(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!Array.isArray(raw.tasks))throw Error('Choose a Fortor dashboard JSON backup.');
 if(raw.schemaVersion!=null&&raw.schemaVersion!==1)throw Error('This backup needs a newer version of the dashboard.');
 const result=emptyWorkspace();
 if(raw.categories!=null&&workspaceList(raw.categories,500).length)result.categories=workspaceUnique(raw.categories.map(c=>({id:workspaceId(c.id),name:workspaceText(c.name,40,true),...(c.color==null?{}:{color:workspaceColor(c.color)})})));
 const categoryIds=new Set(result.categories.map(c=>c.id));
 result.tasks=workspaceUnique(workspaceList(raw.tasks).filter(t=>t&&!t.isMock&&!/^mock-fortor-\d+$/.test(String(t.id))).map(t=>{
  const category=workspaceId(t.category||result.categories[0].id);
  if(!categoryIds.has(category)){result.categories.push({id:category,name:category});categoryIds.add(category);}
  const amount=workspaceAmount(t.amount??0),paid=workspaceAmount(t.paid??0);
  if(paid>amount)throw Error('A received amount exceeds the project value.');
  const task={id:workspaceId(t.id),name:workspaceText(t.name,150,true),client:workspaceText(t.client,100),category,due:workspaceDate(t.due),status:workspaceStatus(t.status),amount,paid,paidDate:workspaceDate(t.paidDate,true),notes:workspaceText(t.notes,100000)};
  if(paid>0&&!task.paidDate)throw Error('A paid task is missing its payment date.');
  if(t.previousStatus!=null)task.previousStatus=workspaceStatus(t.previousStatus);
  return task;
 }));
 result.notes=workspaceUnique(workspaceList(raw.notes).map(n=>({id:workspaceId(n.id),title:workspaceText(n.title,120,true),body:workspaceText(n.body,20000),updatedAt:workspaceTimestamp(n.updatedAt)})));
 result.teams=workspaceUnique(workspaceList(raw.teams,500).map(team=>({
  id:workspaceId(team.id),name:workspaceText(team.name,80,true),description:workspaceText(team.description,1000),updatedAt:workspaceTimestamp(team.updatedAt),
  tasks:workspaceUnique(workspaceList(team.tasks).map(t=>({id:workspaceId(t.id),title:workspaceText(t.title,150,true),due:workspaceDate(t.due),status:workspaceStatus(t.status),assignee:workspaceText(t.assignee,80)}))),
  notes:workspaceUnique(workspaceList(team.notes).map(n=>({id:workspaceId(n.id),title:workspaceText(n.title,150,true),body:workspaceText(n.body,20000)}))),
  links:workspaceUnique(workspaceList(team.links).map(l=>({id:workspaceId(l.id),title:workspaceText(l.title,150,true),url:workspaceLink(l.url)})))
 })));
 result.theme=raw.theme==='light'?'light':'dark';
 result.dashboardMode=['standard','todo','board','display'].includes(raw.dashboardMode)?raw.dashboardMode:'standard';
 result.categoryFilter=categoryIds.has(raw.categoryFilter)?raw.categoryFilter:'all';
 if(result.teams.some(t=>t.id===raw.selectedTeamId))result.selectedTeamId=raw.selectedTeamId;
 return result;
}

export {emptyWorkspace,normalizeWorkspace,workspaceDate,workspaceId};

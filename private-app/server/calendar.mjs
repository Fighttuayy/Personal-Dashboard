import {calendarEvent,HttpError} from './security.mjs';
const root='https://www.googleapis.com/calendar/v3';
export function calendarService({repo,auth,fetchImpl=fetch}){
 async function request(userId,path,method='GET',body){
  const credentials=await auth.api.getAccessToken({body:{providerId:'google',userId}});
  if(!credentials?.accessToken)throw new HttpError(409,'Connect your Google calendar first.');
  const response=await fetchImpl(root+path,{method,headers:{Authorization:'Bearer '+credentials.accessToken,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(response.status===401||response.status===403)throw new HttpError(409,'Calendar permission is missing or expired. Connect again.','calendar_permission');
  if(response.status===429)throw new HttpError(429,'Google Calendar is busy. Try syncing again shortly.');
  if(!response.ok)throw new HttpError(502,'Google Calendar could not complete the request.','calendar_unavailable');
  return response.status===204?null:response.json();
 }
 async function connect(userId,detail='generic'){
  if(!['generic','titles'].includes(detail))throw new HttpError(400,'Invalid calendar privacy option.');
  if(!await repo.isOwner(userId))throw new HttpError(403,'Only the owner can connect a calendar.');
  const existing=await repo.calendarConnection(userId);
  let calendarId=existing?.calendar_id;
  if(!calendarId){const calendar=await request(userId,'/calendars','POST',{summary:"Fortor's Dashboard · Deadlines",description:'Selected task deadlines from your private dashboard. No income or private notes.'});calendarId=calendar.id;}
  await repo.storeCalendar(userId,calendarId,detail);
  return sync(userId);
 }
 const syncing=new Map();
 function sync(userId){if(syncing.has(userId))return syncing.get(userId);const work=performSync(userId).finally(()=>syncing.delete(userId));syncing.set(userId,work);return work;}
 async function performSync(userId){
  const connection=await repo.calendarConnection(userId);if(!connection?.enabled)return {connected:false};
  const {personal}=await repo.bootstrap({id:userId});
  const tasks=personal.data.tasks.filter(task=>task.status!=='เสร็จแล้ว');
  const calendarPath='/calendars/'+encodeURIComponent(connection.calendar_id);
  const existing=[];let pageToken;
  do{const query=new URLSearchParams({privateExtendedProperty:'fortor=dashboard-v2',maxResults:'2500',showDeleted:'false'});if(pageToken)query.set('pageToken',pageToken);const page=await request(userId,calendarPath+'/events?'+query);existing.push(...(page.items||[]));pageToken=page.nextPageToken;}while(pageToken);
  const desired=new Map(tasks.map(task=>{const event=calendarEvent(task,connection.detail);return [event.id,event];}));
  const present=new Map(existing.filter(event=>event.extendedProperties?.private?.fortor==='dashboard-v2').map(event=>[event.id,event]));
  for(const [id,event] of desired){const previous=present.get(id);if(!previous)await request(userId,calendarPath+'/events','POST',event);else if(previous.summary!==event.summary||previous.start?.date!==event.start.date||previous.end?.date!==event.end.date)await request(userId,calendarPath+'/events/'+encodeURIComponent(id),'PATCH',event);}
  for(const [id] of present)if(!desired.has(id))await request(userId,calendarPath+'/events/'+encodeURIComponent(id),'DELETE');
  await repo.asUser(userId,db=>db.query('update fortor.calendar_connections set last_synced_at=now(),last_error=null where user_id=$1',[userId]));
  return {connected:true,count:desired.size};
 }
 return {connect,sync};
}

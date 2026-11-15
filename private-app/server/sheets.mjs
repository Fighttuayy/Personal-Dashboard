import {buildSheetsSnapshot} from './sheets-snapshot.mjs';
import {digest,HttpError} from './security.mjs';

const MARKER = 'fortor-work-type';
const cells = row => ({values:row.map(value => ({userEnteredValue:
 typeof value === 'number' ? {numberValue:value} : {stringValue:String(value ?? '')}
}))});

export function sheetUpdates(snapshot, existing) {
 const taken = new Set(existing.map(sheet => sheet.properties.title.toLowerCase()));
 const ids = new Set(existing.map(sheet => sheet.properties.sheetId));
 const managed = new Map();
 for (const sheet of existing) {
  const key = sheet.developerMetadata?.find(m => m.metadataKey === MARKER)?.metadataValue;
  if (key) managed.set(key, sheet.properties);
  else if (sheet.properties.sheetId === 0 && sheet.properties.title === '_Fortor setup') managed.set('all', sheet.properties);
 }
 const requests = [];
 for (const tab of snapshot) {
  const key = tab.key === null ? 'all' : 'category:' + tab.key;
  const previous = managed.get(key);
  managed.delete(key);
  let title = tab.title, suffix = 2;
  if (previous) taken.delete(previous.title.toLowerCase());
  while (taken.has(title.toLowerCase())) title = tab.title + ' (' + suffix++ + ')';
  taken.add(title.toLowerCase());
  let sheetId = previous?.sheetId ?? 0;
  if (!previous) {
   while (ids.has(sheetId)) sheetId++;
   ids.add(sheetId);
   requests.push({addSheet:{properties:{sheetId,title,gridProperties:{rowCount:Math.max(tab.rows.length, 100),columnCount:9,frozenRowCount:1}}}});
   requests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:MARKER,metadataValue:key,visibility:'DOCUMENT',location:{sheetId}}}});
  } else {
   if (previous.title === '_Fortor setup' && key === 'all') requests.push({createDeveloperMetadata:{developerMetadata:{metadataKey:MARKER,metadataValue:key,visibility:'DOCUMENT',location:{sheetId}}}});
   if (previous.title !== title) requests.push({updateSheetProperties:{properties:{sheetId,title},fields:'title'}});
   const rowCount = Math.max(previous.gridProperties.rowCount,tab.rows.length);
   const columnCount = Math.max(previous.gridProperties.columnCount,9);
   if (rowCount !== previous.gridProperties.rowCount || columnCount !== previous.gridProperties.columnCount) {
    requests.push({updateSheetProperties:{properties:{sheetId,gridProperties:{rowCount,columnCount}},fields:'gridProperties.rowCount,gridProperties.columnCount'}});
   }
  }
  requests.push({updateCells:{range:{sheetId,startRowIndex:0,startColumnIndex:0,endColumnIndex:9},rows:tab.rows.map(cells),fields:'userEnteredValue'}});
 }
 for (const {sheetId,gridProperties} of managed.values()) {
  requests.push({updateCells:{range:{sheetId,startRowIndex:0,startColumnIndex:0,endColumnIndex:Math.min(9,gridProperties.columnCount)},rows:[],fields:'userEnteredValue'}});
 }
 return requests;
}

export function sheetsService({repo,getGoogleCredentials,fetchImpl=fetch}) {
 const queues = new Map();
 function run(userId, work) {
  const previous = queues.get(userId) || Promise.resolve();
  const next = previous.catch(()=>{}).then(work);
  queues.set(userId,next);
  return next.finally(()=>{if(queues.get(userId)===next)queues.delete(userId);});
 }
 async function token(userId) {
  const result = await getGoogleCredentials(userId).catch(()=>null);
  // The Google API checks the live token. Sign-in does not refresh Better Auth’s stored scope list.
  if (!result?.accessToken) throw new HttpError(409,'Allow Google Sheets access first.','sheets_permission');
  return result.accessToken;
 }
 async function request(accessToken,path,body) {
  const response=await fetchImpl('https://sheets.googleapis.com/v4/spreadsheets'+path,{
   method:body?'POST':'GET',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
   body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)
  });
  if (response.status === 403) {
   const payload = await response.json().catch(()=>null);
   const disabled = payload?.error?.details?.some(detail => detail.reason === 'SERVICE_DISABLED');
   throw new HttpError(409,disabled ? 'The Google Sheets API is disabled for this project.' : 'Google denied Sheets access. Use Allow Sheets access and finish consent, then try again.','sheets_permission');
  }
  if (response.status === 401) throw new HttpError(409,'Reconnect Google Sheets to renew access.','sheets_permission');
  if (!response.ok) throw new HttpError(502,'Google Sheets could not complete the sync. Try Sync now.','sheets_unavailable');
  return response.json();
 }
 const connection = userId => repo.asUser(userId,async db=>(await db.query(
  'select spreadsheet_id,enabled,snapshot_hash,last_synced_at,last_error from fortor.sheets_connection where user_id=$1',[userId])).rows[0] || null);
 async function sync(userId,force) {
  const current = await connection(userId);
  if (!current?.enabled) return;
  const {personal} = await repo.bootstrap({id:userId});
  const snapshot = buildSheetsSnapshot(personal.data);
  const hash = digest(JSON.stringify(snapshot));
  if (!force && current.snapshot_hash === hash && !current.last_error) return;
  try {
   const accessToken = await token(userId);
   const path = '/'+encodeURIComponent(current.spreadsheet_id);
   const book = await request(accessToken,path+'?fields=sheets(properties,developerMetadata)');
   await request(accessToken,path+':batchUpdate',{requests:sheetUpdates(snapshot,book.sheets || [])});
   await repo.asUser(userId,db=>db.query('update fortor.sheets_connection set snapshot_hash=$2,last_synced_at=now(),last_error=null where user_id=$1',[userId,hash]));
  } catch (error) {
   const message = error instanceof HttpError ? error.message : 'Google Sheets sync failed. Try Sync now.';
   await repo.asUser(userId,db=>db.query('update fortor.sheets_connection set last_error=$2 where user_id=$1',[userId,message]));
   throw new HttpError(error instanceof HttpError ? error.status : 502,message);
  }
 }
 return {
  connection,
  sync:(userId,force=false)=>run(userId,()=>sync(userId,force)),
  disconnect:userId=>run(userId,()=>repo.asUser(userId,db=>db.query('update fortor.sheets_connection set enabled=false where user_id=$1',[userId]))),
  connect:userId=>run(userId,async()=>{
   if (!await repo.isOwner(userId)) throw new HttpError(403,'Owner access required.');
   const accessToken=await token(userId);
   let id=(await connection(userId))?.spreadsheet_id;
   if (!id) {
    const created=await request(accessToken,'',{properties:{title:"Fortor's Dashboard · Tasks",locale:'en_GB',timeZone:'Asia/Bangkok'},sheets:[{properties:{sheetId:0,title:'_Fortor setup',gridProperties:{frozenRowCount:1}}}]});
    id=created.spreadsheetId;
    await repo.asUser(userId,db=>db.query('insert into fortor.sheets_connection(user_id,spreadsheet_id) values($1,$2)',[userId,id]));
   } else {
    await repo.asUser(userId,db=>db.query('update fortor.sheets_connection set enabled=true where user_id=$1',[userId]));
   }
   await sync(userId,true);
  })
 };
}

import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {normalizeWorkspace,workspaceId} from './workspace-data.mjs';
export class HttpError extends Error{constructor(status,message,code='request_failed'){super(message);this.status=status;this.code=code;}}
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const secretToken=()=>randomBytes(32).toString('base64url');
export function emailAddress(value){if(typeof value!=='string'||value.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(value))throw new HttpError(400,'Enter a valid email address.');return value.trim().toLowerCase();}
export function versionNumber(value){if(!Number.isSafeInteger(value)||value<1)throw new HttpError(400,'A valid record version is required.');return value;}
export function memberRole(value){if(!['viewer','editor'].includes(value))throw new HttpError(400,'Choose Viewer or Editor.');return value;}
export function recordId(value){try{return workspaceId(value);}catch{throw new HttpError(400,'Invalid record ID.');}}
export function personalData(value){const normalized=normalizeWorkspace({...value,teams:[]});return {tasks:normalized.tasks,notes:normalized.notes,categories:normalized.categories,theme:normalized.theme,dashboardMode:normalized.dashboardMode,categoryFilter:normalized.categoryFilter};}
export function teamData(value,id){const normalized=normalizeWorkspace({tasks:[],teams:[{...value,id}]});const team=normalized.teams[0];return {id:team.id,name:team.name,description:team.description,tasks:team.tasks,notes:team.notes,links:team.links,updatedAt:team.updatedAt};}
export function safeJSON(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
export function csrfToken(secret,sessionId){return createHmac('sha256',secret).update('csrf:'+sessionId).digest('base64url');}
export function validCSRF(secret,sessionId,provided){const expected=Buffer.from(csrfToken(secret,sessionId)),actual=Buffer.from(String(provided||''));return expected.length===actual.length&&timingSafeEqual(expected,actual);}
export function requireSameOrigin(req,origin){if(req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site')throw new HttpError(403,'This request must come from your dashboard.','csrf_rejected');}
export function publicSession(session,isOwner){return {id:session.user.id,name:session.user.name,email:session.user.email,isOwner:Boolean(isOwner)};}
export function approvedIdentity({user,source},ownerEmail,allowed){return source?.oauth?.providerId==='google'&&source.oauth.userInfo?.email_verified!==false&&user.emailVerified===true&&(user.email?.toLowerCase()===ownerEmail||allowed);}
export function calendarEvent(task,detail='generic'){
 return {id:'f'+digest(String(task.id)).slice(0,40),summary:detail==='titles'?String(task.name).slice(0,150):'Work deadline',start:{date:task.due},end:{date:nextDate(task.due)},transparency:'transparent',extendedProperties:{private:{fortor:'dashboard-v2'}}};
}
function nextDate(value){const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10);}
export const CALENDAR_SCOPE='https://www.googleapis.com/auth/calendar.app.created';

export function googlePermissionRequest(body){
 const scopes=body.scopes||[];
 if(!Array.isArray(scopes)||scopes.some(scope=>typeof scope!=='string'))throw new HttpError(400,'Invalid permission request.');
 if(scopes.some(scope=>!['openid','email','profile',CALENDAR_SCOPE].includes(scope)))throw new HttpError(403,'Unapproved permission scope.');
 const extra=body.additionalParams||{};
 if(typeof extra!=='object'||Array.isArray(extra)||Object.keys(extra).some(key=>!['prompt','access_type'].includes(key)))throw new HttpError(403,'Unapproved authorization parameter.');
 if(Object.keys(extra).length&&(!scopes.includes(CALENDAR_SCOPE)||extra.prompt!=='select_account consent'||extra.access_type!=='offline'))throw new HttpError(403,'Additional permissions require the Calendar connection flow.');
 return scopes;
}

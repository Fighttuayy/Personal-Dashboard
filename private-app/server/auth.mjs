import {betterAuth} from 'better-auth';
import {createAuthMiddleware,APIError} from 'better-auth/api';
import {fromNodeHeaders} from 'better-auth/node';
import {CALENDAR_SCOPE,approvedIdentity} from './security.mjs';
export function createAuthentication(pool,repo,config){
 let auth;
 auth=betterAuth({
  appName:"Fortor's Dashboard",baseURL:config.origin,secret:config.authSecret,database:pool,
  trustedOrigins:[config.origin],emailAndPassword:{enabled:false},
  socialProviders:{google:{clientId:config.googleClientId,clientSecret:config.googleClientSecret,scope:['openid','email','profile'],prompt:'select_account'}},
  user:{validateUserInfo:async context=>{
   const email=String(context.user.email||'').toLowerCase();
   const allowed=await repo.canSignIn(email);
   if(!approvedIdentity(context,config.ownerEmail,allowed))return {error:'account_not_allowed',errorDescription:'Use the approved owner account or an invited Google account.'};
  }},
  account:{encryptOAuthTokens:true,accountLinking:{enabled:false}},
  session:{expiresIn:60*60*24*7,updateAge:60*60,cookieCache:{enabled:false}},
  advanced:{useSecureCookies:config.production,cookiePrefix:'fortor',defaultCookieAttributes:{httpOnly:true,secure:config.production,sameSite:'lax',path:'/'},cookies:{session_token:{name:config.production?'__Host-fortor.session_token':'fortor.session_token',attributes:{httpOnly:true,secure:config.production,sameSite:'lax',path:'/'}}}},
  rateLimit:{enabled:true,window:60,max:30},
  hooks:{before:createAuthMiddleware(async ctx=>{
   if(ctx.path!=='/sign-in/social')return;
   const body=ctx.body||{};
   if(body.provider!=='google'||body.idToken)throw new APIError('BAD_REQUEST',{message:'Use the Google sign-in button.'});
   const scopes=body.scopes||[];
   if(scopes.some(scope=>!['openid','email','profile',CALENDAR_SCOPE].includes(scope)))throw new APIError('FORBIDDEN',{message:'Unapproved permission scope.'});
   if(scopes.includes(CALENDAR_SCOPE)){
    const session=await auth.api.getSession({headers:ctx.headers});
    if(!session||!await repo.isOwner(session.user.id))throw new APIError('FORBIDDEN',{message:'Only the owner can connect a calendar.'});
   }
  })},
  databaseHooks:{session:{create:{before:async session=>{
   const user=(await pool.query('select id,email,"emailVerified" from public."user" where id=$1',[session.userId])).rows[0];
   if(!user?.emailVerified)return false;
   if(user.email.toLowerCase()===config.ownerEmail)await repo.bindOwner(user.id);
   else if(!await repo.canSignIn(user.email))return false;
   return {data:session};
  },after:async session=>repo.registerSession(session.id)}}},
  logger:{level:'error'}
 });
 return {auth,getSession:req=>auth.api.getSession({headers:fromNodeHeaders(req.headers),query:{disableCookieCache:true}})};
}

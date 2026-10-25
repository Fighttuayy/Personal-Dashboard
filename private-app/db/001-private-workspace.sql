-- Fortor private workspace. Apply with a database administrator, not the web runtime.
-- The web runtime must connect as fortor_runtime (NOINHERIT, NOSUPERUSER, NOBYPASSRLS).
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='fortor_app') then create role fortor_app nologin nosuperuser nobypassrls; end if;
 if not exists(select 1 from pg_roles where rolname='fortor_runtime') then create role fortor_runtime nologin noinherit nosuperuser nobypassrls; end if;
 execute format('grant fortor_app to %I',current_user);
end $$;
grant fortor_app to fortor_runtime;
grant usage on schema public to fortor_runtime;
create schema if not exists fortor;
revoke all on schema fortor from public;
grant usage on schema fortor to fortor_app,fortor_runtime;

-- Better Auth owns authentication, provider verification, CSRF/state/PKCE and session cookies.
create table if not exists public."user" (id text primary key,name text not null,email text not null unique,"emailVerified" boolean not null default false,image text,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now());
create table if not exists public."session" (id text primary key,"expiresAt" timestamptz not null,token text not null unique,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),"ipAddress" text,"userAgent" text,"userId" text not null references public."user"(id) on delete cascade);
create index if not exists fortor_session_user on public."session"("userId");
create table if not exists public."account" (id text primary key,"accountId" text not null,"providerId" text not null,"userId" text not null references public."user"(id) on delete cascade,"accessToken" text,"refreshToken" text,"idToken" text,"accessTokenExpiresAt" timestamptz,"refreshTokenExpiresAt" timestamptz,scope text,password text,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now(),unique("providerId","accountId"));
create table if not exists public."verification" (id text primary key,identifier text not null,value text not null,"expiresAt" timestamptz not null,"createdAt" timestamptz not null default now(),"updatedAt" timestamptz not null default now());

do $$ declare t text;r text;begin
 foreach t in array array['user','session','account','verification'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public',t);
  foreach r in array array['anon','authenticated'] loop
   if exists(select 1 from pg_roles where rolname=r) then execute format('revoke all on public.%I from %I',t,r); end if;
  end loop;
  execute format('grant select,insert,update,delete on public.%I to fortor_runtime',t);
  execute format('create policy auth_runtime on public.%I for all to fortor_runtime using (true) with check (true)',t);
 end loop;
end $$;

create table fortor.session_guard (session_id text primary key references public."session"(id) on delete cascade,last_activity_at timestamptz not null default now());
alter table fortor.session_guard enable row level security;alter table fortor.session_guard force row level security;
grant select,insert,update,delete on fortor.session_guard to fortor_runtime;
create policy guard_runtime on fortor.session_guard for all to fortor_runtime using(true) with check(true);
create table fortor.owner_binding (singleton boolean primary key default true check(singleton),user_id text not null unique references public."user"(id));
create table fortor.personal (user_id text primary key references public."user"(id),data jsonb not null default '{"tasks":[],"notes":[],"categories":[]}',version bigint not null default 1,updated_at timestamptz not null default now());
create table fortor.teams (id text primary key,owner_id text not null references public."user"(id),data jsonb not null,version bigint not null default 1,updated_at timestamptz not null default now());
create table fortor.members (team_id text not null references fortor.teams(id) on delete cascade,user_id text not null references public."user"(id),role text not null check(role in ('editor','viewer')),joined_at timestamptz not null default now(),primary key(team_id,user_id));
create index fortor_member_user on fortor.members(user_id,team_id);
create table fortor.invites (id text primary key,team_id text not null references fortor.teams(id) on delete cascade,email text not null,role text not null check(role in ('editor','viewer')),token_hash text not null unique check(length(token_hash)=64),created_by text not null references public."user"(id),expires_at timestamptz not null,used_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now());
create index fortor_invite_email on fortor.invites(lower(email),expires_at) where used_at is null and revoked_at is null;
create table fortor.calendar_connections (user_id text primary key references public."user"(id),calendar_id text not null,enabled boolean not null default true,detail text not null default 'generic' check(detail in ('generic','titles')),last_synced_at timestamptz,last_error text,updated_at timestamptz not null default now());
create table fortor.calendar_jobs (user_id text primary key references public."user"(id),attempt integer not null default 0,available_at timestamptz not null default now(),lease_until timestamptz);
create table fortor.audit (id bigint generated always as identity primary key,actor_id text not null,team_id text,action text not null,details jsonb not null default '{}',created_at timestamptz not null default now());

create function fortor.actor() returns text language sql stable set search_path=pg_catalog as $$ select nullif(current_setting('fortor.user_id',true),'') $$;
create function fortor.is_owner(p_user text default fortor.actor()) returns boolean language sql stable security definer set search_path=pg_catalog,fortor as $$ select exists(select 1 from fortor.owner_binding where user_id=p_user) $$;
create function fortor.role_for(p_team text,p_user text default fortor.actor()) returns text language sql stable security definer set search_path=pg_catalog,fortor as $$ select case when t.owner_id=p_user then 'owner' else (select m.role from fortor.members m where m.team_id=t.id and m.user_id=p_user) end from fortor.teams t where t.id=p_team $$;
create function fortor.accept_invite(p_hash text) returns text language plpgsql security definer set search_path=pg_catalog,fortor as $$
declare invitation fortor.invites;verified_email text;begin
 select lower(email) into verified_email from public."user" where id=fortor.actor() and "emailVerified"=true;
 if verified_email is null then raise insufficient_privilege using message='Verified account required'; end if;
 select * into invitation from fortor.invites where token_hash=p_hash for update;
 if not found or invitation.revoked_at is not null or invitation.used_at is not null or invitation.expires_at<=now() or lower(invitation.email)<>verified_email then raise insufficient_privilege using message='Invitation unavailable for this account'; end if;
 if invitation.created_by<>(select owner_id from fortor.teams where id=invitation.team_id) then raise insufficient_privilege using message='Invitation owner changed'; end if;
 insert into fortor.members(team_id,user_id,role) values(invitation.team_id,fortor.actor(),invitation.role) on conflict(team_id,user_id) do nothing;
 update fortor.invites set used_at=now() where id=invitation.id;
 insert into fortor.audit(actor_id,team_id,action) values(fortor.actor(),invitation.team_id,'invite.accepted');
 return invitation.team_id;
end $$;
create function fortor.member_directory(p_team text) returns table(user_id text,name text,email text,role text) language sql stable security definer set search_path=pg_catalog,fortor as $$
 select u.id,u.name,case when fortor.role_for(p_team)='owner' then u.email else null end,'owner' from fortor.teams t join public."user" u on u.id=t.owner_id where t.id=p_team and fortor.role_for(p_team) is not null
 union all
 select u.id,u.name,case when fortor.role_for(p_team)='owner' then u.email else null end,m.role from fortor.members m join public."user" u on u.id=m.user_id where m.team_id=p_team and fortor.role_for(p_team) is not null
$$;

-- Only the server authentication hook can bind the first approved Google identity.
create function fortor.bind_owner(p_user text) returns void language plpgsql security definer set search_path=pg_catalog,fortor as $$ begin
 if not exists(select 1 from public."user" where id=p_user and "emailVerified"=true) then raise insufficient_privilege;end if;
 insert into fortor.owner_binding(singleton,user_id) values(true,p_user) on conflict(singleton) do nothing;
 if not exists(select 1 from fortor.owner_binding where user_id=p_user) then raise insufficient_privilege using message='Owner already bound';end if;
 insert into fortor.personal(user_id) values(p_user) on conflict do nothing;
end $$;
create function fortor.can_sign_in(p_email text) returns boolean language sql stable security definer set search_path=pg_catalog,fortor as $$
 select exists(select 1 from fortor.owner_binding o join public."user" u on u.id=o.user_id where lower(u.email)=lower(p_email))
 or exists(select 1 from fortor.members m join public."user" u on u.id=m.user_id where lower(u.email)=lower(p_email))
 or exists(select 1 from fortor.invites where lower(email)=lower(p_email) and used_at is null and revoked_at is null and expires_at>now())
$$;

alter table fortor.owner_binding enable row level security;alter table fortor.owner_binding force row level security;
alter table fortor.personal enable row level security;alter table fortor.personal force row level security;
alter table fortor.teams enable row level security;alter table fortor.teams force row level security;
alter table fortor.members enable row level security;alter table fortor.members force row level security;
alter table fortor.invites enable row level security;alter table fortor.invites force row level security;
alter table fortor.calendar_connections enable row level security;alter table fortor.calendar_connections force row level security;
alter table fortor.calendar_jobs enable row level security;alter table fortor.calendar_jobs force row level security;
alter table fortor.audit enable row level security;alter table fortor.audit force row level security;
create policy personal_owner on fortor.personal for all to fortor_app using(user_id=fortor.actor() and fortor.is_owner()) with check(user_id=fortor.actor() and fortor.is_owner());
create policy team_read on fortor.teams for select to fortor_app using(owner_id=fortor.actor() or fortor.role_for(id) is not null);
create policy team_create on fortor.teams for insert to fortor_app with check(owner_id=fortor.actor() and fortor.is_owner());
create policy team_write on fortor.teams for update to fortor_app using(fortor.role_for(id) in ('owner','editor')) with check(fortor.role_for(id) in ('owner','editor'));
create policy team_delete on fortor.teams for delete to fortor_app using(fortor.role_for(id)='owner');
create policy member_read on fortor.members for select to fortor_app using(fortor.role_for(team_id) is not null);
create policy member_write on fortor.members for update to fortor_app using(fortor.role_for(team_id)='owner') with check(fortor.role_for(team_id)='owner' and role in ('viewer','editor'));
create policy member_delete on fortor.members for delete to fortor_app using(fortor.role_for(team_id)='owner' or user_id=fortor.actor());
create policy invite_owner on fortor.invites for all to fortor_app using(fortor.role_for(team_id)='owner') with check(fortor.role_for(team_id)='owner' and created_by=fortor.actor());
create policy calendar_owner on fortor.calendar_connections for all to fortor_app using(user_id=fortor.actor() and fortor.is_owner()) with check(user_id=fortor.actor() and fortor.is_owner());
create policy audit_read on fortor.audit for select to fortor_app using(fortor.is_owner() or fortor.role_for(team_id)='owner');
create policy audit_write on fortor.audit for insert to fortor_app with check(actor_id=fortor.actor());

grant select,insert,update on fortor.personal to fortor_app;
grant select,insert,update,delete on fortor.teams,fortor.invites to fortor_app;
grant select,update,delete on fortor.members to fortor_app;
grant select,insert,update,delete on fortor.calendar_connections to fortor_app;
grant select,insert on fortor.audit to fortor_app;
grant usage,select on all sequences in schema fortor to fortor_app;
revoke all on all functions in schema fortor from public;
grant execute on function fortor.actor(),fortor.is_owner(text),fortor.role_for(text,text),fortor.accept_invite(text),fortor.member_directory(text) to fortor_app;
grant execute on function fortor.bind_owner(text),fortor.can_sign_in(text),fortor.is_owner(text) to fortor_runtime;
grant select,insert,update,delete on fortor.calendar_jobs to fortor_runtime;
create policy job_runtime on fortor.calendar_jobs for all to fortor_runtime using(true) with check(true);

create function fortor.guard_team() returns trigger language plpgsql set search_path=pg_catalog,fortor as $$ begin
 if new.id<>old.id or new.owner_id<>old.owner_id then raise insufficient_privilege using message='Team identity is immutable';end if;
 if fortor.role_for(old.id)<>'owner' and (new.data->>'name' is distinct from old.data->>'name' or new.data->>'description' is distinct from old.data->>'description') then raise insufficient_privilege using message='Only the owner can change team settings';end if;
 new.version=old.version+1;new.updated_at=now();return new;
end $$;
create trigger guard_team before update on fortor.teams for each row execute function fortor.guard_team();
create function fortor.bump_personal() returns trigger language plpgsql set search_path=pg_catalog,fortor as $$ begin new.version=old.version+1;new.updated_at=now();return new;end $$;
create trigger bump_personal before update on fortor.personal for each row execute function fortor.bump_personal();
create function fortor.notify_change() returns trigger language plpgsql security definer set search_path=pg_catalog,fortor as $$
declare entity jsonb;scope text;identity text;begin
 entity=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 scope=case when tg_table_name='personal' then 'personal' else 'team' end;
 identity=case when tg_table_name='personal' then entity->>'user_id' when tg_table_name='teams' then entity->>'id' else entity->>'team_id' end;
 perform pg_notify('fortor_changes',jsonb_build_object('scope',scope,'id',identity)::text);
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger personal_changed after insert or update on fortor.personal for each row execute function fortor.notify_change();
create trigger team_changed after insert or update or delete on fortor.teams for each row execute function fortor.notify_change();
create trigger membership_changed after insert or update or delete on fortor.members for each row execute function fortor.notify_change();
commit;

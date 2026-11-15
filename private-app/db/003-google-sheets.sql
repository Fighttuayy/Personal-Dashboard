create table if not exists fortor.sheets_connection (
 user_id text primary key references public."user"(id),
 spreadsheet_id text not null,
 enabled boolean not null default true,
 snapshot_hash text,
 last_synced_at timestamptz,
 last_error text
);
alter table fortor.sheets_connection enable row level security;
alter table fortor.sheets_connection force row level security;
create policy sheets_owner on fortor.sheets_connection for all to fortor_app
 using (user_id=fortor.actor() and fortor.is_owner())
 with check (user_id=fortor.actor() and fortor.is_owner());
grant select,insert,update on fortor.sheets_connection to fortor_app;

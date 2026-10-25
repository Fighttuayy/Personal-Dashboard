# Fortor's Dashboard — Private cloud upgrade

Status: implementation prepared and locally tested; NOT activated on the live GitHub Pages site. There are no production credentials or private workspace records in this package. Do not deploy the old static HTML as a replacement for this server.

## What is implemented

- Google-only sign-in, verified-email allowlist, immutable sole-owner binding; no application password/PIN.
- Protected server-rendered dashboard; unconfigured deployments fail closed. Google tokens stay on the server, encrypted by Better Auth. Browser sessions use HttpOnly cookies, Secure in production, SameSite=Lax, CSRF + exact-origin checks.
- Private personal tasks/income/notes and separately scoped team documents. PostgreSQL FORCE RLS plus restricted runtime/data roles; no browser database key.
- Viewer/Editor invites tied to verified Google email; 24-hour expiry, hashed secret, single-use, revoke and member-role controls. Personal data is never part of the team bootstrap.
- Cross-device updates via authorized SSE version checks (about every two seconds), optimistic writes and three-way merging. Overlapping changes require review; drafts stay in memory. This is record-level collaboration, not character-by-character coediting.
- Lock, revoke sessions, 30-minute idle timeout, manual backup/import. Browser private workspace data is not persisted in localStorage. Exported backups are readable files and must be stored privately.
- Separate Google Calendar consent with calendar.app.created only. One-way incomplete-task deadlines into an app-created calendar; generic event titles by default. Income/private notes excluded. iPhone Apple Calendar displays this Google calendar after the user adds the Google account.

## Activation needed

1. Confirm the owner's Google email. Never infer it from GitHub. No real owner identity has been configured yet.
2. Provision a dedicated empty Supabase/PostgreSQL database and a Node 24 web host with HTTPS. GitHub remains the code host; GitHub Pages cannot run the private server. No paid plan is selected by this package.
3. In the Google Cloud console create a Web OAuth client, approved origins, and the exact redirect `https://YOUR_HOST/api/auth/callback/google`. Enable Google Calendar API for the optional integration. Configure consent-screen audience and test users/publishing as applicable. Testing-mode token expiry and Google verification requirements must be checked before general use.
4. Set secrets directly in the hosting secret manager using `.env.example` as a field list. Do not paste passwords, OAuth client secrets, refresh tokens, or database URLs into chat/GitHub.
5. Use an administrator migration job only: set MIGRATION_DATABASE_URL and run `node server/migrate.mjs`. Dedicated empty DB only. The script journals the migration and refuses pre-existing auth tables.
6. Provision a strong LOGIN credential for the already-created `fortor_runtime` role in the database admin console. Retain NOINHERIT, NOSUPERUSER and NOBYPASSRLS; grant no extra roles. Use that role's TLS-verified connection as DATABASE_URL. Never run the web app as postgres/service-role/admin. Managed provider permission restrictions must be checked when applying the migration.
7. Install with `npx --yes pnpm@11.25.0 install --frozen-lockfile --prod`, start `node server/index.mjs`. NODE_ENV=production, correct APP_ORIGIN, Google keys and owner email are mandatory. Start with one web replica; calendar writes serialize within the process.
8. Verify real Google owner sign-in, disallowed account rejection, cross-device save, invite acceptance/revocation, idle lock and optional Calendar consent against the actual services. Local tests do not replace this acceptance test.
9. Before migrating, export the original local workspace from the original browser. It will not appear automatically on the new origin. Import the personal backup only after private sign-in works. Share team content intentionally; do not import a private backup into a team.
10. Enable and verify database backups/restore, provider MFA, access/audit monitoring and deployment rollback. Choose a hosting/database plan with suitable uptime/backups before relying on it for irreplaceable work. Free hosting may sleep and is not assumed production-ready.

## Security limits and operations

This is not end-to-end encryption: the application server and authorized database administrators can access stored work. Google account security protects sign-in; it does not replace application authorization. No claim of absolute security is made.

Offline edits remain in memory; do not close the page before Synced. Failed calendar updates surface a status and can be retried with Sync now; there is no durable job worker yet, so do not promise background retry after server restarts. Stopping sync leaves previously created calendar events; deleting/revoking Google access is a separate user action. Apple controls refresh timing. Team exports are static readable snapshots outside later revocation; share the authenticated team invite for controlled access.

Keep the auth secret stable and backed up in a secret manager: it protects sessions and encrypted provider credentials. Disable or revoke affected sessions/tokens during an incident. Never expose admin DB credentials, secrets or logs containing tokens. Keep database TLS certificate verification enabled.

## Local verification

`pnpm install --frozen-lockfile` then `node --test tests/*.test.mjs`.

Tests run against PGlite (real PostgreSQL policy execution) and Supertest. Coverage includes personal/team isolation, roles, invite replay/expiry/revocation, CAS conflicts, CSRF, missing-setup denial, auth-token endpoint denial, safe bootstrap encoding, session idle timeout, merge conflicts and calendar privacy. Actual Google/Supabase/hosting acceptance remains pending.

Without credentials, `node server/index.mjs` binds 127.0.0.1:4318 and only presents the disabled setup screen. No bypass/demo-login endpoint exists. The separate development UI fixture is deliberately excluded from deliverables.

## References

- Better Auth Google: https://better-auth.com/docs/authentication/google
- Better Auth security: https://better-auth.com/docs/reference/security
- Google Calendar scopes: https://developers.google.com/workspace/calendar/api/auth
- Apple Calendar accounts: https://support.apple.com/en-gb/guide/iphone/iphc37be2016/ios
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Render free-plan limits: https://render.com/docs/free

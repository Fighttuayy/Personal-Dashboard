# Fortor's Dashboard

Private personal workspaces with Google sign-in, cloud persistence and scoped team spaces.

- Open: https://fortors-private-dashboard.onrender.com/
- Data & privacy: https://fortors-private-dashboard.onrender.com/privacy
- Hosting: Render Node web service; PostgreSQL on Supabase in a separate personal organization.
- Source: GitHub. Legacy GitHub Pages/static entry points forward to private sign-in, while offering a local backup export if this browser still has previous records.

## Privacy model

The configured, verified Google owner has the personal dashboard. Other accounts need an active, email-bound invitation and only receive authorized team data. PostgreSQL FORCE RLS and application checks enforce separation. Viewer is read-only; Editor can change shared content but cannot change ownership, team settings or membership. Invitation links are hashed, single-use, valid for 24 hours, and revocable. Session cookies are HttpOnly/Secure in production; sessions lock after 30 idle minutes by default. Remember this device is an explicit per-session opt-in, capped at 30 days from a new Google sign-in and revocable from Security. Existing sessions retain their earlier cookie expiry; start a fresh Google login for a full 30 days.

Cloud workspace records are not saved in browser localStorage. Server Google tokens are encrypted. Neither owner identity nor production secrets are committed. Authorized provider administrators can access stored records; this is not end-to-end encryption. Exported backups and team snapshots are readable files outside later revocation.

## Using it

Sign in with the approved owner Google account. Use Teams to create separate shared spaces and explicitly copy selected personal items when intended. Shared task copies exclude income and private task notes. Invite by email with Viewer or Editor access. Google OAuth must be in production for invited members outside its test-user list.

For Calendar, open Security. Grant the separate Calendar permission, choose generic deadline titles or opt into task titles, then connect. Only the app-created calendar is managed; income and private notes are excluded. Add the Google account in iPhone Calendar settings and select the dedicated deadline calendar. Apple controls refresh timing. Calendar API is enabled; actual access and event sync still require the owner's separate consent. Stopping sync leaves existing events. Automatic updates are best-effort with a visible failure status and manual Sync now; no durable retry worker is included.

## Development and validation

Node 24 and pnpm 11.25.0. Inside private-app (or this extracted package):

```sh
pnpm install --frozen-lockfile
node --test tests/*.test.mjs
node server/index.mjs
```

Without credentials, local startup presents a disabled setup screen. No bypass/demo login route is shipped. Automated tests cover PostgreSQL access policies, owner/member isolation, invitation expiry/replay/revocation, session idle checks, CSRF, safe bootstrap, token endpoint denial, Google scope overrides, merge conflicts, calendar privacy, public privacy routing and loss-safe migration export.

Live acceptance checked Google owner sign-in, persisted task creation, live update in another tab without reload, anonymous API denial, blocked HTML/token endpoints, cross-origin write denial and verified database TLS with the restricted runtime role. Temporary records were removed. Real team-recipient sign-in and Apple-device calendar display require actual participants/devices and must not be claimed as already tested.

## Fresh deployment

Use a dedicated empty database. Review .env.example for variable names and set actual values in the host secret manager. Create a Web Google OAuth client with redirect `https://YOUR_HOST/api/auth/callback/google`; consent initially needs openid/email/profile only. Enable Google Calendar API for the optional integration.

Run server/migrate.mjs once with MIGRATION_DATABASE_URL from an administrator-only migration job. Provision a strong LOGIN credential for fortor_runtime while retaining NOINHERIT, NOSUPERUSER and NOBYPASSRLS. Web DATABASE_URL must use this role, never an admin/service-role credential. Use verified TLS and the provider's current CA. The supplied public Supabase Root 2021 CA was downloaded from the project's official Database Settings certificate link and is valid until April 2031.

BETTER_AUTH_SECRET protects sessions and encrypted provider tokens; keep it stable and backed up securely. OWNER_GOOGLE_EMAIL defines the first allowed owner; the database binding is then immutable. Owner transfers require an explicit administrator procedure.

Use one web replica until calendar synchronization is coordinated across processes. Free Render hosting may sleep and does not imply production uptime. Choose and verify a suitable backup/restore plan before relying on the service for irreplaceable work. No paid plan has been selected automatically. The render.yaml is a configuration draft and has not been Render-CLI validated; the running service was created and verified directly.

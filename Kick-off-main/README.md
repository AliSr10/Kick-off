# Kickoff — mobile layouts and clearer sign-in

This edition keeps the original dark/neon design, public and staff styles, particle/reveal animations, chart settings, selection delays, and animated stadium match pass. A separate `client/public/mobile.css` layer adapts the existing pages for phones, tablets and landscape screens. The security fixes remain in place. The optional Cloudflare integration has been removed.

## Frontend changes in this edition

- Responsive layouts across customer sign-in, home/gallery/location/guide, account/history, every booking step, terms/privacy/contact/support, staff sign-in, all three dashboard views, and all dialogs.
- Clear customer choices: **Continue with Google**, **Continue as guest**, and a separate **Staff sign in** link. The top bar keeps sign-in/account access available on phones.
- Staff login supports autofill, visible labels, show/hide password, a busy state, duplicate-submit prevention, readable errors and recovery after a failed connection.
- Larger touch targets, 16px form inputs, linked labels, international phone formatting, safe-area spacing, zoom support and keyboard focus management.
- Staff booking tables become labeled cards on phones; navigation, counters, chart headings and forms wrap within the screen.
- Match passes scroll normally, long names/time ranges wrap, and export/share controls stay reachable. Decorative/export layers no longer enlarge the mobile viewport.

Use the complete ZIP so every HTML page receives the new stylesheet and `ui.js` helper. No new environment variables, npm dependencies or database migrations are introduced by this frontend revision. Render build/start commands are unchanged.

This project uses plain HTML, CSS, JavaScript and canvas. Neither uploaded version imports Three.js, React Three Fiber/Drei, or Spline. No separate React client build is needed. If you installed these packages only for this project, you can remove them from your existing local client folder:

```bash
cd client
npm uninstall three @react-three/fiber @react-three/drei @splinetool/react-spline
```

## Start with a local visual preview

No database, Google account, or `.env` file is needed for this mode:

```bash
cd server
npm ci
npm run preview
```

Equivalent startup: `node server.js --preview`.

Open `http://localhost:3000`, choose **Continue as guest**, and browse the current design. The staff layout is available directly at `http://localhost:3000/admin/dashboard.html`.

Preview binds to this computer only. Its availability is illustrative and its counters/tables are empty. Booking submissions, Google login and all changes are disabled. It refuses to start when the process environment has `NODE_ENV=production`. Normal `node server.js` starts the full application and requires the configuration and migration below.

## Upgrade the existing Render / Neon deployment

Use the complete project together, including the new scripts, shared frontend helper, migration, vendored assets and lockfile. The ZIP contains a `Kick-off-main` folder; inside it, `client`, `server` and `.github` belong at your repository root. Keep your real secrets in Render, outside Git.

1. Create a Neon development branch or backup before altering production data. This update has not accessed your live database.
2. Use that development branch to run the checks and migration first. Install dependencies from the `server` folder using `npm ci`. Copy `.env.example` to `.env` for local full-app testing and replace the placeholders with your own development values.
3. Run:

```bash
npm run db:check
npm run db:migrate
npm test
```

`db:check` is read-only. It reports duplicate confirmed slots, duplicate weekly slots, confirmed/weekly overlaps, and invalid active slots/statuses. Resolve the reported records before migrating. The migration stops on conflicts; it never chooses a booking to cancel or deletes customer records to resolve them.

The migration runs in one transaction and preserves existing users, reservation IDs and weekly bookings. It adds account ownership, slot timestamps, constraints, indexes, persistent sessions and an audit log. The supplied older `init.sql` did not create the `user_id` column already used by the application; the migration handles this safely. Existing deployments should use `db:migrate`, not rerun a fresh schema manually.

Migration `001_security_and_bookings` is unchanged from the previous security package. If you already applied it successfully, this corrective edition needs no additional migration. Rerunning `db:migrate` is safe and reports that it is already applied. `db:check` reporting `ready: true` means the data passes preflight; it does not apply the migration. Startup now explains a missing migration instead of reporting only `42P01`.

4. Plan production migration while the old application is not accepting booking writes. The old code does not participate in the new PostgreSQL booking lock. Run `db:check` and `db:migrate` against production with the schema owner's credentials, then deploy this complete version. Keep privileged migration credentials out of the running web service when using the restricted application role described below.
5. In Render, use these settings if your root directory is `server`:

| Setting | Value |
| --- | --- |
| Root Directory | `server` |
| Build Command | `npm ci --omit=dev` |
| Start Command | `node server.js` |
| Health Check Path | `/healthz` |
| Node version | Node 22 or 24 |

The install script copies pinned Chart.js and Flatpickr assets from the lockfile into the public vendor directory. The browser loads those files from your own server. No separate frontend build or frontend `npm install` is required.

6. Keep the environment settings below in Render. Its native Node runtime normally sets `NODE_ENV=production`; verify the effective value.
7. After deployment, test Google login, a guest request, staff approval, a signed match-pass link, a cancellation, and conflicting manual/weekly bookings. Check the live layout on desktop/mobile. These provider/browser checks require your configured deployment.

## Environment variables

| Name | Requirement |
| --- | --- |
| `DATABASE_URL` or `DB_URL` | Your Neon connection string. Use the restricted app role for the running service when configured. A pooled Neon URL is supported. |
| `SESSION_SECRET` | Strong random secret, at least 32 characters; generate 32 random bytes as shown below. The old hard-coded fallback has been removed. |
| `ADMIN_USER` | Your existing staff username. |
| `ADMIN_PASS` | A strong unique password, at least 12 characters; a password manager generated value is preferred. |
| `GOOGLE_CLIENT_ID` | Your existing Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | Your existing Google OAuth client secret. Keep it server-side. |
| `GOOGLE_CALLBACK_URL` | Exact HTTPS production callback ending in `/api/auth/google/callback`, also registered in Google's authorized redirect URIs. |
| `NODE_ENV` | `production` on Render; `development` for local full-app work. |
| `APP_URL` | Optional canonical public origin. Defaults to the callback origin. When set, it must use the same origin as the callback. |
| `TICKET_SECRET` | Recommended separate random signing key, at least 32 characters. When absent, `SESSION_SECRET` signs passes. |
| `BUSINESS_WHATSAPP` | Optional; defaults to `9613696325`, international digits without the domestic trunk zero. |

Generate a random key locally, then copy its output into the relevant private environment field:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run it separately for the session and ticket keys. Do not commit the output. Example placeholders are rejected at startup. If you copy `.env.example`, replace its optional `TICKET_SECRET` placeholder too, or remove that line to use the documented fallback.

For local full-app testing, use:

```env
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

Register the localhost callback in your Google development OAuth configuration. Then use `npm run dev` for automatic restarts or `node server.js` for normal startup.

Production PostgreSQL connections enforce `sslmode=verify-full`. Development connection strings using the old `prefer`, `require`, or `verify-ca` aliases are normalized to `verify-full`, retaining full certificate verification and avoiding the alias warning. The old `rejectUnauthorized: false` override is removed. For local PostgreSQL without TLS, use `sslmode=disable` only in development/test mode.

## Restrict the Neon application role

This is a database-owner configuration step, not something the unprivileged web process can do for itself. Complete the migration first.

1. Using an owner connection in Neon, create a dedicated login role called `kickoff_app` with a strong generated password, no database/schema ownership, no administrative attributes and no privileged role memberships. Keep that password private. Do not reuse an owner/admin account as the runtime role.
2. Run `server/config/runtime-role.sql` as the owner. It grants only the table/sequence permissions the app needs, including INSERT-only access to its audit log and read-only access to the migration version. It checks that the role already has CONNECT access and cannot create objects in `public`.
3. If CONNECT has previously been revoked, the owner should grant CONNECT on the specific application database to `kickoff_app`, then rerun the script. If PUBLIC/schema CREATE permissions are too broad, review and restrict them as the owner before rerunning. The helper deliberately does not revoke privileges from other roles or silently change shared database settings.
4. Set Render's `DATABASE_URL` to this application's Neon connection string using the new role and password. Keep privileged migration credentials in a separate operator environment. Subsequent migrations run as the owner; the web process starts as the app role.

The automated database test verifies that this role can perform the required application operations while being unable to alter application tables or delete audit records.

## Security behavior changes

- Booking history is scoped to the authenticated `user_id`. A self-entered phone number is contact information, never ownership proof. Guest bookings remain accessible through their secure receipt link; historical phone-only records are not automatically claimed by accounts.
- Customer/staff values use text nodes or HTML escaping within the original templates. Inline scripts and event-handler attributes are moved into local scripts; responsive refinements are layered over the original styles. Scripts run under a same-origin CSP; the original inline CSS is retained.
- Tickets require an HMAC-signed link and retrieve the real reservation/status from the API. Old unsigned URL-field tickets fail closed. New booking responses include a secure pass URL and QR; account-owned bookings also show their secure Pass link in the existing account page. The authenticated staff reservations API returns `ticketUrl` for historical records; the original staff modal has not gained extra controls.
- New booking references retain the original `RES-XXXXXX` display format using cryptographic randomness and collision retries. A reference alone never authorizes access to a booking or pass; signed links and authenticated account/staff ownership provide authorization.
- Signed links are private bearer links. A recipient can see the player's name, slot and status, but not phone numbers or notes. Share them only with the intended player/facility. Referrer headers are disabled, and QR codes are generated by your own server.
- A downloaded PNG/video is a snapshot, including its status at export time. Reopen the online secure pass to verify its current status. Status refreshes every 30 seconds while the pass is visible; unavailable verification disables the export controls.
- Rotating the signing key invalidates old pass links. New links are available from the account page or authenticated staff API. Rotating the session key signs users out; keeping a separate stable ticket key avoids invalidating passes during session-key changes.
- Public requests are PENDING and do not hold slots. Multiple requests may exist for one slot; only one can be confirmed. All booking/weekly changes use a shared transaction-scoped PostgreSQL advisory lock, plus uniqueness constraints for confirmed/weekly slots.
- Named slots use the Beirut wall clock. The final slot can have a different elapsed duration during daylight-saving changes; migrated records retain their local schedule.
- Sessions are stored in PostgreSQL, with a 24-hour cookie, production Secure, HttpOnly and SameSite=Lax attributes. Admin login rotates the session ID; logout destroys the session and clears the cookie.
- Unsafe API methods require a session CSRF token and validate an incoming Origin header. Google OAuth uses state checking. Same-origin clients do not need permissive CORS headers.
- Rate limits: 10 staff-login attempts/15 minutes, 8 public booking submissions/15 minutes, 180 general API requests/minute and 120 session-bootstrap requests/minute, per IP. These limits are per application instance. Use a shared rate-limit store or an appropriate edge limit before scaling across several Render instances. Sessions and booking conflict protection already use shared PostgreSQL storage.
- Request bodies are limited to 16 KiB. Names, phones, notes, dates, slots, calendar horizon and past kickoff times are validated on the server. Staff API responses are paginated; the original staff table/timeline automatically retrieves the pages so its existing layout and full results are preserved. API responses are not cached; static assets can be cached.
- Staff booking/weekly changes and cancelled-history deletion are written to `audit_log`. Operational errors log an identifier/code instead of full request bodies, ticket links or secrets.

## Account/repository steps outside this ZIP

These require access to your provider accounts and were not performed by editing the source archive:

- Enable MFA and appropriate collaborator access on GitHub, Render, Neon and staff Google accounts.
- Review Git history/secret-scanning alerts for previous `.env` or credential commits. The corrected `.gitignore` prevents new untracked secret files from being added; it cannot erase old commits. Rotate credentials if they were exposed.
- Keep backups/restore coverage appropriate to your Neon plan and test a restore before relying on it.
- For several staff members, use individually attributable accounts/roles rather than sharing one configured operator password. This update retains your existing single-operator login.
- Dependabot configuration is included in `.github/dependabot.yml`. Enable the relevant GitHub dependency/security features and review its updates. Reinstalling from an updated lockfile refreshes the local browser assets through `postinstall`.

## Validation and maintenance

```bash
cd server
npm ci
npm test
npm audit
```

The current suite has 34 passing checks covering missing credentials, session rotation/persistence, ownership, safe rendering, CSRF, OAuth state, signed/live tickets, rate limits, input validation, competing approvals, weekly conflicts, database constraints, reference collisions, TLS configuration, migration preservation/rollback/idempotency, Beirut date boundaries, restricted-role permissions, local asset hashes, preview isolation, and the retained public/admin interface flows.

Database integration checks use an isolated PGlite PostgreSQL engine, and interface checks use JSDOM. They do not connect to your live Neon database or Google account. PGlite serializes embedded transactions; a live multi-connection load test was not performed. Chromium viewport checks cover the public views, booking flow, account, staff login/dashboard views and dialogs, and the signed pass at 320×568, 360×780, 390×844, 430×932, 768×1024, 1024×768, 1440×900 and 844×390. Browser fixtures use synthetic API data and cached copies of the existing Google fonts; external gallery images and map content are excluded. This verifies responsive browser behavior, not a physical iPhone/Android device or live OAuth/deployment. Source comparisons verify the unchanged original public/admin CSS, ticket CSS, required controls, particle/reveal code, ticket motion, chart settings and selection delays. Pass status text and export availability follow server verification as required by the security fix.

Dependencies are locked in `server/package-lock.json`. Run `npm audit` when installing or deploying and review any new advisories.

`COPY_CODE.html` is an optional local file-copy viewer. Keep it at the project root, outside `client/public`. It contains source/documentation and is not part of the hosted website.

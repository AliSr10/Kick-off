# Frontend review — 2.3.0

The original public/admin CSS, ticket CSS, particle/reveal code, ticket motion,
chart configuration and booking selection delays are retained. Responsive styles
are layered in `client/public/mobile.css`; shared keyboard, focus and login
controls live in `client/public/ui.js`. The security backend remains in place.
Optional Cloudflare integration is removed.

## Coverage

| Area | Screens and states reviewed |
| --- | --- |
| Customer access | Google/guest/staff choices, mobile navigation, sign-in error, local preview message |
| Public site | Home, booking guide, gallery, location, terms, privacy, contact and support |
| Booking | Dates, available/unavailable times, player details, confirmation dialog and receipt |
| Account | Profile inputs, sign-out control, booking history, long contact/name values and pass links |
| Staff login | Autofill labels, password visibility, loading, rejected credentials, connection failure and retry |
| Staff dashboard | Schedule, statistics/chart, booking search/status toolbar, booking cards and weekly bookings |
| Staff dialogs | Details, manual booking, weekly creation/editing and history confirmation |
| Date pickers | Schedule and manual booking calendars, clamped horizontally and vertically to the visible screen |
| Match pass | Long names/time ranges, normal scrolling, all export actions and saved PNG |

## Verification

- `cd server && npm test`: 34 passing automated checks. These cover the existing
  security/database behavior, original animation/style contracts, safe rendering,
  preview isolation, booking/staff flows and login recovery.
- Chromium viewport matrix: 320×568, 360×780, 390×844, 430×932, 768×1024,
  1024×768, 1440×900 and 844×390. Checks cover visible control bounds, document
  width, open dialog bounds and navigation through the screens above.
- Additional calendar and keyboard checks at 320×568, 390×844, 768×1024 and
  844×390 cover popup bounds, initial field focus, reverse-tab wrapping and Escape.
- A signed-pass fixture successfully downloads a 1080×1920 PNG. Long player
  names wrap within the saved pass while ordinary names retain their original
  single-line placement.

Browser checks use synthetic API responses and cached copies of the existing
Google fonts. They do not create real bookings or contact Neon/Google OAuth.
External gallery images and embedded map content are excluded from automated
browser fixtures; their responsive containers are checked. This is browser
viewport verification, not testing on physical iOS/Android devices. No live
Render deployment or provider-account changes were performed.

## Install and preview

Use the whole project together; each HTML page needs the new CSS and helper.
No new npm dependencies, environment variables or database migrations are added
by this frontend revision. Existing Render build/start settings stay the same.

```bash
cd server
npm ci
npm run preview
```

Open `http://localhost:3000`. This visual preview requires no database or Google
credentials. Full production startup remains `node server.js` with the existing
environment configuration. See `README.md` for the original security migration
instructions if that migration has not already been applied.

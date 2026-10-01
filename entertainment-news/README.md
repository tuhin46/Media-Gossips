# Media Gossips website

AngularJS 1.8.2 SPA with hash routing, category feeds, search, pinning, bookmarks, trailers, and an admin panel. Public page layouts and CSS are preserved.

This branch uses shared Google Drive content through an Apps Script backend and the Vercel function in `api/storage.js`. Published content is shared among visitors; drafts require a verified admin session. Bookmarks remain in each visitor browser.

Follow [the complete setup guide](../storage/SETUP.md) before deploying. The Vercel project Root Directory must be `entertainment-news`, framework Other, no build command or output override. Environment variables are `DRIVE_SCRIPT_URL`, `DRIVE_API_KEY`, and `SESSION_SECRET`. The script backend and Drive folder are owned by smtuhin46@gmail.com.

Admin username is `admin`; its password is the private ADMIN_PASSWORD Script Property you configure, not the former default password. Password reset is handled through Script Properties and session-secret rotation; no unverified reset form is exposed.

A plain static HTTP server can render the shell, but it does not implement `/api/storage`. Use a configured Vercel Preview for browser testing. The API requires HTTPS same-origin requests and secure cookies.

Existing browser content is not automatically copied. After deployment, open `export-legacy.html` on the original site domain in the original browser, download the JSON backup, and import it through Admin Profile. Do not clear browser data before exporting.

Run `node --test tests/*.test.js` from the repository root for local mocked-service tests. Google authorization and live cross-browser tests remain separate deployment checks.

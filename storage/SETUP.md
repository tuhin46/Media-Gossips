# Media Gossips — shared Google Drive content setup

Target Google account: **smtuhin46@gmail.com**.

Status: code prepared and locally tested. Google deployment, Vercel configuration, migration of your browser content, and live verification still need to be completed. The existing website is unchanged until the integration branch is merged.

## What changes

The AngularJS pages, CSS, categories, pin ordering, search, trailer display, bookmarks, and admin forms keep their existing layout. Data reads and writes go through a Vercel function to an Apps Script backend. Admin authentication moves from browser storage to a signed, secure HTTP-only cookie. The old public default password and unverified reset logic are removed. Loading/error messages and a one-time import control are added. Bookmarks stay personal to each browser.

The current GitHub repository is the authoritative source. Its current snapshot does not contain the analytics and feedback implementation described in the older handoff; this integration does not invent or restore those missing features. If you have newer files on your computer, reconcile them before merging.

## 1. Download the prepared files

Download the integration branch from GitHub: open the branch, select **Code → Download ZIP**, then extract it. You will use these files:

| File | Purpose |
| --- | --- |
| `storage/apps-script/Code.gs` | Apps Script backend |
| `storage/apps-script/appsscript.json` | Apps Script configuration |
| `storage/seed-content.json` | Initial default website content |
| `storage/generate-secrets.html` | Generates private credentials on your own computer |
| `entertainment-news/api/storage.js` | Vercel API; already included in the branch |

## 2. Generate your private values

Open the downloaded `storage/generate-secrets.html` on your computer and click **Generate new values** once. Keep the three values in your password manager:

- `DRIVE_API_KEY`: connects Vercel to Apps Script.
- `SESSION_SECRET`: signs website admin sessions.
- `ADMIN_PASSWORD`: your new website admin password. Username stays `admin`.

These are generated locally. Never send these values, your Gmail password, or a verification code in chat. Do not put them in GitHub. The existing `pulse@2026` password will not work with shared storage. If you change ADMIN_PASSWORD later, also rotate SESSION_SECRET in Vercel and redeploy to invalidate previous sessions.

## 3. Create the Drive folder in the correct account

In your own browser, open Google Drive and sign in as **smtuhin46@gmail.com**. Check the account avatar before continuing.

1. Create a new folder named **Media Gossips Live Content**.
2. Keep the folder private; do not enable “Anyone with the link.”
3. Open that folder and upload the downloaded `storage/seed-content.json` without renaming it.
4. Copy the folder ID from its URL: in `https://drive.google.com/drive/folders/FOLDER_ID`, copy only `FOLDER_ID`.

This folder is separate from the backup folder created previously under khanahnaf002@gmail.com. Do not use that other account's folder for this setup.

## 4. Create the Apps Script project

While signed in as **smtuhin46@gmail.com**, open https://script.google.com and click **New project**. Name it **Media Gossips Drive Backend**.

1. Open `Code.gs` in the editor and replace its entire contents with the downloaded `storage/apps-script/Code.gs` contents.
2. Open **Project Settings** (gear icon) and enable **Show “appsscript.json” manifest file in editor**.
3. Return to the editor, open `appsscript.json`, and replace its contents with the downloaded `storage/apps-script/appsscript.json` contents.
4. Save the project.

## 5. Set Script Properties

Open **Project Settings → Script Properties → Add script property**. Add exactly these names, with your own values, and save:

| Property | Value |
| --- | --- |
| `DRIVE_FOLDER_ID` | The folder ID from step 3 |
| `DRIVE_API_KEY` | The generated DRIVE_API_KEY from step 2 |
| `ADMIN_PASSWORD` | The generated website admin password from step 2 |

Do not enter SESSION_SECRET in Apps Script. Do not enter your Gmail password. DATA_FILE_ID will be created automatically; do not set it manually.

## 6. Initialize storage and authorize Google

Return to the editor. In the function selector next to **Run**, select **setupStorage**, then click **Run**.

1. When Google asks, review permissions and choose **smtuhin46@gmail.com**.
2. Authorize the script you just created to use Google Drive. The requested Drive scope is broad; the provided code uses the selected project folder. Review Code.gs before granting it access.
3. Wait for the execution log to show **Storage ready. Data file created in the selected folder.**
4. Check the folder in Drive: `media-gossips-data.json` should exist beside `seed-content.json`.

Running setup again preserves existing data. If you see **Storage already initialized**, that is expected. If authorization is refused or an unfamiliar warning appears, stop and share the error text or a screenshot without credentials.

## 7. Deploy the Apps Script web app

Choose **Deploy → New deployment → Select type → Web app**.

| Setting | Value |
| --- | --- |
| Description | `Media Gossips shared storage v1` |
| Execute as | **Me (smtuhin46@gmail.com)** |
| Who has access | **Anyone** |

Click **Deploy** and complete any requested authorization. Copy the **Web app URL ending in `/exec`**. Do not use a `/dev` test URL or the script editor URL.

The “Anyone” setting lets Vercel contact this endpoint without a Google session. The folder stays private. Every data request requires the private DRIVE_API_KEY, which is held only in Vercel and Apps Script. Opening `/exec` directly returns a harmless status message, not your content or secrets.

**Send only the `/exec` URL back in chat.** It contains no password. Keep the API key and admin password private.

For future backend code changes: **Deploy → Manage deployments → Edit → Version: New version → Deploy**. Saving code alone does not update an existing `/exec` deployment.

## 8. Configure Vercel before merging

Open your existing Media Gossips project in Vercel. Under **Settings → Environment Variables**, add the following for **Production** and **Preview**, using separate secrets/backend for an isolated test deployment if desired:

| Name | Value |
| --- | --- |
| `DRIVE_SCRIPT_URL` | The Apps Script `/exec` URL from step 7 |
| `DRIVE_API_KEY` | The same generated value used in Apps Script |
| `SESSION_SECRET` | The generated SESSION_SECRET from step 2 |

Mark secret values as sensitive if Vercel offers that control. Do not prefix these names with NEXT_PUBLIC_ or VITE_. They must stay server-side. ADMIN_PASSWORD belongs in Apps Script, not Vercel.

Confirm **Settings → Build and Deployment → Root Directory** is exactly `entertainment-news` with no leading/trailing space. Keep the framework as **Other**, no build command, and no custom output-directory override. Use a supported current Node.js runtime (22 or later). The `api/storage.js` file lives inside that project root and is a Vercel function; it must not be deployed as a static text file.

After changing variables, create/redeploy the integration branch's Preview deployment. Environment changes apply to new deployments. This changes storage architecture; it is no longer a purely static website.

## 9. Test the Preview without losing browser content

On the Preview website:

1. Open `/api/storage`: expect JSON with `items`, `ticker`, and `revision`, not HTML or an error.
2. Open `#!/admin/login`. Log in with username `admin` and the ADMIN_PASSWORD generated earlier.
3. Add a uniquely named test article with **Published** status and a small uploaded image. Wait for save completion.
4. Open the Preview in a separate browser/incognito window without logging in. Confirm the article and image appear after refreshing.
5. Add a **Draft**. Confirm it appears in the admin panel but does not appear to the logged-out visitor or through its image URL.
6. Edit, pin, change the ticker, and remove the test article. Refresh the visitor window after each operation to verify the changes.
7. Check Drive: the live JSON file should update and `backup-*.json` files should appear.

Using the same backend in Preview and Production means Preview edits affect the same content. Until the old production site is migrated it still uses localStorage; after migration both deployments will share Drive if their environment settings point to the same script.

## 10. Merge and migrate your existing browser content

Once Preview passes, merge the integration pull request into `main`. The existing GitHub–Vercel connection should deploy it. Verify the Vercel deployment reports Ready.

On the **original live website domain**, in the **same browser/profile where you previously added articles**:

1. Open `/export-legacy.html` (replace the hash route with this path).
2. Click **Download content backup**. This reads the old `ep_content_db` and ticker keys, leaves them untouched, and includes embedded uploaded images. Keep the JSON backup safely.
3. Log in to the newly deployed live admin panel.
4. Open **Admin Profile → Import content backup** and select that JSON file.
5. Read the confirmation: matching item IDs are replaced. Confirm once. Wait for the import-completed message.
6. Refresh the live website in another browser/incognito window and check your published articles and images.
7. If another browser/device has separate admin content, export it from that device too and review matching IDs before importing.

Import is sequential. If it stops with an error, earlier items may already have been saved; correct the error and reimport the same backup. IDs are preserved, so repeating an import replaces matching items rather than creating new IDs. Very large embedded images are compressed during import. External image URLs remain external links; this integration does not download or back up the remote image files.

## 11. Ongoing publishing and backups

Add or edit content through the admin panel as before. Select **Published** to show it to visitors; select **Draft** to keep it private. Wait for each save to complete before closing the page. Visitors receive the latest content when they load, refresh, or change content routes; this implementation does not push live updates into an idle page.

Drive stores articles, the ticker, and uploaded image data in `media-gossips-data.json`. Uploaded images are served through the Vercel API in separate requests. Each successful mutation saves the preceding state into one of **10 rotating backup slots** in the same folder. Download important backups before they rotate. To restore, stop editing and copy the desired backup's contents into the existing live JSON file after saving a separate copy of its current contents; do not change DATA_FILE_ID or delete the live file. Restore is a manual recovery operation, not an admin UI feature.

This lightweight implementation is for modest traffic/content volume: limits are 20 MB for stored JSON including image data, 3 MB for the content response without embedded images, and 1 MB per uploaded image data URL. Apps Script also has account quotas and execution/concurrency limits. Drive capacity alone does not remove these application limits. A database/object-storage backend is appropriate if traffic or content grows substantially.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| “Shared storage is not configured yet” | All three Vercel variables exist, `/exec` URL is correct, and a new deployment was created |
| “Google returned an unexpected response” | Web app is **Execute as Me**, access **Anyone**, and uses a deployed version |
| “Access denied” | DRIVE_API_KEY values match exactly between Apps Script and Vercel |
| “Run setupStorage before deploying” | Run setupStorage under the target account after adding properties and uploading seed-content.json |
| API URL returns 404 | Vercel Root Directory is entertainment-news and the integration branch was deployed |
| Admin login fails | Username is admin; use the new website password, not Gmail or the previous default |
| “Too many login attempts” | Wait 10 minutes; repeated failures are limited across the shared backend |
| “This content changed” | Reload the admin page and reopen the item before editing; another save changed its version |
| No local content in the export | Use the exact original domain and browser profile; Preview/incognito cannot read another origin's localStorage |
| Save times out | Check Apps Script Executions and the admin list before retrying; a server save may have completed. Retrying the identical operation in the same open page reuses its save ID |

## Validation already performed

Run `node --test tests/*.test.js` from the repository root. Eight local tests cover shared reads, private drafts/images, CRUD/pinning/ticker/import, image validation, backups, stale-edit rejection, idempotency, authentication, login throttling, CSRF origin checks, async client writes, and route loading. Google Drive services and network calls are mocked in these tests. Live Apps Script/Vercel and browser rendering need the setup and verification above.

Official references: https://developers.google.com/apps-script/guides/web ; https://developers.google.com/apps-script/guides/services/quotas ; https://vercel.com/docs/functions/runtimes/node-js ; https://vercel.com/docs/environment-variables .

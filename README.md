# EviFin — GitHub Pages PWA

A clean-install offline-capable monthly cashflow app by Evisionsoft. No financial entries are bundled. The first launch starts with 12 empty months and zero opening balance. Data is stored locally in the browser on each device. Import your JSON backup from **Plan settings → Import JSON** after installation.

## Publish from scratch

1. Sign in at https://github.com and select **New repository** (the **+** menu). Name it `evifin`, choose **Public**, and select **Create repository**. Do not select a template.
2. On the repository page choose **Add file → Upload files**. Upload the six files in this ZIP **directly into the repository root** (not inside a folder): `index.html`, `manifest.webmanifest`, `service-worker.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`. The README is optional. Commit the files.
3. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, branch **main**, folder **/(root)**, then **Save**.
4. Wait for GitHub Pages to publish. Visit `https://YOUR-USERNAME.github.io/evifin/` and verify the empty month cards and working Analysis/Plan settings buttons.
5. On iPhone, open the published URL **in Safari**. Tap **Share → Add to Home Screen → Add**. Launch EviFin from its new home-screen icon.
6. In EviFin open **Plan settings → Import JSON**, select your EviFin backup, and confirm. Check the month totals. Export a backup periodically.

## Notes

- The app works offline after the first successful online visit, once its service worker has cached the files. Open it once while connected before relying on offline use.
- Each browser/device has separate data; GitHub does not store or synchronize your financial entries. Safari private mode or clearing site data can erase local data.
- Keep your JSON backup separately. Import overwrites the current plan after confirmation.
- Import accepts EviFin backups and compatible Finance Vision state backups with a `state` object, or a compatible raw state JSON. Twelve month entries are required.
- GitHub Pages is HTTPS and suitable for service workers. Opening `index.html` directly from Files is not a substitute for installing from the Pages URL.
- To update, replace `index.html` and any changed files in the repository. Update the cache version in `service-worker.js` for subsequent releases.

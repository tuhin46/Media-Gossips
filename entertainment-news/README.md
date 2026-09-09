# Media Gossips

A modern, single-page entertainment news website built with AngularJS — covering movies, music, celebrities, trending releases, and influencer stories. Includes a full custom Admin Panel & CMS for managing all site content in real time, no backend required.

**Live content is stored entirely in the browser via `localStorage`**, so edits made in the Admin Panel reflect instantly across the public site.

---

## ✨ Features

- **Public Site**
  - Home feed with live search, category filters, and a "Spotlight" section
  - Dedicated pages: Movies, Music, Celebrities, Trending, Influencer Stories
  - Bookmarks (saved locally per browser)
  - Trailer modal, article detail pages, breaking news ticker
  - **Pinned content** — pinned cards always surface first, followed by the newest additions

- **Admin Panel & CMS** (`#!/admin/login`)
  - Sidebar drawer navigation across all content sections
  - Data table with search, edit, preview, delete, and pin/unpin actions
  - Add/Edit modal with image upload (Base64 preview) or image URL, YouTube trailer embed, ratings, year, status (Published/Draft), and full editorial content
  - Breaking News Ticker manager
  - Session-based login (`sessionStorage`)

## 🛠️ Tech Stack

- AngularJS 1.8 (`ngRoute`, hash-based routing)
- Vanilla CSS (no framework/build step)
- Font Awesome icons
- `localStorage` / `sessionStorage` for persistence — no backend or database

## 📁 Project Structure

```
entertainment-news/
├── index.html                  # App shell, navbar, ticker, footer
├── css/style.css               # All styling (site + admin panel)
├── js/
│   ├── app.js                  # App module, routes, public controllers
│   ├── services/
│   │   ├── ContentService.js   # CRUD + localStorage sync + pin/sort logic
│   │   └── AuthService.js      # Admin login/logout/session
│   └── controllers/
│       ├── AdminLoginController.js
│       └── AdminDashboardController.js
└── pages/                      # Route templates (home, movies, music, etc.)
```

## 🚀 Running Locally

This is a static AngularJS SPA using client-side routing, so it must be served over HTTP (opening `index.html` directly as a `file://` URL will not work due to browser CORS restrictions on template loading).

```bash
# From the project folder, using any of:
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed local URL in your browser.

## 🔐 Admin Access

Click the lock icon in the navbar, or go to `#!/admin/login`.

- **Username:** `admin`
- **Password:** `pulse@2026`

## ☁️ Deployment

Deployable as a static site on **Vercel**, **Netlify**, or **GitHub Pages** — no build step required. Import the repo, leave build command empty, set output directory to the project root.

> Note: since all content lives in the browser's `localStorage`, a freshly deployed site will only show the seeded sample content until new items are added through the live Admin Panel.

## 📄 License

For personal/portfolio use.

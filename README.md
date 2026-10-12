# Ledgerline — Home Loan EMI & Financial Planning Consultancy Template

A multi-page HTML template built with **Bootstrap 5.3.3**, custom CSS and vanilla ES6+ JavaScript.
Design concept: **"Blueprint meets ledger"** — calm, precise, trustworthy. Warm paper-cream, deep
ink-navy, copper CTAs, sage for approvals, thin blueprint grid lines and line-drawn houses.

- 15 public pages, 7 client dashboard pages, 7 admin dashboard pages (29 HTML files)
- Live EMI, prepayment, affordability and balance-transfer calculators with amortization chart + table
- Light / dark mode (system preference + saved choice) and full RTL
- WCAG 2.1 AA minded: skip link, visible focus, labelled controls, keyboard sliders, accordions and kanban
- ₹ with Indian lakh/crore formatting by default; switch currency in one line
- No build step. Open `index.html` in a browser and it works, even offline.

## Quick start

```bash
# Option 1: just open it
open index.html            # macOS  (or double-click the file)

# Option 2: serve locally (recommended, mirrors production)
npx serve .                # or: python3 -m http.server 8080
```

Deploy by uploading the whole folder to any static host (Netlify, Vercel, GitHub Pages,
cPanel). For a custom 404 on Netlify/Vercel, copy `pages/404.html` to the site root as `404.html`
and change its asset paths from `../` to `./`.

## Folder structure

```
ledgerline/
├── index.html                 Home 1 (general)
├── pages/                     All other pages (public, client-*, admin-*)
├── assets/
│   ├── css/  style.css        Tokens, layout, every component
│   │         dark-mode.css    Dark token overrides  ([data-theme="dark"])
│   │         rtl.css          RTL fixes             ([dir="rtl"])
│   ├── js/   main.js          Config, money format, theme, RTL, forms, reveal, widgets
│   │         calculator.js    EMI maths + all calculator UIs
│   │         dashboard.js     Sidebar, skeletons, uploads, bookings, kanban, messages
│   ├── images/                Fallback line illustrations (WebP)
│   └── vendor/                Bootstrap 5.3.3 (LTR + RTL) and Bootstrap Icons 1.11.3
├── documentation/index.html   Full guide (open in a browser)
├── sitemap.xml  robots.txt
└── README.md
```

## Photos

All photos are local files in `assets/images/`; no third-party image requests are made.

## Most common customizations

| What | Where |
| --- | --- |
| Brand colors | `assets/css/style.css` → `:root` tokens (`--ll-primary`, `--ll-accent`, …) and `dark-mode.css` |
| Fonts | `<link>` to Google Fonts in each page `<head>` + `--ll-font-*` tokens |
| Currency | `assets/js/main.js` → `CONFIG` (`locale`, `currency`, `shortUnits`) |
| Domain for SEO | Replace `https://www.ledgerline.example` in all files, `sitemap.xml`, `robots.txt` |
| Forms | Set each `<form action>` to Formspree / Netlify (search `TODO (integration)`) |
| Legal text | About → Licences (search `TODO (legal)`) |

Search the project for `TODO` to find every customization point.

See **documentation/index.html** for the full guide, credits, changelog and support.

## Licence & credits

Bootstrap and Bootstrap Icons (MIT). Fonts: Fraunces, Manrope, JetBrains Mono (SIL OFL) via Google Fonts.
All lender names, people and figures are fictional sample data.

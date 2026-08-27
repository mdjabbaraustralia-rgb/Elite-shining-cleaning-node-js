# Elite Shining Cleaning — Node.js Edition

This is a Node.js/Express rebuild of the Elite Shining Cleaning website (originally built with Laravel/PHP). It reuses the exact same site content — services, gallery, testimonials, FAQs, pricing, settings (including the current logo, hero headline, and Laundry Service) — copied from the live SQLite database.

## Stack

- **Express** — web server & routing
- **EJS** — server-rendered templates (same HTML/Tailwind markup as the original Blade views)
- **better-sqlite3** — reads/writes the same SQLite database
- **sharp** — automatic image resize/compression on every upload (same behaviour as the PHP version's intervention/image pipeline)
- **multer** — file upload handling
- **pdfkit** — quotation PDF generation
- **bcryptjs** — admin password hashing/verification (compatible with the existing bcrypt hash already in the database)
- **express-session** + **connect-flash** — admin login sessions and one-time flash messages (success/error/old-input)

## Getting started

```bash
npm install
npm start
```

The site runs on **http://127.0.0.1:3000** by default (override with `PORT=xxxx npm start`).

## Project layout

```
src/
  server.js            Express app entry point
  lib/
    db.js              SQLite connection
    settings.js        Setting::get()/set() equivalent
    models.js          Query helpers for every table
    uploads.js         Image optimize + delete-old-upload helpers
    quotationPdf.js     PDF generation for quotations
  middleware/auth.js    requireGuest / requireAuth session guards
  routes/
    public.js          Public pages (home, services, pricing, gallery, blog, testimonials, faq, contact, legal, sitemap)
    booking.js          Public booking form submission
    admin.js             Whole admin panel (auth, dashboard, all CRUD, settings, quotations, bookings)
  views/                EJS templates (mirrors the original resources/views structure)
  public/               Static assets — compiled CSS, self-hosted Alpine.js, images, favicons, and storage/ (uploaded files)
data/
  app.sqlite            The actual site database (copied from the Laravel version — same content)
```

## Admin panel

Log in at **/admin/login** with the same credentials as the live PHP site (`Jabbar` / the password you set). The dashboard, quote requests, quotations (with PDF + discount), services, gallery, blog, testimonials, FAQs, pricing plans, and every site setting (logo, hero headline with per-word colour/underline, banner image, social links, footer content, etc.) all work exactly as before.

## Known differences from the PHP version

- **No CSRF token protection yet** on admin forms (the PHP version had Laravel's built-in CSRF middleware). Fine for local use; before exposing this publicly, CSRF protection should be added.
- **No email notifications** — same as the PHP version, new quote requests only show up in the admin panel, no email is sent automatically.
- Uses Node's built-in in-memory session store, so admin sessions reset if the server restarts (acceptable for a single small admin panel; swap in a persistent store if needed later).

## Verifying the templates compile

```bash
node scripts/check-ejs-syntax.js
```

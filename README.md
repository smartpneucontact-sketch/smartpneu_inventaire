# Smart Inventory

A simple web app to enter SKUs one after another. Duplicate SKUs are rejected,
and the full list can be exported to CSV. Built so multiple people can use it at
the same time against one shared inventory.

## Features

- Add SKUs one at a time (scan or type, press Enter)
- Rejects a SKU if it is already in the inventory (case-insensitive)
- Live list with item count and per-row delete
- Export everything to a CSV file
- Multi-user: everyone hits the same server and shares one inventory
- SQLite storage

## Tech

Node.js + Express + better-sqlite3, plain HTML/CSS/JS frontend. No build step.

## Run locally

```bash
npm install
npm start
# open http://localhost:3000
```

The database file is created at `./data/inventory.db`.

## Deploy on Railway (from GitHub)

1. Push this code to GitHub:

   ```bash
   git init
   git add .
   git commit -m "Smart Inventory"
   git branch -M main
   git remote add origin https://github.com/smartpneucontact-sketch/smartpneu_inventaire.git
   git push -u origin main
   ```

2. In Railway: **New Project → Deploy from GitHub repo** → pick
   `smartpneu_inventaire`. Railway auto-detects Node and runs `npm start`.

3. **Make storage persistent (important).** SQLite writes to a file, and Railway
   wipes the filesystem on every redeploy unless you attach a Volume:
   - In the service, go to **Variables → New Volume** (or **Settings → Volumes**).
   - Mount it at `/data`.
   - Add an environment variable: `DATA_DIR=/data`.

   Without this, the inventory resets each time you redeploy.

4. Under **Settings → Networking**, click **Generate Domain** to get a public URL.
   Share that URL — anyone with it can add SKUs to the same shared inventory.

## A note on "multiple users at the same time"

Everyone using the app talks to the same Railway service and the same SQLite
database, so they all see and edit one shared inventory. Writes are processed one
at a time and the SKU column has a uniqueness constraint, so if two people add the
same SKU simultaneously only the first succeeds and the second gets rejected.

This setup comfortably handles a small team. There is no login — anyone with the
URL can add or delete items.

## CSV format

```
sku,added_at
"ABC-123","2026-06-20T14:03:11.000Z"
```

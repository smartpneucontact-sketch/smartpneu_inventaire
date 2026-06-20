const express = require("express");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

// --- Storage setup ---------------------------------------------------------
// On Railway, attach a Volume and set DATA_DIR to its mount path (e.g. /data)
// so the SQLite file survives redeploys. Locally it defaults to ./data.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, "inventory.db"));

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    sku       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    added_at  TEXT NOT NULL
  );
`);

const insertStmt = db.prepare("INSERT INTO items (sku, added_at) VALUES (?, ?)");
const findStmt = db.prepare("SELECT id, sku, added_at FROM items WHERE sku = ? COLLATE NOCASE");
const listStmt = db.prepare("SELECT id, sku, added_at FROM items ORDER BY id DESC");
const deleteStmt = db.prepare("DELETE FROM items WHERE id = ?");
const countStmt = db.prepare("SELECT COUNT(*) AS n FROM items");

// --- App -------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Add a SKU. Rejects duplicates (409) and empty input (400).
app.post("/api/items", (req, res) => {
  const sku = (req.body && req.body.sku ? String(req.body.sku) : "").trim();
  if (!sku) {
    return res.status(400).json({ error: "SKU is required." });
  }
  const existing = findStmt.get(sku);
  if (existing) {
    return res.status(409).json({ error: `SKU "${sku}" already exists.`, item: existing });
  }
  const added_at = new Date().toISOString();
  try {
    const info = insertStmt.run(sku, added_at);
    res.status(201).json({ id: info.lastInsertRowid, sku, added_at });
  } catch (err) {
    // Backstop for the rare case two users add the same SKU at the same instant:
    // the UNIQUE constraint rejects the second one.
    if (err && err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: `SKU "${sku}" already exists.` });
    }
    throw err;
  }
});

// List all SKUs (newest first).
app.get("/api/items", (req, res) => {
  res.json({ count: countStmt.get().n, items: listStmt.all() });
});

// Delete one SKU by id.
app.delete("/api/items/:id", (req, res) => {
  const info = deleteStmt.run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: "Not found." });
  res.json({ ok: true });
});

// Export all SKUs as a CSV download.
app.get("/api/export.csv", (req, res) => {
  const rows = listStmt.all();
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ["sku,added_at"];
  for (const r of rows) lines.push(`${esc(r.sku)},${esc(r.added_at)}`);
  const csv = lines.join("\r\n");
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="inventory-${stamp}.csv"`);
  res.send(csv);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Smart Inventory running on port ${PORT}`));

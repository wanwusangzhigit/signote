-- Migration: initial schema
-- Notes table + settings table + ip bans table

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  password TEXT,                         -- sha256 hex (lowercase); NULL = no password
  expires_at INTEGER,                    -- unix seconds; NULL = never expire
  status TEXT NOT NULL DEFAULT 'active', -- active | expired
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip TEXT,
  views INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(status);
CREATE INDEX IF NOT EXISTS idx_notes_expires ON notes(expires_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ip_bans (
  ip TEXT PRIMARY KEY,
  reason TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER                     -- NULL = permanent ban
);

CREATE INDEX IF NOT EXISTS idx_ip_bans_expires ON ip_bans(expires_at);

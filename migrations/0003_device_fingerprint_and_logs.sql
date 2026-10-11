-- Migration: device fingerprint + audit log
-- creator_fp: the device fingerprint recorded when expiry is first set.
--   Used to authorize edits to non-expired notes that have an expiry time.
-- note_logs: audit trail of every note read/write operation.

ALTER TABLE notes ADD COLUMN creator_fp TEXT;

CREATE TABLE IF NOT EXISTS note_logs (
  id INTEGER PRIMARY KEY,
  note_id TEXT NOT NULL,
  action TEXT NOT NULL,          -- create | update | overwrite | put | content | raw | img | delete
  ip TEXT,
  ua TEXT,
  fingerprint TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_note_logs_note ON note_logs(note_id);
CREATE INDEX IF NOT EXISTS idx_note_logs_created ON note_logs(created_at);

-- Migration: default settings
-- max_chars: maximum allowed content length per note (in characters)

INSERT OR IGNORE INTO settings (key, value) VALUES ('max_chars', '100000');

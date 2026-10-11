-- Migration: add readonly column
-- When readonly = 1, the note cannot be edited by anyone until it expires.
-- Combined with the adjusted write-authorization rules:
--   - no password, not readonly → anyone may edit (open)
--   - has password               → only correct current_password may edit
--   - readonly = 1               → nobody may edit (frozen)
--   - expired                    → anyone may overwrite (resets to fresh note)
-- Password or readonly without an expiry auto-defaults to 30 days, guaranteeing
-- that a locked note eventually becomes editable again.

ALTER TABLE notes ADD COLUMN readonly INTEGER DEFAULT 0;

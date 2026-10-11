-- Migration: note metadata (title, filename, lang)
-- title:    display name shown in the page header and <title>
-- filename: filename used by GET /:id/dl for download
-- lang:     text language hint; when set, preview renders content as a
--           syntax-highlighted code block instead of markdown

ALTER TABLE notes ADD COLUMN title TEXT;
ALTER TABLE notes ADD COLUMN filename TEXT;
ALTER TABLE notes ADD COLUMN lang TEXT;

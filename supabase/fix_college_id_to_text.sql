-- Run this if you already ran master.sql with college_id as UUID.
-- The app sends college codes (e.g. 'vit-chn') not UUIDs, so signup was failing.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_college_id_fkey;
ALTER TABLE users ALTER COLUMN college_id TYPE TEXT USING NULL;

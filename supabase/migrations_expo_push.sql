-- Expo push: store token on users so Edge Function can send via Expo when user_notifications is inserted.
-- Run after migrations_notifications.sql (or after master if you have users).

ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

COMMENT ON COLUMN users.expo_push_token IS 'Expo push token from the mobile app; used by push Edge Function to send notifications.';

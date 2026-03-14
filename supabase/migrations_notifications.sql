-- User notifications (vendor/admin messages) and push subscriptions.
-- Run after master.sql. RLS: users read own; admin sends via service role.

-- Notifications: sent to user_id (null = broadcast to all), optional scheduled_at
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  sent_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_sent_at ON user_notifications(sent_at);

-- Push subscriptions for Web Push (admin can send push notifications)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_notifications_select_own" ON user_notifications;
DROP POLICY IF EXISTS "user_notifications_update_own" ON user_notifications;
-- Authenticated users see broadcast (user_id IS NULL) and their own notifications
CREATE POLICY "user_notifications_select_own" ON user_notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
CREATE POLICY "user_notifications_update_own" ON user_notifications FOR UPDATE TO authenticated
  USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));
CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT auth_id FROM users WHERE id = user_id));

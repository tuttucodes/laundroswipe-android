-- Fix: allow authenticated users to mark broadcast notifications (user_id IS NULL) as read.
-- Previously UPDATE was only allowed when user_id matched; broadcast rows could never be updated.

DROP POLICY IF EXISTS "user_notifications_update_own" ON user_notifications;
CREATE POLICY "user_notifications_update_own" ON user_notifications FOR UPDATE TO authenticated
  USING (user_id IS NULL OR user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

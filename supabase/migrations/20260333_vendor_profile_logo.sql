-- Add logo field to vendor profiles so admin can upload and user app can render.
ALTER TABLE public.vendor_profiles
ADD COLUMN IF NOT EXISTS logo_url TEXT;


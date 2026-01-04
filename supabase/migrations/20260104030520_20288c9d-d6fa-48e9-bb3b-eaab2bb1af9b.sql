-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "Service role can insert briefs" ON public.morning_briefs;

-- Service role inserts bypass RLS anyway, so we don't need an explicit policy for it
-- But we should allow users to insert their own briefs for manual generation
CREATE POLICY "Users can insert their own morning briefs"
ON public.morning_briefs
FOR INSERT
WITH CHECK (auth.uid() = user_id);
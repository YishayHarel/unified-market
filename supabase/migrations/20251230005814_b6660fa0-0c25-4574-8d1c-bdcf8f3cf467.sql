-- Update social_follows to allow seeing follow counts publicly (for leaderboard/profiles)
DROP POLICY IF EXISTS "Users can view follows they're involved in" ON public.social_follows;

-- Anyone can view follows (needed for follower counts on leaderboard)
CREATE POLICY "Anyone can view follows" 
  ON public.social_follows FOR SELECT 
  USING (true);

-- Enable realtime for follows
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_follows;
ALTER TABLE public.social_follows REPLICA IDENTITY FULL;
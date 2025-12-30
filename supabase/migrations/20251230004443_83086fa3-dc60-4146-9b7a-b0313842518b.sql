-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a new policy that allows anyone to view profiles (for display names in discussions/leaderboard)
-- This only exposes display_name and avatar_url which are meant to be public
CREATE POLICY "Anyone can view profiles" 
  ON public.profiles FOR SELECT 
  USING (true);
-- Fix: Restrict profiles table to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix: Restrict discussion_post_likes to authenticated users
DROP POLICY IF EXISTS "Anyone can view post likes" ON public.discussion_post_likes;
CREATE POLICY "Authenticated users can view post likes" 
ON public.discussion_post_likes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix: Restrict discussion_reply_likes to authenticated users
DROP POLICY IF EXISTS "Anyone can view reply likes" ON public.discussion_reply_likes;
CREATE POLICY "Authenticated users can view reply likes" 
ON public.discussion_reply_likes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix: Restrict social_follows to authenticated users
DROP POLICY IF EXISTS "Anyone can view follows" ON public.social_follows;
CREATE POLICY "Authenticated users can view follows" 
ON public.social_follows 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix: Restrict news_sentiment to authenticated users
DROP POLICY IF EXISTS "Anyone can view news sentiment" ON public.news_sentiment;
CREATE POLICY "Authenticated users can view news sentiment" 
ON public.news_sentiment 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Fix: Add DELETE policy for user_preferences
CREATE POLICY "Users can delete their own preferences" 
ON public.user_preferences 
FOR DELETE 
USING (auth.uid() = user_id);
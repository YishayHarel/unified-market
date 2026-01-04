-- Fix conflicting RLS policies that allow public access when authenticated-only was intended

-- 1. PROFILES table: Remove the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- 2. DISCUSSION_POST_LIKES table: Remove the overly permissive public policy
DROP POLICY IF EXISTS "Anyone can view likes" ON public.discussion_post_likes;

-- 3. DISCUSSION_REPLY_LIKES table: Remove public policy if exists (similar pattern)
DROP POLICY IF EXISTS "Anyone can view reply likes" ON public.discussion_reply_likes;

-- 4. DISCUSSION_POSTS table: Require authentication to view posts
DROP POLICY IF EXISTS "Anyone can view posts" ON public.discussion_posts;
CREATE POLICY "Authenticated users can view posts"
ON public.discussion_posts
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 5. DISCUSSION_REPLIES table: Require authentication to view replies
DROP POLICY IF EXISTS "Anyone can view replies" ON public.discussion_replies;
CREATE POLICY "Authenticated users can view replies"
ON public.discussion_replies
FOR SELECT
USING (auth.uid() IS NOT NULL);
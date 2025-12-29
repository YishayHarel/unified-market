-- Create discussion channels table
CREATE TABLE public.discussion_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT NOT NULL DEFAULT 'general', -- 'general', 'qa', 'sector', 'stock'
  symbol TEXT, -- For stock-specific channels
  sector TEXT, -- For sector-specific channels
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create discussion posts table
CREATE TABLE public.discussion_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.discussion_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  replies_count INTEGER NOT NULL DEFAULT 0,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create discussion replies table
CREATE TABLE public.discussion_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.discussion_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create post likes table to track who liked what
CREATE TABLE public.discussion_post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.discussion_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.discussion_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_post_likes ENABLE ROW LEVEL SECURITY;

-- Channels are publicly readable
CREATE POLICY "Anyone can view channels" ON public.discussion_channels
  FOR SELECT USING (true);

-- Posts are publicly readable, users can create/update/delete their own
CREATE POLICY "Anyone can view posts" ON public.discussion_posts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create posts" ON public.discussion_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON public.discussion_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON public.discussion_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Replies are publicly readable, users can create/update/delete their own
CREATE POLICY "Anyone can view replies" ON public.discussion_replies
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create replies" ON public.discussion_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies" ON public.discussion_replies
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies" ON public.discussion_replies
  FOR DELETE USING (auth.uid() = user_id);

-- Post likes: users can view all, create/delete their own
CREATE POLICY "Anyone can view likes" ON public.discussion_post_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can like posts" ON public.discussion_post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts" ON public.discussion_post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Insert default channels
INSERT INTO public.discussion_channels (name, description, channel_type) VALUES
  ('General', 'General market discussion and chat', 'general'),
  ('Questions & Answers', 'Ask questions and help others', 'qa'),
  ('Technology', 'Tech sector discussion', 'sector'),
  ('Healthcare', 'Healthcare sector discussion', 'sector'),
  ('Finance', 'Financial sector discussion', 'sector'),
  ('Energy', 'Energy sector discussion', 'sector'),
  ('Consumer', 'Consumer goods & retail discussion', 'sector');

-- Create trigger for updating timestamps
CREATE TRIGGER update_discussion_channels_updated_at
  BEFORE UPDATE ON public.discussion_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discussion_posts_updated_at
  BEFORE UPDATE ON public.discussion_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discussion_replies_updated_at
  BEFORE UPDATE ON public.discussion_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_discussion_posts_channel_id ON public.discussion_posts(channel_id);
CREATE INDEX idx_discussion_posts_user_id ON public.discussion_posts(user_id);
CREATE INDEX idx_discussion_replies_post_id ON public.discussion_replies(post_id);
CREATE INDEX idx_discussion_post_likes_post_id ON public.discussion_post_likes(post_id);
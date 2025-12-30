import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export const useDiscussionLikes = (postId?: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserLikes();
    }
  }, [user, postId]);

  const fetchUserLikes = async () => {
    if (!user) return;

    try {
      // Fetch post likes
      const { data: postLikes } = await supabase
        .from('discussion_post_likes')
        .select('post_id')
        .eq('user_id', user.id);

      setLikedPosts(new Set(postLikes?.map(l => l.post_id) || []));

      // Fetch reply likes if we're viewing a post
      if (postId) {
        const { data: replyLikes } = await (supabase
          .from('discussion_reply_likes') as any)
          .select('reply_id')
          .eq('user_id', user.id);

        setLikedReplies(new Set(replyLikes?.map((l: any) => l.reply_id) || []));
      }
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  };

  const togglePostLike = async (postId: string, currentLikes: number) => {
    if (!user) {
      toast({ title: "Please sign in to like posts", variant: "destructive" });
      return currentLikes;
    }

    setLoading(true);
    const isLiked = likedPosts.has(postId);

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('discussion_post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        await supabase
          .from('discussion_posts')
          .update({ likes_count: Math.max(0, currentLikes - 1) })
          .eq('id', postId);

        setLikedPosts(prev => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });

        return Math.max(0, currentLikes - 1);
      } else {
        // Like
        await supabase
          .from('discussion_post_likes')
          .insert({ post_id: postId, user_id: user.id });

        await supabase
          .from('discussion_posts')
          .update({ likes_count: currentLikes + 1 })
          .eq('id', postId);

        setLikedPosts(prev => new Set(prev).add(postId));

        return currentLikes + 1;
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({ title: "Failed to update like", variant: "destructive" });
      return currentLikes;
    } finally {
      setLoading(false);
    }
  };

  const toggleReplyLike = async (replyId: string, currentLikes: number) => {
    if (!user) {
      toast({ title: "Please sign in to like replies", variant: "destructive" });
      return currentLikes;
    }

    setLoading(true);
    const isLiked = likedReplies.has(replyId);

    try {
      if (isLiked) {
        // Unlike
        await (supabase
          .from('discussion_reply_likes') as any)
          .delete()
          .eq('reply_id', replyId)
          .eq('user_id', user.id);

        await supabase
          .from('discussion_replies')
          .update({ likes_count: Math.max(0, currentLikes - 1) })
          .eq('id', replyId);

        setLikedReplies(prev => {
          const next = new Set(prev);
          next.delete(replyId);
          return next;
        });

        return Math.max(0, currentLikes - 1);
      } else {
        // Like
        await (supabase
          .from('discussion_reply_likes') as any)
          .insert({ reply_id: replyId, user_id: user.id });

        await supabase
          .from('discussion_replies')
          .update({ likes_count: currentLikes + 1 })
          .eq('id', replyId);

        setLikedReplies(prev => new Set(prev).add(replyId));

        return currentLikes + 1;
      }
    } catch (error) {
      console.error('Error toggling reply like:', error);
      toast({ title: "Failed to update like", variant: "destructive" });
      return currentLikes;
    } finally {
      setLoading(false);
    }
  };

  return {
    likedPosts,
    likedReplies,
    togglePostLike,
    toggleReplyLike,
    loading
  };
};
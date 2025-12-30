import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseDiscussionRealtimeProps {
  channelId?: string;
  postId?: string;
  onPostsChange?: () => void;
  onRepliesChange?: () => void;
}

export const useDiscussionRealtime = ({
  channelId,
  postId,
  onPostsChange,
  onRepliesChange
}: UseDiscussionRealtimeProps) => {
  useEffect(() => {
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Subscribe to posts changes for the channel
    if (channelId && onPostsChange) {
      const postsChannel = supabase
        .channel(`posts-${channelId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'discussion_posts',
            filter: `channel_id=eq.${channelId}`
          },
          (payload) => {
            console.log('Posts change:', payload);
            onPostsChange();
          }
        )
        .subscribe();

      channels.push(postsChannel);
    }

    // Subscribe to replies changes for the post
    if (postId && onRepliesChange) {
      const repliesChannel = supabase
        .channel(`replies-${postId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'discussion_replies',
            filter: `post_id=eq.${postId}`
          },
          (payload) => {
            console.log('Replies change:', payload);
            onRepliesChange();
          }
        )
        .subscribe();

      channels.push(repliesChannel);
    }

    return () => {
      channels.forEach(channel => {
        supabase.removeChannel(channel);
      });
    };
  }, [channelId, postId, onPostsChange, onRepliesChange]);
};
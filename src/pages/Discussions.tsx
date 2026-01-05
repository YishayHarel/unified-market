import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDiscussionLikes } from "@/hooks/useDiscussionLikes";
import { useDiscussionRealtime } from "@/hooks/useDiscussionRealtime";
import { sanitizeText, titleSchema, contentSchema } from "@/lib/security";
import { 
  MessageSquare, 
  Hash, 
  HelpCircle, 
  Briefcase, 
  Plus,
  Heart,
  MessageCircle,
  Send,
  ArrowLeft,
  Clock,
  User,
  TrendingUp
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  description: string;
  channel_type: string;
  symbol: string | null;
  sector: string | null;
}

interface Post {
  id: string;
  channel_id: string;
  user_id: string;
  title: string;
  content: string;
  likes_count: number;
  replies_count: number;
  is_pinned: boolean;
  created_at: string;
  author_name?: string;
}

interface Reply {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  likes_count: number;
  created_at: string;
  author_name?: string;
}

const Discussions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });
  const [newReply, setNewReply] = useState('');
  const [loading, setLoading] = useState(true);

  // Likes hook
  const { likedPosts, likedReplies, togglePostLike, toggleReplyLike } = useDiscussionLikes(selectedPost?.id);

  // Group channels by type
  const generalChannels = channels.filter(c => c.channel_type === 'general' || c.channel_type === 'qa');
  const sectorChannels = channels.filter(c => c.channel_type === 'sector');
  const stockChannels = channels.filter(c => c.channel_type === 'stock');

  const fetchPosts = useCallback(async (channelId: string) => {
    try {
      const { data, error } = await supabase
        .from('discussion_posts')
        .select('*')
        .eq('channel_id', channelId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((data || []).map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      
      const postsWithAuthors = (data || []).map(post => ({
        ...post,
        author_name: profileMap.get(post.user_id) || 'Anonymous'
      }));

      setPosts(postsWithAuthors);
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  }, []);

  const fetchReplies = useCallback(async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('discussion_replies')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const userIds = [...new Set((data || []).map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      
      const repliesWithAuthors = (data || []).map(reply => ({
        ...reply,
        author_name: profileMap.get(reply.user_id) || 'Anonymous'
      }));

      setReplies(repliesWithAuthors);
    } catch (error) {
      console.error('Error fetching replies:', error);
    }
  }, []);

  // Realtime subscriptions
  useDiscussionRealtime({
    channelId: selectedChannel?.id,
    postId: selectedPost?.id,
    onPostsChange: () => selectedChannel && fetchPosts(selectedChannel.id),
    onRepliesChange: () => selectedPost && fetchReplies(selectedPost.id)
  });

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    const channelId = searchParams.get('channel');
    if (channelId && channels.length > 0) {
      const channel = channels.find(c => c.id === channelId);
      if (channel) {
        setSelectedChannel(channel);
      }
    }
  }, [searchParams, channels]);

  useEffect(() => {
    if (selectedChannel) {
      fetchPosts(selectedChannel.id);
    }
  }, [selectedChannel, fetchPosts]);

  useEffect(() => {
    if (selectedPost) {
      fetchReplies(selectedPost.id);
    }
  }, [selectedPost, fetchReplies]);

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('discussion_channels')
        .select('*')
        .order('channel_type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setChannels(data || []);
      
      const channelId = searchParams.get('channel');
      if (!channelId && data && data.length > 0) {
        setSelectedChannel(data[0]);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!user || !selectedChannel) {
      toast({ title: "Please sign in to post", variant: "destructive" });
      return;
    }

    // Validate and sanitize input
    const titleResult = titleSchema.safeParse(newPost.title);
    const contentResult = contentSchema.safeParse(newPost.content);

    if (!titleResult.success) {
      toast({ title: "Invalid title", description: titleResult.error.errors[0]?.message, variant: "destructive" });
      return;
    }

    if (!contentResult.success) {
      toast({ title: "Invalid content", description: contentResult.error.errors[0]?.message, variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('discussion_posts')
        .insert({
          channel_id: selectedChannel.id,
          user_id: user.id,
          title: titleResult.data,
          content: contentResult.data
        });

      if (error) throw error;

      toast({ title: "Post created!" });
      setNewPost({ title: '', content: '' });
      setShowNewPost(false);
    } catch (error) {
      console.error('Error creating post:', error);
      toast({ title: "Failed to create post", variant: "destructive" });
    }
  };

  const createReply = async () => {
    if (!user || !selectedPost) {
      toast({ title: "Please sign in to reply", variant: "destructive" });
      return;
    }

    // Validate and sanitize reply content
    const contentResult = contentSchema.safeParse(newReply);
    if (!contentResult.success) {
      toast({ title: "Invalid reply", description: contentResult.error.errors[0]?.message, variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('discussion_replies')
        .insert({
          post_id: selectedPost.id,
          user_id: user.id,
          content: contentResult.data
        });

      if (error) throw error;

      await supabase
        .from('discussion_posts')
        .update({ replies_count: selectedPost.replies_count + 1 })
        .eq('id', selectedPost.id);

      setNewReply('');
      setSelectedPost({ ...selectedPost, replies_count: selectedPost.replies_count + 1 });
    } catch (error) {
      console.error('Error creating reply:', error);
      toast({ title: "Failed to post reply", variant: "destructive" });
    }
  };

  const handleLikePost = async (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    const newCount = await togglePostLike(post.id, post.likes_count);
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes_count: newCount } : p));
    if (selectedPost?.id === post.id) {
      setSelectedPost({ ...selectedPost, likes_count: newCount });
    }
  };

  const handleLikeReply = async (reply: Reply) => {
    const newCount = await toggleReplyLike(reply.id, reply.likes_count);
    setReplies(prev => prev.map(r => r.id === reply.id ? { ...r, likes_count: newCount } : r));
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'general': return <Hash className="h-4 w-4" />;
      case 'qa': return <HelpCircle className="h-4 w-4" />;
      case 'sector': return <Briefcase className="h-4 w-4" />;
      case 'stock': return <TrendingUp className="h-4 w-4" />;
      default: return <Hash className="h-4 w-4" />;
    }
  };

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setSearchParams({ channel: channel.id });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Post detail view
  if (selectedPost) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="max-w-3xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => setSelectedPost(null)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {selectedChannel?.name}
          </Button>

          <Card className="mb-4">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedPost.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{selectedPost.author_name}</span>
                    <span>•</span>
                    <Clock className="h-4 w-4" />
                    <span>{formatTimeAgo(selectedPost.created_at)}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{selectedPost.content}</p>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={(e) => handleLikePost(e, selectedPost)}
                  className={likedPosts.has(selectedPost.id) ? "text-red-500" : ""}
                >
                  <Heart className={`h-4 w-4 mr-2 ${likedPosts.has(selectedPost.id) ? "fill-current" : ""}`} />
                  {selectedPost.likes_count}
                </Button>
                <span className="text-sm text-muted-foreground">
                  <MessageCircle className="h-4 w-4 inline mr-1" />
                  {selectedPost.replies_count} replies
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardContent className="pt-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder={user ? "Write a reply..." : "Sign in to reply"}
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  disabled={!user}
                  rows={2}
                />
                <Button onClick={createReply} disabled={!user || !newReply.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {replies.map((reply) => (
              <Card key={reply.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span className="font-medium text-foreground">{reply.author_name}</span>
                    <span>•</span>
                    <span>{formatTimeAgo(reply.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{reply.content}</p>
                  <div className="mt-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleLikeReply(reply)}
                      className={likedReplies.has(reply.id) ? "text-red-500" : ""}
                    >
                      <Heart className={`h-4 w-4 mr-1 ${likedReplies.has(reply.id) ? "fill-current" : ""}`} />
                      {reply.likes_count}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {replies.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No replies yet. Be the first to respond!
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="flex h-[calc(100vh-6rem)]">
        {/* Channels Sidebar */}
        <div className="w-64 border-r bg-muted/30 p-4 hidden md:block">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Channels
          </h2>
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="space-y-4">
              {/* General Channels */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">General</p>
                <div className="space-y-1">
                  {generalChannels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => handleSelectChannel(channel)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        selectedChannel?.id === channel.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {getChannelIcon(channel.channel_type)}
                      <span className="truncate">{channel.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sector Channels */}
              {sectorChannels.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Sectors</p>
                  <div className="space-y-1">
                    {sectorChannels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => handleSelectChannel(channel)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                          selectedChannel?.id === channel.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {getChannelIcon(channel.channel_type)}
                        <span className="truncate">{channel.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stock Channels */}
              {stockChannels.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Stocks</p>
                  <div className="space-y-1">
                    {stockChannels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => handleSelectChannel(channel)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                          selectedChannel?.id === channel.id
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {getChannelIcon(channel.channel_type)}
                        <span className="truncate font-mono">${channel.symbol}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 overflow-auto">
          {/* Mobile channel selector */}
          <div className="md:hidden mb-4">
            <select
              value={selectedChannel?.id || ''}
              onChange={(e) => {
                const channel = channels.find(c => c.id === e.target.value);
                if (channel) setSelectedChannel(channel);
              }}
              className="w-full p-2 rounded-lg border bg-background"
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </div>

          {selectedChannel && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    {getChannelIcon(selectedChannel.channel_type)}
                    {selectedChannel.name}
                  </h1>
                  <p className="text-muted-foreground">{selectedChannel.description}</p>
                </div>
                <Button onClick={() => setShowNewPost(!showNewPost)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Post
                </Button>
              </div>

              {showNewPost && (
                <Card className="mb-4">
                  <CardContent className="pt-4 space-y-4">
                    <Input
                      placeholder="Post title"
                      value={newPost.title}
                      onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    />
                    <Textarea
                      placeholder="What's on your mind?"
                      value={newPost.content}
                      onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                      rows={4}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewPost(false)}>
                        Cancel
                      </Button>
                      <Button onClick={createPost}>Post</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {posts.map((post) => (
                  <Card 
                    key={post.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedPost(post)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {post.is_pinned && <Badge variant="secondary">Pinned</Badge>}
                            <h3 className="font-semibold">{post.title}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {post.author_name}
                            </span>
                            <span>{formatTimeAgo(post.created_at)}</span>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3 w-3" />
                              {post.replies_count}
                            </span>
                            <button
                              onClick={(e) => handleLikePost(e, post)}
                              className={`flex items-center gap-1 hover:text-red-500 transition-colors ${likedPosts.has(post.id) ? "text-red-500" : ""}`}
                            >
                              <Heart className={`h-3 w-3 ${likedPosts.has(post.id) ? "fill-current" : ""}`} />
                              {post.likes_count}
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {posts.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No posts in this channel yet.</p>
                    <p className="text-sm">Be the first to start a discussion!</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Discussions;
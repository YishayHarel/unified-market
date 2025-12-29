import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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

  // Group channels by type
  const generalChannels = channels.filter(c => c.channel_type === 'general' || c.channel_type === 'qa');
  const sectorChannels = channels.filter(c => c.channel_type === 'sector');
  const stockChannels = channels.filter(c => c.channel_type === 'stock');

  useEffect(() => {
    fetchChannels();
  }, []);

  // Handle channel query param
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
  }, [selectedChannel]);

  useEffect(() => {
    if (selectedPost) {
      fetchReplies(selectedPost.id);
    }
  }, [selectedPost]);

  const fetchChannels = async () => {
    try {
      const { data, error } = await supabase
        .from('discussion_channels')
        .select('*')
        .order('channel_type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setChannels(data || []);
      
      // Only set default channel if no channel param
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

  const fetchPosts = async (channelId: string) => {
    try {
      const { data, error } = await supabase
        .from('discussion_posts')
        .select('*')
        .eq('channel_id', channelId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch author names
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
  };

  const fetchReplies = async (postId: string) => {
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
  };

  const createPost = async () => {
    if (!user || !selectedChannel) {
      toast({ title: "Please sign in to post", variant: "destructive" });
      return;
    }

    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast({ title: "Please fill in title and content", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('discussion_posts')
        .insert({
          channel_id: selectedChannel.id,
          user_id: user.id,
          title: newPost.title,
          content: newPost.content
        });

      if (error) throw error;

      toast({ title: "Post created!" });
      setNewPost({ title: '', content: '' });
      setShowNewPost(false);
      fetchPosts(selectedChannel.id);
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

    if (!newReply.trim()) return;

    try {
      const { error } = await supabase
        .from('discussion_replies')
        .insert({
          post_id: selectedPost.id,
          user_id: user.id,
          content: newReply
        });

      if (error) throw error;

      // Update replies count
      await supabase
        .from('discussion_posts')
        .update({ replies_count: selectedPost.replies_count + 1 })
        .eq('id', selectedPost.id);

      setNewReply('');
      fetchReplies(selectedPost.id);
      setSelectedPost({ ...selectedPost, replies_count: selectedPost.replies_count + 1 });
    } catch (error) {
      console.error('Error creating reply:', error);
      toast({ title: "Failed to post reply", variant: "destructive" });
    }
  };

  const getChannelIcon = (type: string, symbol?: string | null) => {
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
                <Button variant="ghost" size="sm">
                  <Heart className="h-4 w-4 mr-2" />
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
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {post.likes_count}
                            </span>
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

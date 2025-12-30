import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { MessageCircle, ChevronDown, ChevronUp, User } from "lucide-react";

interface NewsSentimentProps {
  newsUrl: string;
  newsTitle: string;
}

interface SentimentData {
  bullCount: number;
  bearCount: number;
  userSentiment: 'bull' | 'bear' | null;
  comments: {
    id: string;
    sentiment: 'bull' | 'bear';
    comment: string;
    created_at: string;
  }[];
}

const NewsSentiment = ({ newsUrl, newsTitle }: NewsSentimentProps) => {
  const { user } = useAuth();
  const [sentimentData, setSentimentData] = useState<SentimentData>({
    bullCount: 0,
    bearCount: 0,
    userSentiment: null,
    comments: []
  });
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSentiment();
  }, [newsUrl, user]);

  const fetchSentiment = async () => {
    try {
      const { data, error } = await supabase
        .from('news_sentiment')
        .select('id, sentiment, comment, created_at, user_id')
        .eq('news_url', newsUrl);

      if (error) throw error;

      const bullCount = data?.filter(s => s.sentiment === 'bull').length || 0;
      const bearCount = data?.filter(s => s.sentiment === 'bear').length || 0;
      const userVote = data?.find(s => s.user_id === user?.id);
      const comments = data?.filter(s => s.comment) || [];

      setSentimentData({
        bullCount,
        bearCount,
        userSentiment: userVote?.sentiment as 'bull' | 'bear' | null,
        comments: comments.map(c => ({
          id: c.id,
          sentiment: c.sentiment as 'bull' | 'bear',
          comment: c.comment!,
          created_at: c.created_at
        }))
      });
    } catch (error) {
      console.error('Error fetching sentiment:', error);
    }
  };

  const handleVote = async (sentiment: 'bull' | 'bear') => {
    if (!user) {
      toast.error('Sign in to vote');
      return;
    }

    setLoading(true);
    try {
      if (sentimentData.userSentiment === sentiment) {
        // Remove vote
        await supabase
          .from('news_sentiment')
          .delete()
          .eq('news_url', newsUrl)
          .eq('user_id', user.id);
      } else if (sentimentData.userSentiment) {
        // Update vote
        await supabase
          .from('news_sentiment')
          .update({ sentiment })
          .eq('news_url', newsUrl)
          .eq('user_id', user.id);
      } else {
        // New vote
        await supabase
          .from('news_sentiment')
          .insert({
            news_url: newsUrl,
            news_title: newsTitle,
            user_id: user.id,
            sentiment
          });
      }
      
      await fetchSentiment();
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to vote');
    } finally {
      setLoading(false);
    }
  };

  const handleComment = async () => {
    if (!user) {
      toast.error('Sign in to comment');
      return;
    }
    if (!newComment.trim()) return;
    if (!sentimentData.userSentiment) {
      toast.error('Please vote bull or bear first');
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from('news_sentiment')
        .update({ comment: newComment.trim() })
        .eq('news_url', newsUrl)
        .eq('user_id', user.id);

      setNewComment('');
      await fetchSentiment();
      toast.success('Comment added!');
    } catch (error) {
      console.error('Error commenting:', error);
      toast.error('Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = sentimentData.bullCount + sentimentData.bearCount;
  const bullPercent = totalVotes > 0 ? Math.round((sentimentData.bullCount / totalVotes) * 100) : 50;
  const bearPercent = totalVotes > 0 ? 100 - bullPercent : 50;

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

  return (
    <div className="mt-3 pt-3 border-t border-border">
      {/* Voting Section */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => handleVote('bull')}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            sentimentData.userSentiment === 'bull'
              ? 'bg-green-500/20 text-green-500 ring-2 ring-green-500/50'
              : 'bg-muted hover:bg-green-500/10 hover:text-green-500'
          }`}
        >
          <span className="text-lg">🐂</span>
          <span>Bull</span>
        </button>

        <button
          onClick={() => handleVote('bear')}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            sentimentData.userSentiment === 'bear'
              ? 'bg-red-500/20 text-red-500 ring-2 ring-red-500/50'
              : 'bg-muted hover:bg-red-500/10 hover:text-red-500'
          }`}
        >
          <span className="text-lg">🐻</span>
          <span>Bear</span>
        </button>

        {totalVotes > 0 && (
          <div className="flex-1 ml-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <span className="text-green-500 font-medium">{bullPercent}%</span>
              <span>vs</span>
              <span className="text-red-500 font-medium">{bearPercent}%</span>
              <span className="ml-auto">{totalVotes} votes</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden flex">
              <div 
                className="bg-green-500 transition-all" 
                style={{ width: `${bullPercent}%` }}
              />
              <div 
                className="bg-red-500 transition-all" 
                style={{ width: `${bearPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Comments Toggle */}
      {(sentimentData.comments.length > 0 || sentimentData.userSentiment) && (
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-3 w-3" />
          <span>{sentimentData.comments.length} comments</span>
          {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      )}

      {/* Comments Section */}
      {showComments && (
        <div className="mt-3 space-y-3">
          {/* Add Comment (only if user has voted) */}
          {sentimentData.userSentiment && !sentimentData.comments.find(c => c.id === sentimentData.userSentiment) && (
            <div className="flex gap-2">
              <Textarea
                placeholder="Share your thoughts..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="text-sm min-h-[60px]"
                maxLength={500}
              />
              <Button 
                size="sm" 
                onClick={handleComment}
                disabled={loading || !newComment.trim()}
              >
                Post
              </Button>
            </div>
          )}

          {/* Comments List */}
          {sentimentData.comments.map((comment) => (
            <div key={comment.id} className="p-2 rounded-lg bg-muted/50 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${
                    comment.sentiment === 'bull' 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-red-500/20 text-red-500'
                  }`}
                >
                  {comment.sentiment === 'bull' ? '🐂 Bull' : '🐻 Bear'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(comment.created_at)}
                </span>
              </div>
              <p className="text-foreground">{comment.comment}</p>
            </div>
          ))}

          {sentimentData.comments.length === 0 && !sentimentData.userSentiment && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Vote to share your thoughts!
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default NewsSentiment;
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Plus, 
  Heart, 
  MessageCircle, 
  Share2, 
  TrendingUp, 
  TrendingDown, 
  Eye,
  UserPlus,
  UserMinus
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface SocialPick {
  id: string;
  user_id: string;
  symbol: string;
  pick_type: string;
  reasoning: string;
  target_price?: number;
  confidence_level: number;
  likes_count: number;
  created_at: string;
  profiles?: {
    display_name: string;
  } | null;
}

interface UserProfile {
  user_id: string;
  display_name: string;
  isFollowing?: boolean;
}

const SocialFeatures = () => {
  const [picks, setPicks] = useState<SocialPick[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [showCreatePick, setShowCreatePick] = useState(false);
  const [newPick, setNewPick] = useState({
    symbol: '',
    pick_type: 'buy',
    reasoning: '',
    target_price: '',
    confidence_level: 3
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchSocialPicks();
      fetchFollowing();
    }
  }, [user]);

  const fetchSocialPicks = async () => {
    try {
      const { data, error } = await (supabase
        .from('social_picks') as any)
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setPicks(data || []);
    } catch (error) {
      console.error('Error fetching social picks:', error);
    }
  };

  const fetchFollowing = async () => {
    try {
      const { data, error } = await (supabase
        .from('social_follows') as any)
        .select('following_id')
        .eq('follower_id', user?.id);

      if (error) throw error;
      setFollowing(data?.map((f: any) => f.following_id) || []);
    } catch (error) {
      console.error('Error fetching following:', error);
    }
  };

  const createPick = async () => {
    if (!newPick.symbol || !newPick.reasoning) {
      toast({
        title: "Error",
        description: "Please fill in symbol and reasoning",
        variant: "destructive",
      });
      return;
    }

    try {
      const pickData = {
        user_id: user?.id,
        symbol: newPick.symbol.toUpperCase(),
        pick_type: newPick.pick_type,
        reasoning: newPick.reasoning,
        target_price: newPick.target_price ? parseFloat(newPick.target_price) : null,
        confidence_level: newPick.confidence_level,
      };

      const { error } = await (supabase
        .from('social_picks') as any)
        .insert([pickData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Your pick has been shared!",
      });

      setNewPick({
        symbol: '',
        pick_type: 'buy',
        reasoning: '',
        target_price: '',
        confidence_level: 3
      });
      setShowCreatePick(false);
      fetchSocialPicks();
    } catch (error) {
      console.error('Error creating pick:', error);
      toast({
        title: "Error",
        description: "Failed to share pick",
        variant: "destructive",
      });
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('profiles') as any)
        .select('user_id, display_name')
        .ilike('display_name', `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;

      const usersWithFollowStatus = (data || []).map((u: any) => ({
        ...u,
        isFollowing: following.includes(u.user_id)
      }));

      setSearchResults(usersWithFollowStatus);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: "Error",
        description: "Failed to search users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (userId: string, isCurrentlyFollowing: boolean) => {
    try {
      if (isCurrentlyFollowing) {
        const { error } = await (supabase
          .from('social_follows') as any)
          .delete()
          .eq('follower_id', user?.id)
          .eq('following_id', userId);

        if (error) throw error;
        setFollowing(prev => prev.filter(id => id !== userId));
      } else {
        const { error } = await (supabase
          .from('social_follows') as any)
          .insert([{
            follower_id: user?.id,
            following_id: userId
          }]);

        if (error) throw error;
        setFollowing(prev => [...prev, userId]);
      }

      // Update search results
      setSearchResults(prev => 
        prev.map(user => 
          user.user_id === userId 
            ? { ...user, isFollowing: !isCurrentlyFollowing }
            : user
        )
      );

      toast({
        title: "Success",
        description: isCurrentlyFollowing ? "Unfollowed user" : "Following user",
      });
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    }
  };

  const getPickTypeIcon = (pickType: string) => {
    switch (pickType) {
      case 'buy':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'sell':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'hold':
        return <Eye className="h-4 w-4 text-blue-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPickTypeBadge = (pickType: string) => {
    switch (pickType) {
      case 'buy':
        return 'default';
      case 'sell':
        return 'destructive';
      case 'hold':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getConfidenceStars = (level: number) => {
    return '★'.repeat(level) + '☆'.repeat(5 - level);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Please sign in to access social features.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Social Trading Community
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Search & Follow */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Find Traders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search users by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
                />
                <Button onClick={searchUsers} disabled={loading}>
                  Search
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <Card key={user.user_id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">{user.display_name}</div>
                          </div>
                          <Button
                            variant={user.isFollowing ? "outline" : "default"}
                            size="sm"
                            onClick={() => toggleFollow(user.user_id, user.isFollowing || false)}
                          >
                            {user.isFollowing ? (
                              <>
                                <UserMinus className="h-4 w-4 mr-2" />
                                Unfollow
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-4 w-4 mr-2" />
                                Follow
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Pick */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Share Your Pick</CardTitle>
              <Button
                onClick={() => setShowCreatePick(!showCreatePick)}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Share Pick
              </Button>
            </CardHeader>
            {showCreatePick && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pick-symbol">Stock Symbol</Label>
                    <Input
                      id="pick-symbol"
                      placeholder="AAPL"
                      value={newPick.symbol}
                      onChange={(e) => setNewPick({ ...newPick, symbol: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pick-type">Pick Type</Label>
                    <Select
                      value={newPick.pick_type}
                      onValueChange={(value) => setNewPick({ ...newPick, pick_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
                        <SelectItem value="hold">Hold</SelectItem>
                        <SelectItem value="watch">Watch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="target-price">Target Price (Optional)</Label>
                    <Input
                      id="target-price"
                      type="number"
                      step="0.01"
                      placeholder="150.00"
                      value={newPick.target_price}
                      onChange={(e) => setNewPick({ ...newPick, target_price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="confidence">Confidence Level</Label>
                    <Select
                      value={newPick.confidence_level.toString()}
                      onValueChange={(value) => setNewPick({ ...newPick, confidence_level: parseInt(value) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Star - Low</SelectItem>
                        <SelectItem value="2">2 Stars</SelectItem>
                        <SelectItem value="3">3 Stars - Medium</SelectItem>
                        <SelectItem value="4">4 Stars</SelectItem>
                        <SelectItem value="5">5 Stars - High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="reasoning">Your Reasoning</Label>
                  <Textarea
                    id="reasoning"
                    placeholder="Why are you making this pick? Share your analysis..."
                    value={newPick.reasoning}
                    onChange={(e) => setNewPick({ ...newPick, reasoning: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreatePick(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createPick}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Pick
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Social Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Community Picks</CardTitle>
            </CardHeader>
            <CardContent>
              {picks.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No community picks yet.</p>
                  <p className="text-sm text-muted-foreground">Be the first to share your stock pick!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {picks.map((pick) => (
                    <Card key={pick.id} className="border-l-4 border-l-primary">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                {getPickTypeIcon(pick.pick_type)}
                                <Badge variant={getPickTypeBadge(pick.pick_type)}>
                                  {pick.pick_type.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="font-semibold text-lg">{pick.symbol}</div>
                              {pick.target_price && (
                                <div className="text-sm text-muted-foreground">
                                  Target: ${pick.target_price}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {pick.profiles?.display_name || 'Anonymous'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(pick.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          {/* Confidence & Reasoning */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Confidence:</span>
                              <span className="text-sm">
                                {getConfidenceStars(pick.confidence_level)}
                              </span>
                            </div>
                            <div className="text-sm">
                              <span className="font-medium">Analysis: </span>
                              {pick.reasoning}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-4 pt-2 border-t">
                            <Button variant="ghost" size="sm">
                              <Heart className="h-4 w-4 mr-2" />
                              {pick.likes_count}
                            </Button>
                            <Button variant="ghost" size="sm">
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Comment
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default SocialFeatures;
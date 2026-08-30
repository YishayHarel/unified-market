import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { UserCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MIN_LENGTH = 2;
const MAX_LENGTH = 32;

/**
 * Lets someone choose the name shown against their posts.
 *
 * Accounts are created with a neutral "Investor ABCD" label, and until now
 * there was no way to change it — the forum would have filled up with
 * indistinguishable users.
 */
const DisplayNameSettings = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [initial, setInitial] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!user) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      if (error) console.warn("Could not load display name:", error.message);

      const name = data?.display_name ?? "";
      setDisplayName(name);
      setInitial(name);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [user]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const trimmed = displayName.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      toast.error(`Pick a name between ${MIN_LENGTH} and ${MAX_LENGTH} characters.`);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast.error("Could not save that name. Please try again.");
      console.error("Display name update failed:", error.message);
      return;
    }

    setInitial(trimmed);
    toast.success("Display name updated");
  }

  const unchanged = displayName.trim() === initial.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="h-5 w-5" />
          Display name
        </CardTitle>
        <CardDescription>
          Shown next to your posts and on the leaderboard. Visible to everyone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="display-name">Name</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={MAX_LENGTH}
                placeholder="How you want to appear"
              />
              <p className="text-xs text-muted-foreground">
                {MIN_LENGTH}–{MAX_LENGTH} characters. Your email is never shown.
              </p>
            </div>
            <Button type="submit" disabled={saving || unchanged}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default DisplayNameSettings;

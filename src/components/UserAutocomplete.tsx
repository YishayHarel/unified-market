import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Loader2, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface UserResult {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface UserAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (user: UserResult) => void;
  placeholder?: string;
  className?: string;
  excludeUserIds?: string[];
}

const UserAutocomplete = ({
  value,
  onChange,
  onSelect,
  placeholder = "Search users...",
  className,
  excludeUserIds = [],
}: UserAutocompleteProps) => {
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search users function
  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);

    try {
      const { data: profiles, error } = await (supabase.from("profiles") as any)
        .select("user_id, display_name, avatar_url")
        .ilike("display_name", `%${query}%`)
        .limit(10);

      if (error) throw error;

      // Filter out excluded users
      const filteredResults = (profiles || []).filter(
        (user: UserResult) => !excludeUserIds.includes(user.user_id)
      );

      setResults(filteredResults);
      setIsOpen(filteredResults.length > 0);
      setHighlightedIndex(-1);
    } catch (error) {
      console.error("Error searching users:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [excludeUserIds]);

  // Debounce the search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(value);
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [value, searchUsers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && results[highlightedIndex]) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const handleSelect = (user: UserResult) => {
    onChange(user.display_name || "");
    onSelect(user);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-10 bg-card border border-border"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          <ul className="max-h-64 overflow-auto py-1">
            {results.map((user, index) => (
              <li
                key={user.user_id}
                className={cn(
                  "px-3 py-2 cursor-pointer flex items-center gap-3 transition-colors",
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50"
                )}
                onClick={() => handleSelect(user)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.display_name || "User"}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className="font-medium text-sm">
                  {user.display_name || "Anonymous User"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserAutocomplete;

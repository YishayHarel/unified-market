export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          call_count: number
          created_at: string
          id: string
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          call_count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          call_count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      discussion_channels: {
        Row: {
          channel_type: string
          created_at: string
          description: string | null
          id: string
          name: string
          sector: string | null
          symbol: string | null
          updated_at: string
        }
        Insert: {
          channel_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sector?: string | null
          symbol?: string | null
          updated_at?: string
        }
        Update: {
          channel_type?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sector?: string | null
          symbol?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      discussion_post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "discussion_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_posts: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          likes_count: number
          replies_count: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          likes_count?: number
          replies_count?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          likes_count?: number
          replies_count?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "discussion_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      discussion_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          likes_count: number
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "discussion_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      news_sentiment: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          news_title: string
          news_url: string
          sentiment: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          news_title: string
          news_url: string
          sentiment: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          news_title?: string
          news_url?: string
          sentiment?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          avg_cost: number
          company_name: string | null
          created_at: string
          current_price: number | null
          id: string
          sector: string | null
          shares: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number
          company_name?: string | null
          created_at?: string
          current_price?: number | null
          id?: string
          sector?: string | null
          shares?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number
          company_name?: string | null
          created_at?: string
          current_price?: number | null
          id?: string
          sector?: string | null
          shares?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      social_picks: {
        Row: {
          confidence_level: number | null
          created_at: string
          id: string
          is_public: boolean
          likes_count: number
          pick_type: string
          reasoning: string | null
          symbol: string
          target_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_level?: number | null
          created_at?: string
          id?: string
          is_public?: boolean
          likes_count?: number
          pick_type: string
          reasoning?: string | null
          symbol: string
          target_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_level?: number | null
          created_at?: string
          id?: string
          is_public?: boolean
          likes_count?: number
          pick_type?: string
          reasoning?: string | null
          symbol?: string
          target_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stocks: {
        Row: {
          avg_volume: number | null
          created_at: string
          exchange: string
          id: number
          is_top_100: boolean | null
          last_ranked_at: string | null
          last_return_1d: number | null
          market_cap: number | null
          name: string
          rank_score: number | null
          rel_volume: number | null
          symbol: string
          trending_score: number | null
          updated_at: string | null
        }
        Insert: {
          avg_volume?: number | null
          created_at?: string
          exchange: string
          id?: number
          is_top_100?: boolean | null
          last_ranked_at?: string | null
          last_return_1d?: number | null
          market_cap?: number | null
          name: string
          rank_score?: number | null
          rel_volume?: number | null
          symbol: string
          trending_score?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_volume?: number | null
          created_at?: string
          exchange?: string
          id?: number
          is_top_100?: boolean | null
          last_ranked_at?: string | null
          last_return_1d?: number | null
          market_cap?: number | null
          name?: string
          rank_score?: number | null
          rel_volume?: number | null
          symbol?: string
          trending_score?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_dividends: {
        Row: {
          company: string
          created_at: string
          dividend_per_share: number
          frequency: number
          id: string
          next_pay_date: string | null
          shares: number
          symbol: string
          updated_at: string
          user_id: string
          yield_percentage: number | null
        }
        Insert: {
          company: string
          created_at?: string
          dividend_per_share?: number
          frequency?: number
          id?: string
          next_pay_date?: string | null
          shares?: number
          symbol: string
          updated_at?: string
          user_id: string
          yield_percentage?: number | null
        }
        Update: {
          company?: string
          created_at?: string
          dividend_per_share?: number
          frequency?: number
          id?: string
          next_pay_date?: string | null
          shares?: number
          symbol?: string
          updated_at?: string
          user_id?: string
          yield_percentage?: number | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          investment_goals: string[] | null
          max_position_size: number | null
          preferred_sectors: string[] | null
          rebalance_threshold: number | null
          risk_tolerance: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          investment_goals?: string[] | null
          max_position_size?: number | null
          preferred_sectors?: string[] | null
          rebalance_threshold?: number | null
          risk_tolerance?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          investment_goals?: string[] | null
          max_position_size?: number | null
          preferred_sectors?: string[] | null
          rebalance_threshold?: number | null
          risk_tolerance?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_saved_stocks: {
        Row: {
          id: string
          name: string | null
          saved_at: string
          symbol: string
          user_id: string
        }
        Insert: {
          id?: string
          name?: string | null
          saved_at?: string
          symbol: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string | null
          saved_at?: string
          symbol?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist_alerts: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          is_active: boolean
          message: string | null
          symbol: string
          target_price: number | null
          triggered_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string | null
          symbol: string
          target_price?: number | null
          triggered_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string | null
          symbol?: string
          target_price?: number | null
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_ai_usage: {
        Args: { p_daily_limit?: number; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

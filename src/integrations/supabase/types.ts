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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      match_legs: {
        Row: {
          completed_at: string
          id: string
          leg_mode: Database["public"]["Enums"]["match_mode"]
          leg_number: number
          match_id: string
          winner_id: string | null
        }
        Insert: {
          completed_at?: string
          id?: string
          leg_mode: Database["public"]["Enums"]["match_mode"]
          leg_number: number
          match_id: string
          winner_id?: string | null
        }
        Update: {
          completed_at?: string
          id?: string
          leg_mode?: Database["public"]["Enums"]["match_mode"]
          leg_number?: number
          match_id?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_legs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          best_of: number
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          creator_id: string
          double_in: boolean
          finish_rule: Database["public"]["Enums"]["finish_rule"]
          id: string
          mode: Database["public"]["Enums"]["match_mode"]
          opponent_id: string | null
          rake_bps: number
          stake_cents: number
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          winner_id: string | null
        }
        Insert: {
          best_of: number
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          creator_id: string
          double_in?: boolean
          finish_rule?: Database["public"]["Enums"]["finish_rule"]
          id?: string
          mode: Database["public"]["Enums"]["match_mode"]
          opponent_id?: string | null
          rake_bps?: number
          stake_cents: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          winner_id?: string | null
        }
        Update: {
          best_of?: number
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          double_in?: boolean
          finish_rule?: Database["public"]["Enums"]["finish_rule"]
          id?: string
          mode?: Database["public"]["Enums"]["match_mode"]
          opponent_id?: string | null
          rake_bps?: number
          stake_cents?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          winner_id?: string | null
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
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      tournament_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_final: boolean
          loser_id: string | null
          next_loser_match_id: string | null
          next_loser_slot: number | null
          next_winner_match_id: string | null
          next_winner_slot: number | null
          player1_id: string | null
          player2_id: string | null
          round: number
          side: Database["public"]["Enums"]["bracket_side"]
          slot: number
          tournament_id: string
          winner_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_final?: boolean
          loser_id?: string | null
          next_loser_match_id?: string | null
          next_loser_slot?: number | null
          next_winner_match_id?: string | null
          next_winner_slot?: number | null
          player1_id?: string | null
          player2_id?: string | null
          round: number
          side: Database["public"]["Enums"]["bracket_side"]
          slot: number
          tournament_id: string
          winner_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_final?: boolean
          loser_id?: string | null
          next_loser_match_id?: string | null
          next_loser_slot?: number | null
          next_winner_match_id?: string | null
          next_winner_slot?: number | null
          player1_id?: string | null
          player2_id?: string | null
          round?: number
          side?: Database["public"]["Enums"]["bracket_side"]
          slot?: number
          tournament_id?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_participants: {
        Row: {
          id: string
          joined_at: string
          placement: number | null
          seed: number | null
          tournament_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          placement?: number | null
          seed?: number | null
          tournament_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          placement?: number | null
          seed?: number | null
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          best_of: number
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          creator_id: string
          double_in: boolean
          entry_cents: number
          finish_rule: Database["public"]["Enums"]["finish_rule"]
          id: string
          mode: Database["public"]["Enums"]["match_mode"]
          name: string
          rake_bps: number
          runner_up_id: string | null
          size: number
          started_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          third_id: string | null
          winner_id: string | null
        }
        Insert: {
          best_of: number
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          creator_id: string
          double_in?: boolean
          entry_cents: number
          finish_rule?: Database["public"]["Enums"]["finish_rule"]
          id?: string
          mode: Database["public"]["Enums"]["match_mode"]
          name: string
          rake_bps?: number
          runner_up_id?: string | null
          size: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          third_id?: string | null
          winner_id?: string | null
        }
        Update: {
          best_of?: number
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          double_in?: boolean
          entry_cents?: number
          finish_rule?: Database["public"]["Enums"]["finish_rule"]
          id?: string
          mode?: Database["public"]["Enums"]["match_mode"]
          name?: string
          rake_bps?: number
          runner_up_id?: string | null
          size?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          third_id?: string | null
          winner_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["txn_kind"]
          match_id: string | null
          note: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["txn_kind"]
          match_id?: string | null
          note?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["txn_kind"]
          match_id?: string | null
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_cents: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cents?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_view: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          games_played: number | null
          total_winnings_cents: number | null
          user_id: string | null
          username: string | null
          wins: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _build_bracket_4: {
        Args: { _seeds: string[]; _tid: string }
        Returns: undefined
      }
      _build_bracket_8: {
        Args: { _seeds: string[]; _tid: string }
        Returns: undefined
      }
      _build_bracket_se: {
        Args: { _seeds: string[]; _tid: string }
        Returns: undefined
      }
      _credit_wallet: {
        Args: {
          _amount_cents: number
          _kind: Database["public"]["Enums"]["txn_kind"]
          _match_id: string
          _note: string
          _user_id: string
        }
        Returns: undefined
      }
      _debit_wallet: {
        Args: {
          _amount_cents: number
          _kind: Database["public"]["Enums"]["txn_kind"]
          _match_id: string
          _note: string
          _user_id: string
        }
        Returns: undefined
      }
      _start_tournament: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      cancel_match: { Args: { _match_id: string }; Returns: undefined }
      cancel_tournament: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      create_match: {
        Args: {
          _best_of: number
          _double_in?: boolean
          _finish_rule?: Database["public"]["Enums"]["finish_rule"]
          _mode: Database["public"]["Enums"]["match_mode"]
          _stake_cents: number
        }
        Returns: string
      }
      create_tournament: {
        Args: {
          _best_of: number
          _double_in?: boolean
          _entry_cents: number
          _finish_rule?: Database["public"]["Enums"]["finish_rule"]
          _mode: Database["public"]["Enums"]["match_mode"]
          _name: string
          _size: number
        }
        Returns: string
      }
      dev_top_up: { Args: { _amount_cents: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_match: { Args: { _match_id: string }; Returns: undefined }
      join_tournament: { Args: { _tournament_id: string }; Returns: undefined }
      report_tournament_match: {
        Args: { _match_id: string; _winner_id: string }
        Returns: undefined
      }
      settle_match: {
        Args: { _match_id: string; _winner_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "owner"
      bracket_side: "winners" | "losers" | "grand_final"
      finish_rule: "straight" | "double" | "master" | "both"
      match_mode: "501" | "Cricket" | "Medley" | "Piddle"
      match_status: "open" | "live" | "completed" | "cancelled"
      tournament_status: "open" | "live" | "completed" | "cancelled"
      txn_kind:
        | "deposit"
        | "withdrawal"
        | "match_stake"
        | "match_payout"
        | "rake"
        | "refund"
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
    Enums: {
      app_role: ["owner"],
      bracket_side: ["winners", "losers", "grand_final"],
      finish_rule: ["straight", "double", "master", "both"],
      match_mode: ["501", "Cricket", "Medley", "Piddle"],
      match_status: ["open", "live", "completed", "cancelled"],
      tournament_status: ["open", "live", "completed", "cancelled"],
      txn_kind: [
        "deposit",
        "withdrawal",
        "match_stake",
        "match_payout",
        "rake",
        "refund",
      ],
    },
  },
} as const

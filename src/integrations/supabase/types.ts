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
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          amount_cents: number | null
          created_at: string
          id: string
          note: string | null
          target_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          amount_cents?: number | null
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          amount_cents?: number | null
          created_at?: string
          id?: string
          note?: string | null
          target_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      challenges: {
        Row: {
          challenged_id: string
          challenger_id: string
          created_at: string
          id: string
          match_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["challenge_status"]
        }
        Insert: {
          challenged_id: string
          challenger_id: string
          created_at?: string
          id?: string
          match_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
        }
        Update: {
          challenged_id?: string
          challenger_id?: string
          created_at?: string
          id?: string
          match_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["challenge_status"]
        }
        Relationships: [
          {
            foreignKeyName: "challenges_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_packs: {
        Row: {
          active: boolean
          coins_granted: number
          created_at: string
          display_order: number
          name: string
          price_id: string
          usd_cents: number
        }
        Insert: {
          active?: boolean
          coins_granted: number
          created_at?: string
          display_order?: number
          name: string
          price_id: string
          usd_cents: number
        }
        Update: {
          active?: boolean
          coins_granted?: number
          created_at?: string
          display_order?: number
          name?: string
          price_id?: string
          usd_cents?: number
        }
        Relationships: []
      }
      dart_throws: {
        Row: {
          busted: boolean
          created_at: string
          dart_number: number
          id: string
          leg_id: string
          match_id: string
          multiplier: number
          player_id: string
          points: number
          remaining_after: number | null
          segment: number
          turn_number: number
        }
        Insert: {
          busted?: boolean
          created_at?: string
          dart_number: number
          id?: string
          leg_id: string
          match_id: string
          multiplier: number
          player_id: string
          points?: number
          remaining_after?: number | null
          segment: number
          turn_number: number
        }
        Update: {
          busted?: boolean
          created_at?: string
          dart_number?: number
          id?: string
          leg_id?: string
          match_id?: string
          multiplier?: number
          player_id?: string
          points?: number
          remaining_after?: number | null
          segment?: number
          turn_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "dart_throws_leg_id_fkey"
            columns: ["leg_id"]
            isOneToOne: false
            referencedRelation: "match_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dart_throws_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      deposits: {
        Row: {
          amount_cents: number
          created_at: string
          credited_at: string | null
          environment: string
          id: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          credited_at?: string | null
          environment?: string
          id?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          credited_at?: string | null
          environment?: string
          id?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gift_card_options: {
        Row: {
          active: boolean
          brand: string
          coins_cost: number
          created_at: string
          denomination_usd_cents: number
          display_order: number
          id: string
        }
        Insert: {
          active?: boolean
          brand?: string
          coins_cost: number
          created_at?: string
          denomination_usd_cents: number
          display_order?: number
          id: string
        }
        Update: {
          active?: boolean
          brand?: string
          coins_cost?: number
          created_at?: string
          denomination_usd_cents?: number
          display_order?: number
          id?: string
        }
        Relationships: []
      }
      gift_card_redemptions: {
        Row: {
          brand: string
          coins_spent: number
          created_at: string
          delivery_email: string
          denomination_usd_cents: number
          failure_reason: string | null
          fulfilled_at: string | null
          id: string
          option_id: string
          recipient_name: string | null
          refunded_at: string | null
          status: string
          tremendous_order_id: string | null
          tremendous_reward_id: string | null
          user_id: string
        }
        Insert: {
          brand: string
          coins_spent: number
          created_at?: string
          delivery_email: string
          denomination_usd_cents: number
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          option_id: string
          recipient_name?: string | null
          refunded_at?: string | null
          status?: string
          tremendous_order_id?: string | null
          tremendous_reward_id?: string | null
          user_id: string
        }
        Update: {
          brand?: string
          coins_spent?: number
          created_at?: string
          delivery_email?: string
          denomination_usd_cents?: number
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          option_id?: string
          recipient_name?: string | null
          refunded_at?: string | null
          status?: string
          tremendous_order_id?: string | null
          tremendous_reward_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_redemptions_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "gift_card_options"
            referencedColumns: ["id"]
          },
        ]
      }
      match_legs: {
        Row: {
          completed_at: string | null
          creator_remaining: number | null
          id: string
          leg_mode: Database["public"]["Enums"]["match_mode"]
          leg_number: number
          match_id: string
          opponent_remaining: number | null
          started_at: string
          state: Json
          winner_id: string | null
        }
        Insert: {
          completed_at?: string | null
          creator_remaining?: number | null
          id?: string
          leg_mode: Database["public"]["Enums"]["match_mode"]
          leg_number: number
          match_id: string
          opponent_remaining?: number | null
          started_at?: string
          state?: Json
          winner_id?: string | null
        }
        Update: {
          completed_at?: string | null
          creator_remaining?: number | null
          id?: string
          leg_mode?: Database["public"]["Enums"]["match_mode"]
          leg_number?: number
          match_id?: string
          opponent_remaining?: number | null
          started_at?: string
          state?: Json
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
      match_results: {
        Row: {
          created_at: string
          id: string
          loser_id: string | null
          loser_legs: number
          match_id: string
          payout_cents: number
          rake_cents: number
          winner_id: string
          winner_legs: number
        }
        Insert: {
          created_at?: string
          id?: string
          loser_id?: string | null
          loser_legs?: number
          match_id: string
          payout_cents?: number
          rake_cents?: number
          winner_id: string
          winner_legs?: number
        }
        Update: {
          created_at?: string
          id?: string
          loser_id?: string | null
          loser_legs?: number
          match_id?: string
          payout_cents?: number
          rake_cents?: number
          winner_id?: string
          winner_legs?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
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
          creator_legs: number
          disputed: boolean
          double_in: boolean
          finish_rule: Database["public"]["Enums"]["finish_rule"]
          id: string
          invited_id: string | null
          mode: Database["public"]["Enums"]["match_mode"]
          opponent_id: string | null
          opponent_legs: number
          rake_bps: number
          report_deadline: string | null
          reported_at: string | null
          reported_by: string | null
          reported_winner_id: string | null
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
          creator_legs?: number
          disputed?: boolean
          double_in?: boolean
          finish_rule?: Database["public"]["Enums"]["finish_rule"]
          id?: string
          invited_id?: string | null
          mode: Database["public"]["Enums"]["match_mode"]
          opponent_id?: string | null
          opponent_legs?: number
          rake_bps?: number
          report_deadline?: string | null
          reported_at?: string | null
          reported_by?: string | null
          reported_winner_id?: string | null
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
          creator_legs?: number
          disputed?: boolean
          double_in?: boolean
          finish_rule?: Database["public"]["Enums"]["finish_rule"]
          id?: string
          invited_id?: string | null
          mode?: Database["public"]["Enums"]["match_mode"]
          opponent_id?: string | null
          opponent_legs?: number
          rake_bps?: number
          report_deadline?: string | null
          reported_at?: string | null
          reported_by?: string | null
          reported_winner_id?: string | null
          stake_cents?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          winner_id?: string | null
        }
        Relationships: []
      }
      player_bans: {
        Row: {
          banned_by: string
          created_at: string
          reason: string
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          reason: string
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          reason?: string
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
          losses: number
          rating: number
          updated_at: string
          username: string | null
          wins: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          losses?: number
          rating?: number
          updated_at?: string
          username?: string | null
          wins?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          losses?: number
          rating?: number
          updated_at?: string
          username?: string | null
          wins?: number
        }
        Relationships: []
      }
      tournament_matches: {
        Row: {
          completed_at: string | null
          created_at: string
          disputed: boolean
          id: string
          is_final: boolean
          loser_id: string | null
          next_loser_match_id: string | null
          next_loser_slot: number | null
          next_winner_match_id: string | null
          next_winner_slot: number | null
          player1_id: string | null
          player2_id: string | null
          report_deadline: string | null
          reported_at: string | null
          reported_by: string | null
          reported_winner_id: string | null
          round: number
          side: Database["public"]["Enums"]["bracket_side"]
          slot: number
          tournament_id: string
          winner_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          disputed?: boolean
          id?: string
          is_final?: boolean
          loser_id?: string | null
          next_loser_match_id?: string | null
          next_loser_slot?: number | null
          next_winner_match_id?: string | null
          next_winner_slot?: number | null
          player1_id?: string | null
          player2_id?: string | null
          report_deadline?: string | null
          reported_at?: string | null
          reported_by?: string | null
          reported_winner_id?: string | null
          round: number
          side: Database["public"]["Enums"]["bracket_side"]
          slot: number
          tournament_id: string
          winner_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          disputed?: boolean
          id?: string
          is_final?: boolean
          loser_id?: string | null
          next_loser_match_id?: string | null
          next_loser_slot?: number | null
          next_winner_match_id?: string | null
          next_winner_slot?: number | null
          player1_id?: string | null
          player2_id?: string | null
          report_deadline?: string | null
          reported_at?: string | null
          reported_by?: string | null
          reported_winner_id?: string | null
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
      coin_transactions: {
        Row: {
          amount_coins: number | null
          created_at: string | null
          id: string | null
          kind: Database["public"]["Enums"]["txn_kind"] | null
          match_id: string | null
          note: string | null
          user_id: string | null
        }
        Insert: {
          amount_coins?: number | null
          created_at?: string | null
          id?: string | null
          kind?: Database["public"]["Enums"]["txn_kind"] | null
          match_id?: string | null
          note?: string | null
          user_id?: string | null
        }
        Update: {
          amount_coins?: number | null
          created_at?: string | null
          id?: string | null
          kind?: Database["public"]["Enums"]["txn_kind"] | null
          match_id?: string | null
          note?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      leaderboard_view: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          losses: number | null
          matches_played: number | null
          rating: number | null
          total_winnings_cents: number | null
          user_id: string | null
          username: string | null
          win_pct: number | null
          wins: number | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          losses?: number | null
          matches_played?: never
          rating?: number | null
          total_winnings_cents?: never
          user_id?: string | null
          username?: string | null
          win_pct?: never
          wins?: number | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          losses?: number | null
          matches_played?: never
          rating?: number | null
          total_winnings_cents?: never
          user_id?: string | null
          username?: string | null
          win_pct?: never
          wins?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _advance_tournament_match: {
        Args: { _match_id: string; _winner_id: string }
        Returns: undefined
      }
      _assert_not_banned: { Args: { _user_id: string }; Returns: undefined }
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
      _log_admin: {
        Args: {
          _action: string
          _amount: number
          _note: string
          _target_id: string
          _target_user: string
        }
        Returns: undefined
      }
      _mark_redemption_fulfilled: {
        Args: { _order_id: string; _redemption_id: string; _reward_id: string }
        Returns: undefined
      }
      _refund_redemption: {
        Args: { _reason: string; _redemption_id: string }
        Returns: undefined
      }
      _require_staff: { Args: never; Returns: undefined }
      _settle_match: {
        Args: { _match_id: string; _winner_id: string }
        Returns: undefined
      }
      _start_tournament: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      admin_adjust_coins: {
        Args: { _amount_cents: number; _note: string; _user_id: string }
        Returns: undefined
      }
      admin_ban_player: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      admin_refund_redemption: {
        Args: { _reason: string; _redemption_id: string }
        Returns: undefined
      }
      admin_resolve_dispute: {
        Args: { _match_id: string; _note?: string; _winner_id: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: { _grant: boolean; _role: string; _user_id: string }
        Returns: undefined
      }
      admin_unban_player: { Args: { _user_id: string }; Returns: undefined }
      cancel_match: { Args: { _match_id: string }; Returns: undefined }
      cancel_tournament: {
        Args: { _tournament_id: string }
        Returns: undefined
      }
      complete_leg: {
        Args: { _leg_id: string; _winner_id: string }
        Returns: undefined
      }
      create_match: {
        Args: {
          _best_of: number
          _double_in?: boolean
          _finish_rule?: Database["public"]["Enums"]["finish_rule"]
          _mode: Database["public"]["Enums"]["match_mode"]
          _opponent_id?: string
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
      credit_wallet_from_deposit: {
        Args: {
          _coins_granted: number
          _environment: string
          _payment_intent: string
          _session_id: string
          _user_id: string
        }
        Returns: undefined
      }
      finalize_match_report: { Args: { _match_id: string }; Returns: undefined }
      finalize_tournament_match_report: {
        Args: { _match_id: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      join_match: { Args: { _match_id: string }; Returns: undefined }
      join_tournament: { Args: { _tournament_id: string }; Returns: undefined }
      record_dart: {
        Args: {
          _busted?: boolean
          _dart_number: number
          _leg_id: string
          _multiplier: number
          _remaining_after?: number
          _segment: number
          _state?: Json
          _turn_number: number
        }
        Returns: undefined
      }
      redeem_gift_card: {
        Args: {
          _delivery_email: string
          _option_id: string
          _recipient_name?: string
        }
        Returns: string
      }
      report_match_winner: {
        Args: { _match_id: string; _winner_id: string }
        Returns: string
      }
      report_tournament_match: {
        Args: { _match_id: string; _winner_id: string }
        Returns: undefined
      }
      report_tournament_winner: {
        Args: { _match_id: string; _winner_id: string }
        Returns: string
      }
      respond_challenge: {
        Args: { _accept: boolean; _challenge_id: string }
        Returns: undefined
      }
      settle_match: {
        Args: { _match_id: string; _winner_id: string }
        Returns: undefined
      }
      start_leg: {
        Args: {
          _leg_mode: Database["public"]["Enums"]["match_mode"]
          _match_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "admin"
      bracket_side: "winners" | "losers" | "grand_final"
      challenge_status: "pending" | "accepted" | "declined" | "cancelled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner", "admin"],
      bracket_side: ["winners", "losers", "grand_final"],
      challenge_status: ["pending", "accepted", "declined", "cancelled"],
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

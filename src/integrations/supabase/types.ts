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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          created_at: string
          id: string
          role: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          created_at: string
          error: string | null
          event_key: string
          event_type: string
          id: string
          provider_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_key: string
          event_type: string
          id?: string
          provider_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_key?: string
          event_type?: string
          id?: string
          provider_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          created_at: string
          file_type: string
          filename: string
          id: string
          size_bytes: number
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_type: string
          filename: string
          id?: string
          size_bytes: number
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_type?: string
          filename?: string
          id?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          send_email: boolean
          sync_request_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          send_email?: boolean
          sync_request_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          send_email?: boolean
          sync_request_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_id_fkey"
            columns: ["related_id"]
            isOneToOne: false
            referencedRelation: "simulation_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sync_request_id_fkey"
            columns: ["sync_request_id"]
            isOneToOne: false
            referencedRelation: "sync_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_policies: {
        Row: {
          auto_approve_limit: number | null
          auto_email: boolean
          auto_refund_limit: number
          created_at: string
          execution_date: string | null
          frequency: string
          id: string
          max_retries: number
          name: string
          requires_user_auth: boolean
          retry_delay_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_approve_limit?: number | null
          auto_email?: boolean
          auto_refund_limit?: number
          created_at?: string
          execution_date?: string | null
          frequency?: string
          id?: string
          max_retries?: number
          name: string
          requires_user_auth?: boolean
          retry_delay_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_approve_limit?: number | null
          auto_email?: boolean
          auto_refund_limit?: number
          created_at?: string
          execution_date?: string | null
          frequency?: string
          id?: string
          max_retries?: number
          name?: string
          requires_user_auth?: boolean
          retry_delay_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_policies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          paytm_number: string
          phone: string
          preferences: Json
          updated_at: string
          upi_id: string
        }
        Insert: {
          created_at?: string
          id: string
          name?: string
          paytm_number?: string
          phone?: string
          preferences?: Json
          updated_at?: string
          upi_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          paytm_number?: string
          phone?: string
          preferences?: Json
          updated_at?: string
          upi_id?: string
        }
        Relationships: []
      }
      simulation_transfers: {
        Row: {
          amount: number
          created_at: string
          id: string
          payer_id: string
          recipient_id: string
          requester_id: string
          status: string
          sync_request_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payer_id: string
          recipient_id: string
          requester_id: string
          status?: string
          sync_request_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payer_id?: string
          recipient_id?: string
          requester_id?: string
          status?: string
          sync_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_transfers_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_transfers_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_transfers_sync_request_id_fkey"
            columns: ["sync_request_id"]
            isOneToOne: false
            referencedRelation: "sync_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_wallets: {
        Row: {
          balance: number
          created_at: string
          discoverable: boolean
          email: string
          phone: string
          updated_at: string
          upi_id: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          discoverable?: boolean
          email?: string
          phone?: string
          updated_at?: string
          upi_id?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          discoverable?: boolean
          email?: string
          phone?: string
          updated_at?: string
          upi_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_requests: {
        Row: {
          amount: number | null
          amount_type: string
          approved_at: string | null
          counterparty: string
          counterparty_address: string
          counterparty_email: string
          created_at: string
          direction: string
          email_reminders: boolean
          email_updates: boolean
          id: string
          kind: string
          last_at: string | null
          max_cap: number | null
          name: string
          next_execution_at: string | null
          next_reminder_at: string | null
          policy_id: string
          reminder_cadence: string
          retry_attempts: number
          sender_email: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          amount_type: string
          approved_at?: string | null
          counterparty: string
          counterparty_address: string
          counterparty_email?: string
          created_at?: string
          direction: string
          email_reminders?: boolean
          email_updates?: boolean
          id?: string
          kind?: string
          last_at?: string | null
          max_cap?: number | null
          name: string
          next_execution_at?: string | null
          next_reminder_at?: string | null
          policy_id: string
          reminder_cadence?: string
          retry_attempts?: number
          sender_email?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          amount_type?: string
          approved_at?: string | null
          counterparty?: string
          counterparty_address?: string
          counterparty_email?: string
          created_at?: string
          direction?: string
          email_reminders?: boolean
          email_updates?: boolean
          id?: string
          kind?: string
          last_at?: string | null
          max_cap?: number | null
          name?: string
          next_execution_at?: string | null
          next_reminder_at?: string | null
          policy_id?: string
          reminder_cadence?: string
          retry_attempts?: number
          sender_email?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_requests_policy_id_user_id_fkey"
            columns: ["policy_id", "user_id"]
            isOneToOne: false
            referencedRelation: "payment_policies"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "sync_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teammate_audit: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          outcome: string
          summary: Json
          teammate_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          outcome: string
          summary?: Json
          teammate_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          outcome?: string
          summary?: Json
          teammate_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teammate_audit_teammate_id_fkey"
            columns: ["teammate_id"]
            isOneToOne: false
            referencedRelation: "teammates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teammate_audit_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teammate_builder_drafts: {
        Row: {
          created_at: string
          data: Json
          expires_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          expires_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teammate_builder_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teammate_owner_controls: {
        Row: {
          stopped: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          stopped?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          stopped?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teammate_owner_controls_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teammate_records: {
        Row: {
          created_at: string
          data: Json
          id: string
          kind: string
          teammate_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          kind: string
          teammate_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          teammate_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teammate_records_teammate_id_user_id_fkey"
            columns: ["teammate_id", "user_id"]
            isOneToOne: false
            referencedRelation: "teammates"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      teammates: {
        Row: {
          created_at: string
          evaluated_version: number | null
          evaluation: Json | null
          goal: string
          id: string
          kill_switch: boolean
          name: string
          retired_at: string | null
          role: string
          spec: Json
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          evaluated_version?: number | null
          evaluation?: Json | null
          goal: string
          id?: string
          kill_switch?: boolean
          name: string
          retired_at?: string | null
          role: string
          spec: Json
          status?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          evaluated_version?: number | null
          evaluation?: Json | null
          goal?: string
          id?: string
          kill_switch?: boolean
          name?: string
          retired_at?: string | null
          role?: string
          spec?: Json
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "teammates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_events: {
        Row: {
          created_at: string
          event: string
          id: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_events_transaction_id_user_id_fkey"
            columns: ["transaction_id", "user_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transaction_events_transaction_id_user_id_fkey"
            columns: ["transaction_id", "user_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "transaction_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          audit_trail: Json
          bank_error: string | null
          bank_ref: string
          created_at: string
          description: string
          direction: string
          from_email: string
          from_party: string
          from_upi: string
          id: string
          is_automated: boolean
          is_simulated: boolean
          order_id: string
          retry_count: number
          source_type: string
          status: string
          sync_request_id: string | null
          to_email: string
          to_party: string
          to_upi: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          audit_trail?: Json
          bank_error?: string | null
          bank_ref?: string
          created_at?: string
          description?: string
          direction: string
          from_email?: string
          from_party: string
          from_upi?: string
          id?: string
          is_automated?: boolean
          is_simulated?: boolean
          order_id: string
          retry_count?: number
          source_type: string
          status: string
          sync_request_id?: string | null
          to_email?: string
          to_party: string
          to_upi?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          audit_trail?: Json
          bank_error?: string | null
          bank_ref?: string
          created_at?: string
          description?: string
          direction?: string
          from_email?: string
          from_party?: string
          from_upi?: string
          id?: string
          is_automated?: boolean
          is_simulated?: boolean
          order_id?: string
          retry_count?: number
          source_type?: string
          status?: string
          sync_request_id?: string | null
          to_email?: string
          to_party?: string
          to_upi?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_sync_request_id_fkey"
            columns: ["sync_request_id"]
            isOneToOne: false
            referencedRelation: "sync_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ledger_transactions: {
        Row: {
          amount: number | null
          audit_trail: Json | null
          bank_error: string | null
          bank_ref: string | null
          created_at: string | null
          description: string | null
          direction: string | null
          from_email: string | null
          from_party: string | null
          from_upi: string | null
          id: string | null
          is_automated: boolean | null
          is_simulated: boolean | null
          order_id: string | null
          retry_count: number | null
          source_type: string | null
          status: string | null
          sync_request_id: string | null
          to_email: string | null
          to_party: string | null
          to_upi: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          audit_trail?: Json | null
          bank_error?: string | null
          bank_ref?: string | null
          created_at?: string | null
          description?: string | null
          direction?: string | null
          from_email?: string | null
          from_party?: string | null
          from_upi?: string | null
          id?: string | null
          is_automated?: boolean | null
          is_simulated?: boolean | null
          order_id?: string | null
          retry_count?: number | null
          source_type?: string | null
          status?: string | null
          sync_request_id?: string | null
          to_email?: string | null
          to_party?: string | null
          to_upi?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          audit_trail?: Json | null
          bank_error?: string | null
          bank_ref?: string | null
          created_at?: string | null
          description?: string | null
          direction?: string | null
          from_email?: string | null
          from_party?: string | null
          from_upi?: string | null
          id?: string | null
          is_automated?: boolean | null
          is_simulated?: boolean | null
          order_id?: string | null
          retry_count?: number | null
          source_type?: string | null
          status?: string | null
          sync_request_id?: string | null
          to_email?: string | null
          to_party?: string | null
          to_upi?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_sync_request_id_fkey"
            columns: ["sync_request_id"]
            isOneToOne: false
            referencedRelation: "sync_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cancel_simulation_transfer: { Args: { p_id: string }; Returns: undefined }
      complete_teammate_work: {
        Args: {
          p_action: string
          p_data: Json
          p_owner: string
          p_team: string
          p_version: number
        }
        Returns: undefined
      }
      configure_simulation_wallet: {
        Args: { p_discoverable: boolean; p_phone: string; p_upi: string }
        Returns: undefined
      }
      confirm_simulation_transfer: { Args: { p_id: string }; Returns: string }
      ensure_simulation_wallet: { Args: never; Returns: undefined }
      execute_smart_transfer: {
        Args: { p_amount?: number; p_sync: string }
        Returns: string
      }
      lookup_wallet_recipient: {
        Args: { p_query: string }
        Returns: {
          alias: string
          email: string
          name: string
          user_id: string
        }[]
      }
      pending_collection_requests: {
        Args: never
        Returns: {
          amount: number
          id: string
          max_cap: number
          name: string
          reminder_cadence: string
          sender_name: string
          sync_request_id: string
        }[]
      }
      prepare_simulation_transfer: {
        Args: { p_amount: number; p_recipient: string; p_sync?: string }
        Returns: string
      }
      search_simulation_recipient: {
        Args: { p_query: string }
        Returns: {
          alias: string
          name: string
          user_id: string
        }[]
      }
      send_smart_reminder: { Args: { p_sync: string }; Returns: string }
      teammate_action: {
        Args: { p_action: string; p_data?: Json; p_id?: string }
        Returns: Json
      }
      teammate_runtime_write: {
        Args: { p_action: string; p_data: Json; p_id: string }
        Returns: Json
      }
      top_up_simulation_wallet: { Args: { p_amount: number }; Returns: number }
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
    Enums: {},
  },
} as const

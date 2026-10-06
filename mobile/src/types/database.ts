// Généré par : npx supabase gen types typescript --local > mobile/src/types/database.ts
// Ne pas modifier à la main : régénérer après chaque migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: { Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          admin_notes: string | null;
          blocked: unknown;
          buffer_minutes: number;
          capacity: number;
          created_at: string;
          created_by: string | null;
          id: string;
          period: unknown;
          resource_id: string;
          service_id: string;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          admin_notes?: string | null;
          blocked?: unknown;
          buffer_minutes?: number;
          capacity?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          period: unknown;
          resource_id: string;
          service_id: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Update: {
          admin_notes?: string | null;
          blocked?: unknown;
          buffer_minutes?: number;
          capacity?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          period?: unknown;
          resource_id?: string;
          service_id?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      availability_rules: {
        Row: {
          created_at: string;
          end_time: string;
          id: string;
          resource_id: string;
          start_time: string;
          valid_from: string;
          valid_until: string | null;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_time: string;
          id?: string;
          resource_id: string;
          start_time: string;
          valid_from?: string;
          valid_until?: string | null;
          weekday: number;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          id?: string;
          resource_id?: string;
          start_time?: string;
          valid_from?: string;
          valid_until?: string | null;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "availability_rules_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      blackouts: {
        Row: {
          created_at: string;
          id: string;
          period: unknown;
          reason: string;
          resource_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          period: unknown;
          reason?: string;
          resource_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          period?: unknown;
          reason?: string;
          resource_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blackouts_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          appointment_id: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_id: string;
          client_notes: string | null;
          created_at: string;
          dog_id: string | null;
          id: string;
          party_size: number;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          appointment_id: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_id: string;
          client_notes?: string | null;
          created_at?: string;
          dog_id?: string | null;
          id?: string;
          party_size?: number;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
        };
        Update: {
          appointment_id?: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_id?: string;
          client_notes?: string | null;
          created_at?: string;
          dog_id?: string | null;
          id?: string;
          party_size?: number;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      cameras: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          resource_id: string;
          sort_order: number;
          stream_path: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          resource_id: string;
          sort_order?: number;
          stream_path: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          resource_id?: string;
          sort_order?: number;
          stream_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cameras_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      dogs: {
        Row: {
          birth_date: string | null;
          breed: string | null;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          owner_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          birth_date?: string | null;
          breed?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          breed?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dogs_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      resources: {
        Row: {
          created_at: string;
          id: string;
          is_open: boolean;
          name: string;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_open?: boolean;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_open?: boolean;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          active: boolean;
          booking_enabled: boolean;
          buffer_minutes: number;
          cancel_notice_hours: number;
          created_at: string;
          default_capacity: number;
          description: string;
          duration_minutes: number | null;
          id: string;
          location: string;
          max_advance_days: number;
          min_notice_hours: number;
          mode: Database["public"]["Enums"]["booking_mode"];
          name: string;
          price_cents: number | null;
          resource_id: string;
          slot_step_minutes: number;
          slug: string;
          sort_order: number;
          summary: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          booking_enabled?: boolean;
          buffer_minutes?: number;
          cancel_notice_hours?: number;
          created_at?: string;
          default_capacity?: number;
          description?: string;
          duration_minutes?: number | null;
          id?: string;
          location?: string;
          max_advance_days?: number;
          min_notice_hours?: number;
          mode: Database["public"]["Enums"]["booking_mode"];
          name: string;
          price_cents?: number | null;
          resource_id: string;
          slot_step_minutes?: number;
          slug: string;
          sort_order?: number;
          summary?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          booking_enabled?: boolean;
          buffer_minutes?: number;
          cancel_notice_hours?: number;
          created_at?: string;
          default_capacity?: number;
          description?: string;
          duration_minutes?: number | null;
          id?: string;
          location?: string;
          max_advance_days?: number;
          min_notice_hours?: number;
          mode?: Database["public"]["Enums"]["booking_mode"];
          name?: string;
          price_cents?: number | null;
          resource_id?: string;
          slot_step_minutes?: number;
          slug?: string;
          sort_order?: number;
          summary?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assert_booking_quota: { Args: { p_client_id: string }; Returns: undefined };
      assert_dog_owner: { Args: { p_dog_id: string; p_owner_id: string }; Returns: undefined };
      book_event: {
        Args: { p_appointment_id: string; p_dog_id?: string; p_notes?: string; p_party_size?: number };
        Returns: string;
      };
      book_slot: {
        Args: { p_dog_id?: string; p_notes?: string; p_service_id: string; p_starts_at: string };
        Returns: string;
      };
      camera_access: {
        Args: { p_resource_slug: string };
        Returns: {
          expires_at: string;
          mode: string;
        }[];
      };
      cancel_booking: { Args: { p_booking_id: string }; Returns: undefined };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      get_available_slots: {
        Args: { p_from: string; p_service_id: string; p_to: string };
        Returns: {
          appointment_id: string;
          ends_at: string;
          remaining: number;
          starts_at: string;
        }[];
      };
      get_resource_status: {
        Args: { p_resource_slug: string };
        Returns: {
          status: string;
          until: string;
        }[];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      appointment_status: "scheduled" | "cancelled";
      booking_mode: "slot" | "event";
      booking_status: "confirmed" | "cancelled";
      user_role: "client" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: ["scheduled", "cancelled"],
      booking_mode: ["slot", "event"],
      booking_status: ["confirmed", "cancelled"],
      user_role: ["client", "admin"],
    },
  },
} as const;

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
      audit_log: {
        Row: {
          action: string;
          actor: string | null;
          actor_is_admin: boolean;
          changes: NonNullable<Json>;
          created_at: string;
          id: number;
          row_id: string | null;
          table_name: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor?: string | null;
          actor_is_admin?: boolean;
          changes?: NonNullable<Json>;
          created_at?: string;
          id?: never;
          row_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          actor?: string | null;
          actor_is_admin?: boolean;
          changes?: NonNullable<Json>;
          created_at?: string;
          id?: never;
          row_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
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
          feed_id: string | null;
          id: string;
          period: unknown;
          reason: string;
          resource_id: string;
          source: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          feed_id?: string | null;
          id?: string;
          period: unknown;
          reason?: string;
          resource_id: string;
          source?: string;
        };
        Update: {
          created_at?: string;
          feed_id?: string | null;
          id?: string;
          period?: unknown;
          reason?: string;
          resource_id?: string;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blackouts_feed_id_fkey";
            columns: ["feed_id"];
            isOneToOne: false;
            referencedRelation: "calendar_feeds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "blackouts_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_dogs: {
        Row: {
          booking_id: string;
          dog_id: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id: string;
          dog_id: string;
        };
        Update: {
          booking_id?: string;
          dog_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "booking_dogs_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_dogs_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_guests: {
        Row: {
          access_token: string;
          booking_id: string;
          created_at: string;
          dog: Json | null;
          email: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          profile_completed_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          access_token?: string;
          booking_id: string;
          created_at?: string;
          dog?: Json | null;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          full_name: string;
          id?: string;
          phone?: string | null;
          profile_completed_at?: string | null;
        };
        Update: {
          access_token?: string;
          booking_id?: string;
          created_at?: string;
          dog?: Json | null;
          email?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          profile_completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_guests_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          adults_count: number | null;
          appointment_id: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
          children_count: number | null;
          client_id: string;
          client_notes: string | null;
          created_at: string;
          discount_cents: number | null;
          discount_code_id: string | null;
          dog_id: string | null;
          dogs_count: number | null;
          group_certified_at: string | null;
          group_dogs: NonNullable<Json>;
          health_warnings: string[];
          id: string;
          party_size: number;
          price_cents: number | null;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
          visit_address: string | null;
        };
        ComputedFields: never;
        Insert: {
          adults_count?: number | null;
          appointment_id: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          children_count?: number | null;
          client_id: string;
          client_notes?: string | null;
          created_at?: string;
          discount_cents?: number | null;
          discount_code_id?: string | null;
          dog_id?: string | null;
          dogs_count?: number | null;
          group_certified_at?: string | null;
          group_dogs?: NonNullable<Json>;
          health_warnings?: string[];
          id?: string;
          party_size?: number;
          price_cents?: number | null;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
          visit_address?: string | null;
        };
        Update: {
          adults_count?: number | null;
          appointment_id?: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          children_count?: number | null;
          client_id?: string;
          client_notes?: string | null;
          created_at?: string;
          discount_cents?: number | null;
          discount_code_id?: string | null;
          dog_id?: string | null;
          dogs_count?: number | null;
          group_certified_at?: string | null;
          group_dogs?: NonNullable<Json>;
          health_warnings?: string[];
          id?: string;
          party_size?: number;
          price_cents?: number | null;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
          visit_address?: string | null;
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
            foreignKeyName: "bookings_discount_code_fk";
            columns: ["discount_code_id"];
            isOneToOne: false;
            referencedRelation: "discount_codes";
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
      calendar_days: {
        Row: {
          day: string;
          kind: string;
          label: string;
        };
        ComputedFields: never;
        Insert: {
          day: string;
          kind: string;
          label?: string;
        };
        Update: {
          day?: string;
          kind?: string;
          label?: string;
        };
        Relationships: [];
      };
      calendar_feeds: {
        Row: {
          active: boolean;
          created_at: string;
          event_count: number | null;
          id: string;
          label: string;
          last_error: string | null;
          last_synced_at: string | null;
          resource_id: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          event_count?: number | null;
          id?: string;
          label?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          resource_id: string;
          url: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          event_count?: number | null;
          id?: string;
          label?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          resource_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_feeds_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
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
      discount_codes: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["discount_kind"];
          label: string;
          max_uses: number | null;
          valid_until: string | null;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["discount_kind"];
          label?: string;
          max_uses?: number | null;
          valid_until?: string | null;
          value: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["discount_kind"];
          label?: string;
          max_uses?: number | null;
          valid_until?: string | null;
          value?: number;
        };
        Relationships: [];
      };
      document_acceptances: {
        Row: {
          accepted_at: string;
          booking_id: string | null;
          document_id: string;
          id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string;
          booking_id?: string | null;
          document_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          booking_id?: string | null;
          document_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_acceptances_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_acceptances_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "legal_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_acceptances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dog_vaccinations: {
        Row: {
          created_at: string;
          dog_id: string;
          id: string;
          proof_path: string | null;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["review_status"];
          updated_at: string;
          vaccinated_on: string;
          vaccine_type_id: string;
          valid_until: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dog_id: string;
          id?: string;
          proof_path?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
          vaccinated_on: string;
          vaccine_type_id: string;
          valid_until: string;
        };
        Update: {
          created_at?: string;
          dog_id?: string;
          id?: string;
          proof_path?: string | null;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
          vaccinated_on?: string;
          vaccine_type_id?: string;
          valid_until?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dog_vaccinations_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dog_vaccinations_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dog_vaccinations_vaccine_type_id_fkey";
            columns: ["vaccine_type_id"];
            isOneToOne: false;
            referencedRelation: "vaccine_types";
            referencedColumns: ["id"];
          },
        ];
      };
      dogs: {
        Row: {
          antiparasitic_until: string | null;
          birth_date: string | null;
          bite_history: boolean | null;
          breed: string | null;
          chip_number: string | null;
          created_at: string;
          currently_ill: boolean;
          dogid_registered: boolean;
          id: string;
          in_heat: boolean;
          name: string;
          notes: string | null;
          owner_id: string;
          protocol: boolean;
          protocol_note: string | null;
          reactivity: string | null;
          sex: string | null;
          size: string | null;
          special_needs: string | null;
          sterilised: boolean | null;
          updated_at: string;
          vet_name: string | null;
          vet_phone: string | null;
        };
        ComputedFields: never;
        Insert: {
          antiparasitic_until?: string | null;
          birth_date?: string | null;
          bite_history?: boolean | null;
          breed?: string | null;
          chip_number?: string | null;
          created_at?: string;
          currently_ill?: boolean;
          dogid_registered?: boolean;
          id?: string;
          in_heat?: boolean;
          name: string;
          notes?: string | null;
          owner_id?: string;
          protocol?: boolean;
          protocol_note?: string | null;
          reactivity?: string | null;
          sex?: string | null;
          size?: string | null;
          special_needs?: string | null;
          sterilised?: boolean | null;
          updated_at?: string;
          vet_name?: string | null;
          vet_phone?: string | null;
        };
        Update: {
          antiparasitic_until?: string | null;
          birth_date?: string | null;
          bite_history?: boolean | null;
          breed?: string | null;
          chip_number?: string | null;
          created_at?: string;
          currently_ill?: boolean;
          dogid_registered?: boolean;
          id?: string;
          in_heat?: boolean;
          name?: string;
          notes?: string | null;
          owner_id?: string;
          protocol?: boolean;
          protocol_note?: string | null;
          reactivity?: string | null;
          sex?: string | null;
          size?: string | null;
          special_needs?: string | null;
          sterilised?: boolean | null;
          updated_at?: string;
          vet_name?: string | null;
          vet_phone?: string | null;
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
      emergencies: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          booking_id: string | null;
          created_at: string;
          id: string;
          message: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          booking_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          user_id: string;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          booking_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "emergencies_acknowledged_by_fkey";
            columns: ["acknowledged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "emergencies_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "emergencies_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      guest_document_acceptances: {
        Row: {
          accepted_at: string;
          document_id: string;
          guest_id: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string;
          document_id: string;
          guest_id: string;
        };
        Update: {
          accepted_at?: string;
          document_id?: string;
          guest_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guest_document_acceptances_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "legal_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guest_document_acceptances_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "booking_guests";
            referencedColumns: ["id"];
          },
        ];
      };
      incidents: {
        Row: {
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          dog_ids: string[];
          id: string;
          kind: Database["public"]["Enums"]["incident_kind"];
          occurred_at: string;
          person_ids: string[];
          photo_paths: string[];
          rule_reference: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          dog_ids?: string[];
          id?: string;
          kind: Database["public"]["Enums"]["incident_kind"];
          occurred_at?: string;
          person_ids?: string[];
          photo_paths?: string[];
          rule_reference?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          dog_ids?: string[];
          id?: string;
          kind?: Database["public"]["Enums"]["incident_kind"];
          occurred_at?: string;
          person_ids?: string[];
          photo_paths?: string[];
          rule_reference?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "incidents_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "incidents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_documents: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          kind: string;
          language: string;
          published_at: string | null;
          title: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          kind: string;
          language?: string;
          published_at?: string | null;
          title: string;
          version: number;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          language?: string;
          published_at?: string | null;
          title?: string;
          version?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          attempts: number;
          audience: string;
          booking_id: string | null;
          created_at: string;
          dog_id: string | null;
          emergency_id: string | null;
          guest_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          last_error: string | null;
          locked_until: string | null;
          payload: NonNullable<Json>;
          profile_id: string | null;
          push_sent_at: string | null;
          ref_date: string | null;
          send_after: string;
          sent_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          audience: string;
          booking_id?: string | null;
          created_at?: string;
          dog_id?: string | null;
          emergency_id?: string | null;
          guest_id?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          last_error?: string | null;
          locked_until?: string | null;
          payload?: NonNullable<Json>;
          profile_id?: string | null;
          push_sent_at?: string | null;
          ref_date?: string | null;
          send_after?: string;
          sent_at?: string | null;
        };
        Update: {
          attempts?: number;
          audience?: string;
          booking_id?: string | null;
          created_at?: string;
          dog_id?: string | null;
          emergency_id?: string | null;
          guest_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["notification_kind"];
          last_error?: string | null;
          locked_until?: string | null;
          payload?: NonNullable<Json>;
          profile_id?: string | null;
          push_sent_at?: string | null;
          ref_date?: string | null;
          send_after?: string;
          sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_dog_id_fkey";
            columns: ["dog_id"];
            isOneToOne: false;
            referencedRelation: "dogs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_emergency_id_fkey";
            columns: ["emergency_id"];
            isOneToOne: false;
            referencedRelation: "emergencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_guest_id_fkey";
            columns: ["guest_id"];
            isOneToOne: false;
            referencedRelation: "booking_guests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_rules: {
        Row: {
          active: boolean;
          adjustment: string;
          created_at: string;
          end_time: string | null;
          id: string;
          kind: string;
          label: string;
          on_public_holidays: boolean;
          on_school_holidays: boolean;
          service_id: string;
          sort_order: number;
          start_time: string | null;
          threshold: number;
          value: number;
          weekdays: number[];
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          adjustment?: string;
          created_at?: string;
          end_time?: string | null;
          id?: string;
          kind: string;
          label?: string;
          on_public_holidays?: boolean;
          on_school_holidays?: boolean;
          service_id: string;
          sort_order?: number;
          start_time?: string | null;
          threshold?: number;
          value: number;
          weekdays?: number[];
        };
        Update: {
          active?: boolean;
          adjustment?: string;
          created_at?: string;
          end_time?: string | null;
          id?: string;
          kind?: string;
          label?: string;
          on_public_holidays?: boolean;
          on_school_holidays?: boolean;
          service_id?: string;
          sort_order?: number;
          start_time?: string | null;
          threshold?: number;
          value?: number;
          weekdays?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "pricing_rules_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          birth_date: string | null;
          created_at: string;
          email: string;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          full_name: string;
          id: string;
          insurance_company: string | null;
          insurance_policy: string | null;
          insurance_proof_path: string | null;
          insurance_valid_until: string | null;
          language: string;
          phone: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          birth_date?: string | null;
          created_at?: string;
          email?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          full_name?: string;
          id: string;
          insurance_company?: string | null;
          insurance_policy?: string | null;
          insurance_proof_path?: string | null;
          insurance_valid_until?: string | null;
          language?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          created_at?: string;
          email?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          full_name?: string;
          id?: string;
          insurance_company?: string | null;
          insurance_policy?: string | null;
          insurance_proof_path?: string | null;
          insurance_valid_until?: string | null;
          language?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          created_at: string;
          last_seen_at: string;
          platform: string | null;
          token: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          last_seen_at?: string;
          platform?: string | null;
          token: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          last_seen_at?: string;
          platform?: string | null;
          token?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      questionnaire_questions: {
        Row: {
          active: boolean;
          created_at: string;
          help: string | null;
          id: string;
          kind: string;
          label: string;
          options: NonNullable<Json>;
          position: number;
          required: boolean;
          service_id: string;
          translations: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          help?: string | null;
          id?: string;
          kind: string;
          label: string;
          options?: NonNullable<Json>;
          position?: number;
          required?: boolean;
          service_id: string;
          translations?: NonNullable<Json>;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          help?: string | null;
          id?: string;
          kind?: string;
          label?: string;
          options?: NonNullable<Json>;
          position?: number;
          required?: boolean;
          service_id?: string;
          translations?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "questionnaire_questions_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      questionnaire_responses: {
        Row: {
          answers: NonNullable<Json>;
          booking_id: string;
          questions_snapshot: NonNullable<Json>;
          submitted_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          answers?: NonNullable<Json>;
          booking_id: string;
          questions_snapshot?: NonNullable<Json>;
          submitted_at?: string;
          updated_at?: string;
        };
        Update: {
          answers?: NonNullable<Json>;
          booking_id?: string;
          questions_snapshot?: NonNullable<Json>;
          submitted_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questionnaire_responses_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: true;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      rescue_access: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string;
          id: string;
          label: string;
          revoked_at: string | null;
          token: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          id?: string;
          label?: string;
          revoked_at?: string | null;
          token?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          id?: string;
          label?: string;
          revoked_at?: string | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rescue_access_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      sanctions: {
        Row: {
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          incident_id: string | null;
          level: Database["public"]["Enums"]["sanction_level"];
          reason: string;
          starts_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          incident_id?: string | null;
          level: Database["public"]["Enums"]["sanction_level"];
          reason?: string;
          starts_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          incident_id?: string | null;
          level?: Database["public"]["Enums"]["sanction_level"];
          reason?: string;
          starts_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sanctions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sanctions_incident_fk";
            columns: ["incident_id"];
            isOneToOne: false;
            referencedRelation: "incidents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sanctions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
          max_dogs: number | null;
          max_people: number | null;
          min_notice_hours: number;
          mode: Database["public"]["Enums"]["booking_mode"];
          name: string;
          price_cents: number | null;
          price_visible: boolean;
          required_document_kinds: string[];
          requires_address: boolean;
          requires_park_profile: boolean;
          resource_id: string;
          slot_step_minutes: number;
          slug: string;
          sort_order: number;
          summary: string;
          translations: NonNullable<Json>;
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
          max_dogs?: number | null;
          max_people?: number | null;
          min_notice_hours?: number;
          mode: Database["public"]["Enums"]["booking_mode"];
          name: string;
          price_cents?: number | null;
          price_visible?: boolean;
          required_document_kinds?: string[];
          requires_address?: boolean;
          requires_park_profile?: boolean;
          resource_id: string;
          slot_step_minutes?: number;
          slug: string;
          sort_order?: number;
          summary?: string;
          translations?: NonNullable<Json>;
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
          max_dogs?: number | null;
          max_people?: number | null;
          min_notice_hours?: number;
          mode?: Database["public"]["Enums"]["booking_mode"];
          name?: string;
          price_cents?: number | null;
          price_visible?: boolean;
          required_document_kinds?: string[];
          requires_address?: boolean;
          requires_park_profile?: boolean;
          resource_id?: string;
          slot_step_minutes?: number;
          slug?: string;
          sort_order?: number;
          summary?: string;
          translations?: NonNullable<Json>;
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
      settings: {
        Row: {
          admin_email: string | null;
          antiparasitic_rule: string;
          calendar_token: string;
          expiry_alert_days: number;
          heat_rule: string;
          id: boolean;
          illness_rule: string;
          min_age_rule: string;
          min_dog_age_months: number | null;
          reminder_hours: number;
          rescue_info: string;
          social_monthly_cap: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          admin_email?: string | null;
          antiparasitic_rule?: string;
          calendar_token?: string;
          expiry_alert_days?: number;
          heat_rule?: string;
          id?: boolean;
          illness_rule?: string;
          min_age_rule?: string;
          min_dog_age_months?: number | null;
          reminder_hours?: number;
          rescue_info?: string;
          social_monthly_cap?: number | null;
          updated_at?: string;
        };
        Update: {
          admin_email?: string | null;
          antiparasitic_rule?: string;
          calendar_token?: string;
          expiry_alert_days?: number;
          heat_rule?: string;
          id?: boolean;
          illness_rule?: string;
          min_age_rule?: string;
          min_dog_age_months?: number | null;
          reminder_hours?: number;
          rescue_info?: string;
          social_monthly_cap?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      vaccine_types: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          required: boolean;
          sort_order: number;
          translations: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          required?: boolean;
          sort_order?: number;
          translations?: NonNullable<Json>;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          required?: boolean;
          sort_order?: number;
          translations?: NonNullable<Json>;
        };
        Relationships: [];
      };
      waitlist_entries: {
        Row: {
          created_at: string;
          day: string;
          id: string;
          notified_at: string | null;
          service_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          day: string;
          id?: string;
          notified_at?: string | null;
          service_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          id?: string;
          notified_at?: string | null;
          service_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_entries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_book_for_client: {
        Args: {
          p_client_id: string;
          p_duration_minutes: number;
          p_notes?: string;
          p_price_cents?: number;
          p_service_id: string;
          p_starts_at: string;
          p_visit_address?: string;
        };
        Returns: string;
      };
      admin_stats: { Args: { p_from: string; p_to: string }; Returns: Json };
      assert_booking_quota: { Args: { p_client_id: string }; Returns: undefined };
      assert_dog_owner: { Args: { p_dog_id: string; p_owner_id: string }; Returns: undefined };
      assert_dogs_owner: { Args: { p_dog_ids: string[]; p_owner_id: string }; Returns: undefined };
      assert_eligibility: {
        Args: {
          p_dog_ids: string[];
          p_group_count?: number;
          p_service: Omit<
            Database["public"]["Tables"]["services"]["Row"],
            Database["public"]["Tables"]["services"]["ComputedFields"]
          >;
          p_starts_at: string;
          p_uid: string;
        };
        Returns: undefined;
      };
      assert_not_sanctioned: { Args: { p_uid: string }; Returns: undefined };
      book_event: {
        Args: {
          p_adults_count?: number;
          p_appointment_id: string;
          p_children_count?: number;
          p_discount_code?: string;
          p_document_ids?: string[];
          p_dog_id?: string;
          p_dog_ids?: string[];
          p_dogs_count?: number;
          p_group_certified?: boolean;
          p_group_dogs?: Json;
          p_guests?: Json;
          p_notes?: string;
          p_party_size?: number;
        };
        Returns: string;
      };
      book_slot: {
        Args: {
          p_adults_count?: number;
          p_children_count?: number;
          p_discount_code?: string;
          p_document_ids?: string[];
          p_dog_id?: string;
          p_dog_ids?: string[];
          p_dogs_count?: number;
          p_group_certified?: boolean;
          p_group_dogs?: Json;
          p_guests?: Json;
          p_notes?: string;
          p_service_id: string;
          p_starts_at: string;
          p_visit_address?: string;
        };
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
      check_discount_code: {
        Args: { p_code: string; p_service_id: string };
        Returns: {
          discount_cents: number;
          price_cents: number;
          valid: boolean;
        }[];
      };
      check_park_eligibility: {
        Args: { p_dog_ids: string[]; p_group_count?: number; p_service_id: string; p_starts_at: string };
        Returns: Json;
      };
      claim_notifications: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          audience: string;
          booking_id: string | null;
          created_at: string;
          dog_id: string | null;
          emergency_id: string | null;
          guest_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          last_error: string | null;
          locked_until: string | null;
          payload: NonNullable<Json>;
          profile_id: string | null;
          push_sent_at: string | null;
          ref_date: string | null;
          send_after: string;
          sent_at: string | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "notifications";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      clean_group_dogs: { Args: { p_dogs: Json }; Returns: Json };
      clean_guests: { Args: { p_guests: Json }; Returns: Json };
      close_period: {
        Args: {
          p_cancel_existing?: boolean;
          p_ends_at: string;
          p_reason?: string;
          p_resource_id: string;
          p_starts_at: string;
        };
        Returns: number;
      };
      complete_guest_profile: {
        Args: { p_document_ids: string[]; p_profile: Json; p_token: string };
        Returns: undefined;
      };
      compute_price: {
        Args: {
          p_dogs: number;
          p_guests: number;
          p_service: Omit<
            Database["public"]["Tables"]["services"]["Row"],
            Database["public"]["Tables"]["services"]["ComputedFields"]
          >;
          p_starts_at: string;
        };
        Returns: number;
      };
      count_appointments_in_period: {
        Args: { p_ends_at: string; p_resource_id: string; p_starts_at: string };
        Returns: number;
      };
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: undefined };
      dog_health_issues: {
        Args: {
          p_day: string;
          p_dog: Omit<
            Database["public"]["Tables"]["dogs"]["Row"],
            Database["public"]["Tables"]["dogs"]["ComputedFields"]
          >;
        };
        Returns: {
          code: string;
          mode: string;
        }[];
      };
      eligibility_warnings: {
        Args: {
          p_dog_ids: string[];
          p_service: Omit<
            Database["public"]["Tables"]["services"]["Row"],
            Database["public"]["Tables"]["services"]["ComputedFields"]
          >;
          p_starts_at: string;
        };
        Returns: string[];
      };
      enqueue_expiry_alerts: { Args: Record<PropertyKey, never>; Returns: number };
      export_my_data: { Args: Record<PropertyKey, never>; Returns: Json };
      get_available_slots: {
        Args: { p_from: string; p_service_id: string; p_to: string };
        Returns: {
          appointment_id: string;
          ends_at: string;
          remaining: number;
          starts_at: string;
        }[];
      };
      get_emergency_overview: { Args: { p_resource_slug?: string }; Returns: Json };
      get_full_days: { Args: { p_from: string; p_service_id: string; p_to: string }; Returns: string[] };
      get_guest_invitation: { Args: { p_language?: string; p_token: string }; Returns: Json };
      get_required_documents: {
        Args: { p_language?: string; p_service_id: string };
        Returns: {
          accepted: boolean;
          body: string;
          document_id: string;
          kind: string;
          title: string;
          version: number;
        }[];
      };
      get_rescue_info: { Args: Record<PropertyKey, never>; Returns: string };
      get_resource_status: {
        Args: { p_resource_slug: string };
        Returns: {
          status: string;
          until: string;
        }[];
      };
      guest_camera_access: {
        Args: { p_token: string };
        Returns: {
          ends_at: string;
          expires_at: string;
          guest_name: string;
          mode: string;
          starts_at: string;
        }[];
      };
      insert_guests: { Args: { p_booking_id: string; p_guests: Json }; Returns: undefined };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      my_role: { Args: Record<PropertyKey, never>; Returns: string };
      normalize_dog_ids: { Args: { p_dog_id: string; p_dog_ids: string[] }; Returns: string[] };
      prepare_booking: {
        Args: {
          p_adults_count: number;
          p_children_count: number;
          p_discount_code: string;
          p_document_ids: string[];
          p_dog_id: string;
          p_dogs_count: number;
          p_notes: string;
          p_price: number;
          p_service: Omit<
            Database["public"]["Tables"]["services"]["Row"],
            Database["public"]["Tables"]["services"]["ComputedFields"]
          >;
          p_uid: string;
          p_visit_address: string;
        };
        Returns: Record<string, unknown>;
      };
      quote_price: {
        Args: {
          p_discount_code?: string;
          p_dogs_count?: number;
          p_guests_count?: number;
          p_service_id: string;
          p_starts_at: string;
        };
        Returns: {
          discount_cents: number;
          labels: string[];
          price_cents: number;
        }[];
      };
      raise_emergency: { Args: { p_message?: string }; Returns: string };
      record_acceptances: {
        Args: { p_booking_id: string; p_document_ids: string[]; p_uid: string };
        Returns: undefined;
      };
      replace_external_busy: { Args: { p_error?: string; p_events: Json; p_feed_id: string }; Returns: number };
      reschedule_booking: { Args: { p_booking_id: string; p_starts_at: string }; Returns: undefined };
      rescue_camera_access: {
        Args: { p_token: string };
        Returns: {
          expires_at: string;
          label: string;
          mode: string;
          rescue_info: string;
        }[];
      };
      schedule_booking_reminder: { Args: { p_booking_id: string; p_starts_at: string }; Returns: undefined };
      set_booking_guests: { Args: { p_booking_id: string; p_guests: Json }; Returns: undefined };
      set_user_role: {
        Args: { p_role: Database["public"]["Enums"]["user_role"]; p_user_id: string };
        Returns: undefined;
      };
      submit_questionnaire: { Args: { p_answers: Json; p_booking_id: string }; Returns: undefined };
    };
    Enums: {
      appointment_status: "scheduled" | "cancelled";
      booking_mode: "slot" | "event";
      booking_status: "confirmed" | "cancelled";
      discount_kind: "percent" | "amount";
      incident_kind: "injury" | "bite" | "fight" | "dirt" | "rules_breach" | "other";
      notification_kind:
        | "booking_confirmed"
        | "booking_rescheduled"
        | "booking_cancelled"
        | "booking_reminder"
        | "admin_new_booking"
        | "admin_booking_rescheduled"
        | "admin_booking_cancelled"
        | "insurance_expiring"
        | "vaccination_expiring"
        | "vaccination_reviewed"
        | "waitlist_slot_freed"
        | "admin_documents_expired"
        | "admin_vaccination_to_review"
        | "admin_emergency"
        | "guest_live_link"
        | "admin_questionnaire_submitted";
      review_status: "pending" | "validated" | "rejected";
      sanction_level: "warning" | "suspension" | "ban";
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
      discount_kind: ["percent", "amount"],
      incident_kind: ["injury", "bite", "fight", "dirt", "rules_breach", "other"],
      notification_kind: [
        "booking_confirmed",
        "booking_rescheduled",
        "booking_cancelled",
        "booking_reminder",
        "admin_new_booking",
        "admin_booking_rescheduled",
        "admin_booking_cancelled",
        "insurance_expiring",
        "vaccination_expiring",
        "vaccination_reviewed",
        "waitlist_slot_freed",
        "admin_documents_expired",
        "admin_vaccination_to_review",
        "admin_emergency",
        "guest_live_link",
        "admin_questionnaire_submitted",
      ],
      review_status: ["pending", "validated", "rejected"],
      sanction_level: ["warning", "suspension", "ban"],
      user_role: ["client", "admin"],
    },
  },
} as const;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      meal_records: {
        Row: {
          id: string;
          user_id: string;
          record_date: string;
          meal_type: string;
          image_url: string | null;
          image_storage_path: string | null;
          total_calories: number | null;
          total_carbohydrates_g: number | null;
          total_protein_g: number | null;
          total_fat_g: number | null;
          food_name: string | null;
          food_name_en: string | null;
          ai_review: string | null;
          ai_score: "perfect" | "good" | "bad" | null;
          analysis_confidence: number | null;
          updated_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          record_date: string;
          meal_type: string;
          image_url?: string | null;
          image_storage_path?: string | null;
          total_calories?: number | null;
          total_carbohydrates_g?: number | null;
          total_protein_g?: number | null;
          total_fat_g?: number | null;
          food_name?: string | null;
          food_name_en?: string | null;
          ai_review?: string | null;
          ai_score?: "perfect" | "good" | "bad" | null;
          analysis_confidence?: number | null;
          updated_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          image_url?: string | null;
          image_storage_path?: string | null;
          total_calories?: number | null;
          total_carbohydrates_g?: number | null;
          total_protein_g?: number | null;
          total_fat_g?: number | null;
          food_name?: string | null;
          food_name_en?: string | null;
          ai_review?: string | null;
          ai_score?: "perfect" | "good" | "bad" | null;
          analysis_confidence?: number | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          user_id: string;
          nickname: string | null;
          target_calories: number | null;
          avatar_url: string | null;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          nickname?: string | null;
          target_calories?: number | null;
          avatar_url?: string | null;
          updated_at?: string | null;
        };
        Update: {
          nickname?: string | null;
          target_calories?: number | null;
          avatar_url?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: string | null;
          status: string | null;
          auto_renew: boolean | null;
          current_period_end: string | null;
          next_billing_date: string | null;
          price_monthly: number | null;
          card_company: string | null;
          card_number: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: string | null;
          status?: string | null;
          auto_renew?: boolean | null;
          current_period_end?: string | null;
          next_billing_date?: string | null;
          price_monthly?: number | null;
          card_company?: string | null;
          card_number?: string | null;
          updated_at?: string | null;
        };
        Update: {
          plan?: string | null;
          status?: string | null;
          auto_renew?: boolean | null;
          current_period_end?: string | null;
          next_billing_date?: string | null;
          price_monthly?: number | null;
          card_company?: string | null;
          card_number?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      ai_feedbacks: {
        Row: {
          id: string;
          user_id: string;
          feedback_date: string;
          feedback_text: string;
          nutrition_summary: Json | null;
          ai_provider: string | null;
          ai_model: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          feedback_date: string;
          feedback_text: string;
          nutrition_summary?: Json | null;
          ai_provider?: string | null;
          ai_model?: string | null;
          created_at?: string | null;
        };
        Update: {
          feedback_text?: string;
          nutrition_summary?: Json | null;
          ai_provider?: string | null;
          ai_model?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

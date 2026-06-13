import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          session_code: string;
          agent_id: string;
          status: string;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["sessions"]["Row"], "id" | "created_at">;
      };
      participants: {
        Row: {
          id: string;
          session_id: string;
          role: string;
          name: string;
          joined_at: string;
          left_at: string | null;
        };
      };
      messages: {
        Row: {
          id: string;
          session_id: string;
          sender: string;
          message: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "id" | "created_at">;
      };
    };
  };
};
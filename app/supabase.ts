import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://mesbcospesuhuojhftxs.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lc2Jjb3NwZXN1aHVvamhmdHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0ODYxNDUsImV4cCI6MjEwMTA2MjE0NX0.T8v8FMpDp9QGxveTHqpYeqr7AS0Zz6DU3PH_tOM0jdM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
  },
});

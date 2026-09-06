import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Únicamente se permiten la URL pública del proyecto y la Publishable/Anon Key
// en este archivo, porque se ejecuta directamente en el navegador.
const SUPABASE_URL = "https://pvwqqcwmwyflwgbwzqiz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ccB4tyS2JFdXQnvy58S6eA_1gAYfwM0";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

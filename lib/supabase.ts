import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

function createProjectClient(key: string) {
  const { url } = getSupabaseEnv();

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        "x-application-name": "dramanow-web"
      }
    }
  });
}

export function createSupabaseClient() {
  const { anonKey } = getSupabaseEnv();
  return createProjectClient(anonKey);
}

export function createSupabaseWriteClient() {
  const { anonKey } = getSupabaseEnv();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    "";

  return createProjectClient(serviceRoleKey.trim() || anonKey);
}

import { createClient } from "@supabase/supabase-js";

// 🔑 PASTE YOUR SUPABASE URL HERE
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bkwasvqxwtghqnfgdjsd.supabase.co";

// 🔑 PASTE YOUR SUPABASE KEY HERE
// Accepts either the newer "publishable" key (starts with sb_publishable_...)
// or the older "anon" key (a long JWT string) — both work identically here.
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_FxV74V8e-vQD0Cl2jpPfmw_P3mex5qc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

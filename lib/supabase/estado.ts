// Antes de que exista un proyecto Supabase real (p. ej. en un preview de Vercel
// desplegado solo para revisar visualización), las páginas deben degradar en
// vez de reventar. Una vez cargadas las env vars, esto pasa a true sin tocar código.
export const supabaseConfigurado = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

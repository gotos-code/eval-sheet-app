// Supabase project connection info (publishable/anon key — safe to expose client-side).
// Reuses the SAME Supabase project as SO CRM (gotos-code's Project). Access/approval is
// still fully separate — see eval_profiles table + is_eval_admin()/eval_set_*() in SETUP.md.
window.SUPABASE_URL = 'https://qoaovyinizzwhfahcowz.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_HiBSZiuR9ZzHw67YloMvcw__vzYPm5S';

// Only addresses on this domain may sign up.
window.ALLOWED_EMAIL_DOMAIN = 'sora1.jp';

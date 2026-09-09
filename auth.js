// Shared Supabase client + auth/approval helpers used across all pages.
// Reuses SO CRM's Supabase project, but access is tracked in a separate
// eval_profiles table — being approved in SO CRM does NOT grant access here.
window.sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

async function getSessionUser(){
  const { data: { session } } = await sb.auth.getSession();
  return session ? session.user : null;
}

// Returns this user's eval_profiles row, creating a pending (approved=false)
// one on first-ever visit — covers both a brand-new signup and an existing
// SO CRM account logging in here for the first time.
async function getProfile(user){
  const { data, error } = await sb
    .from('eval_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if(error) return null;
  if(data) return data;

  const meta = user.user_metadata || {};
  const { data: inserted, error: insertError } = await sb
    .from('eval_profiles')
    .insert({
      id: user.id,
      email: user.email,
      last_name: meta.last_name || null,
      first_name: meta.first_name || null
    })
    .select()
    .single();
  if(insertError) return null;
  return inserted;
}

// Redirects away if not logged in / not approved. Returns {user, profile} on success.
// pageKind: 'app' (requires approved), 'admin' (requires approved + is_admin)
async function requireAuth(pageKind){
  const user = await getSessionUser();
  if(!user){
    location.href = 'login.html';
    return null;
  }
  const profile = await getProfile(user);
  if(!profile || !profile.approved){
    location.href = 'index.html';
    return null;
  }
  if(pageKind === 'admin' && !profile.is_admin){
    location.href = 'sheet.html';
    return null;
  }
  return { user, profile };
}

async function signOut(){
  await sb.auth.signOut();
  location.href = 'login.html';
}

// Shared Supabase client + auth/approval helpers used across all pages.
window.sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

async function getSessionUser(){
  const { data: { session } } = await sb.auth.getSession();
  return session ? session.user : null;
}

async function getProfile(userId){
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if(error) return null;
  return data;
}

// Redirects away if not logged in / not approved. Returns {user, profile} on success.
// pageKind: 'app' (requires approved), 'admin' (requires approved + is_admin)
async function requireAuth(pageKind){
  const user = await getSessionUser();
  if(!user){
    location.href = 'login.html';
    return null;
  }
  const profile = await getProfile(user.id);
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

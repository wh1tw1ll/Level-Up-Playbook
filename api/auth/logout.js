// api/auth/logout.js
export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    'lu_auth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'lu_session=; Path=/; Secure; SameSite=Lax; Max-Age=0'
  ]);
  res.redirect('/');
}

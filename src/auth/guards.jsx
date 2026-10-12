import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider.jsx';

// Áreas logadas: sem sessão, vai para o login e volta depois
export function RequireAuth() {
  const { status, signedOutByUser } = useAuth();
  const location = useLocation();
  if (status !== 'authenticated') {
    if (signedOutByUser) return <Navigate to="/signin" replace />;
    return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
}

export function RequireAdmin() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/projects" replace />;
}

// Telas de visitante (login, cadastro): quem entrou vai para ?next= (só caminhos internos)
// ou para os projetos. É este guarda que redireciona após o login.
export function GuestOnly() {
  const { status } = useAuth();
  const location = useLocation();
  if (status !== 'authenticated') return <Outlet />;
  const next = new URLSearchParams(location.search).get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/projects';
  return <Navigate to={safeNext} replace />;
}

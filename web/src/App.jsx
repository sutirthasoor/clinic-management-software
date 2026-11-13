import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ModulePage from './pages/ModulePage';
import Profile from './pages/Profile';
import UsersAdmin from './pages/UsersAdmin';

const Analytics = lazy(() => import('./pages/Analytics'));
const Timeline = lazy(() => import('./pages/Timeline'));
const Guard = ({ roles, children }) => (roles.includes(useAuth().role) ? children : <Navigate to="/" />);

export default function App() {
  const { user, profile, ready, logout } = useAuth();
  if (!ready) return <div className="center">Loading...</div>;
  if (!user) return <Auth />;
  if (!profile) return <div className="center">Setting up your account... <button className="btn ghost" onClick={logout}>Sign out</button></div>;
  if (profile.active === false) return <div className="center">This account is deactivated. Contact the clinic. <button className="btn ghost" onClick={logout}>Sign out</button></div>;

  return (
    <Suspense fallback={<div className="center">Loading...</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="m/:key" element={<ModulePage />} />
          <Route path="users" element={<Guard roles={['admin']}><UsersAdmin /></Guard>} />
          <Route path="analytics" element={<Guard roles={['admin']}><Analytics /></Guard>} />
          <Route path="timeline" element={<Guard roles={['admin', 'doctor']}><Timeline /></Guard>} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

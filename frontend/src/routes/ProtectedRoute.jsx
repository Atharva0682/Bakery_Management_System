import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';

const ProtectedRoute = ({ children, allowedRoles, redirectPath }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { slug } = useBusiness();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-light, #EFE6DC)',
            borderTopColor: 'var(--color-brand-primary, #5A3825)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px',
          }}
        />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ color: 'var(--text-secondary, #5E4E45)', fontSize: '14px' }}>
          Verifying your session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const fallbackPath = redirectPath || (slug ? `/b/${slug}/login` : '/login');
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && user) {
    const userRole = (user.role || 'customer').toLowerCase();
    const hasRole = allowedRoles.map(r => r.toLowerCase()).includes(userRole);
    if (!hasRole) {
      // Authenticated user does NOT have permission for this portal.
      // Redirect them strictly to their assigned portal, NOT to the foreign login page.
      if (userRole === 'baker' || userRole === 'staff') {
        return <Navigate to="/staff/tasks" state={{ from: location, unauthorized: true }} replace />;
      }
      if (userRole === 'owner' || userRole === 'manager') {
        return <Navigate to="/owner/dashboard" state={{ from: location, unauthorized: true }} replace />;
      }
      return <Navigate to="/menu" state={{ from: location, unauthorized: true }} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;

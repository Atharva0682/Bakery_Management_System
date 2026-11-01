import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useBusiness } from '../context/BusinessContext';

const NotFoundPage = () => {
  const { slug } = useBusiness();
  const homePath = slug ? `/b/${slug}` : '/';

  return (
    <div style={{ padding: '80px 0', textAlign: 'center' }}>
      <div className="container" style={{ maxWidth: '500px' }}>
        <div className="card" style={{ padding: '48px 24px' }}>
          <span style={{ fontSize: '64px', display: 'block', marginBottom: '16px' }}>🥐</span>
          <h1 className="font-serif" style={{ fontSize: '32px', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Page Not Found
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '24px' }}>
            The page you are looking for has been moved or doesn't exist.
          </p>
          <Link to={homePath} className="btn btn-primary btn-pill">
            <ArrowLeft size={16} /> Return to Bakery Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;

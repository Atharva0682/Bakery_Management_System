import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import MobileBottomNav from '../components/common/MobileBottomNav';

const CustomerLayout = () => {
  return (
    <div className="customer-layout-root has-mobile-bottom-nav" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <main style={{ flex: '1 0 auto' }}>
        <Outlet />
      </main>
      <Footer />
      <MobileBottomNav role="customer" />
    </div>
  );
};

export default CustomerLayout;

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import BusinessRouteWrapper from '../layouts/BusinessRouteWrapper';
import ProtectedRoute from './ProtectedRoute';

// Customer Pages
const HomePage = lazy(() => import('../pages/HomePage'));
const MenuPage = lazy(() => import('../pages/MenuPage'));
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'));
const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));
const OrderConfirmationPage = lazy(() => import('../pages/OrderConfirmationPage'));
const OrderTrackingPage = lazy(() => import('../pages/OrderTrackingPage'));
const MyOrdersPage = lazy(() => import('../pages/MyOrdersPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const FeedbackPage = lazy(() => import('../pages/FeedbackPage'));
const QrEntryPage = lazy(() => import('../pages/QrEntryPage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const SignUpPage = lazy(() => import('../pages/SignUpPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

// Staff Portal (C Crumb&Co. STAFF PWA - 3 Core Modules: Tasks, Order Recipes & Baking, Wastage & Buffer)
import StaffLayout from '../layouts/StaffLayout';
const StaffTasksPage = lazy(() => import('../pages/staff/StaffTasksPage'));
const StaffProductionStationPage = lazy(() => import('../pages/staff/StaffProductionStationPage'));
const StaffBatchesWastagePage = lazy(() => import('../pages/staff/StaffBatchesWastagePage'));
const StaffLoginPage = lazy(() => import('../pages/staff/StaffLoginPage'));

// Owner Portal (PR Priya Sharma Owner Portal | C Crumb&Co. Operations - 6 Primary Modules + Secondary Settings)
import OwnerLayout from '../layouts/OwnerLayout';
const OwnerDashboardPage = lazy(() => import('../pages/owner/OwnerDashboardPage'));
const OwnerOrdersPage = lazy(() => import('../pages/owner/OwnerOrdersPage'));
const OwnerProductionWorkspacePage = lazy(() => import('../pages/owner/OwnerProductionWorkspacePage'));
const OwnerStockSuppliersPage = lazy(() => import('../pages/owner/OwnerStockSuppliersPage'));
const OwnerProductsRecipesPage = lazy(() => import('../pages/owner/OwnerProductsRecipesPage'));
const OwnerReportsWorkspacePage = lazy(() => import('../pages/owner/OwnerReportsWorkspacePage'));
const OwnerWorkersPage = lazy(() => import('../pages/owner/OwnerWorkersPage'));
const OwnerBrandingPage = lazy(() => import('../pages/owner/OwnerBrandingPage'));
const OwnerLoginPage = lazy(() => import('../pages/owner/OwnerLoginPage'));

const AppRoutes = () => {
  return (
    <Suspense fallback={<p role="status">Loading page...</p>}>
    <Routes>
      {/* Universal QR Code Entry Route */}
      <Route path="/q/:uniqueCode" element={<QrEntryPage />} />

      {/* ======================================================== */}
      {/* STAFF PORTAL ROUTES (C Crumb&Co. STAFF PWA)              */}
      {/* ======================================================== */}
      <Route path="/staff/login" element={<StaffLoginPage />} />
      <Route
        path="/staff"
        element={
          <ProtectedRoute
            allowedRoles={['staff', 'baker', 'manager', 'owner']}
            redirectPath="/staff/login"
          >
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/staff/tasks" replace />} />
        {/* Module 1: Today's Tasks */}
        <Route path="tasks" element={<StaffTasksPage />} />
        {/* Module 2: Order Recipe, Ingredients & Baking Station (with Timer up to Packaging) */}
        <Route path="production" element={<StaffProductionStationPage />} />
        {/* Module 3: Wastage & Buffer */}
        <Route path="batches" element={<StaffBatchesWastagePage />} />
        <Route path="wastage" element={<Navigate to="/staff/batches" replace />} />

        {/* Redirects for streamlined 3-module architecture */}
        <Route path="recipes" element={<Navigate to="/staff/production" replace />} />
        <Route path="ingredients" element={<Navigate to="/staff/production" replace />} />
        <Route path="*" element={<Navigate to="/staff/tasks" replace />} />
      </Route>

      {/* ======================================================== */}
      {/* OWNER PORTAL ROUTES (PR Priya Sharma Owner Portal)       */}
      {/* ======================================================== */}
      <Route path="/owner/login" element={<OwnerLoginPage />} />
      <Route
        path="/owner"
        element={
          <ProtectedRoute
            allowedRoles={['owner', 'manager']}
            redirectPath="/owner/login"
          >
            <OwnerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/owner/dashboard" replace />} />
        {/* 6 Primary Modules */}
        <Route path="dashboard" element={<OwnerDashboardPage />} />
        <Route path="orders" element={<OwnerOrdersPage />} />
        <Route path="production" element={<OwnerProductionWorkspacePage />} />
        <Route path="stock" element={<OwnerStockSuppliersPage />} />
        <Route path="products" element={<OwnerProductsRecipesPage />} />
        <Route path="reports" element={<OwnerReportsWorkspacePage />} />

        {/* Secondary Settings & Team Management */}
        <Route path="workers" element={<OwnerWorkersPage />} />
        <Route path="branding" element={<OwnerBrandingPage />} />

        {/* Backward-Compatible Redirects for Consolidated Screens */}
        <Route path="payments" element={<Navigate to="/owner/orders" replace />} />
        <Route path="production-planning" element={<Navigate to="/owner/production" replace />} />
        <Route path="batches" element={<Navigate to="/owner/production" replace />} />
        <Route path="inventory" element={<Navigate to="/owner/stock" replace />} />
        <Route path="vendors" element={<Navigate to="/owner/stock" replace />} />
        <Route path="recipes" element={<Navigate to="/owner/products" replace />} />
        <Route path="costing" element={<Navigate to="/owner/reports" replace />} />
        <Route path="wastage" element={<Navigate to="/owner/reports" replace />} />
        <Route path="traceability" element={<Navigate to="/owner/reports" replace />} />
        <Route path="analytics" element={<Navigate to="/owner/reports" replace />} />

        <Route path="*" element={<Navigate to="/owner/dashboard" replace />} />
      </Route>

      {/* ======================================================== */}
      {/* MULTI-TENANT BUSINESS ROUTES: /b/:businessSlug/*         */}
      {/* ======================================================== */}
      <Route path="/b/:businessSlug" element={<BusinessRouteWrapper />}>
        <Route index element={<HomePage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="product/:slug" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignUpPage />} />
        <Route path="register" element={<SignUpPage />} />

        {/* Customer Routes (Checkout and Tracking open to Guests as well) */}
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        <Route path="order-tracking/:orderId" element={<OrderTrackingPage />} />
        <Route path="orders/:orderId" element={<OrderTrackingPage />} />
        <Route
          path="orders"
          element={
            <ProtectedRoute>
              <MyOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="feedback"
          element={
            <ProtectedRoute>
              <FeedbackPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="feedback/:orderId"
          element={
            <ProtectedRoute>
              <FeedbackPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* ======================================================== */}
      {/* ROOT & DIRECT ROUTES (Active / Default Tenant)           */}
      {/* ======================================================== */}
      <Route path="/" element={<BusinessRouteWrapper />}>
        <Route index element={<HomePage />} />
        <Route path="menu" element={<MenuPage />} />
        <Route path="product/:slug" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignUpPage />} />
        <Route path="register" element={<SignUpPage />} />

        {/* Customer Routes (Checkout and Tracking open to Guests as well) */}
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        <Route path="order-tracking/:orderId" element={<OrderTrackingPage />} />
        <Route path="orders/:orderId" element={<OrderTrackingPage />} />
        <Route
          path="orders"
          element={
            <ProtectedRoute>
              <MyOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="feedback"
          element={
            <ProtectedRoute>
              <FeedbackPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="feedback/:orderId"
          element={
            <ProtectedRoute>
              <FeedbackPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
  );
};

export default AppRoutes;

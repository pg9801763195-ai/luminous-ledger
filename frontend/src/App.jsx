import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ShopProvider } from './context/ShopContext';
import ProtectedLayout from './components/ProtectedLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Suppliers from './pages/Suppliers';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Coupons from './pages/Coupons';
import Broadcast from './pages/Broadcast';
import Returns from './pages/Returns';
import SaaSAdmin from './pages/SaaSAdmin';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ShopProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />


          {/* Secured Routes wrapped with custom section permissions */}
          <Route element={<ProtectedLayout requiredPermission="dashboard" />}>
            <Route path="/" element={<Dashboard />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="billing" />}>
            <Route path="/billing" element={<POS />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="returns" />}>
            <Route path="/returns" element={<Returns />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="products" />}>
            <Route path="/products" element={<Products />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="inventory" />}>
            <Route path="/inventory" element={<Inventory />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="customers" />}>
            <Route path="/customers" element={<Customers />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="suppliers" />}>
            <Route path="/suppliers" element={<Suppliers />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="reports" />}>
            <Route path="/reports" element={<Reports />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="coupons" />}>
            <Route path="/coupons" element={<Coupons />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="broadcast" />}>
            <Route path="/broadcast" element={<Broadcast />} />
          </Route>
          <Route element={<ProtectedLayout requiredPermission="settings" />}>
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Super-Admin SaaS Control Panel */}
          <Route element={<ProtectedLayout />}>
            <Route path="/saas-admin" element={<SaaSAdmin />} />
          </Route>

          {/* Fallback Catch-All */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ShopProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;

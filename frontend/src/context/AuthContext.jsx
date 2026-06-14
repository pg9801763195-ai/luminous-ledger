import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalAdminToken, setOriginalAdminToken] = useState(null);
  const [originalAdminUser, setOriginalAdminUser] = useState(null);

  useEffect(() => {
    // No persistent session load on reload
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { token, user } = res.data;
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(user);
        return { success: true, user };
      }
      return { success: false, message: 'Invalid credentials' };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      return { success: false, message };
    }
  };

  const logout = () => {
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setIsImpersonating(false);
    setOriginalAdminToken(null);
    setOriginalAdminUser(null);
  };

  const startImpersonation = (impersonationToken, impersonatedUser) => {
    const authHeader = api.defaults.headers.common['Authorization'];
    const currentToken = authHeader ? authHeader.split(' ')[1] : null;

    setOriginalAdminToken(currentToken);
    setOriginalAdminUser(user);

    api.defaults.headers.common['Authorization'] = `Bearer ${impersonationToken}`;
    setUser(impersonatedUser);
    setIsImpersonating(true);
  };

  const exitImpersonation = () => {
    if (originalAdminToken) {
      api.defaults.headers.common['Authorization'] = `Bearer ${originalAdminToken}`;
      setUser(originalAdminUser);
      setIsImpersonating(false);
      setOriginalAdminToken(null);
      setOriginalAdminUser(null);
    }
  };

  const checkRole = (allowedRoles) => {
    return user && allowedRoles.includes(user.role);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (user.role === 'SuperAdmin') return true; // SuperAdmin has all permissions

    const getDefaultPermissions = (role) => {
      if (role === 'Admin') {
        return [
          'dashboard',
          'billing',
          'returns',
          'products',
          'inventory',
          'coupons',
          'broadcast',
          'customers',
          'suppliers',
          'reports',
          'settings',
        ];
      }
      if (role === 'Manager') {
        return [
          'dashboard',
          'billing',
          'returns',
          'products',
          'inventory',
          'coupons',
          'broadcast',
          'customers',
          'suppliers',
          'reports',
        ];
      }
      return ['dashboard', 'billing', 'returns'];
    };

    const userPermissions = user.permissions && user.permissions.length > 0
      ? user.permissions
      : getDefaultPermissions(user.role);

    return userPermissions.includes(permission);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    checkRole,
    hasPermission,
    isAdmin: user?.role === 'Admin',
    isManager: user?.role === 'Manager' || user?.role === 'Admin',
    isCashier: user?.role === 'Cashier',
    isSuperAdmin: user?.role === 'SuperAdmin',
    isImpersonating,
    startImpersonation,
    exitImpersonation,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

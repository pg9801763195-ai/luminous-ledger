import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const ShopContext = createContext();

export const useShop = () => useContext(ShopContext);

export const ShopProvider = ({ children }) => {
  const { user } = useAuth();
  const [shopProfile, setShopProfile] = useState({
    name: 'Retail Store',
    logo: '',
    gstin: '',
    address: '',
    email: '',
    phone: '',
    receiptBaseUrl: '',
    metaApiEnabled: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchShopProfile = async () => {
    try {
      const res = await api.get('/shop');
      if (res.data.success && res.data.profile) {
        setShopProfile(res.data.profile);
      }
    } catch (error) {
      console.error('Failed to fetch shop profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicShopProfile = async () => {
    try {
      const res = await api.get('/shop/public');
      if (res.data.success && res.data.profile) {
        setShopProfile((prev) => ({
          ...prev,
          name: res.data.profile.name,
          logo: res.data.profile.logo,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch public shop profile:', error);
    }
  };

  useEffect(() => {
    setLoading(true);
    setShopProfile({
      name: 'Retail Store',
      logo: '',
      gstin: '',
      address: '',
      email: '',
      phone: '',
      receiptBaseUrl: '',
      metaApiEnabled: false,
    });

    if (user) {
      fetchShopProfile();
    } else {
      fetchPublicShopProfile().finally(() => setLoading(false));
    }
  }, [user]);

  const updateProfile = async (profileData) => {
    try {
      const res = await api.put('/shop', profileData);
      if (res.data.success && res.data.profile) {
        setShopProfile(res.data.profile);
        return { success: true, profile: res.data.profile };
      }
      return { success: false, message: res.data.message || 'Failed to update profile' };
    } catch (error) {
      console.error('Failed to update shop profile:', error);
      const message = error.response?.data?.message || 'Update failed';
      return { success: false, message };
    }
  };

  const value = {
    shopProfile,
    loading,
    refreshShopProfile: fetchShopProfile,
    updateProfile,
  };

  return (
    <ShopContext.Provider value={value}>
      {children}
    </ShopContext.Provider>
  );
};

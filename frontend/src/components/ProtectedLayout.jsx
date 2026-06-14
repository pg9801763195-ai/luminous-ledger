import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import Sidebar from './Sidebar';
import Header from './Header';

const ProtectedLayout = ({ requiredPermission }) => {
  const { user, loading, hasPermission } = useAuth();
  const { shopProfile } = useShop();

  if (loading) {
    return (
      <div class="min-h-screen flex items-center justify-center bg-[#faf8ff]">
        <div class="flex flex-col items-center gap-md">
          <span class="material-symbols-outlined text-[48px] text-[#0041c8] animate-spin">progress_activity</span>
          <span class="font-bold text-[#0041c8]">Loading {shopProfile?.name || 'Retail Store'}...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div class="min-h-screen bg-[#faf8ff] flex">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Layout */}
      <div class="flex-1 ml-[260px] flex flex-col min-h-screen">
        <Header />
        
        {/* Main Content Canvas */}
        <main class="pt-24 px-margin-edge pb-xl flex-1 flex flex-col space-y-gutter">
          {shopProfile?.announcement && (
            <div class="bg-gradient-to-r from-[#0041c8] to-[#6063ee] text-white px-md py-sm rounded-xl shadow-md flex items-center justify-between gap-md select-none border border-[#0041c8]/20 animate-pulse">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-[24px]">campaign</span>
                <span class="text-xs font-bold leading-normal">SYSTEM ANNOUNCEMENT: {shopProfile.announcement}</span>
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ProtectedLayout;

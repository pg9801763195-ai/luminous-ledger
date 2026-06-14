import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import ShopProfileModal from './ShopProfileModal';
import LuminousLogo from '../assets/luminous_logo.png';

const Sidebar = () => {
  const { user, logout, hasPermission } = useAuth();
  const { shopProfile } = useShop();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      to: '/saas-admin',
      label: 'SaaS Admin',
      icon: 'admin_panel_settings',
      show: user?.role === 'SuperAdmin',
    },
    {
      to: '/',
      label: 'Dashboard',
      icon: 'dashboard',
      show: user?.role !== 'SuperAdmin' && hasPermission('dashboard'),
    },
    {
      to: '/billing',
      label: 'POS Billing',
      icon: 'receipt_long',
      show: user?.role !== 'SuperAdmin' && hasPermission('billing'),
    },
    {
      to: '/returns',
      label: 'Returns & Exchanges',
      icon: 'assignment_return',
      show: user?.role !== 'SuperAdmin' && hasPermission('returns'),
    },
    {
      to: '/products',
      label: 'Products',
      icon: 'list_alt',
      show: user?.role !== 'SuperAdmin' && hasPermission('products'),
    },
    {
      to: '/inventory',
      label: 'Inventory Logs',
      icon: 'inventory_2',
      show: user?.role !== 'SuperAdmin' && hasPermission('inventory'),
    },
    {
      to: '/coupons',
      label: 'Discount Coupons',
      icon: 'redeem',
      show: user?.role !== 'SuperAdmin' && hasPermission('coupons'),
    },
    {
      to: '/broadcast',
      label: 'WA Marketing',
      icon: 'chat',
      show: user?.role !== 'SuperAdmin' && hasPermission('broadcast'),
    },
    {
      to: '/customers',
      label: 'Customers',
      icon: 'group',
      show: user?.role !== 'SuperAdmin' && hasPermission('customers'),
    },
    {
      to: '/suppliers',
      label: 'Suppliers',
      icon: 'local_shipping',
      show: user?.role !== 'SuperAdmin' && hasPermission('suppliers'),
    },
    {
      to: '/reports',
      label: 'Reports & P&L',
      icon: 'analytics',
      show: user?.role !== 'SuperAdmin' && hasPermission('reports'),
    },
    {
      to: '/settings',
      label: 'Settings & Admin',
      icon: 'settings',
      show: user?.role !== 'SuperAdmin' && hasPermission('settings'),
    },
  ];

  return (
    <>
      <aside className="fixed left-0 top-0 h-full w-[260px] z-40 flex flex-col py-xl border-r border-white/20 dark:border-white/5 sidebar-glass shadow-xl select-none">
        <div className="px-xl mb-xl flex flex-col items-center text-center gap-sm">
          {user?.role === 'SuperAdmin' ? (
            <img 
              src={LuminousLogo} 
              alt="SaaS Platform" 
              className="w-20 h-20 object-contain rounded-full shadow-md bg-white p-1" 
            />
          ) : shopProfile.logo ? (
            <img 
              src={shopProfile.logo} 
              alt="Logo" 
              className="w-20 h-20 object-contain rounded-full shadow-md bg-white p-1 cursor-pointer hover:scale-105 transition-transform duration-200" 
              onClick={() => setIsModalOpen(true)}
              title="Configure Shop Profile"
            />
          ) : (
            <div 
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#0041c8]/20 to-[#6063ee]/20 text-[#0041c8] border border-[#c3c5d9] flex items-center justify-center font-bold shadow-md cursor-pointer hover:scale-105 transition-transform duration-200 select-none"
              onClick={() => setIsModalOpen(true)}
              title="Configure Shop Profile"
            >
              <span className="text-[28px]">
                {shopProfile.name ? shopProfile.name.charAt(0).toUpperCase() : 'S'}
              </span>
            </div>
          )}
          <h1 
            className="font-headline-md text-[18px] text-[#0041c8] font-bold tracking-tight leading-tight cursor-pointer hover:text-[#6063ee] transition-colors"
            onClick={() => { if (user?.role !== 'SuperAdmin') setIsModalOpen(true); }}
            title={user?.role === 'SuperAdmin' ? 'SaaS Platform' : 'Configure Shop Profile'}
          >
            {user?.role === 'SuperAdmin' ? 'Luminous SaaS' : shopProfile.name}
          </h1>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-md px-lg py-md transition-all active:translate-x-1 duration-200 ${
                    isActive
                      ? 'bg-[#6063ee]/10 text-[#0041c8] border-l-4 border-[#0041c8] font-semibold'
                      : 'text-[#434656] hover:bg-[#dae2fd]/40'
                  }`
                }
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-body-md">{item.label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="mt-auto px-lg pt-xl border-t border-[#c3c5d9]/30">
          <div className="flex items-center justify-between p-md rounded-xl bg-white/40">
            <div className="flex items-center gap-md overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-[#0041c8]/10 text-[#0041c8] flex items-center justify-center font-bold shrink-0">
                {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="font-body-md font-bold text-[#131b2e] truncate">{user?.name}</p>
                <p className="text-label-sm text-[#434656] font-mono">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Log Out"
              className="p-sm text-[#434656] hover:text-[#ba1a1a] hover:bg-red-50 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <ShopProfileModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
};

export default Sidebar;

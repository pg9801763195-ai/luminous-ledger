import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';

const Header = () => {
  const { isImpersonating, exitImpersonation, user } = useAuth();
  const { shopProfile } = useShop();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Unified global search fetching with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setShowDropdown(false);
      setSelectedIndex(-1);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setShowDropdown(true);
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.data.success) {
          setSearchResults(res.data.results);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Error fetching search results:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Click outside to close dropdown listener
  useEffect(() => {
    const handleOutsideClick = (e) => {
      const container = document.getElementById('global-search-container');
      if (container && !container.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const getFlatItems = () => {
    if (!searchResults) return [];
    const items = [];
    
    if (searchResults.pages && searchResults.pages.length > 0) {
      searchResults.pages.forEach(p => items.push({ type: 'page', data: p }));
    }
    if (searchResults.products && searchResults.products.length > 0) {
      searchResults.products.forEach(p => items.push({ type: 'product', data: p }));
    }
    if (searchResults.customers && searchResults.customers.length > 0) {
      searchResults.customers.forEach(c => items.push({ type: 'customer', data: c }));
    }
    if (searchResults.tenants && searchResults.tenants.length > 0) {
      searchResults.tenants.forEach(t => items.push({ type: 'tenant', data: t }));
    }
    
    return items;
  };

  const handleKeyDown = (e) => {
    const flatItems = getFlatItems();
    if (!flatItems.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
      if (flatItems[activeIndex]) {
        handleItemClick(flatItems[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setSearchResults(null);
      setShowDropdown(false);
    }
  };

  const handleItemClick = (item) => {
    setSearchQuery('');
    setSearchResults(null);
    setShowDropdown(false);
    
    if (item.type === 'page') {
      navigate(item.data.path);
    } else if (item.type === 'product') {
      window.location.href = `/products?search=${encodeURIComponent(item.data.sku)}`;
    } else if (item.type === 'customer') {
      window.location.href = `/customers?search=${encodeURIComponent(item.data.phone || item.data.name)}`;
    } else if (item.type === 'tenant') {
      window.location.href = `/saas-admin?search=${encodeURIComponent(item.data.slug)}`;
    }
  };

  // Fetch notifications from the backend
  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.notifications);
      }
    } catch (error) {
      console.error('Error fetching notifications', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for notifications every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = async () => {
    try {
      const res = await api.put('/notifications/read-all');
      if (res.data.success) {
        setNotifications([]);
        setShowNotifications(false);
      }
    } catch (error) {
      console.error('Error marking notifications as read', error);
    }
  };

  const markSingleRead = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await api.put(`/notifications/${id}/read`);
      if (res.data.success) {
        setNotifications(notifications.filter((n) => n._id !== id));
      }
    } catch (error) {
      console.error('Error marking notification as read', error);
    }
  };

  return (
    <>
      {isImpersonating && (
        <div class="fixed top-0 left-[260px] right-0 z-50 bg-[#ba1a1a] text-white text-center py-2 text-sm font-bold flex items-center justify-center gap-md select-none border-b border-[#ffdad6]/20">
          <span>⚠️ You are currently impersonating {shopProfile?.name} - {user?.name} ({user?.email})</span>
          <button
            onClick={exitImpersonation}
            class="px-sm py-0.5 bg-white text-[#ba1a1a] hover:bg-red-50 rounded text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            Exit Impersonation
          </button>
        </div>
      )}
      <header class={`fixed left-[260px] right-0 z-40 h-16 bg-white/70 backdrop-blur-xl border-b border-white/40 shadow-sm flex items-center justify-between px-margin-edge select-none ${isImpersonating ? 'top-9' : 'top-0'}`}>
        {/* Search Input Bar */}
        <div id="global-search-container" class="flex items-center flex-1 max-w-xl">
          <div class="relative w-full group">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#434656] group-focus-within:text-[#0041c8] transition-colors">search</span>
            <input
              type="text"
              placeholder="System-wide navigation (Type SKU, customers, or reports)..."
              class="w-full pl-10 pr-4 py-2 bg-white/50 border border-[#c3c5d9]/60 rounded-lg focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] transition-all font-body-md outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (searchQuery.trim()) setShowDropdown(true);
              }}
            />

            {showDropdown && (
              <div class="absolute top-full left-0 right-0 mt-2 bg-white border border-[#c3c5d9] rounded-xl shadow-xl z-50 overflow-hidden max-h-[400px] flex flex-col">
                <div class="overflow-y-auto flex-1 custom-scrollbar p-sm divide-y divide-[#c3c5d9]/10">
                  {searchLoading && (
                    <div class="p-md text-center text-[#737688] flex items-center justify-center gap-sm text-xs select-none">
                      <span class="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                      Searching platform records...
                    </div>
                  )}

                  {!searchLoading && (!searchResults || getFlatItems().length === 0) && (
                    <div class="p-md text-center text-[#737688] text-xs select-none">
                      No matching products, customers, or page shortcuts found.
                    </div>
                  )}

                  {!searchLoading && searchResults && (
                    <>
                      {/* Pages section */}
                      {searchResults.pages && searchResults.pages.length > 0 && (
                        <div class="py-xs">
                          <span class="text-[10px] uppercase font-bold text-[#737688] px-md block py-1 tracking-wider select-none">Pages & Navigation</span>
                          {searchResults.pages.map((p) => {
                            const flatIdx = getFlatItems().findIndex(item => item.type === 'page' && item.data.path === p.path);
                            const active = selectedIndex === flatIdx;
                            return (
                              <div
                                key={p.path}
                                onClick={() => handleItemClick({ type: 'page', data: p })}
                                onMouseEnter={() => setSelectedIndex(flatIdx)}
                                class={`px-md py-sm rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                                  active ? 'bg-[#0041c8]/10 text-[#0041c8]' : 'hover:bg-[#0041c8]/5 text-[#131b2e]'
                                }`}
                              >
                                <div class="flex items-center gap-sm">
                                  <span class="material-symbols-outlined text-[18px]">navigation</span>
                                  <span class="text-xs font-semibold">{p.name}</span>
                                </div>
                                <span class="text-[10px] font-mono text-[#737688]">{p.path}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Products section */}
                      {searchResults.products && searchResults.products.length > 0 && (
                        <div class="py-xs">
                          <span class="text-[10px] uppercase font-bold text-[#737688] px-md block py-1 tracking-wider select-none">Products Catalog</span>
                          {searchResults.products.map((p) => {
                            const flatIdx = getFlatItems().findIndex(item => item.type === 'product' && item.data._id === p._id);
                            const active = selectedIndex === flatIdx;
                            return (
                              <div
                                key={p._id}
                                onClick={() => handleItemClick({ type: 'product', data: p })}
                                onMouseEnter={() => setSelectedIndex(flatIdx)}
                                class={`px-md py-sm rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                                  active ? 'bg-[#0041c8]/10 text-[#0041c8]' : 'hover:bg-[#0041c8]/5 text-[#131b2e]'
                                }`}
                              >
                                <div class="flex items-center gap-sm">
                                  <span class="material-symbols-outlined text-[18px]">inventory</span>
                                  <div class="text-left">
                                    <span class="text-xs font-semibold block leading-tight">{p.name}</span>
                                    <span class="text-[10px] font-mono text-[#737688] block">SKU: {p.sku}</span>
                                  </div>
                                </div>
                                <div class="text-right">
                                  <span class="text-xs font-bold text-[#131b2e] block">₹{((p.price || 0) * (1 + (p.taxRate || 18) / 100)).toFixed(2)}</span>
                                  <span class="text-[10px] text-[#737688] block">{p.stock} left</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Customers section */}
                      {searchResults.customers && searchResults.customers.length > 0 && (
                        <div class="py-xs">
                          <span class="text-[10px] uppercase font-bold text-[#737688] px-md block py-1 tracking-wider select-none">Customers Register</span>
                          {searchResults.customers.map((c) => {
                            const flatIdx = getFlatItems().findIndex(item => item.type === 'customer' && item.data._id === c._id);
                            const active = selectedIndex === flatIdx;
                            return (
                              <div
                                key={c._id}
                                onClick={() => handleItemClick({ type: 'customer', data: c })}
                                onMouseEnter={() => setSelectedIndex(flatIdx)}
                                class={`px-md py-sm rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                                  active ? 'bg-[#0041c8]/10 text-[#0041c8]' : 'hover:bg-[#0041c8]/5 text-[#131b2e]'
                                }`}
                              >
                                <div class="flex items-center gap-sm">
                                  <span class="material-symbols-outlined text-[18px]">person</span>
                                  <div class="text-left">
                                    <span class="text-xs font-semibold block leading-tight">{c.name}</span>
                                    <span class="text-[10px] font-mono text-[#737688] block">{c.phone || c.email || 'No contact'}</span>
                                  </div>
                                </div>
                                <span class="px-sm py-0.5 bg-[#6ffbbe]/25 text-[#005c3e] rounded-full text-[10px] font-mono font-bold">
                                  {c.loyaltyPoints || 0} pts
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Tenants section (SuperAdmin only) */}
                      {searchResults.tenants && searchResults.tenants.length > 0 && (
                        <div class="py-xs">
                          <span class="text-[10px] uppercase font-bold text-[#737688] px-md block py-1 tracking-wider select-none">Store Tenants</span>
                          {searchResults.tenants.map((t) => {
                            const flatIdx = getFlatItems().findIndex(item => item.type === 'tenant' && item.data._id === t._id);
                            const active = selectedIndex === flatIdx;
                            return (
                              <div
                                key={t._id}
                                onClick={() => handleItemClick({ type: 'tenant', data: t })}
                                onMouseEnter={() => setSelectedIndex(flatIdx)}
                                class={`px-md py-sm rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                                  active ? 'bg-[#0041c8]/10 text-[#0041c8]' : 'hover:bg-[#0041c8]/5 text-[#131b2e]'
                                }`}
                              >
                                <div class="flex items-center gap-sm">
                                  <span class="material-symbols-outlined text-[18px]">store</span>
                                  <div class="text-left">
                                    <span class="text-xs font-semibold block leading-tight">{t.name}</span>
                                    <span class="text-[10px] font-mono text-[#737688] block">Slug: {t.slug}</span>
                                  </div>
                                </div>
                                <span class={`px-sm py-0.5 rounded-full text-[10px] font-bold ${
                                  t.status === 'Active' ? 'bg-[#83ffc6]/20 text-[#005c3e]' : 'bg-[#ffdad6] text-[#ba1a1a]'
                                }`}>
                                  {t.status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div class="flex items-center gap-lg">
          {/* Notifications Icon and Dropdown */}
          <div class="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              class="relative p-2 text-[#434656] hover:bg-[#0041c8]/5 rounded-full transition-colors active:scale-95 duration-150 ease-in-out"
            >
              <span class="material-symbols-outlined">notifications</span>
              {notifications.length > 0 && (
                <span class="absolute top-2 right-2 w-2.5 h-2.5 bg-[#ba1a1a] rounded-full border border-white animate-pulse"></span>
              )}
            </button>

            {showNotifications && (
              <div class="absolute right-0 mt-2 w-80 bg-white border border-[#c3c5d9] rounded-xl shadow-xl z-50 overflow-hidden max-h-[400px] flex flex-col">
                <div class="p-md border-b border-[#c3c5d9]/30 flex items-center justify-between">
                  <span class="font-bold text-[#131b2e] font-body-md">Alerts & Notifications ({notifications.length})</span>
                  {notifications.length > 0 && (
                    <button
                      onClick={markAllRead}
                      class="text-xs font-bold text-[#0041c8] hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div class="overflow-y-auto flex-1 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div class="p-xl text-center text-[#434656] text-label-sm">
                      No active warnings or stock alerts!
                    </div>
                  ) : (
                    <div class="divide-y divide-[#c3c5d9]/20">
                      {notifications.map((notif) => (
                        <div
                          key={notif._id}
                          class="p-md hover:bg-[#0041c8]/5 transition-colors flex items-start gap-sm relative group"
                        >
                          <span class={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${
                            notif.type === 'Low Stock' ? 'text-[#ba1a1a]' : 'text-[#0041c8]'
                          }`}>
                            {notif.type === 'Low Stock' ? 'warning' : 'info'}
                          </span>
                          <div class="flex-1">
                            <p class="text-xs text-[#131b2e] font-medium leading-relaxed">{notif.message}</p>
                            <span class="text-[10px] text-[#737688] font-mono block mt-1">
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <button
                            onClick={(e) => markSingleRead(notif._id, e)}
                            title="Mark read"
                            class="opacity-0 group-hover:opacity-100 p-1 text-[#737688] hover:text-[#0041c8] rounded transition-all shrink-0"
                          >
                            <span class="material-symbols-outlined text-[16px]">check</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div class="h-8 w-[1px] bg-[#c3c5d9]/30"></div>
          <div class="flex items-center gap-sm p-1 rounded-lg">
            <span class="text-label-sm font-bold text-[#0041c8]">v2.4.0</span>
            <span class="material-symbols-outlined text-[#0041c8] text-[18px]">verified</span>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;

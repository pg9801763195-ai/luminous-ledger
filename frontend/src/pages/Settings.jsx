import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import ShopProfileModal from '../components/ShopProfileModal';

const Settings = () => {
  const { user: currentUser, isManager } = useAuth();
  const { shopProfile } = useShop();
  const [isShopModalOpen, setIsShopModalOpen] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [targetUpgradePlan, setTargetUpgradePlan] = useState('Premium');
  
  // Staff list states
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  
  // Staff Form Modal states
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editStaffId, setEditStaffId] = useState(null);
  const [staffFormData, setStaffFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Cashier',
    active: true,
    permissions: ['dashboard', 'billing', 'returns'],
  });
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Activity logs states
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logSearch, setLogSearch] = useState('');
  const [logAction, setLogAction] = useState('');

  // Legal & compliance modal states
  const [legalModal, setLegalModal] = useState({ show: false, title: '', content: '' });
  const openLegalModal = (title, content) => {
    setLegalModal({ show: true, title, content });
  };

  const fetchStaff = async () => {
    try {
      setStaffLoading(true);
      const res = await api.get('/auth/staff');
      if (res.data.success) {
        setStaffList(res.data.staff);
      }
    } catch (error) {
      console.error('Error fetching staff list', error);
    } finally {
      setStaffLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await api.get(
        `/activities?page=${logPage}&search=${logSearch}&action=${logAction}`
      );
      if (res.data.success) {
        setLogs(res.data.logs);
        setLogTotalPages(res.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error loading audit log activity', error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [logPage, logAction]);

  const handleLogSearchSubmit = (e) => {
    e.preventDefault();
    setLogPage(1);
    fetchLogs();
  };

  const nonAdminStaffCount = staffList.filter(s => s.role !== 'Admin').length;
  const staffLimit = shopProfile.plan === 'Basic' ? 3 : (shopProfile.plan === 'Premium' ? 5 : Infinity);

  const handleOpenCreateStaff = () => {
    if (nonAdminStaffCount >= staffLimit) {
      alert(`You have reached the maximum limit of ${staffLimit} staff accounts for your ${shopProfile.plan} subscription plan. Please upgrade your plan.`);
      return;
    }
    setEditStaffId(null);
    setStaffFormData({
      name: '',
      email: '',
      password: '',
      role: 'Cashier',
      active: true,
      permissions: ['dashboard', 'billing', 'returns'],
    });
    setShowStaffPassword(false);
    setShowStaffModal(true);
  };

  const handleOpenEditStaff = (staff) => {
    setEditStaffId(staff._id);
    setStaffFormData({
      name: staff.name,
      email: staff.email,
      password: '', // Leave blank to avoid showing hash
      role: staff.role,
      active: staff.active,
      permissions: staff.permissions || [],
    });
    setShowStaffPassword(false);
    setShowStaffModal(true);
  };

  const handleStaffFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editStaffId) {
        // Update user
        const { password, ...updateData } = staffFormData;
        const existingStaff = staffList.find(s => s._id === editStaffId);
        if (existingStaff && existingStaff.role === 'Admin' && staffFormData.role !== 'Admin') {
          if (nonAdminStaffCount >= staffLimit) {
            alert(`You have reached the maximum limit of ${staffLimit} staff accounts for your ${shopProfile.plan} subscription plan. Please upgrade your plan.`);
            return;
          }
        }
        // Only include password if Admin wrote something to reset password
        if (password) {
          updateData.password = password;
        }
        const res = await api.put(`/auth/staff/${editStaffId}`, updateData);
        if (res.data.success) {
          setShowStaffModal(false);
          fetchStaff();
        }
      } else {
        // Create user
        if (staffFormData.role !== 'Admin' && nonAdminStaffCount >= staffLimit) {
          alert(`You have reached the maximum limit of ${staffLimit} staff accounts for your ${shopProfile.plan} subscription plan. Please upgrade your plan.`);
          return;
        }
        if (!staffFormData.password) {
          alert('Password is required for new accounts');
          return;
        }
        const res = await api.post('/auth/staff', staffFormData);
        if (res.data.success) {
          setShowStaffModal(false);
          fetchStaff();
        }
      }
    } catch (error) {
      console.error('Error saving staff credentials', error);
      alert(error.response?.data?.message || 'Failed to save staff credentials');
    }
  };

  const handleDeleteStaff = async (id, name) => {
    if (id === currentUser.id) {
      alert('You cannot delete your own active administrator profile!');
      return;
    }

    if (window.confirm(`Are you sure you want to permanently delete credentials for "${name}"?`)) {
      try {
        const res = await api.delete(`/auth/staff/${id}`);
        if (res.data.success) {
          fetchStaff();
        }
      } catch (error) {
        console.error('Error deleting staff account', error);
        alert(error.response?.data?.message || 'Failed to delete staff member');
      }
    }
  };

  return (
    <div class="space-y-gutter flex-grow flex flex-col select-none">
      {/* Title Header */}
      <div>
        <h2 class="font-headline-lg text-headline-lg text-[#131b2e]">Settings &amp; Administration</h2>
        <p class="font-body-md text-[#434656] mt-1">Configure staff account credentials, access roles, and audit security events.</p>
      </div>

      {/* Subscription Plans & Feature Tiers Comparison */}
      <div className="glass-panel rounded-xl p-lg flex flex-col shadow-sm gap-md">
        <div className="flex items-center justify-between border-b border-[#c3c5d9]/40 pb-md mb-xs">
          <h4 className="font-bold text-body-lg flex items-center gap-sm">
            <span className="material-symbols-outlined text-[#0041c8]">workspace_premium</span>
            Platform Subscription Tiers & Plans
          </h4>
          <div className="flex items-center gap-sm">
            <span className="text-xs font-bold text-[#434656] uppercase">Current Active Tier:</span>
            <span className={`px-sm py-1 font-mono text-xs font-bold rounded-full ${
              shopProfile.plan === 'Enterprise' 
                ? 'bg-amber-100 border border-amber-300 text-amber-800' 
                : shopProfile.plan === 'Premium' 
                  ? 'bg-blue-100 border border-blue-300 text-blue-800' 
                  : 'bg-gray-100 border border-gray-300 text-gray-800'
            }`}>
              {shopProfile.plan || 'Basic'} Tier
            </span>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-lg mt-xs">
          
          {/* Premium Plan Card */}
          <div className="premium-card-silver rounded-2xl p-xl flex flex-col justify-between shadow-lg relative min-h-[300px] border border-slate-300/40">
            {/* Ambient inner styling */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-200 to-transparent opacity-50 rounded-bl-full pointer-events-none" />
            
            <div className="space-y-md relative z-10">
              <div className="flex justify-between items-center">
                <span className="bg-slate-200/80 border border-slate-400/30 text-slate-700 font-mono text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  Premium Level
                </span>
                {shopProfile.plan === 'Premium' && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/80 border border-emerald-300 px-2.5 py-1 rounded-full animate-pulse">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Active Plan
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-slate-800 font-extrabold">Premium Plan</h3>
                <p className="text-xs text-slate-600 mt-1">Accelerate business scaling with marketing automations & expanded teams.</p>
              </div>
              <ul className="space-y-sm text-xs text-slate-700 font-medium">
                <li className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-slate-600 text-[16px] mt-0.5">check_circle</span>
                  <span>WhatsApp Broadcast Marketing (Sandbox/API activation)</span>
                </li>
                <li className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-slate-600 text-[16px] mt-0.5">check_circle</span>
                  <span>Up to 5 staff account credentials (excluding Admin)</span>
                </li>
                <li className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-slate-600 text-[16px] mt-0.5">check_circle</span>
                  <span>Priority email & business hours support</span>
                </li>
              </ul>
            </div>

            <div className="mt-lg pt-md border-t border-slate-300/30 relative z-10">
              {shopProfile.plan === 'Basic' ? (
                <button
                  type="button"
                  onClick={() => {
                    setTargetUpgradePlan('Premium');
                    setShowPlanModal(true);
                  }}
                  className="w-full h-10 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_circle_up</span>
                  Upgrade to Premium
                </button>
              ) : shopProfile.plan === 'Premium' ? (
                <div className="h-10 border border-emerald-300/50 bg-emerald-50/50 rounded-lg text-xs font-bold text-emerald-800 flex items-center justify-center gap-xs">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  Currently Active Tier
                </div>
              ) : (
                <div className="h-10 border border-slate-300/50 bg-slate-100/50 rounded-lg text-xs font-bold text-slate-600 flex items-center justify-center gap-xs">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  Included in your Enterprise tier
                </div>
              )}
            </div>
          </div>

          {/* Enterprise Plan Card */}
          <div className="premium-card-gold rounded-2xl p-xl flex flex-col justify-between shadow-lg relative min-h-[300px] border border-amber-300/40">
            {/* Ambient inner styling */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-amber-200 to-transparent pointer-events-none opacity-50 rounded-bl-full" />

            <div className="space-y-md relative z-10">
              <div className="flex justify-between items-center">
                <span className="bg-amber-200/80 border border-amber-400/30 text-amber-800 font-mono text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  Enterprise Level
                </span>
                {shopProfile.plan === 'Enterprise' && (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-full animate-pulse">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Active Plan
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-amber-950 font-extrabold">Enterprise Plan</h3>
                <p className="text-xs text-amber-900 mt-1">Complete system autonomy with unlimited staff and custom brand customization.</p>
              </div>
              <ul className="space-y-sm text-xs text-amber-950 font-medium">
                <li className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-amber-700 text-[16px] mt-0.5">check_circle</span>
                  <span>Production WhatsApp Gateway activation (unlimited scale)</span>
                </li>
                <li className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-amber-700 text-[16px] mt-0.5">check_circle</span>
                  <span>UNLIMITED staff account credentials (no limits)</span>
                </li>
                <li className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-amber-700 text-[16px] mt-0.5">check_circle</span>
                  <span>Custom subdomain mappings & branding white-labeling</span>
                </li>
                <li className="flex items-start gap-sm">
                  <span className="material-symbols-outlined text-amber-700 text-[16px] mt-0.5">check_circle</span>
                  <span>24/7 dedicated system support & priority SLAs</span>
                </li>
              </ul>
            </div>

            <div className="mt-lg pt-md border-t border-amber-300/30 relative z-10">
              {shopProfile.plan !== 'Enterprise' ? (
                <button
                  type="button"
                  onClick={() => {
                    setTargetUpgradePlan('Enterprise');
                    setShowPlanModal(true);
                  }}
                  className="w-full h-10 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-xs cursor-pointer border border-amber-600"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_circle_up</span>
                  Request Enterprise Upgrade
                </button>
              ) : (
                <div className="h-10 border border-amber-300 bg-amber-100/60 rounded-lg text-xs font-bold text-amber-900 flex items-center justify-center gap-xs">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  Currently Active Tier
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
        {/* Left Column: Store Profile & Staff Accounts */}
        <div className="flex flex-col gap-gutter">
          
          {/* Store Profile Card */}
          <div className="glass-panel rounded-xl p-lg flex flex-col shadow-sm gap-md">
            <div className="flex items-center justify-between border-b border-[#c3c5d9]/40 pb-md mb-xs">
              <h4 className="font-bold text-body-lg flex items-center gap-sm">
                <span className="material-symbols-outlined text-[#0041c8]">store</span>
                Store Profile
              </h4>
              {isManager && (
                <button
                  onClick={() => setIsShopModalOpen(true)}
                  className="h-8 px-sm bg-[#0041c8] text-white hover:opacity-90 rounded text-xs font-semibold flex items-center gap-xs animate-click"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  Edit
                </button>
              )}
            </div>

            <div className="flex flex-col items-center gap-md py-sm">
              {shopProfile.logo ? (
                <img 
                  src={shopProfile.logo} 
                  alt="Store Logo" 
                  className="w-24 h-24 rounded-full object-contain bg-white border border-[#c3c5d9] p-1 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#0041c8]/20 to-[#6063ee]/20 text-[#0041c8] border border-[#c3c5d9] flex items-center justify-center font-bold shadow-md select-none">
                  <span className="text-[32px]">
                    {shopProfile.name ? shopProfile.name.charAt(0).toUpperCase() : 'S'}
                  </span>
                </div>
              )}
              <div className="text-center">
                <h5 className="font-bold text-[#131b2e] text-headline-sm leading-tight">{shopProfile.name}</h5>
                <p className="text-xs text-[#737688] font-mono mt-1">GSTIN: {shopProfile.gstin || 'N/A'}</p>
              </div>
            </div>

            <div className="space-y-sm text-xs border-t border-[#c3c5d9]/20 pt-md">
              <div className="flex justify-between">
                <span className="font-bold text-[#434656]">Email:</span>
                <span className="text-[#131b2e] font-medium">{shopProfile.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-[#434656]">Phone:</span>
                <span className="text-[#131b2e] font-medium">{shopProfile.phone || 'N/A'}</span>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="font-bold text-[#434656]">Address:</span>
                <span className="text-[#131b2e] leading-relaxed font-medium bg-[#faf8ff] p-xs rounded border border-[#c3c5d9]/20">{shopProfile.address || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Staff User Management Card (1 column) */}
          <div className="glass-panel rounded-xl p-lg flex flex-col shadow-sm gap-md">
            <div className="flex items-center justify-between border-b border-[#c3c5d9]/40 pb-md mb-xs">
              <h4 className="font-bold text-body-lg flex flex-col text-left">
                <span className="flex items-center gap-sm">
                  <span className="material-symbols-outlined text-[#0041c8]">manage_accounts</span>
                  Staff Accounts
                </span>
                {shopProfile.plan && (
                  <span className="text-[11px] font-normal text-[#737688] mt-1">
                    Used {nonAdminStaffCount} of {staffLimit === Infinity ? '∞' : staffLimit} limit ({shopProfile.plan})
                  </span>
                )}
              </h4>
              <button
                onClick={handleOpenCreateStaff}
                disabled={nonAdminStaffCount >= staffLimit}
                className={`h-8 px-sm bg-[#0041c8] text-white hover:opacity-90 rounded text-xs font-semibold flex items-center gap-xs animate-click ${
                  nonAdminStaffCount >= staffLimit ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Create
              </button>
            </div>

            <div className="space-y-md max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
              {staffLoading ? (
                <div className="py-lg text-center">
                  <span className="material-symbols-outlined text-[28px] text-[#0041c8] animate-spin">progress_activity</span>
                </div>
              ) : staffList.length === 0 ? (
                <div className="py-lg text-center text-[#737688] text-xs">No staff registered.</div>
              ) : (
                staffList.map((staff) => (
                  <div key={staff._id} className="p-md rounded-xl border border-[#c3c5d9]/30 bg-white/40 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-sm">
                        <h6 className="font-bold text-[#131b2e] text-sm">{staff.name}</h6>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          staff.active ? 'bg-[#83ffc6]/20 text-[#005c3e]' : 'bg-[#ffdad6] text-[#ba1a1a]'
                        }`}>
                          {staff.active ? 'Active' : 'Deactivated'}
                        </span>
                      </div>
                      <span className="text-xs text-[#737688] font-mono block mt-1">{staff.email}</span>
                      <span className="text-[10px] uppercase font-bold text-[#0041c8] font-mono block mt-1">{staff.role}</span>
                    </div>

                    <div className="flex gap-xs">
                      <button
                        onClick={() => handleOpenEditStaff(staff)}
                        className="p-1 hover:bg-[#0041c8]/5 rounded text-[#0041c8] transition-colors"
                        title="Edit Account Details"
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                      {staff._id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteStaff(staff._id, staff.name)}
                          className="p-1 hover:bg-red-50 rounded text-[#ba1a1a] transition-colors"
                          title="Delete Profile"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Security Audit Log Table (2 columns on lg) */}
        <div class="lg:col-span-2 flex flex-col space-y-md">
          {/* Filters header panel */}
          <div class="glass-panel p-md rounded-xl flex flex-wrap items-center justify-between gap-md">
            <form onSubmit={handleLogSearchSubmit} class="flex items-center gap-sm flex-grow max-w-sm">
              <input
                type="text"
                placeholder="Search audit details or IP address..."
                class="flex-grow h-9 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] text-xs"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
              <button
                type="submit"
                class="px-md h-9 bg-[#0041c8] text-white rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 animate-click"
              >
                Find
              </button>
            </form>

            <select
              class="h-9 px-3 border border-[#c3c5d9] bg-white rounded-lg text-xs outline-none cursor-pointer focus:border-[#0041c8]"
              value={logAction}
              onChange={(e) => {
                setLogAction(e.target.value);
                setLogPage(1);
              }}
            >
              <option value="">All Security Events</option>
              <option value="LOGIN">LOGIN</option>
              <option value="CREATE_PRODUCT">CREATE_PRODUCT</option>
              <option value="UPDATE_PRODUCT">UPDATE_PRODUCT</option>
              <option value="ADJUST_STOCK">ADJUST_STOCK</option>
              <option value="GENERATE_INVOICE">GENERATE_INVOICE</option>
              <option value="REFUND_INVOICE">REFUND_INVOICE</option>
              <option value="CREATE_STAFF">CREATE_STAFF</option>
              <option value="UPDATE_STAFF">UPDATE_STAFF</option>
              <option value="DELETE_STAFF">DELETE_STAFF</option>
            </select>
          </div>

          {/* Audit Logs list */}
          <div class="glass-panel rounded-xl overflow-hidden shadow-sm flex flex-col justify-between min-h-[440px]">
            <div class="overflow-x-auto flex-grow">
              <table class="w-full text-left text-sm">
                <thead class="bg-[#f2f3ff]/50 sticky top-0 backdrop-blur-md">
                  <tr>
                    <th class="p-3 text-xs font-bold text-[#434656]">User Account</th>
                    <th class="p-3 text-xs font-bold text-[#434656]">Event Action</th>
                    <th class="p-3 text-xs font-bold text-[#434656]">Security details</th>
                    <th class="p-3 text-xs font-bold text-[#434656]">IP Address</th>
                    <th class="p-3 text-xs font-bold text-[#434656]">Timestamp</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-[#c3c5d9]/20 font-body-md">
                  {logsLoading ? (
                    <tr>
                      <td colspan="5" class="text-center py-xl">
                        <span class="material-symbols-outlined text-[32px] text-[#0041c8] animate-spin">progress_activity</span>
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colspan="5" class="p-4 text-center text-[#737688]">No activity log tracks found</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log._id} class="hover:bg-[#0041c8]/5 transition-colors">
                        <td class="p-3">
                          <div class="font-bold text-[#131b2e]">{log.user ? log.user.name : 'Unknown User'}</div>
                          <span class="text-[10px] text-[#737688] font-mono">{log.user ? log.user.email : 'N/A'}</span>
                        </td>
                        <td class="p-3">
                          <span class="bg-[#eaedff] text-[#0041c8] font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                            {log.action}
                          </span>
                        </td>
                        <td class="p-3 text-xs text-[#434656] max-w-[200px] truncate" title={log.details}>
                          {log.details}
                        </td>
                        <td class="p-3 font-mono text-xs text-[#737688]">{log.ipAddress || '127.0.0.1'}</td>
                        <td class="p-3 font-mono text-xs text-[#737688]">
                          {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination logs footer */}
            {logTotalPages > 1 && (
              <div class="px-lg py-md bg-white/30 flex items-center justify-between border-t border-[#c3c5d9]/30">
                <p class="text-label-sm text-[#434656]">Showing page {logPage} of {logTotalPages}</p>
                <div class="flex gap-sm">
                  <button
                    onClick={() => setLogPage(Math.max(1, logPage - 1))}
                    disabled={logPage === 1}
                    class="p-2 rounded-lg border border-[#c3c5d9] hover:bg-[#eaedff] transition-colors disabled:opacity-30"
                  >
                    <span class="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button
                    onClick={() => setLogPage(Math.min(logTotalPages, logPage + 1))}
                    disabled={logPage === logTotalPages}
                    class="p-2 rounded-lg border border-[#c3c5d9] hover:bg-[#eaedff] transition-colors disabled:opacity-30"
                  >
                    <span class="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Legal & Compliance Disclosures */}
      <div className="glass-panel rounded-xl p-md flex flex-col md:flex-row items-center justify-between text-xs text-[#737688] mt-lg gap-sm border border-[#c3c5d9]/30 bg-white/40">
        <span className="flex items-center gap-xs">
          <span className="material-symbols-outlined text-[16px] text-[#737688]">verified_user</span>
          Luminous Ledger Legal Shield. Under commercial terms of service.
        </span>
        <div className="flex gap-md font-semibold text-[#0041c8]">
          <button 
            type="button"
            onClick={() => openLegalModal("Terms of Service", "Welcome to Luminous Ledger. By accessing or using our SaaS platform, you agree to these terms:\n\n1. Commercial Usage Only: This platform is designed solely for retail management and billing. You agree to use it only for legitimate business operations.\n2. Security Obligations: You are responsible for keeping your login credentials confidential. Sharing of accounts is prohibited.\n3. Prohibited Conduct: You agree not to perform reverse engineering, vulnerability scanning, security probing, or spamming of any API endpoints.\n4. Limitation of Liability: We do not guarantee uninterrupted system access. Under no circumstances shall Luminous Ledger be liable for calculations discrepancies, tax calculation errors, retail data loss, or server downtime. Rate limit locks do not constitute a breach of service.")} 
            className="hover:underline hover:text-[#0031a0]"
          >
            Terms of Service
          </button>
          <span>•</span>
          <button 
            type="button"
            onClick={() => openLegalModal("Privacy Policy", "This Privacy Policy discloses the operational data practices of Luminous Ledger:\n\n1. Data Points Collected:\n• Work Emails & Hashed Passwords for staff authentication.\n• Full Names of staff users for audit logs.\n• Shop Profiles (Subdomain, Shop Name, GSTIN, Address, Phone, Logo).\n• Transaction & Billing records (Invoices, payment categories, quantities, amounts, dates).\n• Security & Access Logs (IP addresses logged for rate-limiting protection and administrative audit trails).\n\n2. Usage: All collected data is used exclusively to facilitate retail POS operations and secure the platform. We do not sell or monetize your store metrics.\n3. Security & Compliance: Passwords are encrypted using bcrypt hashing prior to database storage.")} 
            className="hover:underline hover:text-[#0031a0]"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button 
            type="button"
            onClick={() => openLegalModal("Compliance & Data Disclosures", "Luminous Ledger Data Declaration:\n\n1. Active Data Declarations:\n• Geolocation: The platform does not track active geolocation data of users.\n• Photos & Media: Only shop logo image uploads are accepted; no other photo access is requested.\n• System Auditing: Administrative operations (creating products, registering staff, deleting records, adjusting inventory) are logged alongside the operator's IP address to comply with business audits.\n• Rate Limiting: Failed auth attempts log temporary lock keys using MongoDB TTL index records. They expire automatically in 10 minutes.\n\n2. Service Compliances:\n• Tax Disclosures: Shop Profile inputs include store GSTIN fields synced onto POS billing headers to comply with national billing guidelines.")} 
            className="hover:underline hover:text-[#0031a0]"
          >
            Compliance & Data Disclosures
          </button>
        </div>
      </div>

      {/* CREATE/EDIT STAFF CREDENTIALS MODAL */}
      {showStaffModal && (
        <div class="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg animate-fade-in">
          <div class="bg-white rounded-xl max-w-sm w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40">
            <h3 class="font-bold text-headline-md text-[#131b2e] mb-lg flex items-center gap-sm">
              <span class="material-symbols-outlined text-[#0041c8]">{editStaffId ? 'manage_accounts' : 'person_add'}</span>
              {editStaffId ? 'Modify Staff Account' : 'Register Staff Account'}
            </h3>

            <form onSubmit={handleStaffFormSubmit} class="space-y-md">
              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={staffFormData.name}
                  onChange={(e) => setStaffFormData({ ...staffFormData, name: e.target.value })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Work Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sarah.connor@company.com"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={staffFormData.email}
                  onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
                  disabled={!!editStaffId}
                />
              </div>

              <div className="space-y-xs">
                <label className="text-xs font-bold text-[#434656] px-1">
                  {editStaffId ? 'Reset Password (Leave blank to keep current)' : 'Password *'}
                </label>
                <div className="relative group">
                  <input
                    type={showStaffPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="w-full h-11 pl-3 pr-10 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                    value={staffFormData.password}
                    onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
                    required={!editStaffId}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffPassword(!showStaffPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737688] hover:text-[#0041c8] transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showStaffPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-md">
                <div class="space-y-xs">
                  <label class="text-xs font-bold text-[#434656] px-1">Role Permission *</label>
                  <select
                    required
                    class="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none cursor-pointer focus:border-[#0041c8]"
                    value={staffFormData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      let defaultPerms = ['dashboard', 'billing', 'returns'];
                      if (newRole === 'Admin') {
                        defaultPerms = ['dashboard', 'billing', 'returns', 'products', 'inventory', 'coupons', 'broadcast', 'customers', 'suppliers', 'reports', 'settings'];
                      } else if (newRole === 'Manager') {
                        defaultPerms = ['dashboard', 'billing', 'returns', 'products', 'inventory', 'coupons', 'broadcast', 'customers', 'suppliers', 'reports'];
                      }
                      setStaffFormData({
                        ...staffFormData,
                        role: newRole,
                        permissions: defaultPerms
                      });
                    }}
                  >
                    <option value="Cashier">Cashier</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                <div class="space-y-xs">
                  <label class="text-xs font-bold text-[#434656] px-1">Account State</label>
                  <select
                    class="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none cursor-pointer focus:border-[#0041c8]"
                    value={staffFormData.active.toString()}
                    onChange={(e) => setStaffFormData({ ...staffFormData, active: e.target.value === 'true' })}
                  >
                    <option value="true">Active (Access)</option>
                    <option value="false">Blocked</option>
                  </select>
                </div>
              </div>

              <div class="space-y-xs pt-xs">
                <label class="text-xs font-bold text-[#434656] px-1 block">Customize Section Access</label>
                <div class="bg-[#f2f3ff]/50 rounded-lg p-md border border-[#c3c5d9]/30 grid grid-cols-2 gap-y-sm gap-x-md max-h-[160px] overflow-y-auto custom-scrollbar">
                  {[
                    { id: 'dashboard', label: 'Dashboard' },
                    { id: 'billing', label: 'POS Billing' },
                    { id: 'returns', label: 'Returns & Exchanges' },
                    { id: 'products', label: 'Products' },
                    { id: 'inventory', label: 'Inventory Logs' },
                    { id: 'coupons', label: 'Discount Coupons' },
                    { id: 'broadcast', label: 'WA Marketing' },
                    { id: 'customers', label: 'Customers' },
                    { id: 'suppliers', label: 'Suppliers' },
                    { id: 'reports', label: 'Reports & P&L' },
                    { id: 'settings', label: 'Settings & Admin' }
                  ].map((section) => (
                    <label key={section.id} class="flex items-center gap-sm text-xs text-[#131b2e] cursor-pointer hover:text-[#0041c8]">
                      <input
                        type="checkbox"
                        class="w-3.5 h-3.5 accent-[#0041c8] rounded border-[#c3c5d9]"
                        checked={staffFormData.permissions?.includes(section.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          let newPermissions = [...(staffFormData.permissions || [])];
                          if (checked) {
                            if (!newPermissions.includes(section.id)) {
                              newPermissions.push(section.id);
                            }
                          } else {
                            newPermissions = newPermissions.filter(p => p !== section.id);
                          }
                          setStaffFormData({ ...staffFormData, permissions: newPermissions });
                        }}
                      />
                      {section.label}
                    </label>
                  ))}
                </div>
              </div>

              <div class="flex gap-md pt-lg border-t border-[#c3c5d9]/20">
                <button
                  type="submit"
                  class="flex-grow h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-all"
                >
                  Save Account
                </button>
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  class="h-11 px-4 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Store Profile Configuration Modal */}
      <ShopProfileModal 
        isOpen={isShopModalOpen} 
        onClose={() => setIsShopModalOpen(false)} 
      />

      {/* PLAN UPGRADE MODAL */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 select-none animate-fade-in">
          <div className="glass-panel p-xl rounded-xl shadow-2xl max-w-md w-full space-y-lg relative animate-scaleUp text-left bg-white">
            <div className="flex items-center justify-between border-b border-[#c3c5d9]/30 pb-sm">
              <h3 className="font-bold text-headline-md text-[#131b2e] flex items-center gap-xs">
                <span className="material-symbols-outlined text-[#0041c8] text-[24px]">verified_user</span>
                Plan Upgrade Request
              </h3>
              <button 
                onClick={() => setShowPlanModal(false)}
                className="text-[#737688] hover:text-[#131b2e] p-1 hover:bg-[#eaedff] rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-md">
              <p className="text-xs text-[#434656] leading-relaxed">
                To upgrade your subscription plan to **{targetUpgradePlan}** and unlock more features:
              </p>
              
              <div className="p-md rounded-lg bg-[#f2f3ff] border border-[#0041c8]/10 text-xs text-[#131b2e] space-y-sm">
                <p className="font-semibold">Activation Steps:</p>
                <ul className="list-decimal list-inside space-y-xs text-[#434656]">
                  <li>Contact store administration at <strong className="text-[#0041c8]">support@luminous.com</strong>.</li>
                  <li>Provide your Store Subdomain/Slug: <strong className="font-mono text-[#0041c8]">{shopProfile.slug || 'your subdomain'}</strong></li>
                  <li>The administrator will review your store request and upgrade the subscription plan.</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPlanModal(false)}
              className="w-full h-11 bg-[#0041c8] text-white hover:opacity-90 font-bold rounded-lg shadow-md transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* LEGAL MODAL */}
      {legalModal.show && (
        <div className="fixed inset-0 z-50 bg-[#131b2e]/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in select-none">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#c3c5d9]/40 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-lg font-bold text-[#0041c8] flex items-center gap-2 border-b border-[#c3c5d9]/20 pb-3">
              <span className="material-symbols-outlined text-[#0041c8]">shield</span>
              {legalModal.title}
            </h3>
            <p className="text-sm text-[#434656] whitespace-pre-line leading-relaxed">
              {legalModal.content}
            </p>
            <button
              onClick={() => setLegalModal({ show: false, title: '', content: '' })}
              className="w-full h-11 bg-[#0041c8] hover:bg-[#0031a0] text-white font-semibold rounded-xl shadow-md transition-all active:scale-95 mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;

import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const SaaSAdmin = () => {
  const { user, startImpersonation } = useAuth();
  const navigate = useNavigate();

  if (!user || user.role !== 'SuperAdmin') {
    return <Navigate to="/" replace />;
  }

  // Active tab state: 'tenants' | 'analytics' | 'announcement' | 'limits' | 'logs'
  const [activeTab, setActiveTab] = useState('tenants');

  // Tenants tab states
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedTenantId, setExpandedTenantId] = useState(null);

  // Tenant registration states
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'Basic',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    gstin: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit tenant states
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    gstin: '',
  });
  const [editError, setEditError] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete tenant states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState(null);
  const [deleteTimer, setDeleteTimer] = useState(10);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deletingTenant, setDeletingTenant] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let interval = null;
    if (showDeleteModal && deleteTimer > 0) {
      interval = setInterval(() => {
        setDeleteTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showDeleteModal, deleteTimer]);

  // Analytics tab states
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Global announcements & limits configuration states
  const [configData, setConfigData] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [announcementText, setAnnouncementText] = useState('');
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [planLimitsForm, setPlanLimitsForm] = useState({
    Basic: { staffLimit: 3, waMarketingEnabled: false },
    Premium: { staffLimit: 5, waMarketingEnabled: true },
    Enterprise: { staffLimit: 9999, waMarketingEnabled: true }
  });

  // Audit Logs states
  const [systemLogs, setSystemLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsSearch, setLogsSearch] = useState('');
  const [logsAction, setLogsAction] = useState('');

  // ----------------------------------------------------
  // API Fetch Actions
  // ----------------------------------------------------

  const fetchTenants = async () => {
    try {
      setTenantsLoading(true);
      const res = await api.get('/saas/tenants');
      if (res.data.success) {
        setTenants(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching tenants list', error);
    } finally {
      setTenantsLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const res = await api.get('/saas/analytics');
      if (res.data.success) {
        setAnalytics(res.data.data);
      }
    } catch (error) {
      console.error('Error compiling system analytics', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      setConfigLoading(true);
      const res = await api.get('/saas/config');
      if (res.data.success) {
        setConfigData(res.data.data);
        setAnnouncementText(res.data.data.announcement || '');
        if (res.data.data.planLimits) {
          setPlanLimitsForm(res.data.data.planLimits);
        }
      }
    } catch (error) {
      console.error('Error loading system config', error);
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchSystemLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await api.get(
        `/saas/logs?page=${logsPage}&search=${logsSearch}&action=${logsAction}`
      );
      if (res.data.success) {
        setSystemLogs(res.data.logs);
        setLogsTotalPages(res.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error loading platform logs', error);
    } finally {
      setLogsLoading(false);
    }
  };

  // Switch fetching depending on active tab
  useEffect(() => {
    if (activeTab === 'tenants') {
      fetchTenants();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    } else if (activeTab === 'announcement' || activeTab === 'limits') {
      fetchConfig();
    } else if (activeTab === 'logs') {
      fetchSystemLogs();
    }
  }, [activeTab, logsPage, logsAction]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearch(searchParam);
      setActiveTab('tenants');
    }
  }, []);

  // ----------------------------------------------------
  // Tenant Handlers
  // ----------------------------------------------------

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const res = await api.post('/saas/tenants', formData);
      if (res.data.success) {
        setShowModal(false);
        setFormData({
          name: '',
          slug: '',
          plan: 'Basic',
          adminName: '',
          adminEmail: '',
          adminPassword: '',
          gstin: '',
        });
        fetchTenants();
      }
    } catch (error) {
      setFormError(error.response?.data?.message || 'Failed to create store');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTenantStatus = async (tenant) => {
    const newStatus = tenant.status === 'Active' ? 'Suspended' : 'Active';
    const confirmMessage = `Are you sure you want to ${newStatus === 'Suspended' ? 'SUSPEND' : 'ACTIVATE'} store "${tenant.name}"? ${
      newStatus === 'Suspended' ? 'Users of this store will be locked out immediately.' : 'Users will be allowed access again.'
    }`;

    if (window.confirm(confirmMessage)) {
      try {
        const res = await api.put(`/saas/tenants/${tenant._id}`, { status: newStatus });
        if (res.data.success) {
          fetchTenants();
        }
      } catch (error) {
        alert(error.response?.data?.message || 'Failed to update store status');
      }
    }
  };

  const handlePlanChange = async (tenantId, newPlan) => {
    try {
      const res = await api.put(`/saas/tenants/${tenantId}`, { plan: newPlan });
      if (res.data.success) {
        fetchTenants();
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update subscription plan');
    }
  };

  const handleOpenEditModal = (tenant) => {
    setSelectedTenant(tenant);
    setEditFormData({
      name: tenant.name,
      gstin: tenant.gstin || '',
    });
    setEditError('');
    setShowEditModal(true);
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    setEditError('');
    setUpdating(true);

    try {
      const res = await api.put(`/saas/tenants/${selectedTenant._id}`, editFormData);
      if (res.data.success) {
        setShowEditModal(false);
        fetchTenants();
      }
    } catch (error) {
      setEditError(error.response?.data?.message || 'Failed to update store');
    } finally {
      setUpdating(false);
    }
  };  const handleOpenDeleteModal = (tenant) => {
    setTenantToDelete(tenant);
    setDeleteTimer(10);
    setDeleteConfirmInput('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const handleDeleteTenant = async (e) => {
    e.preventDefault();
    if (deleteTimer > 0) return;
    if (deleteConfirmInput.toLowerCase() !== tenantToDelete.slug.toLowerCase()) {
      setDeleteError(`Please type "${tenantToDelete.slug}" exactly to confirm deletion`);
      return;
    }

    setDeleteError('');
    setDeletingTenant(true);

    try {
      const res = await api.delete(`/saas/tenants/${tenantToDelete._id}`);
      if (res.data.success) {
        setShowDeleteModal(false);
        fetchTenants();
      }
    } catch (error) {
      setDeleteError(error.response?.data?.message || 'Failed to delete store');
    } finally {
      setDeletingTenant(false);
    }
  };

  const handleImpersonate = async (userId) => {
    if (window.confirm('You are about to log in as this user for debugging. Audit logs will record this impersonation session. Proceed?')) {
      try {
        const res = await api.post(`/saas/impersonate/${userId}`);
        if (res.data.success) {
          const { token, user: impUser } = res.data;
          startImpersonation(token, impUser);
          navigate('/');
        }
      } catch (error) {
        alert(error.response?.data?.message || 'Impersonation failed');
      }
    }
  };

  // ----------------------------------------------------
  // Configuration Handlers (Announcements & Limits)
  // ----------------------------------------------------

  const handleSaveAnnouncement = async (e) => {
    e.preventDefault();
    try {
      setUpdatingConfig(true);
      const res = await api.put('/saas/config', { announcement: announcementText });
      if (res.data.success) {
        alert('Global announcement broadcast published successfully!');
        setConfigData(res.data.data);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save system announcement');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleSaveLimits = async (e) => {
    e.preventDefault();
    try {
      setUpdatingConfig(true);
      const res = await api.put('/saas/config', { planLimits: planLimitsForm });
      if (res.data.success) {
        alert('Pricing plan limits updated successfully!');
        setConfigData(res.data.data);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save pricing limits');
    } finally {
      setUpdatingConfig(false);
    }
  };

  // ----------------------------------------------------
  // Search Filters
  // ----------------------------------------------------

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  const handleLogsSearchSubmit = (e) => {
    e.preventDefault();
    setLogsPage(1);
    fetchSystemLogs();
  };

  return (
    <div className="space-y-gutter flex-grow flex flex-col select-none p-margin-edge">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md border-b border-[#c3c5d9]/20 pb-md">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-[#131b2e]">SaaS Control Center</h2>
          <p className="font-body-md text-[#434656] mt-1">
            Super-Admin platform console. Monitor analytics, dynamic plan gates, system broadcasts, and global audit trials.
          </p>
        </div>
        
        {activeTab === 'tenants' && (
          <button
            onClick={() => {
              setFormError('');
              setShowModal(true);
            }}
            className="px-lg py-md bg-[#0041c8] text-white rounded-lg font-semibold flex items-center gap-sm shadow-md hover:opacity-90 transition-all active:scale-95 text-xs self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">add_business</span>
            Register New Store
          </button>
        )}
      </div>

      {/* Tab Selector Navigation */}
      <div className="flex border-b border-[#c3c5d9]/30 gap-md overflow-x-auto pb-0.5 custom-scrollbar">
        {[
          { id: 'tenants', label: 'Store Tenants', icon: 'storefront' },
          { id: 'analytics', label: 'Platform Analytics', icon: 'analytics' },
          { id: 'announcement', label: 'System Announcement', icon: 'campaign' },
          { id: 'limits', label: 'Plan Limits Editor', icon: 'tune' },
          { id: 'logs', label: 'System Audit Logs', icon: 'gavel' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-xs pb-sm px-sm font-semibold text-xs transition-all border-b-2 shrink-0 ${
              activeTab === tab.id
                ? 'border-[#0041c8] text-[#0041c8]'
                : 'border-transparent text-[#737688] hover:text-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="flex-grow flex flex-col">
        
        {/* ==================== TAB 1: STORE TENANTS ==================== */}
        {activeTab === 'tenants' && (
          <div className="space-y-md">
            {/* KPI quick counters */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-gutter mt-sm">
              <div className="glass-panel p-lg rounded-xl flex items-center gap-md">
                <div className="w-10 h-10 bg-[#0041c8]/10 text-[#0041c8] rounded-xl flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">storefront</span>
                </div>
                <div>
                  <p className="text-[10px] text-[#737688] font-bold uppercase tracking-wider">Total Stores</p>
                  <p className="font-headline-md text-headline-md text-[#131b2e] leading-none mt-1">{tenants.length}</p>
                </div>
              </div>

              <div className="glass-panel p-lg rounded-xl flex items-center gap-md">
                <div className="w-10 h-10 bg-green-50 text-green-700 rounded-xl flex items-center justify-center shrink-0 border border-green-100">
                  <span className="material-symbols-outlined text-[24px]">check_circle</span>
                </div>
                <div>
                  <p className="text-[10px] text-[#737688] font-bold uppercase tracking-wider">Active</p>
                  <p className="font-headline-md text-headline-md text-green-700 leading-none mt-1">
                    {tenants.filter(t => t.status === 'Active').length}
                  </p>
                </div>
              </div>

              <div className="glass-panel p-lg rounded-xl flex items-center gap-md">
                <div className="w-10 h-10 bg-red-50 text-[#ba1a1a] rounded-xl flex items-center justify-center shrink-0 border border-red-100">
                  <span className="material-symbols-outlined text-[24px]">block</span>
                </div>
                <div>
                  <p className="text-[10px] text-[#737688] font-bold uppercase tracking-wider">Suspended</p>
                  <p className="font-headline-md text-headline-md text-[#ba1a1a] leading-none mt-1">
                    {tenants.filter(t => t.status === 'Suspended').length}
                  </p>
                </div>
              </div>

              <div className="glass-panel p-lg rounded-xl flex items-center gap-md">
                <div className="w-10 h-10 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center shrink-0 border border-amber-100">
                  <span className="material-symbols-outlined text-[24px]">inventory_2</span>
                </div>
                <div>
                  <p className="text-[10px] text-[#737688] font-bold uppercase tracking-wider">Total Products</p>
                  <p className="font-headline-md text-headline-md text-amber-700 leading-none mt-1">
                    {tenants.reduce((acc, t) => acc + (t.stats?.products || 0), 0)}
                  </p>
                </div>
              </div>

              <div className="glass-panel p-lg rounded-xl flex items-center gap-md">
                <div className="w-10 h-10 bg-purple-50 text-purple-700 rounded-xl flex items-center justify-center shrink-0 border border-purple-100">
                  <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                </div>
                <div>
                  <p className="text-[10px] text-[#737688] font-bold uppercase tracking-wider">Total Invoices</p>
                  <p className="font-headline-md text-headline-md text-purple-700 leading-none mt-1">
                    {tenants.reduce((acc, t) => acc + (t.stats?.invoices || 0), 0)}
                  </p>
                </div>
              </div>
            </div>

            {/* Filter header */}
            <div className="glass-panel p-md rounded-xl flex items-center gap-md">
              <div className="flex items-center gap-sm flex-grow max-w-md">
                <span className="material-symbols-outlined text-[#434656] text-[20px]">search</span>
                <input
                  type="text"
                  placeholder="Search by store name or slug/subdomain..."
                  className="flex-grow h-10 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Tenants table */}
            <div className="glass-panel rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#faf8ff] border-b border-[#c3c5d9]/30 text-[11px] font-bold text-[#434656] h-11 uppercase tracking-wider">
                    <th className="px-lg">Store Info</th>
                    <th className="px-lg">Subdomain Slug</th>
                    <th className="px-lg">Subscription Plan</th>
                    <th className="px-lg">Usage Metrics</th>
                    <th className="px-lg">Status</th>
                    <th className="px-lg text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c5d9]/10">
                  {tenantsLoading ? (
                    <tr>
                      <td colSpan="6" className="py-xl text-center">
                        <span className="material-symbols-outlined text-[36px] text-[#0041c8] animate-spin">progress_activity</span>
                      </td>
                    </tr>
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-xl text-center text-[#737688] text-xs">
                        No stores registered matching query.
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <React.Fragment key={tenant._id}>
                        <tr className="hover:bg-[#faf8ff]/50 font-body-md text-[#131b2e] text-xs">
                          <td className="px-lg py-md">
                            <div className="font-bold text-sm">{tenant.name}</div>
                            <div className="text-xs text-[#737688] font-mono mt-0.5">GSTIN: {tenant.gstin || 'None'}</div>
                            <div className="text-[10px] text-[#737688] mt-1">Registered: {new Date(tenant.createdAt).toLocaleDateString()}</div>
                          </td>
                          <td className="px-lg py-md font-mono">{tenant.slug}</td>
                          <td className="px-lg py-md">
                            <select
                              value={tenant.plan}
                              onChange={(e) => handlePlanChange(tenant._id, e.target.value)}
                              className="h-8 px-2 border border-[#c3c5d9] bg-white rounded outline-none focus:border-[#0041c8] text-xs font-semibold"
                            >
                              <option value="Basic">Basic Plan</option>
                              <option value="Premium">Premium Plan</option>
                              <option value="Enterprise">Enterprise Plan</option>
                            </select>
                          </td>
                          <td className="px-lg py-md text-[10px] space-y-0.5 text-[#434656]">
                            <div>🧑‍🤝‍🧑 {tenant.stats?.users || 0} Staff Members</div>
                            <div>📦 {tenant.stats?.products || 0} Products</div>
                            <div>🧾 {tenant.stats?.invoices || 0} Invoices</div>
                          </td>
                          <td className="px-lg py-md">
                            <span className={`px-sm py-0.5 rounded-full text-[10px] font-bold ${
                              tenant.status === 'Active' 
                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                : 'bg-red-50 text-[#ba1a1a] border border-red-200'
                            }`}>
                              {tenant.status}
                            </span>
                          </td>
                          <td className="px-lg py-md text-right">
                            <div className="flex items-center justify-end gap-sm">
                              <button
                                onClick={() => handleOpenEditModal(tenant)}
                                className="px-sm h-8 border border-[#c3c5d9]/60 hover:bg-[#dae2fd]/40 text-xs text-[#434656] font-semibold rounded flex items-center gap-xs"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                                Edit
                              </button>
                              <button
                                onClick={() => setExpandedTenantId(expandedTenantId === tenant._id ? null : tenant._id)}
                                className="px-sm h-8 border border-[#c3c5d9]/60 hover:bg-[#dae2fd]/40 text-xs text-[#434656] font-semibold rounded flex items-center gap-xs"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  {expandedTenantId === tenant._id ? 'expand_less' : 'expand_more'}
                                </span>
                                Debug
                              </button>
                              <button
                                onClick={() => toggleTenantStatus(tenant)}
                                className={`px-sm h-8 text-xs font-semibold rounded ${
                                  tenant.status === 'Active'
                                    ? 'border border-[#ffdad6] hover:bg-red-50 text-[#ba1a1a]'
                                    : 'bg-green-700 hover:bg-green-800 text-white'
                                }`}
                              >
                                {tenant.status === 'Active' ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                onClick={() => handleOpenDeleteModal(tenant)}
                                className="px-sm h-8 border border-red-200 hover:bg-red-50 text-xs text-[#ba1a1a] font-semibold rounded flex items-center gap-xs"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Debug Panel */}
                        {expandedTenantId === tenant._id && (
                          <tr className="bg-[#faf8ff]">
                            <td colSpan="6" className="px-2xl py-md">
                              <div className="border border-[#c3c5d9]/40 rounded-lg bg-white overflow-hidden shadow-inner max-w-3xl">
                                <div className="bg-[#faf8ff] px-lg py-sm border-b border-[#c3c5d9]/30 flex items-center justify-between text-[11px] font-bold text-[#434656]">
                                  <span>STAFF ACCOUNTS FOR "{tenant.name.toUpperCase()}"</span>
                                  <span>{tenant.users?.length || 0} Registered Users</span>
                                </div>
                                <div className="divide-y divide-[#c3c5d9]/20">
                                  {(!tenant.users || tenant.users.length === 0) ? (
                                    <div className="p-lg text-center text-xs text-[#737688]">No staff users registered under this store.</div>
                                  ) : (
                                    tenant.users.map((staffUser) => (
                                      <div key={staffUser._id} className="px-lg py-md flex items-center justify-between hover:bg-[#faf8ff]/30 text-xs">
                                        <div className="space-y-0.5">
                                          <div className="text-sm font-bold text-[#131b2e]">{staffUser.name}</div>
                                          <div className="text-xs text-[#737688] font-mono">{staffUser.email} | Role: <span className="font-bold text-[#0041c8]">{staffUser.role}</span></div>
                                        </div>
                                        <button
                                          onClick={() => handleImpersonate(staffUser._id)}
                                          className="px-md h-8 bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 text-white rounded font-bold text-xs flex items-center gap-xs shadow-sm transition-all active:scale-95"
                                        >
                                          <span className="material-symbols-outlined text-[16px]">account_circle</span>
                                          Impersonate
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: PLATFORM ANALYTICS ==================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-gutter mt-sm">
            {analyticsLoading ? (
              <div className="py-xl text-center glass-panel rounded-xl">
                <span className="material-symbols-outlined text-[36px] text-[#0041c8] animate-spin">progress_activity</span>
                <p className="text-xs text-[#737688] mt-2">Compiling platform metric indices...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
                
                {/* Visual statistics card */}
                <div className="lg:col-span-2 glass-panel p-lg rounded-xl flex flex-col gap-lg shadow-sm">
                  <div>
                    <h3 className="font-bold text-[#131b2e] text-body-lg flex items-center gap-xs">
                      <span className="material-symbols-outlined text-[#0041c8]">donut_large</span>
                      Store Subscription Split
                    </h3>
                    <p className="text-xs text-[#434656] mt-0.5">Visual ratio breakdown of system pricing plan distributions.</p>
                  </div>

                  {/* Horizontal visual chart bars */}
                  <div className="space-y-md">
                    {['Basic', 'Premium', 'Enterprise'].map((tier) => {
                      const count = analytics?.planCounts?.[tier] || 0;
                      const pct = analytics?.totals?.stores > 0 
                        ? Math.round((count / analytics.totals.stores) * 100) 
                        : 0;
                      const colors = {
                        Basic: 'from-slate-400 to-slate-500 bg-slate-500',
                        Premium: 'from-blue-500 to-indigo-500 bg-blue-500',
                        Enterprise: 'from-amber-400 to-amber-500 bg-amber-500'
                      };
                      return (
                        <div key={tier} className="space-y-xs">
                          <div className="flex justify-between text-xs font-bold text-[#131b2e]">
                            <span className="flex items-center gap-xs">
                              <span className={`w-3 h-3 rounded-full ${colors[tier].split(' ')[2]}`} />
                              {tier} Tier
                            </span>
                            <span>{count} stores ({pct}%)</span>
                          </div>
                          <div className="h-4 bg-[#c3c5d9]/20 rounded-full overflow-hidden border border-[#c3c5d9]/10">
                            <div 
                              className={`h-full bg-gradient-to-r ${colors[tier].split(' ').slice(0,2).join(' ')} transition-all duration-1000`} 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Growth Trends table mapping */}
                  <div className="border-t border-[#c3c5d9]/20 pt-md mt-sm">
                    <h4 className="font-bold text-xs text-[#131b2e] uppercase tracking-wider mb-sm">SaaS Signup Timeline</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-md text-center">
                      {(analytics?.storeGrowth || []).map((growthMonth) => (
                        <div key={growthMonth._id} className="bg-white/40 p-md rounded-lg border border-[#c3c5d9]/25">
                          <p className="text-[10px] font-bold text-[#737688] uppercase">{growthMonth._id}</p>
                          <p className="text-headline-sm font-extrabold text-[#0041c8] mt-1">+{growthMonth.count} Stores</p>
                        </div>
                      ))}
                      {(!analytics?.storeGrowth || analytics.storeGrowth.length === 0) && (
                        <div className="col-span-full py-sm text-xs text-[#737688]">No registration logs recorded.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Projected Billing Box */}
                <div className="flex flex-col gap-gutter">
                  
                  {/* Monthly Recurring Revenue */}
                  <div className="glass-panel p-lg rounded-xl bg-gradient-to-tr from-[#0041c8]/5 to-[#6063ee]/5 border border-[#0041c8]/10 shadow-sm flex flex-col gap-md">
                    <div>
                      <p className="text-[10px] font-bold text-[#737688] uppercase tracking-wider">Estimated Business Revenue</p>
                      <h4 className="font-headline-lg text-[32px] font-black text-[#0041c8] mt-1 leading-tight">
                        ${analytics?.mrr?.toLocaleString()} / mo
                      </h4>
                      <p className="text-[11px] text-[#434656] mt-1">Calculated using tier metrics: Basic ($0), Premium ($99), Enterprise ($499).</p>
                    </div>

                    <div className="border-t border-[#c3c5d9]/30 pt-md space-y-sm text-xs font-medium text-[#434656]">
                      <div className="flex justify-between">
                        <span>Premium Base:</span>
                        <span className="font-bold text-[#131b2e]">${(analytics?.planCounts?.Premium || 0) * 99}/mo</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Enterprise Base:</span>
                        <span className="font-bold text-[#131b2e]">${(analytics?.planCounts?.Enterprise || 0) * 499}/mo</span>
                      </div>
                    </div>
                  </div>

                  {/* Cumulative platform totals */}
                  <div className="glass-panel p-lg rounded-xl shadow-sm space-y-md">
                    <h4 className="font-bold text-[#131b2e] text-xs uppercase tracking-wider border-b border-[#c3c5d9]/30 pb-xs">
                      Platform Stats Index
                    </h4>
                    
                    <div className="space-y-sm text-xs">
                      <div className="flex justify-between items-center py-xs">
                        <span className="text-[#434656] flex items-center gap-xs">
                          <span className="material-symbols-outlined text-[16px] text-[#0041c8]">group</span>
                          Cumulative Staff:
                        </span>
                        <span className="font-bold text-[#131b2e]">{analytics?.totals?.staff || 0} users</span>
                      </div>
                      <div className="flex justify-between items-center py-xs">
                        <span className="text-[#434656] flex items-center gap-xs">
                          <span className="material-symbols-outlined text-[16px] text-[#0041c8]">inventory</span>
                          Cumulative Products:
                        </span>
                        <span className="font-bold text-[#131b2e]">{analytics?.totals?.products || 0} SKUs</span>
                      </div>
                      <div className="flex justify-between items-center py-xs">
                        <span className="text-[#434656] flex items-center gap-xs">
                          <span className="material-symbols-outlined text-[16px] text-[#0041c8]">receipt</span>
                          Cumulative Invoices:
                        </span>
                        <span className="font-bold text-[#131b2e]">{analytics?.totals?.invoices || 0} checks</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 3: SYSTEM ANNOUNCEMENT ==================== */}
        {activeTab === 'announcement' && (
          <div className="mt-sm glass-panel p-lg rounded-xl shadow-sm max-w-2xl">
            {configLoading ? (
              <div className="py-xl text-center">
                <span className="material-symbols-outlined text-[36px] text-[#0041c8] animate-spin">progress_activity</span>
              </div>
            ) : (
              <form onSubmit={handleSaveAnnouncement} className="space-y-lg text-left">
                <div>
                  <h3 className="font-bold text-[#131b2e] text-body-lg flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[#0041c8]">campaign</span>
                    Global System Broadcast
                  </h3>
                  <p className="text-xs text-[#434656] mt-0.5">
                    Post messages displayed dynamically on the dashboard header for all store operators across the system.
                  </p>
                </div>

                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">Broadcast Banner Text</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. System scheduled server maintenance is set for Sunday at 02:00 AM UTC. Please finalize checkout bills before this window."
                    className="w-full p-md border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8] text-xs font-medium leading-relaxed resize-none transition-all"
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                  />
                  <span className="text-[10px] text-[#737688] px-1 block">Leave empty and save to disable the announcement banner system-wide.</span>
                </div>

                <div className="flex gap-md pt-xs">
                  <button
                    type="submit"
                    disabled={updatingConfig}
                    className="h-10 px-lg bg-[#0041c8] hover:opacity-90 text-white font-bold rounded-lg text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">publish</span>
                    {updatingConfig ? 'Publishing...' : 'Publish Announcement'}
                  </button>
                  {announcementText && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setUpdatingConfig(true);
                          const res = await api.put('/saas/config', { announcement: '' });
                          if (res.data.success) {
                            alert('Announcement cleared successfully!');
                            setAnnouncementText('');
                            setConfigData(res.data.data);
                          }
                        } catch (err) {
                          alert('Failed to clear announcement');
                        } finally {
                          setUpdatingConfig(false);
                        }
                      }}
                      className="h-10 px-lg border border-red-200 hover:bg-red-50 text-[#ba1a1a] font-bold rounded-lg text-xs transition-all"
                    >
                      Clear Broadcast
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {/* ==================== TAB 4: PLAN LIMITS CONFIGURATOR ==================== */}
        {activeTab === 'limits' && (
          <div className="mt-sm space-y-gutter max-w-4xl text-left">
            {configLoading ? (
              <div className="py-xl text-center glass-panel rounded-xl">
                <span className="material-symbols-outlined text-[36px] text-[#0041c8] animate-spin">progress_activity</span>
              </div>
            ) : (
              <form onSubmit={handleSaveLimits} className="space-y-lg">
                
                <div>
                  <h3 className="font-bold text-[#131b2e] text-body-lg flex items-center gap-xs">
                    <span className="material-symbols-outlined text-[#0041c8]">tune</span>
                    Dynamic Tier Resource Limits
                  </h3>
                  <p className="text-xs text-[#434656] mt-0.5">
                    Configure thresholds for staff account caps and enable/disable features like WhatsApp Marketing per tier.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                  {['Basic', 'Premium', 'Enterprise'].map((tier) => (
                    <div key={tier} className="glass-panel p-lg rounded-xl flex flex-col gap-md shadow-sm bg-white/50 relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0041c8]/30 to-[#6063ee]/30" />
                      
                      <h4 className="font-bold text-sm text-[#131b2e] uppercase tracking-wide border-b border-[#c3c5d9]/30 pb-xs">
                        {tier} Tier
                      </h4>

                      <div className="space-y-md flex-grow">
                        <div className="space-y-xs">
                          <label className="text-[11px] font-bold text-[#434656] px-1">Staff Account Cap</label>
                          <input
                            type="number"
                            required
                            min="1"
                            max="9999"
                            className="w-full h-10 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8] text-xs font-semibold"
                            value={planLimitsForm[tier]?.staffLimit || 3}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setPlanLimitsForm({
                                ...planLimitsForm,
                                [tier]: {
                                  ...planLimitsForm[tier],
                                  staffLimit: val
                                }
                              });
                            }}
                          />
                          <span className="text-[10px] text-[#737688] px-1 block">Maximum non-Admin credentials.</span>
                        </div>

                        <div className="pt-2 border-t border-[#c3c5d9]/20">
                          <label className="flex items-center gap-sm text-xs font-bold text-[#434656] cursor-pointer hover:text-[#0041c8]">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-[#0041c8] rounded cursor-pointer"
                              checked={planLimitsForm[tier]?.waMarketingEnabled || false}
                              onChange={(e) => {
                                setPlanLimitsForm({
                                  ...planLimitsForm,
                                  [tier]: {
                                    ...planLimitsForm[tier],
                                    waMarketingEnabled: e.target.checked
                                  }
                                });
                              }}
                            />
                            Enable WA Marketing
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-md border-t border-[#c3c5d9]/20 flex">
                  <button
                    type="submit"
                    disabled={updatingConfig}
                    className="h-10 px-xl bg-[#0041c8] hover:opacity-90 text-white font-bold rounded-lg text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    {updatingConfig ? 'Saving settings...' : 'Save Plan limits'}
                  </button>
                </div>

              </form>
            )}
          </div>
        )}

        {/* ==================== TAB 5: SYSTEM AUDIT LOGS ==================== */}
        {activeTab === 'logs' && (
          <div className="space-y-md mt-sm">
            {/* Audit log filters panel */}
            <div className="glass-panel p-md rounded-xl flex flex-wrap items-center justify-between gap-md">
              <form onSubmit={handleLogsSearchSubmit} className="flex items-center gap-sm flex-grow max-w-sm">
                <input
                  type="text"
                  placeholder="Search audit descriptions, IP addresses..."
                  className="flex-grow h-9 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] text-xs"
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-md h-9 bg-[#0041c8] text-white rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all"
                >
                  Find
                </button>
              </form>

              <select
                className="h-9 px-3 border border-[#c3c5d9] bg-white rounded-lg text-xs outline-none cursor-pointer focus:border-[#0041c8] font-semibold"
                value={logsAction}
                onChange={(e) => {
                  setLogsAction(e.target.value);
                  setLogsPage(1);
                }}
              >
                <option value="">All Security Events</option>
                <option value="LOGIN">LOGIN</option>
                <option value="CREATE_TENANT">CREATE_TENANT</option>
                <option value="UPDATE_TENANT">UPDATE_TENANT</option>
                <option value="IMPERSONATION_START">IMPERSONATION_START</option>
                <option value="UPDATE_SYSTEM_CONFIG">UPDATE_SYSTEM_CONFIG</option>
              </select>
            </div>

            {/* Audit Logs list */}
            <div className="glass-panel rounded-xl overflow-hidden shadow-sm flex flex-col justify-between min-h-[440px]">
              <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#faf8ff] border-b border-[#c3c5d9]/30 h-11">
                    <tr>
                      <th className="px-lg font-bold text-[#434656] uppercase tracking-wider">User Account</th>
                      <th className="px-lg font-bold text-[#434656] uppercase tracking-wider">Tenant Store</th>
                      <th className="px-lg font-bold text-[#434656] uppercase tracking-wider">Action Event</th>
                      <th className="px-lg font-bold text-[#434656] uppercase tracking-wider">Event Details</th>
                      <th className="px-lg font-bold text-[#434656] uppercase tracking-wider">IP Address</th>
                      <th className="px-lg font-bold text-[#434656] uppercase tracking-wider">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c3c5d9]/20 text-[#131b2e]">
                    {logsLoading ? (
                      <tr>
                        <td colSpan="6" className="text-center py-xl">
                          <span className="material-symbols-outlined text-[32px] text-[#0041c8] animate-spin">progress_activity</span>
                        </td>
                      </tr>
                    ) : systemLogs.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-4 text-center text-[#737688]">No activity log tracks found in the system logs.</td>
                      </tr>
                    ) : (
                      systemLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-[#faf8ff] transition-colors h-12">
                          <td className="px-lg">
                            <div className="font-bold">{log.user ? log.user.name : 'Unknown Operator'}</div>
                            <span className="text-[10px] text-[#737688] font-mono">{log.user ? log.user.email : 'N/A'}</span>
                          </td>
                          <td className="px-lg font-semibold">
                            {log.tenant ? (
                              <div>
                                <div>{log.tenant.name}</div>
                                <span className="text-[10px] text-[#737688] font-mono">{log.tenant.slug}</span>
                              </div>
                            ) : (
                              <span className="text-[#0041c8] font-bold">Platform-wide</span>
                            )}
                          </td>
                          <td className="px-lg">
                            <span className="bg-[#eaedff] text-[#0041c8] font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-[#0041c8]/10">
                              {log.action}
                            </span>
                          </td>
                          <td className="px-lg text-[#434656] max-w-[240px] truncate" title={log.details}>
                            {log.details}
                          </td>
                          <td className="px-lg font-mono text-[#737688]">{log.ipAddress || '127.0.0.1'}</td>
                          <td className="px-lg font-mono text-[#737688]">
                            {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination logs footer */}
              {logsTotalPages > 1 && (
                <div className="px-lg py-md bg-white/30 flex items-center justify-between border-t border-[#c3c5d9]/30">
                  <p className="text-[11px] text-[#434656] font-semibold">Showing logs page {logsPage} of {logsTotalPages}</p>
                  <div className="flex gap-sm">
                    <button
                      onClick={() => setLogsPage(Math.max(1, logsPage - 1))}
                      disabled={logsPage === 1}
                      className="p-1 px-2 rounded-lg border border-[#c3c5d9] bg-white hover:bg-[#eaedff] transition-colors disabled:opacity-30 cursor-pointer flex items-center"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                    </button>
                    <button
                      onClick={() => setLogsPage(Math.min(logsTotalPages, logsPage + 1))}
                      disabled={logsPage === logsTotalPages}
                      className="p-1 px-2 rounded-lg border border-[#c3c5d9] bg-white hover:bg-[#eaedff] transition-colors disabled:opacity-30 cursor-pointer flex items-center"
                    >
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* REGISTER NEW TENANT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg">
          <div className="bg-white rounded-xl max-w-md w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-headline-md text-[#131b2e] mb-lg flex items-center gap-sm">
              <span className="material-symbols-outlined text-[#0041c8]">add_business</span>
              Register New Store
            </h3>

            {formError && (
              <div className="p-md bg-red-50 border border-red-200 text-[#ba1a1a] rounded-lg text-xs font-semibold mb-md flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-lg">
              {/* Store Details Section */}
              <div className="space-y-sm border-b border-[#c3c5d9]/20 pb-md text-left">
                <h4 className="text-xs font-bold text-[#0041c8] tracking-wider uppercase">Store Config</h4>
                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">Retail Store Name</label>
                  <input
                    type="text"
                    placeholder="Defaults to: Default Retail Store"
                    className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all text-sm"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">GSTIN (GST Number)</label>
                  <input
                    type="text"
                    placeholder="e.g. 27AAAAA1111A1Z1"
                    className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all text-sm font-mono"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-md">
                  <div className="space-y-xs">
                    <label className="text-xs font-bold text-[#434656] px-1">Subdomain / Slug *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. unique-store-slug"
                      pattern="^[a-z0-9\-]+$"
                      title="Only lowercase alphanumeric characters and hyphens allowed"
                      className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all text-sm font-mono"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                    />
                  </div>
                  <div className="space-y-xs">
                    <label className="text-xs font-bold text-[#434656] px-1">Subscription Plan *</label>
                    <select
                      className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] bg-white transition-all text-sm"
                      value={formData.plan}
                      onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                    >
                      <option value="Basic">Basic Plan</option>
                      <option value="Premium">Premium Plan</option>
                      <option value="Enterprise">Enterprise Plan</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Admin Account Section */}
              <div className="space-y-sm text-left">
                <h4 className="text-xs font-bold text-[#0041c8] tracking-wider uppercase">Store Admin Profile</h4>
                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">Admin User Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all text-sm"
                    value={formData.adminName}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">Admin Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. admin@mystore.com"
                    className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all text-sm font-mono"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">Initial Password *</label>
                  <input
                    type="password"
                    required
                    minLength="6"
                    placeholder="Min 6 characters"
                    className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all text-sm"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex gap-md pt-lg border-t border-[#c3c5d9]/20">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-grow h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50 text-xs font-bold"
                >
                  {submitting ? 'Creating store...' : 'Create & Provision Store'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-11 px-4 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg active:scale-95 transition-all text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TENANT DETAILS MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg">
          <div className="bg-white rounded-xl max-w-md w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-headline-md text-[#131b2e] mb-lg flex items-center gap-sm">
              <span className="material-symbols-outlined text-[#0041c8]">edit_note</span>
              Edit Store Details
            </h3>

            {editError && (
              <div className="p-md bg-red-50 border border-red-200 text-[#ba1a1a] rounded-lg text-xs font-semibold mb-md flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateTenant} className="space-y-lg">
              <div className="space-y-md text-left">
                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">Retail Store Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shree Shyam Retailers"
                    className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all text-sm font-semibold"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">GSTIN (GST Number) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 27AAAAA1111A1Z1"
                    className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all text-sm font-mono font-semibold"
                    value={editFormData.gstin}
                    onChange={(e) => setEditFormData({ ...editFormData, gstin: e.target.value })}
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex gap-md pt-lg border-t border-[#c3c5d9]/20">
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-grow h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50 text-xs font-bold"
                >
                  {updating ? 'Saving details...' : 'Save Details'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="h-11 px-4 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg active:scale-95 transition-all text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE TENANT WARNING MODAL */}
      {showDeleteModal && tenantToDelete && (
        <div className="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg">
          <div className="bg-white rounded-xl max-w-md w-full p-2xl shadow-2xl glass-panel relative border border-red-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="font-bold text-headline-md text-red-600 mb-md flex items-center gap-sm">
              <span className="material-symbols-outlined text-red-600 text-[28px]">warning</span>
              Danger: Delete Store
            </h3>

            {deleteError && (
              <div className="p-md bg-red-50 border border-red-200 text-[#ba1a1a] rounded-lg text-xs font-semibold mb-md flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">error</span>
                {deleteError}
              </div>
            )}

            <div className="space-y-md text-left text-xs mb-lg">
              <p className="text-[#434656] font-medium leading-relaxed">
                You are about to delete store <strong className="text-[#131b2e] font-bold">"{tenantToDelete.name}"</strong> (Slug: <span className="font-mono text-[#0041c8] font-bold">{tenantToDelete.slug}</span>).
              </p>
              
              <div className="p-md bg-red-50 border border-red-200 rounded-lg text-[#ba1a1a] font-semibold space-y-xs">
                <p className="flex items-center gap-xs text-[10px] uppercase tracking-wider">
                  <span className="material-symbols-outlined text-[16px]">gavel</span>
                  Critical Warning:
                </p>
                <p className="leading-relaxed">
                  This action is <strong className="underline">permanent</strong>. All staff members, products, coupons, customers, inventory logs, receipts, and invoices belonging to this store will be completely and irreversibly purged from the system.
                </p>
              </div>

              <div className="space-y-xs pt-xs">
                <label className="text-[11px] font-bold text-[#434656] block">
                  To confirm, type the subdomain slug <strong className="font-mono text-[#0041c8] font-bold">"{tenantToDelete.slug}"</strong> below:
                </label>
                <input
                  type="text"
                  placeholder="Type slug here..."
                  className="w-full h-10 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-red-600 font-mono text-sm"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                />
              </div>
            </div>

            {/* Modal Buttons */}
            <div className="flex gap-md pt-lg border-t border-[#c3c5d9]/20">
              <button
                type="button"
                onClick={handleDeleteTenant}
                disabled={deletingTenant || deleteTimer > 0 || deleteConfirmInput.toLowerCase() !== tenantToDelete.slug.toLowerCase()}
                className={`flex-grow h-11 text-white font-semibold rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-all text-xs font-bold ${
                  deletingTenant || deleteTimer > 0 || deleteConfirmInput.toLowerCase() !== tenantToDelete.slug.toLowerCase()
                    ? 'bg-red-400 opacity-50 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {deletingTenant 
                  ? 'Purging data...' 
                  : deleteTimer > 0 
                    ? `Wait ${deleteTimer}s to unlock` 
                    : 'Yes, Delete Completely'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="h-11 px-4 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg active:scale-95 transition-all text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SaaSAdmin;

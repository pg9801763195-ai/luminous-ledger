import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import LuminousLogo from '../assets/luminous_logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  
  // New login interactive states
  const [showPassword, setShowPassword] = useState(false);
  const [infoModal, setInfoModal] = useState({ show: false, title: '', content: '' });

  const { login } = useAuth();
  const navigate = useNavigate();

  // Search parameters for tenant slug detection
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant') || searchParams.get('store');

  const [tenantProfile, setTenantProfile] = useState(null);
  const [fetchingTenant, setFetchingTenant] = useState(!!tenantSlug);


  useEffect(() => {
    const fetchTenantBranding = async () => {
      if (!tenantSlug) {
        setFetchingTenant(false);
        return;
      }
      try {
        setFetchingTenant(true);
        const res = await api.get(`/shop/public?slug=${tenantSlug.toLowerCase()}`);
        if (res.data.success && res.data.profile) {
          setTenantProfile(res.data.profile);
        }
      } catch (err) {
        console.error('Failed to load tenant branding, falling back to global login:', err);
      } finally {
        setFetchingTenant(false);
      }
    };
    fetchTenantBranding();
  }, [tenantSlug]);

  const openInfo = (title, content) => {
    setInfoModal({ show: true, title, content });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoadingSubmit(true);

    const result = await login(email, password);
    if (result.success) {
      if (remember) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      if (result.user?.role === 'SuperAdmin') {
        navigate('/saas-admin');
      } else {
        navigate('/');
      }
    } else {
      setError(result.message);
      setLoadingSubmit(false);
    }
  };

  return (
    <div className="bg-gradient-to-tr from-[#eef2ff] via-[#faf8ff] to-[#f5f3ff] font-body-md text-[#131b2e] min-h-screen relative overflow-hidden flex items-center justify-center w-full">
      {/* Background Decorative Blur Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-[#ff8a00] to-[#e52e71] opacity-[0.14] blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-[#00c6ff] to-[#0072ff] opacity-[0.14] blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute top-[30%] right-[10%] w-[35%] h-[35%] rounded-full bg-gradient-to-tr from-[#7928ca] to-[#ff0080] opacity-[0.11] blur-[100px] pointer-events-none z-0"></div>

      {/* Static CSS Grid Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid-masked z-0 pointer-events-none"></div>

      {/* Main Content Grid */}
      <main className="relative z-10 w-full max-w-[1440px] px-6 flex justify-center">
        {/* Login Card */}
        <div className="glass-panel w-full max-w-[480px] p-8 md:p-10 rounded-2xl border border-white/60 bg-white/75 backdrop-blur-md shadow-[0_15px_35px_-5px_rgba(0,40,150,0.08)] hover:shadow-[0_25px_50px_-10px_rgba(0,40,150,0.15)] transition-all duration-500 ease-in-out hover:-translate-y-1">
          
          {/* Brand Identity */}
          <div className="flex flex-col items-center mb-8 text-center select-none">
            {fetchingTenant ? (
              <div className="w-24 h-24 rounded-full flex items-center justify-center bg-white shadow-md p-1 mb-4 border border-[#c3c5d9]/30">
                <span className="material-symbols-outlined text-[32px] text-[#0041c8] animate-spin">progress_activity</span>
              </div>
            ) : tenantProfile ? (
              tenantProfile.logo ? (
                <img 
                  src={tenantProfile.logo} 
                  alt={`${tenantProfile.name} Logo`} 
                  className="w-24 h-24 object-contain rounded-full shadow-md bg-white p-2 mb-4 border border-[#c3c5d9]/30" 
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#0041c8]/20 to-[#6063ee]/20 text-[#0041c8] border border-[#0041c8]/25 flex items-center justify-center font-bold shadow-md p-1 mb-4 select-none">
                  <span className="text-[32px] font-semibold tracking-wider">
                    {tenantProfile.name ? tenantProfile.name.charAt(0).toUpperCase() : 'S'}
                  </span>
                </div>
              )
            ) : (
              <img 
                src={LuminousLogo} 
                alt="Luminous Ledger Logo" 
                className="w-24 h-24 object-contain rounded-full shadow-md bg-white p-2 mb-4" 
              />
            )}
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-[#0041c8] via-[#5255e2] to-[#7928ca] bg-clip-text text-transparent">
              {fetchingTenant ? 'Loading Portal...' : (tenantProfile ? tenantProfile.name : 'Luminous Ledger')}
            </h1>
            <p className="text-[#434656] text-sm mt-2 font-medium">
              {fetchingTenant ? 'Fetching store settings...' : (tenantProfile ? 'Retail Management Portal' : 'Multi-Tenant Retail Management Platform')}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-4 bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/20 rounded-xl text-sm flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#ba1a1a]">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#434656] tracking-wide px-1" htmlFor="email">Work Email</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737688] group-focus-within:text-[#0041c8] transition-colors">
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <input
                  className="w-full h-12 pl-12 pr-4 bg-white/70 border border-[#c3c5d9] rounded-xl focus:border-[#0041c8] focus:ring-1 focus:ring-[#0041c8]/10 transition-all outline-none text-[#131b2e] placeholder:text-[#737688]"
                  id="email"
                  placeholder="alex.morgan@company.com"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-semibold text-[#434656] tracking-wide" htmlFor="password">Password</label>
                <a className="text-xs text-[#0041c8] hover:text-[#0031a0] transition-colors font-medium hover:underline decoration-1 underline-offset-4" href="#" onClick={(e) => { e.preventDefault(); openInfo("Reset Password", "To reset your password, please contact the system Administrator at your store location or email support at admin@luminous.com. For security compliance, password resets must be audit-logged by an Administrator."); }}>Forgot?</a>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737688] group-focus-within:text-[#0041c8] transition-colors">
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                </div>
                <input
                  className="w-full h-12 pl-12 pr-12 bg-white/70 border border-[#c3c5d9] rounded-xl focus:border-[#0041c8] focus:ring-1 focus:ring-[#0041c8]/10 transition-all outline-none text-[#131b2e] placeholder:text-[#737688]"
                  id="password"
                  placeholder="••••••••••••"
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737688] hover:text-[#0041c8] transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-3 px-1 py-1">
              <div className="relative flex items-center h-5">
                <input
                  className="w-4 h-4 text-[#0041c8] border-[#c3c5d9] rounded focus:ring-[#0041c8]/20 transition-all cursor-pointer"
                  id="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
              </div>
              <label className="text-sm text-[#434656] cursor-pointer select-none" htmlFor="remember">Remember this device</label>
            </div>

            <button
              className="w-full h-12 bg-gradient-to-r from-[#0041c8] via-[#5255e2] to-[#7928ca] hover:opacity-95 text-white font-semibold rounded-xl shadow-lg shadow-[#0041c8]/15 hover:shadow-[#0041c8]/30 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 mt-8 disabled:opacity-50"
              type="submit"
              disabled={loadingSubmit}
            >
              {loadingSubmit ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Links */}
          <div className="mt-8 text-center space-y-4 select-none">
            <p className="text-sm text-[#434656]">
              Don't have an account?{' '}
              <a className="text-[#0041c8] font-semibold hover:text-[#0031a0] hover:underline decoration-1 underline-offset-4 transition-colors" href="#" onClick={(e) => { e.preventDefault(); openInfo("Request Account Access", "Registration of cashier, manager, and administrator staff accounts is managed directly by the Store Owner or Administrator. Please contact your location manager to have your account added."); }}>Request Access</a>
            </p>
            <div className="flex items-center justify-center gap-6 pt-6 border-t border-[#c3c5d9]/40">
              <a className="text-xs text-[#737688] hover:text-[#434656] transition-colors" href="#" onClick={(e) => { e.preventDefault(); openInfo("Terms of Service", "Welcome to Luminous Ledger. By accessing or using our SaaS platform, you agree to these terms:\n\n1. Commercial Usage Only: This platform is designed solely for retail management and billing. You agree to use it only for legitimate business operations.\n2. Security Obligations: You are responsible for keeping your login credentials confidential. Sharing of accounts is prohibited.\n3. Prohibited Conduct: You agree not to perform reverse engineering, vulnerability scanning, security probing, or spamming of any API endpoints.\n4. Limitation of Liability: We do not guarantee uninterrupted system access. Under no circumstances shall Luminous Ledger be liable for calculations discrepancies, tax calculation errors, retail data loss, or server downtime. Rate limit locks do not constitute a breach of service."); }}>Terms of Service</a>
              <div className="w-1 h-1 bg-[#c3c5d9] rounded-full"></div>
              <a className="text-xs text-[#737688] hover:text-[#434656] transition-colors" href="#" onClick={(e) => { e.preventDefault(); openInfo("Privacy Policy", "This Privacy Policy discloses the operational data practices of Luminous Ledger:\n\n1. Data Points Collected:\n• Work Emails & Hashed Passwords for staff authentication.\n• Full Names of staff users for audit logs.\n• Shop Profiles (Subdomain, Shop Name, GSTIN, Address, Phone, Logo).\n• Transaction & Billing records (Invoices, payment categories, quantities, amounts, dates).\n• Security & Access Logs (IP addresses logged for rate-limiting protection and administrative audit trails).\n\n2. Usage: All collected data is used exclusively to facilitate retail POS operations and secure the platform. We do not sell or monetize your store metrics.\n3. Security & Compliance: Passwords are encrypted using bcrypt hashing prior to database storage."); }}>Privacy Policy</a>
              <div className="w-1 h-1 bg-[#c3c5d9] rounded-full"></div>
              <a className="text-xs text-[#737688] hover:text-[#434656] transition-colors" href="#" onClick={(e) => { e.preventDefault(); openInfo("Help Center", "Welcome to the Support Portal:\n\n• Billing: Navigate to 'POS Billing' to search items by name/SKU and scan barcodes. Select loyalty customers for points tracking.\n• Security: Multi-tier roles restrict cashiers from inventory logs, analytics reports, and staff creators.\n• Printing: Barcodes are printed in standard format. Invoices support silent thermal printing directly to connected 80mm printers.\n• Rate Limits: Security blocks are triggered after 10 consecutive failed logins. Enter correct credentials to clear block counts."); }}>Help Center</a>
            </div>
          </div>
        </div>
      </main>

      {/* INFO MODAL */}
      {infoModal.show && (
        <div className="fixed inset-0 z-50 bg-[#131b2e]/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in select-none">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#c3c5d9]/40 space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-lg font-bold text-[#0041c8] flex items-center gap-2 border-b border-[#c3c5d9]/20 pb-3">
              <span className="material-symbols-outlined text-[#0041c8]">info</span>
              {infoModal.title}
            </h3>
            <p className="text-sm text-[#434656] whitespace-pre-line leading-relaxed">
              {infoModal.content}
            </p>
            <button
              onClick={() => setInfoModal({ show: false, title: '', content: '' })}
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

export default Login;

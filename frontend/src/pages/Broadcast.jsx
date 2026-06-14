import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';

const Broadcast = () => {
  const { isManager } = useAuth();
  const { shopProfile, updateProfile } = useShop();
  
  // Data lists
  const [customers, setCustomers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  
  // Selection / Loading states
  const [loading, setLoading] = useState(true);
  const [sendingSimulation, setSendingSimulation] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationLogs, setSimulationLogs] = useState([]);
  
  // Form values
  const [campaignName, setCampaignName] = useState('Diwali Special Offer');
  const [selectedCoupon, setSelectedCoupon] = useState('');
  const [messageText, setMessageText] = useState(
    'Hi {name},\n\nWe have a special offer for you! Use coupon code {coupon} on your next billing to get exclusive discount. You currently have {points} loyalty points in your account.\n\nHappy Shopping!'
  );
  
  // Customer selection
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [manualSendStatus, setManualSendStatus] = useState({}); // { customerId: true/false }
  const [apiSuccessBanner, setApiSuccessBanner] = useState('');
  const [custSearch, setCustSearch] = useState('');
  const [bulkQueue, setBulkQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [showQueueModal, setShowQueueModal] = useState(false);

  // Upgrade Modal states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Interactive Demo States (for Basic plan preview)
  const [demoMessage, setDemoMessage] = useState(
    'Hi {name},\n\nWe have a special 15% discount on Jeans! Use coupon code JEANS15 at checkout. You currently have {points} loyalty points.\n\nHappy Shopping!'
  );
  const [selectedDemoCustId, setSelectedDemoCustId] = useState(1);
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoLogs, setDemoLogs] = useState([]);
  const [demoSending, setDemoSending] = useState(false);
  const [demoCampaignName, setDemoCampaignName] = useState('Weekend Special Demo');

  const demoCustomers = [
    { id: 1, name: 'Alice Smith', phone: '9876543210', points: 150 },
    { id: 2, name: 'Sarah Connor', phone: '9988776655', points: 320 },
    { id: 3, name: 'John Doe', phone: '9001002003', points: 75 }
  ];

  const getDemoPreviewText = () => {
    let text = demoMessage;
    const sampleCust = demoCustomers.find(c => c.id === selectedDemoCustId) || demoCustomers[0];
    text = text.replace(/{name}/g, sampleCust.name);
    text = text.replace(/{points}/g, sampleCust.points);
    text = text.replace(/{coupon}/g, 'JEANS15');
    return text;
  };

  const handleDemoBroadcastSimulation = () => {
    setDemoSending(true);
    setDemoProgress(0);
    setDemoLogs([]);

    let step = 0;
    const interval = setInterval(() => {
      if (step >= demoCustomers.length) {
        clearInterval(interval);
        setDemoSending(false);
        setDemoLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] [Demo] Broadcast complete! Saved campaign "${demoCampaignName}" to mock logs.`
        ]);
        return;
      }

      const currentCust = demoCustomers[step];
      setDemoLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [Demo] Sent message to ${currentCust.name} (${currentCust.phone}) -> SUCCESS ✅`
      ]);

      step += 1;
      setDemoProgress(Math.round((step / demoCustomers.length) * 100));
    }, 1000);
  };

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [customersRes, couponsRes] = await Promise.all([
        api.get('/customers?limit=100'),
        api.get('/coupons')
      ]);

      if (customersRes.data.success) {
        setCustomers(customersRes.data.customers);
        // Pre-select all active customers
        setSelectedCustomerIds(customersRes.data.customers.map(c => c._id));
      }
      if (couponsRes.data.success) {
        setCoupons(couponsRes.data.coupons);
        if (couponsRes.data.coupons.length > 0) {
          setSelectedCoupon(couponsRes.data.coupons[0].code);
        }
      }
    } catch (error) {
      console.error('Failed to fetch broadcast data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Formatting preview message
  const getPreviewText = () => {
    let text = messageText;
    const sampleCust = customers.find(c => selectedCustomerIds.includes(c._id)) || {
      name: 'Jordan Smith',
      loyaltyPoints: 120
    };
    
    text = text.replace(/{name}/g, sampleCust.name);
    text = text.replace(/{points}/g, sampleCust.loyaltyPoints);
    text = text.replace(/{coupon}/g, selectedCoupon || 'NO_COUPON');
    return text;
  };

  // Helper to insert tags into text area
  const insertTag = (tag) => {
    setMessageText(prev => prev + tag);
  };

  const filteredCustomers = (customers || []).filter(c => 
    c.name.toLowerCase().includes(custSearch.toLowerCase()) || 
    (c.phone && c.phone.includes(custSearch))
  );

  // Toggle selection
  const handleToggleCustomer = (id) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleAll = () => {
    const filteredIds = filteredCustomers.map(c => c._id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedCustomerIds.includes(id));
    
    if (allFilteredSelected) {
      setSelectedCustomerIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedCustomerIds(prev => {
        const union = new Set([...prev, ...filteredIds]);
        return Array.from(union);
      });
    }
  };

  // Generate WhatsApp web link
  const getWhatsAppWebUrl = (customer) => {
    let text = messageText;
    text = text.replace(/{name}/g, customer.name);
    text = text.replace(/{points}/g, customer.loyaltyPoints || '0');
    text = text.replace(/{coupon}/g, selectedCoupon || '');

    // Format phone: strip spaces/dashes and add country code if needed (default to 91 for India if standard phone length)
    let rawPhone = customer.phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone; // Fallback to Indian code
    }
    
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const handleManualSendClick = (customerId, url) => {
    setManualSendStatus(prev => ({ ...prev, [customerId]: true }));
    window.open(url, '_blank');
  };

  const handleSendAllSelected = () => {
    if (selectedCustomerIds.length === 0) {
      alert('Please select at least one customer.');
      return;
    }

    const targetCustomers = customers.filter(c => selectedCustomerIds.includes(c._id));
    setBulkQueue(targetCustomers);
    setCurrentQueueIndex(0);
    setShowQueueModal(true);

    // Open first chat window directly inside user gesture callback to bypass popup blocker
    const firstUrl = getWhatsAppWebUrl(targetCustomers[0]);
    window.open(firstUrl, '_blank');
    setManualSendStatus(prev => ({ ...prev, [targetCustomers[0]._id]: true }));
  };

  const handleOpenNextInQueue = () => {
    const nextIndex = currentQueueIndex + 1;
    if (nextIndex < bulkQueue.length) {
      const nextCust = bulkQueue[nextIndex];
      const url = getWhatsAppWebUrl(nextCust);
      window.open(url, '_blank');
      setManualSendStatus(prev => ({ ...prev, [nextCust._id]: true }));
      setCurrentQueueIndex(nextIndex);
    }
  };

  // simulated bulk broadcast
  const handleApiBroadcastSimulation = async () => {
    if (selectedCustomerIds.length === 0) {
      alert('Please select at least one customer.');
      return;
    }

    setSendingSimulation(true);
    setSimulationProgress(0);
    setSimulationLogs([]);
    setApiSuccessBanner('');

    const targetCustomers = customers.filter(c => selectedCustomerIds.includes(c._id));
    let currentStep = 0;

    const interval = setInterval(async () => {
      if (currentStep >= targetCustomers.length) {
        clearInterval(interval);
        
        // Call backend API to record campaign activity
        try {
          const res = await api.post('/marketing/broadcast', {
            customers: selectedCustomerIds,
            message: messageText,
            campaignName
          });
          if (res.data.success) {
            setApiSuccessBanner(`Meta Cloud API Broadcast Complete! Successfully logged Campaign "${campaignName}" for ${targetCustomers.length} customers.`);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setSendingSimulation(false);
        }
        return;
      }

      const currentCust = targetCustomers[currentStep];
      setSimulationLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}] Simulated Meta API send to ${currentCust.name} (${currentCust.phone}) -> SUCCESS ✅`
      ]);

      currentStep += 1;
      setSimulationProgress(Math.round((currentStep / targetCustomers.length) * 100));
    }, 800); // Send log every 800ms
  };



  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center select-none">
        <span className="material-symbols-outlined text-[48px] text-[#0041c8] animate-spin">progress_activity</span>
      </div>
    );
  }

  if (shopProfile.plan === 'Basic') {
    return (
      <div className="space-y-gutter flex-grow flex flex-col justify-start py-8 px-margin-edge select-none">
        
        {/* Header Title block */}
        <div className="border-b border-[#c3c5d9]/20 pb-md mb-lg text-left">
          <h2 className="font-headline-lg text-headline-lg text-[#131b2e] tracking-tight flex items-center gap-sm">
            <span className="material-symbols-outlined text-[#0041c8] text-[32px]">campaign</span>
            WhatsApp Campaign Manager
          </h2>
          <p className="font-body-md text-[#434656] mt-1">
            Automate WhatsApp customer notifications, promo offers, and loyalty balance updates.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter items-stretch max-w-6xl w-full mx-auto">
          {/* Column 1: Gating Lock Card */}
          <div className="glass-panel p-xl rounded-2xl shadow-xl text-center border border-white/20 relative overflow-hidden bg-white/60 backdrop-blur-md flex flex-col justify-between items-center gap-lg min-h-[480px]">
            {/* Decorative gradients */}
            <div className="absolute -top-12 -left-12 w-48 h-48 bg-gradient-to-tr from-[#6063ee]/20 to-transparent rounded-full filter blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-gradient-to-bl from-[#0041c8]/10 to-transparent rounded-full filter blur-2xl pointer-events-none"></div>

            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#0041c8]/10 to-[#6063ee]/10 text-[#0041c8] border border-[#c3c5d9]/40 flex items-center justify-center font-bold shadow-md animate-pulse">
              <span className="material-symbols-outlined text-[36px]">lock</span>
            </div>

            <div className="space-y-sm">
              <h3 className="font-headline-md text-headline-md text-[#131b2e] tracking-tight">
                Premium Account Required
              </h3>
              <div className="inline-block px-3 py-1 text-xs font-semibold text-[#0041c8] bg-[#eaedff] border border-[#c3c5d9]/50 rounded-full">
                Upgrade to Premium / Enterprise
              </div>
              <p className="font-body-md text-xs text-[#434656] max-w-sm mx-auto pt-2 leading-relaxed">
                Your store is currently on the <strong className="text-[#0041c8]">Basic Plan</strong>. Enable this feature to run automated marketing campaigns and integrate with the official Meta APIs.
              </p>
            </div>

            {/* Premium features comparison list */}
            <div className="w-full bg-white/40 border border-[#c3c5d9]/25 rounded-xl p-md text-left space-y-sm">
              <p className="text-[10px] font-bold text-[#131b2e] tracking-wider uppercase">Included in Premium & Enterprise:</p>
              <div className="grid grid-cols-1 gap-xs text-xs text-[#434656]">
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-green-600 text-[14px]">check_circle</span>
                  <span>Automated Bulk WhatsApp Campaigns</span>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-green-600 text-[14px]">check_circle</span>
                  <span>Meta Cloud API Integration (No web tab reliance)</span>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-green-600 text-[14px]">check_circle</span>
                  <span>Expanded limits and WABA configuration</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowUpgradeModal(true)}
              className="px-8 py-3 w-full bg-gradient-to-tr from-[#0041c8] to-[#6063ee] text-white hover:opacity-95 font-bold rounded-lg shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-xs cursor-pointer text-sm"
            >
              <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
              Upgrade Subscription
            </button>
          </div>

          {/* Column 2: Interactive Sandbox Demo */}
          <div className="glass-panel p-xl rounded-2xl shadow-xl border border-white/20 bg-white/60 backdrop-blur-md flex flex-col justify-between gap-md text-left min-h-[480px]">
            <div className="flex justify-between items-center border-b border-[#c3c5d9]/20 pb-sm">
              <h3 className="font-bold text-headline-md text-[#131b2e] flex items-center gap-xs text-sm">
                <span className="material-symbols-outlined text-[#0041c8] text-[20px]">science</span>
                Interactive Sandbox Demo
              </h3>
              <span className="px-2 py-0.5 bg-yellow-100 border border-yellow-300 text-yellow-850 rounded-full text-[9px] font-bold uppercase tracking-wider">Preview Mode</span>
            </div>

            <div className="space-y-sm flex-1 flex flex-col justify-between">
              <div className="space-y-xs">
                <label className="text-[10px] font-bold text-[#434656] uppercase tracking-wider">Campaign Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-[#c3c5d9] bg-white rounded-lg outline-none text-xs"
                  value={demoCampaignName}
                  onChange={(e) => setDemoCampaignName(e.target.value)}
                />
              </div>

              <div className="space-y-xs">
                <label className="text-[10px] font-bold text-[#434656] uppercase tracking-wider">Message Template</label>
                <textarea
                  rows="3"
                  className="w-full p-3 border border-[#c3c5d9] rounded-lg outline-none bg-white text-xs leading-relaxed"
                  value={demoMessage}
                  onChange={(e) => setDemoMessage(e.target.value)}
                />
                <div className="flex gap-xs pt-1">
                  <button
                    onClick={() => setDemoMessage(prev => prev + ' {name}')}
                    className="px-2 py-1 bg-[#f2f3ff] border border-[#c3c5d9]/60 hover:bg-[#eaedff] text-[10px] font-bold text-[#0041c8] rounded"
                  >
                    + Name
                  </button>
                  <button
                    onClick={() => setDemoMessage(prev => prev + ' {points}')}
                    className="px-2 py-1 bg-[#f2f3ff] border border-[#c3c5d9]/60 hover:bg-[#eaedff] text-[10px] font-bold text-[#0041c8] rounded"
                  >
                    + Points
                  </button>
                  <button
                    onClick={() => setDemoMessage(prev => prev + ' {coupon}')}
                    className="px-2 py-1 bg-[#f2f3ff] border border-[#c3c5d9]/60 hover:bg-[#eaedff] text-[10px] font-bold text-[#0041c8] rounded"
                  >
                    + Coupon
                  </button>
                </div>
              </div>

              {/* Chat preview */}
              <div className="space-y-xs">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-[#434656] uppercase tracking-wider">Mock Chat Preview</label>
                  <select
                    className="bg-transparent border-none outline-none font-bold text-[10px] text-[#0041c8] cursor-pointer"
                    value={selectedDemoCustId}
                    onChange={(e) => setSelectedDemoCustId(Number(e.target.value))}
                  >
                    {demoCustomers.map(c => (
                      <option key={c.id} value={c.id}>Preview: {c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div 
                  style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')" }}
                  className="w-full p-sm rounded-xl shadow-inner min-h-[120px] flex flex-col justify-end bg-repeat"
                >
                  <div className="bg-[#dcf8c6] p-2 rounded-lg shadow-sm max-w-[85%] self-start text-left">
                    <p className="font-body-md text-[#131b2e] whitespace-pre-line text-[11px] leading-relaxed">{getDemoPreviewText()}</p>
                    <div className="text-[8px] text-[#737688] text-right mt-1 font-mono">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulator trigger and logs */}
              <div className="space-y-sm pt-2">
                <button
                  onClick={handleDemoBroadcastSimulation}
                  disabled={demoSending}
                  className="w-full h-10 bg-[#25D366] hover:bg-[#1ebd59] disabled:bg-gray-300 text-white font-bold rounded-lg shadow transition-all active:scale-[0.98] flex items-center justify-center gap-xs text-xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">play_circle</span>
                  {demoSending ? 'Simulating Broadcast...' : 'Run Simulation Campaign'}
                </button>

                {demoSending && (
                  <div className="space-y-xs">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-[#25D366] h-2 rounded-full transition-all duration-300" style={{ width: `${demoProgress}%` }}></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-[#737688] font-bold font-mono">
                      <span>Sending Broadcast Queue</span>
                      <span>{demoProgress}%</span>
                    </div>
                  </div>
                )}

                {demoLogs.length > 0 && (
                  <div className="bg-[#131b2e] text-green-400 font-mono text-[9px] p-2 rounded-lg h-20 overflow-y-auto space-y-xs custom-scrollbar">
                    {demoLogs.map((log, i) => (
                      <p key={i}>{log}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 select-none animate-fade-in">
            <div className="glass-panel p-xl rounded-xl shadow-2xl max-w-md w-full space-y-lg relative animate-scaleUp text-left bg-white">
              <div className="flex items-center justify-between border-b border-[#c3c5d9]/30 pb-sm">
                <h3 className="font-bold text-headline-md text-[#131b2e] flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[#0041c8] text-[24px]">verified_user</span>
                  Plan Upgrade Request
                </h3>
                <button 
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-[#737688] hover:text-[#131b2e] p-1 hover:bg-[#eaedff] rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-md">
                <p className="text-xs text-[#434656] leading-relaxed">
                  To upgrade your subscription plan and activate Premium or Enterprise features:
                </p>
                
                <div className="p-md rounded-lg bg-[#f2f3ff] border border-[#0041c8]/10 text-xs text-[#131b2e] space-y-sm">
                  <p className="font-semibold">Activation Steps:</p>
                  <ul className="list-decimal list-inside space-y-xs text-[#434656]">
                    <li>Contact store administration at <strong className="text-[#0041c8]">support@luminous.com</strong>.</li>
                    <li>Provide your Store Subdomain/Slug: <strong className="font-mono text-[#0041c8]">{shopProfile.slug || 'your subdomain'}</strong></li>
                    <li>The administrator will review your store request and update the subscription plan.</li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowUpgradeModal(false)}
                className="w-full h-11 bg-[#0041c8] text-white hover:opacity-90 font-bold rounded-lg shadow-md transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-gutter flex-grow flex flex-col select-none">
      
      {/* Header */}
      <div>
        <h2 className="font-headline-lg text-headline-lg text-[#131b2e]">WhatsApp Marketing Broadcaster</h2>
        <p className="font-body-md text-[#434656] mt-1">Compose dynamic campaigns, link promotional coupons, and broadcast messages to customer logs.</p>
      </div>

      {/* Main Campaign Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter flex-1 items-start">
        
        {/* Left 2 Columns: Composer and Preview */}
        <div className="lg:col-span-2 space-y-gutter">
          
          {/* Campaign Details Form */}
          <div className="glass-panel p-lg rounded-xl space-y-md">
            <h3 className="font-bold text-headline-md text-[#131b2e] pb-sm border-b border-[#c3c5d9]/30">Campaign Details</h3>
            
            <div className="grid grid-cols-2 gap-md">
              <div className="space-y-xs col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-[#434656] px-1">Campaign Name</label>
                <input
                  type="text"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all bg-white"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>

              <div className="space-y-xs col-span-2 md:col-span-1">
                <label className="text-xs font-bold text-[#434656] px-1">Select Promo Coupon</label>
                <select
                  class="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8]"
                  value={selectedCoupon}
                  onChange={(e) => setSelectedCoupon(e.target.value)}
                >
                  <option value="">No Coupon</option>
                  {coupons.map((c) => (
                    <option key={c._id} value={c.code}>{c.code} ({c.discountType === 'Percentage' ? `${c.discountValue}%` : `₹${c.discountValue}`})</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2 space-y-xs">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-[#434656]">Message Template</label>
                  <span className="text-[10px] text-[#737688]">Use tags to personalize messages</span>
                </div>
                <textarea
                  rows="6"
                  class="w-full p-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all bg-white font-body-md leading-relaxed"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
                
                {/* Insert Tag Helpers */}
                <div className="flex flex-wrap gap-xs pt-1">
                  <button
                    type="button"
                    onClick={() => insertTag(' {name} ')}
                    className="px-md py-sm bg-[#eaedff] text-[#0041c8] rounded-lg text-xs font-semibold hover:bg-[#dae2fd] transition-colors"
                  >
                    + Customer Name
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTag(' {points} ')}
                    className="px-md py-sm bg-[#eaedff] text-[#0041c8] rounded-lg text-xs font-semibold hover:bg-[#dae2fd] transition-colors"
                  >
                    + Loyalty Points
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTag(' {coupon} ')}
                    className="px-md py-sm bg-[#eaedff] text-[#0041c8] rounded-lg text-xs font-semibold hover:bg-[#dae2fd] transition-colors"
                  >
                    + Coupon Code
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp Preview Card */}
          <div className="glass-panel p-lg rounded-xl space-y-md">
            <h3 className="font-bold text-headline-md text-[#131b2e] pb-sm border-b border-[#c3c5d9]/30">WhatsApp Message Preview</h3>
            
            <div 
              style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')" }}
              className="w-full max-w-md mx-auto p-lg rounded-xl shadow-inner min-h-[160px] flex flex-col justify-end bg-repeat"
            >
              <div className="bg-[#dcf8c6] p-md rounded-lg shadow-sm max-w-[85%] self-start relative text-left">
                <p className="font-body-md text-[#131b2e] whitespace-pre-line text-xs">{getPreviewText()}</p>
                <div className="text-[9px] text-[#737688] text-right mt-1 font-mono">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          </div>

          {/* simulated Broadcaster UI */}
          <div className="glass-panel p-lg rounded-xl space-y-md">
            <div className="flex items-center justify-between border-b border-[#c3c5d9]/30 pb-sm">
              <h3 className="font-bold text-headline-md text-[#131b2e]">
                {shopProfile.metaApiEnabled ? 'Automated Bulk Broadcaster' : 'Simulated Bulk Broadcaster'}
              </h3>
              <span className={`px-sm py-1 font-mono text-[9px] font-bold rounded-full ${
                shopProfile.metaApiEnabled 
                  ? 'bg-green-100 border border-green-300 text-green-800' 
                  : 'bg-green-50 border border-green-200 text-green-700'
              }`}>
                {shopProfile.metaApiEnabled ? 'Automated Gateway Active' : 'Meta Cloud API V2'}
              </span>
            </div>

            {/* Disclaimer Banner */}
            {shopProfile.metaApiEnabled ? (
              <div className="p-md rounded-lg border border-green-200 bg-green-50/50 text-green-800 text-xs flex flex-col gap-1 select-none">
                <div className="flex items-center gap-xs font-bold text-green-900">
                  <span className="material-symbols-outlined text-[16px] text-green-600">verified_user</span>
                  Automated Meta Cloud API Gateway Active
                </div>
                <p className="leading-relaxed">
                  Bulk campaigns are sent automatically to clients' phones in the background. No manual chat window popups are required.
                </p>
              </div>
            ) : (
              <div className="p-md rounded-lg border border-amber-200 bg-amber-50/50 text-amber-800 text-xs flex flex-col gap-1 select-none">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-xs font-bold text-amber-900">
                      <span className="material-symbols-outlined text-[16px]">warning</span>
                      Meta Cloud API Simulation Mode
                    </div>
                    <p className="leading-relaxed">
                      This bulk panel runs in <strong>simulated sandbox mode</strong>. It does not send real messages to customers' phones.
                    </p>
                    <p className="leading-relaxed font-semibold">
                      To send actual WhatsApp messages, use the green "Send Chat" buttons on the right directory list.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUpgradeModal(true);
                    }}
                    className="shrink-0 px-md py-2 bg-[#0041c8] text-white rounded-lg text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
                  >
                    Enable Automated API
                  </button>
                </div>
              </div>
            )}

            {apiSuccessBanner && (
              <div className="p-md rounded-lg border border-green-200 bg-green-50 text-green-800 text-xs font-semibold flex items-center gap-xs">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {apiSuccessBanner}
              </div>
            )}

            <div className="space-y-md">
              <div className="flex justify-between items-center text-xs font-bold text-[#434656]">
                <span>{shopProfile.metaApiEnabled ? 'Campaign Dispatch Progress' : 'Broadcast Progress'}</span>
                <span className="text-[#0041c8]">{simulationProgress}% ({selectedCustomerIds.length} Selected)</span>
              </div>
              <div className="w-full bg-[#eaedff] rounded-full h-3 overflow-hidden">
                <div className="bg-[#0041c8] h-3 transition-all duration-300" style={{ width: `${simulationProgress}%` }}></div>
              </div>

              <div className="flex flex-col md:flex-row gap-md">
                <button
                  type="button"
                  disabled={sendingSimulation || selectedCustomerIds.length === 0}
                  onClick={handleApiBroadcastSimulation}
                  className="flex-1 h-11 border border-[#0041c8] text-[#0041c8] hover:bg-[#eaedff] font-semibold rounded-lg active:scale-95 transition-all shadow-sm flex items-center justify-center gap-xs disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {shopProfile.metaApiEnabled ? 'forward_to_inbox' : 'analytics'}
                  </span>
                  {shopProfile.metaApiEnabled ? 'Launch Bulk Campaign' : 'Launch Simulated Campaign'}
                </button>
                <button
                  type="button"
                  disabled={selectedCustomerIds.length === 0}
                  onClick={handleSendAllSelected}
                  className="flex-1 h-11 bg-[#25D366] hover:bg-[#1ebd59] text-white font-semibold rounded-lg active:scale-95 transition-all shadow-md flex items-center justify-center gap-xs disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[20px]">chat</span>
                  Send to All Selected (Real)
                </button>
              </div>

              {simulationLogs.length > 0 && (
                <div className="bg-[#131b2e] text-green-400 font-mono text-[10px] p-md rounded-lg h-32 overflow-y-auto space-y-xs custom-scrollbar">
                  {simulationLogs.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Target Customers Selector */}
        <div className="glass-panel p-lg rounded-xl space-y-md h-[640px] flex flex-col">
          <div className="border-b border-[#c3c5d9]/30 pb-sm space-y-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-headline-md text-[#131b2e]">Target Directory</h3>
              <label className="flex items-center gap-xs text-xs font-bold text-[#434656] cursor-pointer">
                <input
                  type="checkbox"
                  checked={filteredCustomers.length > 0 && filteredCustomers.every(c => selectedCustomerIds.includes(c._id))}
                  onChange={handleToggleAll}
                  className="rounded text-[#0041c8] focus:ring-[#0041c8]"
                />
                Filter All
              </label>
            </div>
            <p className="text-[11px] text-[#737688]">{selectedCustomerIds.length} of {customers.length} selected</p>
            
            {/* Search Input */}
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#737688] group-focus-within:text-[#0041c8] transition-colors">search</span>
              <input
                type="text"
                placeholder="Search name or phone..."
                className="w-full h-8 pl-8 pr-2 border border-[#c3c5d9] bg-white rounded-lg outline-none text-xs focus:border-[#0041c8] transition-all"
                value={custSearch}
                onChange={(e) => setCustSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-sm pr-1 custom-scrollbar">
            {filteredCustomers.map((c) => {
              const waLink = getWhatsAppWebUrl(c);
              const hasSent = manualSendStatus[c._id];
              return (
                <div key={c._id} className="p-sm rounded-lg bg-white/40 border border-[#c3c5d9]/20 flex flex-col justify-between gap-xs hover:border-[#c3c5d9]/60 transition-colors">
                  <div className="flex items-start gap-sm">
                    <input
                      type="checkbox"
                      checked={selectedCustomerIds.includes(c._id)}
                      onChange={() => handleToggleCustomer(c._id)}
                      className="rounded text-[#0041c8] focus:ring-[#0041c8] mt-0.5"
                    />
                    <div className="overflow-hidden">
                      <p className="font-semibold text-xs text-[#131b2e] truncate">{c.name}</p>
                      <p className="text-[10px] text-[#737688] font-mono">{c.phone}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-1 border-t border-[#c3c5d9]/10 pt-1">
                    <span className="text-[9.5px] text-[#434656] font-semibold">Points: {c.loyaltyPoints || 0}</span>
                    <button
                      type="button"
                      onClick={() => handleManualSendClick(c._id, waLink)}
                      className={`h-7 px-sm text-[10px] font-bold rounded-lg flex items-center gap-xs transition-colors ${
                        hasSent 
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-[#25D366] text-white hover:bg-[#1ebd59]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">chat</span>
                      {hasSent ? 'Opened Chat' : 'Send Chat'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* WHATSAPP BULK SENDER QUEUE MODAL */}
      {showQueueModal && (
        <div className="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg animate-fade-in select-none">
          <div className="bg-white rounded-xl max-w-md w-full p-lg shadow-2xl glass-panel relative border border-[#c3c5d9]/40 space-y-md">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#c3c5d9]/25 pb-sm">
              <h3 className="font-bold text-headline-md text-[#131b2e] flex items-center gap-xs">
                <span className="material-symbols-outlined text-[#25D366]">chat</span>
                WhatsApp Broadcast Queue
              </h3>
              <button 
                onClick={() => setShowQueueModal(false)}
                className="text-[#737688] hover:text-[#131b2e]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Info Message */}
            <p className="text-[11px] text-[#434656] leading-relaxed">
              Browsers block opening multiple tabs automatically to protect users. We have queued your broadcast. Click the button below to open the next chat.
            </p>

            {/* Progress status */}
            <div className="space-y-xs">
              <div className="flex justify-between text-xs font-bold text-[#131b2e]">
                <span>Progress</span>
                <span>{currentQueueIndex + 1} of {bulkQueue.length} Opened</span>
              </div>
              <div className="w-full bg-[#eaedff] rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-[#25D366] h-2.5 transition-all duration-300" 
                  style={{ width: `${((currentQueueIndex + 1) / bulkQueue.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-sm">
              {currentQueueIndex + 1 < bulkQueue.length ? (
                <button
                  type="button"
                  onClick={handleOpenNextInQueue}
                  className="w-full h-12 bg-[#25D366] hover:bg-[#1ebd59] text-white font-bold rounded-lg shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-xs"
                >
                  <span className="material-symbols-outlined text-[20px]">send</span>
                  Open Next Chat: {bulkQueue[currentQueueIndex + 1]?.name}
                </button>
              ) : (
                <div className="p-md bg-green-50 border border-green-200 text-green-800 text-xs font-bold rounded-lg text-center flex items-center justify-center gap-xs">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  All queued chats have been opened!
                </div>
              )}
            </div>

            {/* List of targets */}
            <div className="max-h-48 overflow-y-auto pr-1 border border-[#c3c5d9]/30 rounded-lg custom-scrollbar bg-gray-50/50 p-sm space-y-sm">
              {bulkQueue.map((c, idx) => {
                const isOpened = idx <= currentQueueIndex;
                const isCurrent = idx === currentQueueIndex + 1;
                return (
                  <div 
                    key={c._id} 
                    className={`p-sm rounded flex items-center justify-between text-xs transition-colors ${
                      isCurrent 
                        ? 'bg-[#eaedff] border border-[#0041c8]/30 font-semibold text-[#0041c8]' 
                        : isOpened 
                          ? 'opacity-60 text-green-700 bg-green-50/50' 
                          : 'text-[#434656]'
                    }`}
                  >
                    <div>
                      <span>{idx + 1}. {c.name}</span>
                      <span className="text-[10px] text-[#737688] font-mono block">{c.phone}</span>
                    </div>
                    <div>
                      {isOpened ? (
                        <span className="text-[10px] font-bold text-green-600 flex items-center gap-base">
                          <span className="material-symbols-outlined text-[12px]">check</span> Opened
                        </span>
                      ) : isCurrent ? (
                        <span className="text-[10px] font-bold text-[#0041c8] animate-pulse">Next</span>
                      ) : (
                        <span className="text-[10px] text-[#737688]">Pending</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Close queue */}
            <button
              onClick={() => setShowQueueModal(false)}
              className="w-full h-10 border border-[#c3c5d9] hover:bg-[#eaedff] text-[#434656] font-semibold rounded-lg text-xs"
            >
              Cancel Broadcast Queue
            </button>

          </div>
        </div>
      )}
      {/* UPGRADE META CLOUD API MODAL */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 select-none animate-fade-in">
          <div className="glass-panel p-xl rounded-xl shadow-2xl max-w-md w-full space-y-lg relative animate-scaleUp text-left">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#c3c5d9]/30 pb-sm">
              <h3 className="font-bold text-headline-md text-[#131b2e] flex items-center gap-xs">
                <span className="material-symbols-outlined text-[#0041c8] text-[24px]">verified_user</span>
                Meta Cloud API Integration
              </h3>
              <button 
                onClick={() => setShowUpgradeModal(false)}
                className="text-[#737688] hover:text-[#131b2e] p-1 hover:bg-[#eaedff] rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-md">
              <p className="text-xs text-[#434656] leading-relaxed">
                To activate the **Official Meta WhatsApp API Gateway** and enable automated background broadcasts (without manual chat tabs):
              </p>
              
              <div className="p-md rounded-lg bg-[#f2f3ff] border border-[#0041c8]/10 text-xs text-[#131b2e] space-y-sm">
                <p className="font-semibold">Activation Steps:</p>
                <ul className="list-decimal list-inside space-y-xs text-[#434656]">
                  <li>Contact store administration at <strong className="text-[#0041c8]">support@luminous.com</strong>.</li>
                  <li>Provide your WhatsApp Business Account (WABA) details.</li>
                  <li>The administrator will verify WABA details and configure the automated API gateway.</li>
                </ul>
              </div>

              <p className="text-[11px] text-[#737688] italic">
                *Subscription package fees may apply. Contact store administration for pricing details.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowUpgradeModal(false)}
              className="w-full h-11 bg-[#0041c8] text-white hover:opacity-90 font-bold rounded-lg shadow-md transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Broadcast;

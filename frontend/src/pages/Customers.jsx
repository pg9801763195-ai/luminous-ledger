import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Customers = () => {
  const { isManager } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Pagination
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Profile modal states
  const [selectedCustId, setSelectedCustId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Edit/Create modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editCustId, setEditCustId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    loyaltyPoints: 0,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // WhatsApp composer states
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waCustomer, setWaCustomer] = useState(null);
  const [waCoupons, setWaCoupons] = useState([]);
  const [selectedWaCoupon, setSelectedWaCoupon] = useState('');
  const [waMessage, setWaMessage] = useState(
    'Hi {name},\n\nWe have a special offer for you! Use coupon code {coupon} to get exclusive discount. You currently have {points} loyalty points in your account.\n\nHappy Shopping!'
  );

  const handleOpenWhatsAppModal = async (cust) => {
    setWaCustomer(cust);
    setShowWhatsAppModal(true);
    try {
      const res = await api.get('/coupons');
      if (res.data.success) {
        const activeCoupons = (res.data.coupons || []).filter(c => {
          const isExpired = c.expiryDate && new Date(c.expiryDate) < new Date();
          return !isExpired;
        });
        setWaCoupons(activeCoupons);
        if (activeCoupons.length > 0) {
          setSelectedWaCoupon(activeCoupons[0].code);
        } else {
          setSelectedWaCoupon('');
        }
      }
    } catch (err) {
      console.error('Error fetching coupons', err);
    }
  };

  const getWhatsAppMessagePreview = () => {
    if (!waCustomer) return '';
    let text = waMessage;
    text = text.replace(/{name}/g, waCustomer.name);
    text = text.replace(/{points}/g, waCustomer.loyaltyPoints || '0');
    text = text.replace(/{coupon}/g, selectedWaCoupon || 'NO_COUPON');
    return text;
  };

  const handleSendWhatsAppMessage = async () => {
    if (!waCustomer) return;
    const finalMessage = getWhatsAppMessagePreview();
    
    // 1. Generate WhatsApp Web URL
    let cleanPhone = waCustomer.phone || '';
    cleanPhone = cleanPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMessage)}`;
    
    // 2. Call backend to log this campaign in the database
    try {
      await api.post('/marketing/broadcast', {
        customers: [waCustomer._id],
        message: finalMessage,
        campaignName: 'Direct WhatsApp Offer'
      });
    } catch (err) {
      console.error('Failed to log campaign activity', err);
    }
    
    // 3. Open WhatsApp Web
    window.open(url, '_blank');
    setShowWhatsAppModal(false);
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/customers?page=${page}&search=${search}`);
      if (res.data.success) {
        setCustomers(res.data.customers);
        setTotalPages(res.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching customers', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearch(searchParam);
      const fetchWithSearch = async () => {
        try {
          setLoading(true);
          const res = await api.get(`/customers?page=1&search=${encodeURIComponent(searchParam)}`);
          if (res.data.success) {
            setCustomers(res.data.customers);
            setTotalPages(res.data.pagination.pages);
          }
        } catch (error) {
          console.error('Error fetching customers', error);
        } finally {
          setLoading(false);
        }
      };
      fetchWithSearch();
    }
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchCustomers();
  };

  const handleOpenCreate = () => {
    setEditCustId(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      loyaltyPoints: 0,
    });
    setShowFormModal(true);
  };

  const handleOpenEdit = (e, cust) => {
    e.stopPropagation(); // Avoid opening profile modal
    setEditCustId(cust._id);
    setFormData({
      name: cust.name,
      phone: cust.phone || '',
      email: cust.email || '',
      loyaltyPoints: cust.loyaltyPoints || 0,
    });
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (formSubmitting) return;
    try {
      setFormSubmitting(true);
      if (editCustId) {
        const res = await api.put(`/customers/${editCustId}`, formData);
        if (res.data.success) {
          setShowFormModal(false);
          fetchCustomers();
        }
      } else {
        const res = await api.post('/customers', formData);
        if (res.data.success) {
          setShowFormModal(false);
          fetchCustomers();
        }
      }
    } catch (error) {
      console.error('Error saving customer profile', error);
      alert(error.response?.data?.message || 'Failed to save customer profile');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation(); // Avoid opening profile
    if (window.confirm(`Are you sure you want to delete customer file for "${name}"?`)) {
      try {
        const res = await api.delete(`/customers/${id}`);
        if (res.data.success) {
          fetchCustomers();
        }
      } catch (error) {
        console.error('Error deleting customer file', error);
        alert(error.response?.data?.message || 'Failed to delete customer');
      }
    }
  };

  // Open customer profile details (Invoice history)
  const handleOpenProfile = async (id) => {
    try {
      setSelectedCustId(id);
      setProfileLoading(true);
      const res = await api.get(`/customers/${id}`);
      if (res.data.success) {
        setProfileData(res.data);
      }
    } catch (error) {
      console.error('Error loading customer profile history', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const triggerPDFDownload = (invoiceId, invoiceNumber) => {
    api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `invoice-${invoiceNumber}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((err) => {
        console.error('Failed to download invoice PDF', err);
        alert('Failed to generate PDF. Check server logs.');
      });
  };

  return (
    <div class="space-y-gutter flex-grow flex flex-col select-none">
      {/* Title & Action */}
      <div class="flex items-end justify-between">
        <div>
          <h2 class="font-headline-lg text-headline-lg text-[#131b2e]">Customer Management</h2>
          <p class="font-body-md text-[#434656] mt-1">Track loyalty rewards, contacts, and purchase frequencies.</p>
        </div>
        <button
          onClick={handleOpenCreate}
          class="px-lg py-md bg-[#0041c8] text-white rounded-lg font-label-sm flex items-center gap-sm shadow-lg shadow-[#0041c8]/20 hover:opacity-90 transition-all active:scale-95"
        >
          <span class="material-symbols-outlined text-[18px]">person_add</span>
          New Customer
        </button>
      </div>

      {/* Filter panel */}
      <div class="glass-panel p-md rounded-xl flex items-center gap-md">
        <form onSubmit={handleSearchSubmit} class="flex items-center gap-sm flex-grow max-w-md">
          <input
            type="text"
            placeholder="Search by name, email, or phone number..."
            class="flex-grow h-10 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="submit"
            class="px-md h-10 bg-[#0041c8] text-white rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Customers List Table */}
      <div class="glass-panel rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col justify-between">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-[#f2f3ff]/50 sticky top-0 backdrop-blur-md">
              <tr>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Client Name</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Phone Number</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Email Address</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Loyalty Points</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Purchase Count</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Total Spendings</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#c3c5d9]/20 font-body-md">
              {loading ? (
                <tr>
                  <td colspan="7" class="text-center py-xl">
                    <span class="material-symbols-outlined text-[36px] text-[#0041c8] animate-spin">progress_activity</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colspan="7" class="px-lg py-xl text-center text-[#737688]">No customer files seeded or found</td>
                </tr>
              ) : (
                customers.map((cust) => (
                  <tr
                    key={cust._id}
                    onClick={() => handleOpenProfile(cust._id)}
                    class="hover:bg-[#0041c8]/5 transition-colors group cursor-pointer"
                  >
                    <td class="px-lg py-md font-bold text-[#131b2e] flex items-center gap-sm">
                      <div class="w-8 h-8 rounded-full bg-[#0041c8]/10 text-[#0041c8] flex items-center justify-center font-bold text-xs">
                        {cust.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      {cust.name}
                    </td>
                    <td class="px-lg py-md font-mono text-[#434656]">{cust.phone || 'N/A'}</td>
                    <td class="px-lg py-md text-[#434656]">{cust.email || 'N/A'}</td>
                    <td class="px-lg py-md">
                      <span class="px-sm py-1 bg-[#6ffbbe]/20 text-[#005c3e] rounded-full font-mono font-bold text-xs">
                        {cust.loyaltyPoints} pts
                      </span>
                    </td>
                    <td class="px-lg py-md font-mono text-[#434656]">{cust.purchaseCount} visits</td>
                    <td class="px-lg py-md font-mono font-bold text-[#131b2e]">₹{cust.totalSpent.toFixed(2)}</td>
                    <td class="px-lg py-md">
                      <div class="flex items-center gap-sm">
                        <button
                          onClick={(e) => handleOpenEdit(e, cust)}
                          class="p-1 text-[#0041c8] hover:bg-[#0041c8]/5 rounded transition-colors"
                          title="Edit Customer Profile"
                        >
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        {cust.phone && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenWhatsAppModal(cust);
                            }}
                            class="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Send WhatsApp Offer"
                          >
                            <span class="material-symbols-outlined text-[18px]">chat</span>
                          </button>
                        )}
                        {isManager && (
                          <button
                            onClick={(e) => handleDelete(e, cust._id, cust.name)}
                            class="p-1 text-[#ba1a1a] hover:bg-red-50 rounded transition-colors"
                            title="Delete File"
                          >
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls footer */}
        {totalPages > 1 && (
          <div class="px-lg py-md bg-white/30 flex items-center justify-between border-t border-[#c3c5d9]/30">
            <p class="text-label-sm text-[#434656]">Showing page {page} of {totalPages}</p>
            <div class="flex gap-sm">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                class="p-2 rounded-lg border border-[#c3c5d9] hover:bg-[#eaedff] transition-colors disabled:opacity-30"
              >
                <span class="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                class="p-2 rounded-lg border border-[#c3c5d9] hover:bg-[#eaedff] transition-colors disabled:opacity-30"
              >
                <span class="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NEW/EDIT CUSTOMER MODAL */}
      {showFormModal && (
        <div class="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg">
          <div class="bg-white rounded-xl max-w-sm w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40">
            <h3 class="font-bold text-headline-md text-[#131b2e] mb-lg flex items-center gap-sm">
              <span class="material-symbols-outlined text-[#0041c8]">{editCustId ? 'edit' : 'person_add'}</span>
              {editCustId ? 'Edit Customer Info' : 'Create Customer profile'}
            </h3>

            <form onSubmit={handleFormSubmit} class="space-y-md">
              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Smith"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 555-0101"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. jordan@company.com"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {editCustId && (
                <div class="space-y-xs">
                  <label class="text-xs font-bold text-[#434656] px-1">Loyalty Points</label>
                  <input
                    type="number"
                    min="0"
                    class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all font-mono"
                    value={formData.loyaltyPoints}
                    onChange={(e) => setFormData({ ...formData, loyaltyPoints: parseInt(e.target.value, 10) || 0 })}
                  />
                </div>
              )}

              <div class="flex gap-md pt-lg border-t border-[#c3c5d9]/20">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  class="flex-grow h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : 'Save File'}
                </button>
                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={() => setShowFormModal(false)}
                  class="h-11 px-4 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg active:scale-95 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER PROFILE VISUAL DRILL DOWN OVERLAY */}
      {selectedCustId && profileData && (
        <div class="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg">
          <div class="bg-white rounded-xl max-w-2xl w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col">
            <button
              onClick={() => {
                setSelectedCustId(null);
                setProfileData(null);
              }}
              class="absolute top-4 right-4 p-1 hover:bg-[#dae2fd]/40 rounded-full transition-colors text-[#434656]"
            >
              <span class="material-symbols-outlined text-[24px]">close</span>
            </button>

            {/* Profile Overview Header */}
            <div class="flex items-center gap-md border-b border-[#c3c5d9]/30 pb-lg mb-lg">
              <div class="w-14 h-14 rounded-full bg-[#0041c8]/10 text-[#0041c8] flex items-center justify-center font-bold text-headline-md shrink-0">
                {profileData.customer.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div class="flex-grow">
                <h3 class="font-bold text-headline-md text-[#131b2e] leading-snug">{profileData.customer.name}</h3>
                <div class="flex items-center gap-md text-xs text-[#737688] font-mono mt-1">
                  <span>Phone: {profileData.customer.phone || 'N/A'}</span>
                  <span>|</span>
                  <span>Email: {profileData.customer.email || 'N/A'}</span>
                </div>
              </div>
              {profileData.customer.phone && (
                <button
                  onClick={() => handleOpenWhatsAppModal(profileData.customer)}
                  class="px-md h-9 bg-[#25D366] hover:bg-[#1ebd59] text-white font-semibold rounded-lg flex items-center justify-center gap-xs shadow-sm text-xs transition-colors shrink-0"
                >
                  <span class="material-symbols-outlined text-[16px]">chat</span>
                  Send WhatsApp Offer
                </button>
              )}
            </div>

            {/* KPI quick metrics */}
            <div class="grid grid-cols-3 gap-md mb-lg">
              <div class="p-md bg-[#faf8ff] rounded-lg border border-[#c3c5d9]/30">
                <span class="text-[10px] uppercase font-bold text-[#737688]">Total Spendings</span>
                <p class="font-mono text-body-lg font-bold text-[#0041c8] mt-1">₹{profileData.totalSpent.toFixed(2)}</p>
              </div>
              <div class="p-md bg-[#faf8ff] rounded-lg border border-[#c3c5d9]/30">
                <span class="text-[10px] uppercase font-bold text-[#737688]">Loyalty Balance</span>
                <p class="font-mono text-body-lg font-bold text-[#005c3e] mt-1">{profileData.customer.loyaltyPoints} pts</p>
              </div>
              <div class="p-md bg-[#faf8ff] rounded-lg border border-[#c3c5d9]/30">
                <span class="text-[10px] uppercase font-bold text-[#737688]">Visits Count</span>
                <p class="font-mono text-body-lg font-bold text-[#131b2e] mt-1">{profileData.purchaseCount} times</p>
              </div>
            </div>

            {/* Invoices List History */}
            <h4 class="font-bold text-body-md text-[#131b2e] mb-sm">Purchase Invoices History</h4>
            <div class="border border-[#c3c5d9]/30 rounded-lg overflow-hidden flex-1">
              <div class="overflow-x-auto max-h-[260px] custom-scrollbar">
                <table class="w-full text-left text-sm">
                  <thead class="bg-[#f2f3ff]/50 sticky top-0 backdrop-blur-md">
                    <tr>
                      <th class="p-3 text-xs font-bold text-[#434656]">Invoice Number</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">Serving Cashier</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">Payment Status</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">Grand Total</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">Date</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[#c3c5d9]/20">
                    {profileData.purchaseHistory.length === 0 ? (
                      <tr>
                        <td colspan="6" class="p-4 text-center text-[#737688]">No invoice purchases recorded</td>
                      </tr>
                    ) : (
                      profileData.purchaseHistory.map((inv) => (
                        <tr key={inv._id} class="hover:bg-[#0041c8]/5 transition-colors group">
                          <td class="p-3 font-mono font-bold text-[#131b2e]">{inv.invoiceNumber}</td>
                          <td class="p-3 text-[#434656]">{inv.cashier ? inv.cashier.name : 'System'}</td>
                          <td class="p-3">
                            <span class={`px-sm py-0.5 rounded-full text-[10px] font-bold ${
                              inv.paymentStatus === 'Paid' ? 'bg-[#83ffc6]/20 text-[#005c3e]' : 'bg-[#ffdad6] text-[#ba1a1a]'
                            }`}>
                              {inv.paymentStatus}
                            </span>
                          </td>
                          <td class="p-3 font-mono font-bold text-[#131b2e]">₹{inv.grandTotal.toFixed(2)}</td>
                          <td class="p-3 font-mono text-[#737688] text-xs">
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </td>
                          <td class="p-3">
                            <button
                              onClick={() => triggerPDFDownload(inv._id, inv.invoiceNumber)}
                              class="text-[#0041c8] hover:bg-[#0041c8]/5 p-1 rounded transition-colors"
                              title="Download PDF Invoice"
                            >
                              <span class="material-symbols-outlined text-[16px]">download</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* WHATSAPP OFFER COMPOSER MODAL */}
      {showWhatsAppModal && waCustomer && (
        <div class="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg animate-fade-in select-none">
          <div class="bg-white rounded-xl max-w-lg w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40 space-y-md">
            <h3 class="font-bold text-headline-md text-[#131b2e] flex items-center gap-sm pb-sm border-b border-[#c3c5d9]/30">
              <span class="material-symbols-outlined text-[#25D366]">chat</span>
              Send Offer to {waCustomer.name}
            </h3>

            <div class="grid grid-cols-2 gap-md">
              <div class="space-y-xs col-span-2 md:col-span-1">
                <label class="text-xs font-bold text-[#434656] px-1">Customer Phone</label>
                <input
                  type="text"
                  disabled
                  class="w-full h-11 px-3 border border-[#c3c5d9] bg-gray-100 rounded-lg outline-none font-mono text-xs"
                  value={waCustomer.phone}
                />
              </div>

              <div class="space-y-xs col-span-2 md:col-span-1">
                <label class="text-xs font-bold text-[#434656] px-1">Select Promo Coupon</label>
                <select
                  class="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8] text-xs font-bold"
                  value={selectedWaCoupon}
                  onChange={(e) => setSelectedWaCoupon(e.target.value)}
                >
                  <option value="">No Coupon</option>
                  {waCoupons.map((c) => (
                    <option key={c._id} value={c.code}>
                      {c.code} ({c.discountType === 'Percentage' ? `${c.discountValue}%` : `₹${c.discountValue}`})
                    </option>
                  ))}
                </select>
              </div>

              <div class="col-span-2 space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Message Template</label>
                <textarea
                  rows="4"
                  class="w-full p-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] bg-white text-xs leading-relaxed"
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                />
              </div>
            </div>

            {/* Live Preview section */}
            <div class="space-y-xs">
              <label class="text-xs font-bold text-[#434656] px-1">WhatsApp Message Preview</label>
              <div 
                style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')" }}
                className="w-full p-lg rounded-xl shadow-inner min-h-[120px] flex flex-col justify-end bg-repeat"
              >
                <div class="bg-[#dcf8c6] p-md rounded-lg shadow-sm max-w-[85%] self-start text-left">
                  <p class="font-body-md text-[#131b2e] whitespace-pre-line text-[11px] leading-relaxed">{getWhatsAppMessagePreview()}</p>
                  <div class="text-[8px] text-[#737688] text-right mt-1 font-mono">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            </div>

            <div class="flex gap-md pt-lg border-t border-[#c3c5d9]/20">
              <button
                onClick={handleSendWhatsAppMessage}
                class="flex-grow h-11 bg-[#25D366] hover:bg-[#1ebd59] text-white font-semibold rounded-lg flex items-center justify-center gap-xs shadow-md transition-all active:scale-95"
              >
                <span class="material-symbols-outlined text-[20px]">send</span>
                Send on WhatsApp
              </button>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                class="h-11 px-4 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg transition-all active:scale-95"
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

export default Customers;

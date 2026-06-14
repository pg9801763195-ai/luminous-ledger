import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Suppliers = () => {
  const { isManager } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
  });

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/suppliers?search=${search}`);
      if (res.data.success) {
        setSuppliers(res.data.suppliers);
      }
    } catch (error) {
      console.error('Error fetching suppliers list', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSuppliers();
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (sup) => {
    setEditId(sup._id);
    setFormData({
      name: sup.name,
      contactPerson: sup.contactPerson || '',
      email: sup.email || '',
      phone: sup.phone || '',
      address: sup.address || '',
    });
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        const res = await api.put(`/suppliers/${editId}`, formData);
        if (res.data.success) {
          setShowModal(false);
          fetchSuppliers();
        }
      } else {
        const res = await api.post('/suppliers', formData);
        if (res.data.success) {
          setShowModal(false);
          fetchSuppliers();
        }
      }
    } catch (error) {
      console.error('Error saving supplier info', error);
      alert(error.response?.data?.message || 'Failed to save supplier details');
    }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete supplier "${name}"? This will unlink them from any associated products.`)) {
      try {
        const res = await api.delete(`/suppliers/${id}`);
        if (res.data.success) {
          fetchSuppliers();
        }
      } catch (error) {
        console.error('Error deleting supplier', error);
        alert(error.response?.data?.message || 'Failed to delete supplier');
      }
    }
  };

  return (
    <div class="space-y-gutter flex-grow flex flex-col select-none">
      {/* Title block */}
      <div class="flex items-end justify-between">
        <div>
          <h2 class="font-headline-lg text-headline-lg text-[#131b2e]">Wholesale Suppliers</h2>
          <p class="font-body-md text-[#434656] mt-1">Manage wholesale distributors and coordinate inventory restocks.</p>
        </div>
        {isManager && (
          <button
            onClick={handleOpenCreate}
            class="px-lg py-md bg-[#0041c8] text-white rounded-lg font-label-sm flex items-center gap-sm shadow-lg shadow-[#0041c8]/20 hover:opacity-90 transition-all active:scale-95"
          >
            <span class="material-symbols-outlined text-[18px]">local_shipping</span>
            Register Supplier
          </button>
        )}
      </div>

      {/* Filter header */}
      <div class="glass-panel p-md rounded-xl flex items-center gap-md">
        <form onSubmit={handleSearchSubmit} class="flex items-center gap-sm flex-grow max-w-md">
          <input
            type="text"
            placeholder="Search by supplier name or contact person..."
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

      {/* Supplier Grid list */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter flex-1 items-start">
        {loading ? (
          <div class="col-span-full py-xl text-center">
            <span class="material-symbols-outlined text-[36px] text-[#0041c8] animate-spin">progress_activity</span>
          </div>
        ) : suppliers.length === 0 ? (
          <div class="col-span-full py-xl text-center text-[#737688] font-body-md">
            No wholesale suppliers found in database
          </div>
        ) : (
          suppliers.map((sup) => (
            <div key={sup._id} class="glass-panel rounded-xl p-lg flex flex-col justify-between min-h-[200px] hover:shadow-md transition-shadow relative">
              <div class="space-y-sm">
                <div class="flex items-start justify-between">
                  <h4 class="font-bold text-body-lg text-[#131b2e] leading-snug pr-8">{sup.name}</h4>
                  <span class="bg-[#0041c8]/10 text-[#0041c8] px-sm py-0.5 rounded-full text-xs font-mono font-bold">
                    {sup.productCount} SKUs
                  </span>
                </div>
                
                <div class="space-y-xs text-sm text-[#434656] pt-sm">
                  <div class="flex items-center gap-xs">
                    <span class="material-symbols-outlined text-[16px] text-[#737688]">person</span>
                    <span>{sup.contactPerson || 'No contact person'}</span>
                  </div>
                  <div class="flex items-center gap-xs">
                    <span class="material-symbols-outlined text-[16px] text-[#737688]">call</span>
                    <span class="font-mono">{sup.phone || 'No Phone number'}</span>
                  </div>
                  <div class="flex items-center gap-xs">
                    <span class="material-symbols-outlined text-[16px] text-[#737688]">mail</span>
                    <span class="truncate">{sup.email || 'No email address'}</span>
                  </div>
                  <div class="flex items-center gap-xs">
                    <span class="material-symbols-outlined text-[16px] text-[#737688]">home</span>
                    <span class="truncate text-xs">{sup.address || 'No address logged'}</span>
                  </div>
                </div>
              </div>

              {isManager && (
                <div class="flex gap-md border-t border-[#c3c5d9]/20 pt-md mt-md">
                  <button
                    onClick={() => handleOpenEdit(sup)}
                    class="flex-1 h-9 border border-[#c3c5d9]/60 hover:bg-[#dae2fd]/40 text-sm text-[#434656] font-semibold rounded-lg flex items-center justify-center gap-xs active:scale-95 transition-all"
                  >
                    <span class="material-symbols-outlined text-[16px]">edit</span>
                    Modify
                  </button>
                  <button
                    onClick={() => handleDelete(sup._id, sup.name)}
                    class="flex-1 h-9 border border-[#ffdad6] hover:bg-red-50 text-sm text-[#ba1a1a] font-semibold rounded-lg flex items-center justify-center gap-xs active:scale-95 transition-all"
                  >
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div class="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg">
          <div class="bg-white rounded-xl max-w-sm w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40">
            <h3 class="font-bold text-headline-md text-[#131b2e] mb-lg flex items-center gap-sm">
              <span class="material-symbols-outlined text-[#0041c8]">{editId ? 'edit' : 'local_shipping'}</span>
              {editId ? 'Modify Supplier Info' : 'Register Wholesale Supplier'}
            </h3>

            <form onSubmit={handleFormSubmit} class="space-y-md">
              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Supplier Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Apparel Group"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Robert Downey"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 555-9011"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. order@apexapparel.com"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Address Location</label>
                <input
                  type="text"
                  placeholder="e.g. 10 Apparel Way, Boston, MA"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div class="flex gap-md pt-lg border-t border-[#c3c5d9]/20">
                <button
                  type="submit"
                  class="flex-grow h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-all"
                >
                  Save Supplier
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  class="h-11 px-4 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;

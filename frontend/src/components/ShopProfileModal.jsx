import React, { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';

const ShopProfileModal = ({ isOpen, onClose }) => {
  const { shopProfile, updateProfile } = useShop();
  const { isManager } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    gstin: '',
    address: '',
    email: '',
    phone: '',
    receiptBaseUrl: '',
  });

  const [imagePreview, setImagePreview] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Sync state with global shop profile on open
  useEffect(() => {
    if (isOpen && shopProfile) {
      setFormData({
        name: shopProfile.name || '',
        logo: shopProfile.logo || '',
        gstin: shopProfile.gstin || '',
        address: shopProfile.address || '',
        email: shopProfile.email || '',
        phone: shopProfile.phone || '',
        receiptBaseUrl: shopProfile.receiptBaseUrl || '',
      });
      setImagePreview(shopProfile.logo || '');
      setMessage({ type: '', text: '' });
    }
  }, [isOpen, shopProfile]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image size must be under 2MB' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result;
      setFormData((prev) => ({
        ...prev,
        logo: base64Data,
      }));
      setImagePreview(base64Data);
      setMessage({ type: '', text: '' });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isManager) return;

    setIsSaving(true);
    setMessage({ type: '', text: '' });

    const result = await updateProfile(formData);
    setIsSaving(false);

    if (result.success) {
      setMessage({ type: 'success', text: 'Shop profile updated successfully!' });
      // Close modal after brief delay to let user see success
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setMessage({ type: 'error', text: result.message || 'Failed to update shop profile.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg">
      <div className="bg-white rounded-xl max-w-lg w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40 max-h-[90vh] overflow-y-auto custom-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-lg">
          <h3 className="font-bold text-headline-md text-[#131b2e] flex items-center gap-sm">
            <span className="material-symbols-outlined text-[#0041c8] text-[28px]">store</span>
            Shop Profile Configuration
          </h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-[#eaedff] rounded-lg transition-colors text-[#434656]"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Banner Messages */}
        {message.text && (
          <div className={`p-md rounded-lg mb-lg font-body-md border flex items-center gap-sm ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <span className="material-symbols-outlined text-[20px]">
              {message.type === 'success' ? 'check_circle' : 'error'}
            </span>
            {message.text}
          </div>
        )}

        {!isManager && (
          <div className="p-md rounded-lg mb-lg font-body-md border bg-amber-50 border-amber-200 text-amber-800 flex items-center gap-sm">
            <span className="material-symbols-outlined text-[20px]">info</span>
            You are logged in as a Cashier. Details are read-only.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-lg">
          
          {/* Logo Upload Section */}
          <div className="flex flex-col items-center gap-sm py-sm border-b border-[#c3c5d9]/30">
            <div className="relative group">
              {imagePreview ? (
                <img 
                  src={imagePreview} 
                  alt="Logo Preview" 
                  className="w-24 h-24 rounded-full object-contain bg-white border border-[#c3c5d9] p-1 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#0041c8]/20 to-[#6063ee]/20 text-[#0041c8] border border-[#c3c5d9] flex items-center justify-center font-bold shadow-md select-none">
                  <span className="text-[32px]">
                    {formData.name ? formData.name.charAt(0).toUpperCase() : 'S'}
                  </span>
                </div>
              )}
              {isManager && (
                <label 
                  htmlFor="shop-logo-upload" 
                  className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity duration-200"
                >
                  <span className="material-symbols-outlined text-[24px]">photo_camera</span>
                </label>
              )}
            </div>
            {isManager && (
              <>
                <input 
                  type="file" 
                  id="shop-logo-upload" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
                <p className="text-[11px] text-[#737688]">Upload custom shop logo (PNG/JPG, max 2MB)</p>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, logo: '' }));
                      setImagePreview('');
                    }}
                    className="text-xs text-red-600 hover:text-red-800 hover:underline flex items-center gap-xs mt-xs font-semibold animate-click"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    Remove Logo
                  </button>
                )}
              </>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-2 gap-md">
            
            <div className="col-span-2 space-y-xs">
              <label className="text-xs font-bold text-[#434656] px-1">Shop Name *</label>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. Shree Shyam Saawariya"
                className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all bg-white disabled:bg-gray-100 disabled:text-gray-500"
                value={formData.name}
                onChange={handleInputChange}
                disabled={!isManager}
              />
            </div>

            <div className="space-y-xs">
              <label className="text-xs font-bold text-[#434656] px-1">GSTIN (GST Number)</label>
              <input
                type="text"
                name="gstin"
                placeholder="e.g. 27AAAAA1111A1Z1"
                className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none bg-gray-100 text-gray-500 font-mono cursor-not-allowed"
                value={formData.gstin}
                onChange={handleInputChange}
                disabled={true}
                title="GSTIN can only be modified by system administration"
              />
              <span className="text-[9px] text-[#737688] px-1 font-semibold block">Locked: Contact administrator to update GSTIN</span>
            </div>

            <div className="space-y-xs">
              <label className="text-xs font-bold text-[#434656] px-1">Contact Phone</label>
              <input
                type="text"
                name="phone"
                placeholder="e.g. +91 9999999999"
                className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all bg-white disabled:bg-gray-100 disabled:text-gray-500"
                value={formData.phone}
                onChange={handleInputChange}
                disabled={!isManager}
              />
            </div>

            <div className="col-span-2 space-y-xs">
              <label className="text-xs font-bold text-[#434656] px-1">Shop Email Address</label>
              <input
                type="email"
                name="email"
                placeholder="e.g. contact@yourstore.com"
                className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all bg-white disabled:bg-gray-100 disabled:text-gray-500"
                value={formData.email}
                onChange={handleInputChange}
                disabled={!isManager}
              />
            </div>

            <div className="col-span-2 space-y-xs">
              <label className="text-xs font-bold text-[#434656] px-1 flex items-center gap-xs">
                Public Receipt Base URL (for sharing)
                <span className="material-symbols-outlined text-[14px] text-[#737688] cursor-help" title="Enter the public domain or local IP (e.g. https://mystore.com or http://192.168.1.100:5000) that customers use to open receipt links. Leave empty to auto-detect.">info</span>
              </label>
              <input
                type="text"
                name="receiptBaseUrl"
                placeholder="e.g. https://mystore.com or http://192.168.1.100:5000"
                className="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all bg-white disabled:bg-gray-100 disabled:text-gray-500 font-mono text-xs"
                value={formData.receiptBaseUrl}
                onChange={handleInputChange}
                disabled={!isManager}
              />
            </div>

            <div className="col-span-2 space-y-xs">
              <label className="text-xs font-bold text-[#434656] px-1">Shop Physical Address</label>
              <textarea
                name="address"
                rows="2"
                placeholder="e.g. 123 Retail Lane, Hub Plaza"
                className="w-full p-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all bg-white disabled:bg-gray-100 disabled:text-gray-500"
                value={formData.address}
                onChange={handleInputChange}
                disabled={!isManager}
              />
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-md pt-md border-t border-[#c3c5d9]/30">
            <button
              type="button"
              onClick={onClose}
              className="px-lg h-11 border border-[#c3c5d9] rounded-lg text-[#434656] hover:bg-[#eaedff] transition-colors"
            >
              Close
            </button>
            {isManager && (
              <button
                type="submit"
                disabled={isSaving}
                className="px-lg h-11 bg-[#0041c8] text-white rounded-lg hover:bg-[#0036a3] transition-colors flex items-center justify-center gap-xs font-semibold shadow-md disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">save</span>
                    Save Profile
                  </>
                )}
              </button>
            )}
          </div>

        </form>

      </div>
    </div>
  );
};

export default ShopProfileModal;

import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Coupons = () => {
  const { isManager } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Search state
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'Percentage',
    discountValue: 0,
    applicableProduct: '',
    expiryDate: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const res = await api.get('/coupons');
      if (res.data.success) {
        setCoupons(res.data.coupons);
      }
    } catch (err) {
      console.error('Error fetching coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products?limit=100');
      if (res.data.success) {
        setProducts(res.data.products);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  useEffect(() => {
    fetchCoupons();
    fetchProducts();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'code' ? value.toUpperCase() : value,
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitLoading(true);

    if (formData.discountValue <= 0) {
      setError('Discount value must be greater than 0');
      setSubmitLoading(false);
      return;
    }

    try {
      // Create body, making sure applicableProduct is null if empty
      const requestData = {
        ...formData,
        applicableProduct: formData.applicableProduct || null,
      };

      const res = await api.post('/coupons', requestData);
      if (res.data.success) {
        setSuccess('Coupon code created successfully!');
        setFormData({
          code: '',
          discountType: 'Percentage',
          discountValue: 0,
          applicableProduct: '',
          expiryDate: '',
        });
        setSelectedProduct(null);
        setProductSearch('');
        fetchCoupons();
      }
    } catch (err) {
      console.error('Error creating coupon:', err);
      setError(err.response?.data?.message || 'Failed to generate coupon code');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteCoupon = async (id, code) => {
    if (window.confirm(`Are you sure you want to delete coupon code "${code}"?`)) {
      try {
        const res = await api.delete(`/coupons/${id}`);
        if (res.data.success) {
          fetchCoupons();
        }
      } catch (err) {
        console.error('Error deleting coupon:', err);
        alert('Failed to delete coupon code');
      }
    }
  };

  return (
    <div className="space-y-gutter flex-grow flex flex-col select-none">
      {/* Page Title */}
      <div>
        <h2 className="font-headline-lg text-headline-lg text-[#131b2e]">Discount Coupons</h2>
        <p className="font-body-md text-[#434656] mt-1">Generate and manage universal or item-specific discount coupons for POS billing.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-xl flex-1 items-start">
        {/* Create Coupon Card */}
        {isManager ? (
          <div className="glass-panel p-2xl rounded-xl border border-[#c3c5d9]/40 space-y-lg">
            <h3 className="font-bold text-headline-md text-[#131b2e] flex items-center gap-sm">
              <span className="material-symbols-outlined text-[#0041c8]">local_offer</span>
              Create Coupon
            </h3>

            {error && (
              <div className="p-md bg-[#ffdad6] text-[#93000a] border border-[#ba1a1a]/20 rounded-lg text-sm flex items-center gap-sm">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-md bg-[#83ffc6]/20 text-[#005c3e] border border-[#005c3e]/20 rounded-lg text-sm flex items-center gap-sm">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-md">
              <div className="space-y-xs">
                <label className="text-xs font-bold text-[#434656] px-1">Coupon Code *</label>
                <input
                  type="text"
                  name="code"
                  required
                  placeholder="e.g. SHYAM50"
                  className="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8] uppercase font-mono tracking-wider font-bold"
                  value={formData.code}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">Discount Type *</label>
                  <select
                    name="discountType"
                    className="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8]"
                    value={formData.discountType}
                    onChange={handleInputChange}
                  >
                    <option value="Percentage">Percent (%)</option>
                    <option value="Fixed">Fixed (₹)</option>
                  </select>
                </div>

                <div className="space-y-xs">
                  <label className="text-xs font-bold text-[#434656] px-1">Value *</label>
                  <input
                    type="number"
                    name="discountValue"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder={formData.discountType === 'Percentage' ? 'e.g. 10' : 'e.g. 100'}
                    className="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8] font-mono"
                    value={formData.discountValue || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountValue: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* Product Selector with Barcode Lookup */}
              <div className="space-y-xs">
                <label className="text-xs font-bold text-[#434656] px-1">Applicable Product (Optional)</label>
                {!selectedProduct ? (
                  <div className="space-y-xs">
                    <div className="relative group">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-[#737688] group-focus-within:text-[#0041c8] transition-colors">barcode_reader</span>
                      <input
                        type="text"
                        placeholder="Scan Barcode or Search SKU/Name..."
                        className="w-full h-11 pl-10 pr-3 border border-[#c3c5d9] bg-white rounded-lg outline-none text-xs focus:border-[#0041c8] transition-all"
                        value={productSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          setProductSearch(val);
                          // Try instant match on SKU/barcode or Name
                          const match = products.find(p => 
                            p.sku.toLowerCase() === val.trim().toLowerCase() ||
                            p.name.toLowerCase() === val.trim().toLowerCase()
                          );
                          if (match) {
                            setSelectedProduct(match);
                            setFormData(prev => ({ ...prev, applicableProduct: match._id }));
                            setProductSearch('');
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = productSearch.trim();
                            // Look for SKU/barcode or Name
                            const match = products.find(p => 
                              p.sku.toLowerCase() === val.toLowerCase() ||
                              p.name.toLowerCase().includes(val.toLowerCase())
                            );
                            if (match) {
                              setSelectedProduct(match);
                              setFormData(prev => ({ ...prev, applicableProduct: match._id }));
                              setProductSearch('');
                            } else {
                              alert('No product found matching SKU/barcode or Name: ' + val);
                            }
                          }
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-[#737688] px-1">Leave empty to generate a universal code applicable to all items.</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-md bg-[#eaedff]/40 border border-[#0041c8]/20 rounded-lg">
                    <div className="text-xs">
                      <p className="font-bold text-[#131b2e]">{selectedProduct.name}</p>
                      <p className="font-mono text-[10px] text-[#434656] mt-0.5">SKU: {selectedProduct.sku} — Retail: ₹{selectedProduct.price}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProduct(null);
                        setFormData(prev => ({ ...prev, applicableProduct: '' }));
                      }}
                      className="p-1 hover:bg-red-50 text-[#ba1a1a] rounded transition-colors"
                      title="Clear Selection"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-xs">
                <label className="text-xs font-bold text-[#434656] px-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  name="expiryDate"
                  className="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8]"
                  value={formData.expiryDate}
                  onChange={handleInputChange}
                />
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center gap-xs shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                {submitLoading ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Generate Coupon
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="glass-panel p-2xl rounded-xl border border-[#c3c5d9]/40 text-center text-[#434656]">
            Only Managers and Administrators are authorized to generate discount coupons.
          </div>
        )}

        {/* Coupons List */}
        <div className="glass-panel rounded-xl overflow-hidden shadow-sm lg:col-span-2 flex flex-col min-h-[400px]">
          <div className="overflow-x-auto flex-grow">
            <table className="w-full text-left">
              <thead className="bg-[#f2f3ff]/50 sticky top-0 backdrop-blur-md">
                <tr>
                  <th className="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Coupon Code</th>
                  <th className="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Discount</th>
                  <th className="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Applicable Item</th>
                  <th className="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Expiry</th>
                  <th className="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Status</th>
                  {isManager && <th className="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c3c5d9]/20 font-body-md">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-xl">
                      <span className="material-symbols-outlined text-[36px] text-[#0041c8] animate-spin">progress_activity</span>
                    </td>
                  </tr>
                ) : coupons.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-lg py-xl text-center text-[#737688]">No discount coupons active</td>
                  </tr>
                ) : (
                  coupons.map((coupon) => {
                    const isExpired = coupon.expiryDate && new Date(coupon.expiryDate) < new Date();
                    return (
                      <tr key={coupon._id} className="hover:bg-[#0041c8]/5 transition-colors">
                        <td className="px-lg py-md font-mono font-bold text-[#131b2e] tracking-wider">
                          {coupon.code}
                        </td>
                        <td className="px-lg py-md font-bold text-[#0041c8]">
                          {coupon.discountType === 'Percentage' ? `${coupon.discountValue}% Off` : `₹${coupon.discountValue.toFixed(2)} Off`}
                        </td>
                        <td className="px-lg py-md text-[#131b2e] font-semibold max-w-[200px] truncate">
                          {coupon.applicableProduct ? (
                            <span>
                              {coupon.applicableProduct.name}{' '}
                              <span className="text-xs text-[#737688] font-mono">({coupon.applicableProduct.sku})</span>
                            </span>
                          ) : (
                            <span className="text-[#005c3e] font-bold">Universal (Any Item)</span>
                          )}
                        </td>
                        <td className="px-lg py-md text-[#434656] font-mono">
                          {coupon.expiryDate ? new Date(coupon.expiryDate).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-lg py-md">
                          <span className={`px-sm py-1 rounded-full text-xs font-bold inline-flex items-center gap-xs ${
                            isExpired 
                              ? 'bg-[#ffdad6] text-[#ba1a1a]' 
                              : 'bg-[#83ffc6]/20 text-[#005c3e]'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isExpired ? 'bg-[#ba1a1a]' : 'bg-[#005c3e]'
                            }`}></span>
                            {isExpired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                        {isManager && (
                          <td className="px-lg py-md">
                            <button
                              onClick={() => handleDeleteCoupon(coupon._id, coupon.code)}
                              className="p-1 text-[#ba1a1a] hover:bg-red-50 rounded transition-colors"
                              title="Delete Coupon"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Coupons;

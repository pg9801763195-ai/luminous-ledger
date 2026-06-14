import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Inventory = () => {
  const { isManager } = useAuth();
  const [logs, setLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Stock Adjustment Form states
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustType, setAdjustType] = useState('Stock-In');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scannerError, setScannerError] = useState('');

  const searchProductBySku = (skuValue) => {
    setScannerError('');
    if (!skuValue) return;
    const cleanSku = skuValue.trim();
    const matched = products.find(p => p.sku && p.sku.toLowerCase() === cleanSku.toLowerCase());
    if (matched) {
      setSelectedProductId(matched._id);
      setBarcodeInput('');
    } else {
      setScannerError(`Product with SKU "${cleanSku}" not found`);
    }
  };

  const handleBarcodeScan = (e) => {
    setScannerError('');
    const val = e.target.value;
    setBarcodeInput(val);
    
    const matched = products.find(p => p.sku && p.sku.toLowerCase() === val.trim().toLowerCase());
    if (matched) {
      setSelectedProductId(matched._id);
      setBarcodeInput('');
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await api.get(`/products/logs/history?page=${page}`);
      if (res.data.success) {
        setLogs(res.data.logs);
        setTotalPages(res.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching inventory logs', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchAllProducts = async () => {
    try {
      const res = await api.get('/products?limit=100');
      if (res.data.success) {
        setProducts(res.data.products);
      }
    } catch (error) {
      console.error('Error loading products list', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  useEffect(() => {
    fetchAllProducts();
  }, []);

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (!selectedProductId || adjustQty === 0) {
      alert('Please select a product and enter a non-zero quantity');
      return;
    }

    try {
      setAdjustLoading(true);
      const res = await api.put(`/products/${selectedProductId}/adjust-stock`, {
        quantity: adjustQty,
        changeType: adjustType,
        description: adjustNote,
      });

      if (res.data.success) {
        // Reset adjust form
        setAdjustQty(0);
        setSelectedProductId('');
        setAdjustNote('');
        setAdjustType('Stock-In');
        alert('Stock adjusted and logged successfully!');
        
        // Refresh logs and products list
        setPage(1);
        fetchLogs();
        fetchAllProducts();
      }
    } catch (error) {
      console.error('Stock adjustment failed', error);
      alert(error.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setAdjustLoading(false);
    }
  };

  return (
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-gutter flex-1 select-none">
      {/* Inventory Stock Log Audit Trail (2 columns on lg) */}
      <div class="lg:col-span-2 flex flex-col space-y-md">
        <div>
          <h2 class="font-headline-lg text-headline-lg text-[#131b2e]">Inventory Audit Logs</h2>
          <p class="font-body-md text-[#434656] mt-1">Audit trail for all stock adjustments, sales deductions, and refunds.</p>
        </div>

        {/* Logs Table */}
        <div class="glass-panel rounded-xl overflow-hidden shadow-sm flex-grow flex flex-col justify-between min-h-[480px]">
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-[#f2f3ff]/50 sticky top-0 backdrop-blur-md">
                <tr>
                  <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Product</th>
                  <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">SKU</th>
                  <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Log Type</th>
                  <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Changed Qty</th>
                  <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Audit Range</th>
                  <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Operator</th>
                  <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Timestamp</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#c3c5d9]/20 font-body-md">
                {loadingLogs ? (
                  <tr>
                    <td colspan="7" class="text-center py-xl">
                      <span class="material-symbols-outlined text-[36px] text-[#0041c8] animate-spin">progress_activity</span>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colspan="7" class="px-lg py-xl text-center text-[#737688]">No inventory logs captured in database</td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} class="hover:bg-[#0041c8]/5 transition-colors group">
                      <td class="px-lg py-md font-bold text-[#131b2e] max-w-[160px] truncate">{log.product ? log.product.name : 'Unknown Product'}</td>
                      <td class="px-lg py-md font-mono text-xs text-[#434656]">{log.product ? log.product.sku : 'N/A'}</td>
                      <td class="px-lg py-md">
                        <span class={`px-sm py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-xs ${
                          log.changeType === 'Stock-In' || log.changeType === 'Purchase'
                            ? 'bg-[#83ffc6]/20 text-[#005c3e]'
                            : log.changeType === 'Sale'
                            ? 'bg-blue-50 text-[#0041c8]'
                            : log.changeType === 'Refund'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {log.changeType}
                        </span>
                      </td>
                      <td class={`px-lg py-md font-mono font-bold ${log.quantityChanged >= 0 ? 'text-[#005c3e]' : 'text-[#ba1a1a]'}`}>
                        {log.quantityChanged >= 0 ? `+${log.quantityChanged}` : log.quantityChanged}
                      </td>
                      <td class="px-lg py-md font-mono text-xs text-[#737688]">
                        {log.stockBefore} → {log.stockAfter}
                      </td>
                      <td class="px-lg py-md text-[#434656]">{log.performedBy ? log.performedBy.name : 'System'}</td>
                      <td class="px-lg py-md font-mono text-xs text-[#737688]">
                        {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      </div>

      {/* Stock Adjustment Panel Form (1 column) */}
      <div class="glass-panel rounded-xl p-lg flex flex-col shadow-lg sticky top-24 self-start">
        <h4 class="font-bold text-headline-md border-b border-[#c3c5d9]/40 pb-md mb-lg flex items-center gap-sm">
          <span class="material-symbols-outlined text-[#0041c8]">published_with_changes</span>
          Manual Adjustment
        </h4>

        {isManager ? (
          <form onSubmit={handleAdjustStock} class="space-y-lg flex flex-col">
            <div class="space-y-md">
              <div class="space-y-xs">
                <div class="flex justify-between items-center px-1">
                  <label class="text-xs font-bold text-[#434656]">Scan Barcode / SKU</label>
                  <span class="text-[10px] text-[#0041c8] font-bold flex items-center gap-0.5">
                    <span class="material-symbols-outlined text-[12px] animate-pulse">barcode_scanner</span>
                    Scanner Ready
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="Scan product barcode or type SKU..."
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all bg-white font-mono text-sm"
                  value={barcodeInput}
                  onChange={handleBarcodeScan}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchProductBySku(e.target.value);
                    }
                  }}
                />
                {scannerError && (
                  <p class="text-[10px] text-[#ba1a1a] font-semibold px-1 mt-0.5">{scannerError}</p>
                )}
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Select Product *</label>
                <select
                  required
                  class="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none cursor-pointer focus:border-[#0041c8]"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">Choose item...</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (SKU: {p.sku} | Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div class="grid grid-cols-2 gap-md">
                <div class="space-y-xs">
                  <label class="text-xs font-bold text-[#434656] px-1">Adjust Quantity *</label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 10 or -5"
                    class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all font-mono font-bold"
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(parseInt(e.target.value, 10) || 0)}
                  />
                </div>

                <div class="space-y-xs">
                  <label class="text-xs font-bold text-[#434656] px-1">Adjustment Type</label>
                  <select
                    class="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none cursor-pointer focus:border-[#0041c8]"
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                  >
                    <option value="Stock-In">Stock-In (Add)</option>
                    <option value="Purchase">Purchase Entry</option>
                    <option value="Adjustment">General Correction</option>
                  </select>
                </div>
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Adjustment Note / Reference</label>
                <textarea
                  rows="3"
                  placeholder="e.g. Damaged inventory replacement, warehouse shipment PO-921"
                  class="w-full p-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all text-sm"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={adjustLoading || !selectedProductId || adjustQty === 0}
              class="w-full h-12 bg-[#0041c8] hover:bg-[#0041c8]/90 disabled:opacity-50 text-white font-bold rounded-lg shadow-md shadow-[#0041c8]/20 flex items-center justify-center gap-sm transition-all active:scale-[0.99]"
            >
              {adjustLoading ? (
                <>
                  <span class="material-symbols-outlined animate-spin">progress_activity</span>
                  Adjusting...
                </>
              ) : (
                <>
                  Record Stock Adjustment
                  <span class="material-symbols-outlined text-[20px]">save</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div class="flex-grow flex items-center justify-center text-center text-[#737688] p-md">
            <div>
              <span class="material-symbols-outlined text-[48px] text-[#ba1a1a] mb-sm">lock</span>
              <p class="font-bold text-[#131b2e]">RBAC Restricted</p>
              <p class="text-xs mt-base">Only Manager or Admin roles can record manual stock adjustments.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;

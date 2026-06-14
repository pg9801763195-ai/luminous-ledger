import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const Returns = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search');
  
  // Lookup Invoice States
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Return & Exchange Details
  const [returnItems, setReturnItems] = useState({}); // itemId -> quantity to return
  const [exchangeCart, setExchangeCart] = useState([]); // list of { product, quantity }
  const [returnReason, setReturnReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Exchange Product Search
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Payment states for collect settlement differences
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentSplit, setPaymentSplit] = useState({ UPI: 0, Cash: 0, Card: 0 });

  // Print helper states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState(null);

  // Auto-focus barcode reader input on global keyboard events
  const inputRef = useRef(null);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // If typing in another input, ignore
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
         document.activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Transfer focus to search input if alphanumeric key typed
      if (e.key && e.key.length === 1 && /^[a-zA-Z0-9-]$/.test(e.key)) {
        if (inputRef.current) {
          inputRef.current.focus();
          setInvoiceSearch((prev) => (prev + e.key).toUpperCase());
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  useEffect(() => {
    if (searchQuery) {
      setInvoiceSearch(searchQuery);
      fetchInvoice(searchQuery);
    }
  }, [searchQuery]);

  // Search invoice core function
  const fetchInvoice = async (searchVal) => {
    if (!searchVal || !searchVal.trim()) return;

    try {
      setSearching(true);
      setError('');
      setSuccess('');
      // Query invoices by number matching
      const res = await api.get(`/invoices?search=${searchVal.trim()}`);
      if (res.data.success && res.data.invoices.length > 0) {
        const found = res.data.invoices[0];
        if (found.paymentStatus === 'Refunded') {
          setError('This invoice has already been fully refunded.');
          setInvoice(null);
        } else {
          setInvoice(found);
          // Initialize return quantities to 0
          const initialReturns = {};
          found.items.forEach((item) => {
            initialReturns[item._id] = 0;
          });
          setReturnItems(initialReturns);
          setExchangeCart([]);
          setReturnReason('');
        }
      } else {
        setError('Invoice not found. Please scan or enter a valid invoice number.');
        setInvoice(null);
      }
    } catch (err) {
      console.error('Invoice lookup failed:', err);
      setError('Failed to fetch invoice. Try again.');
      setInvoice(null);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInvoice = (e) => {
    if (e) e.preventDefault();
    fetchInvoice(invoiceSearch);
  };

  // Search product for exchange
  const searchExchangeProducts = async (query) => {
    setProductSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      const res = await api.get(`/products?search=${query}&limit=5`);
      if (res.data.success) {
        setSearchResults(res.data.products);
      }
    } catch (err) {
      console.error('Exchange product lookup failed:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Add item to exchange cart
  const handleAddExchangeProduct = (product) => {
    const existing = exchangeCart.find((item) => item.product._id === product._id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        alert(`Cannot add more. Insufficient stock for "${product.name}". Available: ${product.stock}`);
        return;
      }
      setExchangeCart(
        exchangeCart.map((item) =>
          item.product._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      if (product.stock < 1) {
        alert(`Product "${product.name}" is out of stock.`);
        return;
      }
      setExchangeCart([...exchangeCart, { product, quantity: 1 }]);
    }
    setProductSearch('');
    setSearchResults([]);
  };

  // Update exchange quantity
  const handleUpdateExchangeQty = (productId, newQty, maxStock) => {
    if (newQty <= 0) {
      setExchangeCart(exchangeCart.filter((item) => item.product._id !== productId));
      return;
    }
    if (newQty > maxStock) {
      alert(`Cannot add more. Insufficient stock. Available: ${maxStock}`);
      return;
    }
    setExchangeCart(
      exchangeCart.map((item) =>
        item.product._id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  // Remove exchange item
  const handleRemoveExchangeItem = (productId) => {
    setExchangeCart(exchangeCart.filter((item) => item.product._id !== productId));
  };

  // Return items quantity increment / decrement
  const handleUpdateReturnQty = (itemId, newQty, maxQty) => {
    const qtyVal = Math.max(0, Math.min(maxQty, newQty));
    setReturnItems((prev) => ({
      ...prev,
      [itemId]: qtyVal,
    }));
  };

  // Calculate totals
  const refundRatio = (invoice && invoice.exchangeCredit > 0) ? (invoice.grandTotal / (invoice.grandTotal + invoice.exchangeCredit)) : 1;

  const formatValue = (val) => {
    return val % 1 === 0 ? val.toFixed(0) : val.toFixed(2);
  };

  const getReturnSubtotals = () => {
    if (!invoice) return { refundTotal: 0, exchangeTotal: 0, netDiff: 0 };

    let refundTotal = 0;
    invoice.items.forEach((item) => {
      const returnQty = returnItems[item._id] || 0;
      if (returnQty > 0) {
        const unitTotal = item.total / item.quantity; // includes tax & discounts
        refundTotal += (unitTotal * returnQty) * refundRatio;
      }
    });

    let exchangeTotal = 0;
    exchangeCart.forEach((item) => {
      const taxRate = item.product.taxRate !== undefined ? item.product.taxRate : 18;
      const unitExchangePrice = item.product.price * (1 + taxRate / 100);
      exchangeTotal += unitExchangePrice * item.quantity;
    });

    const roundedRefund = Math.round(refundTotal);
    const roundedExchange = Math.round(exchangeTotal);
    const roundedNetDiff = roundedRefund - roundedExchange;

    return {
      refundTotal: roundedRefund,
      exchangeTotal: roundedExchange,
      netDiff: roundedNetDiff,
    };
  };

  const { refundTotal, exchangeTotal, netDiff } = getReturnSubtotals();

  const splitSum = (paymentSplit.UPI || 0) + (paymentSplit.Cash || 0) + (paymentSplit.Card || 0);

  const handleSplitChange = (method, value) => {
    setPaymentSplit(prev => ({
      ...prev,
      [method]: value
    }));
  };

  // Submit return/exchange
  const handleSubmitReturn = async () => {
    const itemsToReturn = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        itemId,
        quantity: qty,
      }));

    if (itemsToReturn.length === 0) {
      alert('Please select at least one item quantity to return.');
      return;
    }

    if (!returnReason.trim()) {
      alert('Please enter a reason for the return/exchange.');
      return;
    }

    const isSplitInvalid = netDiff < 0 && paymentMethod === 'Mixed' && Math.abs(splitSum - Math.abs(netDiff)) >= 0.05;
    if (isSplitInvalid) {
      alert('Split payment sum must match the collected difference amount.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      
      const payload = {
        items: itemsToReturn,
        exchangeItems: exchangeCart.map((item) => ({
          productId: item.product._id,
          quantity: item.quantity,
        })),
        reason: returnReason,
        paymentMethod: netDiff < 0 ? paymentMethod : 'Cash',
        paymentSplit: netDiff < 0 && paymentMethod === 'Mixed' ? paymentSplit : null,
      };

      const res = await api.post(`/invoices/${invoice._id}/return`, payload);
      if (res.data.success) {
        setSuccessDetails({
          invoiceNumber: invoice.invoiceNumber,
          netDiff: res.data.netDiff,
          invoiceId: invoice._id,
          exchangeInvoice: res.data.exchangeInvoice,
        });
        setSuccess('Return/Exchange processed successfully!');
        setShowSuccessModal(true);

        // Reset state
        setInvoice(null);
        setInvoiceSearch('');
        setReturnItems({});
        setExchangeCart([]);
        setReturnReason('');
        setPaymentMethod('Cash');
        setPaymentSplit({ UPI: 0, Cash: 0, Card: 0 });
      }
    } catch (err) {
      console.error('Failed to submit return/exchange:', err);
      setError(err.response?.data?.message || 'Failed to submit return/exchange request.');
    } finally {
      setSubmitting(false);
    }
  };

  // Download return invoice receipt
  const triggerPrintReceipt = (invoiceId) => {
    api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' })
      .then((response) => {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        
        let iframe = document.getElementById('silent-pdf-print-iframe');
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'silent-pdf-print-iframe';
          iframe.style.position = 'fixed';
          iframe.style.right = '0';
          iframe.style.bottom = '0';
          iframe.style.width = '0';
          iframe.style.height = '0';
          iframe.style.border = '0';
          document.body.appendChild(iframe);
        }
        
        iframe.src = url;
        iframe.onload = () => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        };
      })
      .catch((err) => {
        console.error('Failed to print updated invoice PDF', err);
        alert('Failed to print receipt');
      });
  };

  const triggerDownloadPDF = (invoiceId, invoiceNumber) => {
    api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `invoice-${invoiceNumber}-updated.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Failed to download invoice PDF', err);
        alert('Failed to download PDF');
      });
  };

  return (
    <div className="space-y-gutter flex-grow flex flex-col">
      {/* Header */}
      <div className="flex items-end justify-between select-none">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-[#131b2e]">Returns & Exchanges</h2>
          <p className="font-body-md text-[#434656] mt-1">Scan printed receipt barcodes or search bills to return/exchange products.</p>
        </div>
      </div>

      {/* Bill Search Card */}
      <div className="glass-panel p-lg rounded-xl shadow-sm space-y-md">
        <form onSubmit={handleSearchInvoice} className="flex gap-md select-none">
          <div className="relative flex-grow group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#434656] group-focus-within:text-[#0041c8] transition-colors">receipt</span>
            <input
              ref={inputRef}
              type="text"
              placeholder="Scan receipt barcode or enter invoice number..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#c3c5d9] rounded-lg focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] transition-all font-mono text-sm outline-none uppercase"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-lg h-11 bg-[#0041c8] text-white rounded-lg font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-xs text-sm shadow-md"
          >
            {searching ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">search</span>
            )}
            Search Invoice
          </button>
        </form>

        {error && (
          <div className="p-md rounded-lg bg-[#ffdad6] text-[#ba1a1a] text-sm flex items-center gap-sm">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}
      </div>

      {invoice && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
          {/* Main Return Form */}
          <div className="lg:col-span-2 space-y-gutter">
            
            {/* Bill Info Grid */}
            <div className="glass-panel p-lg rounded-xl shadow-sm space-y-md">
              <div className="flex justify-between items-center border-b border-[#c3c5d9]/30 pb-sm select-none">
                <h4 className="font-headline-md text-headline-md">Bill Details: {invoice.invoiceNumber}</h4>
                <span className={`px-sm py-1 rounded-full text-xs font-bold ${
                  invoice.paymentStatus === 'Paid' 
                    ? 'bg-[#83ffc6]/20 text-[#005c3e]' 
                    : 'bg-[#ffdad6] text-[#ba1a1a]'
                }`}>
                  {invoice.paymentStatus}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-md select-none text-sm">
                <div>
                  <p className="text-xs text-[#737688]">Date & Time</p>
                  <p className="font-semibold text-[#131b2e]">{new Date(invoice.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-[#737688]">Customer</p>
                  <p className="font-semibold text-[#131b2e]">{invoice.customer ? invoice.customer.name : 'Walk-in Guest'}</p>
                </div>
                <div>
                  <p className="text-xs text-[#737688]">Payment Mode</p>
                  <p className="font-semibold text-[#131b2e]">{invoice.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-xs text-[#737688]">Grand Total</p>
                  <p className="font-bold text-[#0041c8]">₹{invoice.grandTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Step 1: Select Items to Return */}
            <div className="glass-panel p-lg rounded-xl shadow-sm space-y-md">
              <div className="flex items-center gap-sm border-b border-[#c3c5d9]/30 pb-sm select-none">
                <span className="w-6 h-6 rounded-full bg-[#0041c8] text-white flex items-center justify-center text-xs font-bold">1</span>
                <h4 className="font-headline-md text-headline-md">Select Quantities to Return</h4>
              </div>
              
              <div className="overflow-x-auto select-none">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f2f3ff]/50 font-bold text-[#434656]">
                    <tr>
                      <th className="px-md py-sm">Product Item</th>
                      <th className="px-md py-sm text-center">Purchased</th>
                      <th className="px-md py-sm text-center">Returned</th>
                      <th className="px-md py-sm text-center">Returnable</th>
                      <th className="px-md py-sm text-right">Return Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c3c5d9]/10 text-xs">
                    {invoice.items.map((item) => {
                      const maxReturnable = item.quantity - (item.returnedQuantity || 0);
                      const isQtyMaxed = maxReturnable <= 0;
                      return (
                        <tr key={item._id} className="hover:bg-[#0041c8]/5 transition-colors">
                          <td className="px-md py-sm">
                            <p className="font-bold text-[#131b2e]">{item.name}</p>
                            <p className="font-mono text-[#737688] text-[10px]">SKU: {item.sku} | Unit Net: ₹{((item.total / item.quantity) * refundRatio).toFixed(2)}</p>
                          </td>
                          <td className="px-md py-sm text-center font-semibold">{item.quantity}</td>
                          <td className="px-md py-sm text-center text-[#ba1a1a] font-semibold">{item.returnedQuantity || 0}</td>
                          <td className="px-md py-sm text-center text-[#005c3e] font-bold">{maxReturnable}</td>
                          <td className="px-md py-sm text-right">
                            {isQtyMaxed ? (
                              <span className="text-[#ba1a1a] font-semibold text-xs">Fully Returned</span>
                            ) : (
                              <div className="inline-flex items-center gap-xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReturnQty(item._id, (returnItems[item._id] || 0) - 1, maxReturnable)}
                                  className="w-7 h-7 bg-[#eaedff] hover:bg-[#c3c5d9] rounded flex items-center justify-center font-bold text-sm"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={maxReturnable}
                                  className="w-12 text-center border border-[#c3c5d9] rounded py-1 font-semibold text-xs"
                                  value={returnItems[item._id] || 0}
                                  onChange={(e) => handleUpdateReturnQty(item._id, parseInt(e.target.value) || 0, maxReturnable)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReturnQty(item._id, (returnItems[item._id] || 0) + 1, maxReturnable)}
                                  className="w-7 h-7 bg-[#eaedff] hover:bg-[#c3c5d9] rounded flex items-center justify-center font-bold text-sm"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Step 2: Choose Swaps (Optional Exchange Items) */}
            <div className="glass-panel p-lg rounded-xl shadow-sm space-y-md">
              <div className="flex items-center justify-between border-b border-[#c3c5d9]/30 pb-sm select-none">
                <div className="flex items-center gap-sm">
                  <span className="w-6 h-6 rounded-full bg-[#0041c8] text-white flex items-center justify-center text-xs font-bold">2</span>
                  <h4 className="font-headline-md text-headline-md">Add Exchange Items (Optional)</h4>
                </div>
                <span className="text-xs text-[#737688]">Swap for catalog products</span>
              </div>

              {/* Live search products */}
              <div className="relative group select-none">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#434656]">search</span>
                <input
                  type="text"
                  placeholder="Search exchange products by name or SKU..."
                  className="w-full pl-10 pr-4 py-2 border border-[#c3c5d9] rounded-lg text-sm outline-none focus:border-[#0041c8] transition-colors"
                  value={productSearch}
                  onChange={(e) => searchExchangeProducts(e.target.value)}
                />
                
                {/* AutocompleteDropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-[#c3c5d9] rounded-lg shadow-lg z-50 divide-y divide-[#c3c5d9]/10 text-xs">
                    {searchResults.map((product) => {
                      const taxRate = product.taxRate !== undefined ? product.taxRate : 18;
                      const inclPrice = product.price * (1 + taxRate / 100);
                      return (
                        <div
                          key={product._id}
                          onClick={() => handleAddExchangeProduct(product)}
                          className="p-md hover:bg-[#0041c8]/5 transition-colors cursor-pointer flex justify-between items-center"
                        >
                          <div>
                            <p className="font-bold text-[#131b2e]">{product.name}</p>
                            <p className="font-mono text-[#737688] text-[10px]">SKU: {product.sku} | Stock: {product.stock} units</p>
                          </div>
                          <p className="font-bold text-[#0041c8]">₹{inclPrice.toFixed(2)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                {productSearch.trim() && !searchLoading && searchResults.length === 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-[#c3c5d9] p-md rounded-lg shadow-lg text-center text-[#737688] text-xs z-50">
                    No products found matching query
                  </div>
                )}
              </div>

              {/* Selected Exchange Items List */}
              {exchangeCart.length > 0 ? (
                <div className="border border-[#c3c5d9]/30 rounded-lg overflow-hidden select-none">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#f2f3ff]/50 font-bold text-[#434656]">
                      <tr>
                        <th className="px-md py-sm">Product Name</th>
                        <th className="px-md py-sm">Unit Price (incl. tax)</th>
                        <th className="px-md py-sm text-center">Exchange Qty</th>
                        <th className="px-md py-sm text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c3c5d9]/10 text-xs">
                      {exchangeCart.map((item) => {
                        const taxRate = item.product.taxRate !== undefined ? item.product.taxRate : 18;
                        const inclPrice = item.product.price * (1 + taxRate / 100);
                        return (
                          <tr key={item.product._id} className="hover:bg-[#0041c8]/5 transition-colors">
                            <td className="px-md py-sm">
                              <p className="font-bold text-[#131b2e]">{item.product.name}</p>
                              <p className="font-mono text-[#737688] text-[10px]">SKU: {item.product.sku} | Available: {item.product.stock}</p>
                            </td>
                            <td className="px-md py-sm font-semibold">₹{inclPrice.toFixed(2)}</td>
                            <td className="px-md py-sm text-center">
                              <div className="inline-flex items-center gap-xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateExchangeQty(item.product._id, item.quantity - 1, item.product.stock)}
                                  className="w-7 h-7 bg-[#eaedff] hover:bg-[#c3c5d9] rounded flex items-center justify-center font-bold text-sm"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={item.product.stock}
                                  className="w-12 text-center border border-[#c3c5d9] rounded py-1 font-semibold text-xs"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateExchangeQty(item.product._id, parseInt(e.target.value) || 1, item.product.stock)}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleUpdateExchangeQty(item.product._id, item.quantity + 1, item.product.stock)}
                                  className="w-7 h-7 bg-[#eaedff] hover:bg-[#c3c5d9] rounded flex items-center justify-center font-bold text-sm"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-md py-sm text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveExchangeItem(item.product._id)}
                                className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors inline-flex items-center"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-xs text-[#737688] py-sm select-none">No exchange products added. Add items here if customer wants to exchange.</p>
              )}
            </div>
          </div>

          {/* Settle panel */}
          <div className="space-y-gutter">
            
            {/* Return Reason Card */}
            <div className="glass-panel p-lg rounded-xl shadow-sm space-y-md select-none">
              <h4 className="font-headline-md text-headline-md">Return Details</h4>
              <div className="space-y-sm">
                <label className="text-xs text-[#434656] font-semibold">Reason for Return / Exchange</label>
                <textarea
                  placeholder="e.g. Sizing issues, customer changed mind..."
                  className="w-full p-md border border-[#c3c5d9] rounded-lg text-xs outline-none focus:border-[#0041c8] transition-colors resize-none h-24"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>
            </div>

            {/* Settle Summary Panel */}
            <div className="glass-panel p-lg rounded-xl shadow-sm space-y-lg select-none">
              <h4 className="font-headline-md text-headline-md">Settle Difference</h4>
              
              <div className="space-y-sm text-xs font-semibold text-[#434656]">
                <div className="flex justify-between">
                  <span>Total Refund Value:</span>
                  <span className="text-[#005c3e]">₹{formatValue(refundTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Exchange Cost:</span>
                  <span className="text-[#ba1a1a]">₹{formatValue(exchangeTotal)}</span>
                </div>
                <div className="h-[1px] bg-[#c3c5d9]/30 my-md"></div>
                <div className="flex justify-between text-sm">
                  <span>Net Settle Balance:</span>
                  {netDiff > 0 ? (
                    <span className="font-bold text-[#005c3e] text-right">
                      Refund ₹{formatValue(netDiff)}
                      <p className="text-[10px] font-normal text-[#737688]">Pay back to customer</p>
                    </span>
                  ) : netDiff < 0 ? (
                    <span className="font-bold text-[#ba1a1a] text-right">
                      Collect ₹{formatValue(Math.abs(netDiff))}
                      <p className="text-[10px] font-normal text-[#737688]">Collect from customer</p>
                    </span>
                  ) : (
                    <span className="font-bold text-[#0041c8] text-right">
                      Even Exchange
                      <p className="text-[10px] font-normal text-[#737688]">No cash settlement</p>
                    </span>
                  )}
                </div>
              {netDiff < 0 && (
                <div className="space-y-sm pt-xs border-t border-[#c3c5d9]/20">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#434656]">Collect Via</span>
                    <select
                      className="border border-[#c3c5d9] rounded p-1 outline-none bg-white font-semibold cursor-pointer text-xs"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="UPI">UPI</option>
                      <option value="Mixed">Mixed</option>
                    </select>
                  </div>

                  {paymentMethod === 'Mixed' && (
                    <div className="space-y-sm bg-[#f2f3ff]/40 p-sm rounded-lg border border-[#c3c5d9]/20 select-none text-[10px]">
                      <div className="font-semibold text-[#434656] mb-xs">Collect Split Details</div>
                      
                      <div className="flex items-center justify-between gap-md">
                        <span className="text-[#434656] w-12 font-medium">UPI (₹)</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-20 font-mono text-right border border-[#c3c5d9] rounded p-1 outline-none focus:border-[#0041c8] text-[10px] font-semibold bg-white"
                          value={paymentSplit.UPI || ''}
                          onChange={(e) => handleSplitChange('UPI', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-md">
                        <span className="text-[#434656] w-12 font-medium">Cash (₹)</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-20 font-mono text-right border border-[#c3c5d9] rounded p-1 outline-none focus:border-[#0041c8] text-[10px] font-semibold bg-white"
                          value={paymentSplit.Cash || ''}
                          onChange={(e) => handleSplitChange('Cash', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-md">
                        <span className="text-[#434656] w-12 font-medium">Card (₹)</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="w-20 font-mono text-right border border-[#c3c5d9] rounded p-1 outline-none focus:border-[#0041c8] text-[10px] font-semibold bg-white"
                          value={paymentSplit.Card || ''}
                          onChange={(e) => handleSplitChange('Card', parseFloat(e.target.value) || 0)}
                        />
                      </div>

                      <div className="h-[1px] bg-[#c3c5d9]/30 my-sm"></div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-[#434656] font-medium">Split Total:</span>
                        <span className={`font-mono font-bold ${Math.abs(splitSum - Math.abs(netDiff)) < 0.05 ? 'text-[#005c3e]' : 'text-[#ba1a1a]'}`}>
                          ₹{formatValue(splitSum)}
                        </span>
                      </div>
                      
                      {Math.abs(splitSum - Math.abs(netDiff)) >= 0.05 && (
                        <div className="text-[9px] text-[#ba1a1a] text-right font-medium animate-pulse">
                          Difference: ₹{formatValue(Math.abs(netDiff) - splitSum)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

              <button
                type="button"
                disabled={submitting || (netDiff < 0 && paymentMethod === 'Mixed' && Math.abs(splitSum - Math.abs(netDiff)) >= 0.05)}
                onClick={handleSubmitReturn}
                className={`w-full py-md text-white font-semibold rounded-lg flex items-center justify-center gap-xs shadow-md transition-all active:scale-95 ${
                  submitting || (netDiff < 0 && paymentMethod === 'Mixed' && Math.abs(splitSum - Math.abs(netDiff)) >= 0.05) ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#0041c8] hover:opacity-90'
                }`}
                title={netDiff < 0 && paymentMethod === 'Mixed' && Math.abs(splitSum - Math.abs(netDiff)) >= 0.05 ? "Split sum must equal Collected difference to submit" : ""}
              >
                {submitting ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">assignment_turned_in</span>
                )}
                Submit Return/Exchange
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && successDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 select-none">
          <div className="glass-panel p-xl rounded-xl shadow-2xl max-w-sm w-full space-y-lg text-center animate-scaleUp">
            <div className="w-16 h-16 bg-[#005c3e]/10 text-[#005c3e] rounded-full flex items-center justify-center mx-auto mb-md">
              <span className="material-symbols-outlined text-[36px]">check_circle</span>
            </div>
            
            <h3 className="font-headline-lg text-headline-lg text-[#131b2e]">Return Completed</h3>
            
            <div className="bg-[#f2f3ff] p-md rounded-lg space-y-sm text-xs font-mono text-left">
              <div className="flex justify-between">
                <span className="text-[#737688]">Invoice Number:</span>
                <span className="font-bold text-[#131b2e]">{successDetails.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#737688]">Settle Action:</span>
                {successDetails.netDiff > 0 ? (
                  <span className="font-bold text-[#005c3e]">Refunded ₹{formatValue(successDetails.netDiff)}</span>
                ) : successDetails.netDiff < 0 ? (
                  <span className="font-bold text-[#ba1a1a]">Collected ₹{formatValue(Math.abs(successDetails.netDiff))}</span>
                ) : (
                  <span className="font-bold text-[#0041c8]">Even Exchange (₹0)</span>
                )}
              </div>
              {successDetails.exchangeInvoice && (
                <div className="pt-sm border-t border-[#c3c5d9]/30 flex justify-between">
                  <span className="text-[#737688]">Exchange Bill:</span>
                  <span className="font-bold text-[#0041c8]">{successDetails.exchangeInvoice.invoiceNumber}</span>
                </div>
              )}
            </div>

            <div className="space-y-sm pt-sm text-center">
              <div className="text-[10px] uppercase font-bold text-[#737688] text-left">Print Actions</div>
              
              <div className="grid grid-cols-2 gap-md">
                <button
                  type="button"
                  onClick={() => triggerPrintReceipt(successDetails.invoiceId)}
                  className="py-2 bg-[#eaedff] text-[#0041c8] font-bold rounded-lg text-xs hover:bg-[#c3c5d9] transition-all inline-flex items-center justify-center gap-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  Print Return Bill
                </button>
                <button
                  type="button"
                  onClick={() => triggerDownloadPDF(successDetails.invoiceId, successDetails.invoiceNumber)}
                  className="py-2 border border-[#c3c5d9] text-[#434656] font-bold rounded-lg text-xs hover:bg-gray-100 transition-all inline-flex items-center justify-center gap-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download Return
                </button>
              </div>

              {successDetails.exchangeInvoice && (
                <div className="grid grid-cols-2 gap-md">
                  <button
                    type="button"
                    onClick={() => triggerPrintReceipt(successDetails.exchangeInvoice._id)}
                    className="py-2 bg-[#0041c8]/10 text-[#0041c8] font-bold rounded-lg text-xs hover:bg-[#c3c5d9] transition-all inline-flex items-center justify-center gap-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    Print Exchange Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerDownloadPDF(successDetails.exchangeInvoice._id, successDetails.exchangeInvoice.invoiceNumber)}
                    className="py-2 border border-[#c3c5d9] text-[#434656] font-bold rounded-lg text-xs hover:bg-gray-100 transition-all inline-flex items-center justify-center gap-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Download Exchange
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-2 bg-[#0041c8] text-white font-bold rounded-lg text-xs hover:opacity-90 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;

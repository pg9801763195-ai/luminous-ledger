import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useShop } from '../context/ShopContext';

const POS = () => {
  const { shopProfile } = useShop();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentSplit, setPaymentSplit] = useState({ UPI: 0, Cash: 0, Card: 0 });
  const [checkoutResult, setCheckoutResult] = useState(null);
  
  // Modal states
  const [showCustModal, setShowCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [custModalLoading, setCustModalLoading] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // WhatsApp and Coupon Promotion states
  const [lastCheckoutCustomer, setLastCheckoutCustomer] = useState(null);
  const [tempWhatsAppPhone, setTempWhatsAppPhone] = useState('');
  const [posCoupons, setPosCoupons] = useState([]);

  // Focus ref for search
  const searchInputRef = useRef(null);

  // Helper to find matching pre-existing customers in real-time
  const getMatchingCustomers = () => {
    const searchName = newCustName.trim().toLowerCase();
    const searchPhone = newCustPhone.trim().replace(/\D/g, ''); // digit comparison
    
    if (searchName.length < 3 && searchPhone.length < 3) return [];
    
    return customers.filter(c => {
      const matchName = searchName.length >= 3 && c.name.toLowerCase().includes(searchName);
      const cleanCustomerPhone = (c.phone || '').replace(/\D/g, '');
      const matchPhone = searchPhone.length >= 3 && cleanCustomerPhone.includes(searchPhone);
      return matchName || matchPhone;
    });
  };
  
  const matchingCustomers = getMatchingCustomers();

  // Fetch products matching search string
  const searchProducts = async (term) => {
    try {
      setLoading(true);
      const res = await api.get(`/products?search=${term}&limit=8`);
      if (res.data.success) {
        setProducts(res.data.products);
      }
    } catch (error) {
      console.error('Error searching products', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch customers for selector
  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers?limit=100');
      if (res.data.success) {
        setCustomers(res.data.customers);
      }
    } catch (error) {
      console.error('Error fetching customers', error);
    }
  };

  // Fetch active coupons for promotion in WhatsApp text
  const fetchPosCoupons = async () => {
    try {
      const res = await api.get('/coupons');
      if (res.data.success) {
        const activeCoupons = (res.data.coupons || []).filter(c => {
          const isExpired = c.expiryDate && new Date(c.expiryDate) < new Date();
          return !isExpired;
        });
        setPosCoupons(activeCoupons);
      }
    } catch (error) {
      console.error('Error fetching POS coupons', error);
    }
  };

  // Generate WhatsApp manual link for Invoice & Offer promotion
  const getWhatsAppInvoiceUrl = (phone, invoice, customerName) => {
    const sName = (shopProfile.name || "Retail Store").toUpperCase();
    const dateObj = new Date(invoice.createdAt || new Date());
    const dateStr = `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    
    const centerText = (str, width = 28) => {
      if (str.length >= width) return str.substring(0, width);
      const leftPad = Math.floor((width - str.length) / 2);
      return ' '.repeat(leftPad) + str;
    };

    let text = `Hi ${customerName || 'Customer'},\n\nThank you for shopping at *${shopProfile.name || "Retail Store"}*! 🛍️\n\n`;
    text += `\`\`\`\n`;
    text += `============================\n`;
    text += `${centerText(sName)}\n`;
    text += `============================\n`;
    text += `Invoice: ${invoice.invoiceNumber}\n`;
    text += `Date: ${dateStr}\n`;
    text += `----------------------------\n`;
    text += `Items:\n`;
    
    (invoice.items || []).forEach(item => {
      const nameCol = item.name.substring(0, 13).padEnd(13);
      const qtyCol = `x${item.quantity}`.padEnd(5);
      const priceCol = `₹${item.total.toFixed(2)}`.padStart(8);
      text += `${nameCol} ${qtyCol} ${priceCol}\n`;
    });
    
    text += `----------------------------\n`;
    text += `Subtotal:`.padEnd(19) + `₹${invoice.subtotal.toFixed(2)}`.padStart(9) + `\n`;
    text += `GST Tax:`.padEnd(19) + `₹${invoice.taxTotal.toFixed(2)}`.padStart(9) + `\n`;
    if (invoice.discount > 0) {
      text += `Discount:`.padEnd(19) + `-₹${invoice.discount.toFixed(2)}`.padStart(9) + `\n`;
    }
    text += `============================\n`;
    text += `GRAND TOTAL:`.padEnd(19) + `₹${invoice.grandTotal.toFixed(2)}`.padStart(9) + `\n`;
    text += `============================\n`;
    text += `\`\`\`\n\n`;
    
    // Include PDF download link as reference
    const baseUrl = shopProfile?.receiptBaseUrl ? shopProfile.receiptBaseUrl.replace(/\/$/, '') : window.location.origin;
    const billPdfUrl = `${baseUrl}/api/invoices/public/${invoice.shareToken || invoice._id}/pdf`;
    text += `View PDF Receipt: ${billPdfUrl}\n\n`;
    text += `Hope you had a great experience. Visit us again soon!`;

    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  useEffect(() => {
    searchProducts('');
    fetchCustomers();
    fetchPosCoupons();
  }, []);

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearch(term);
    searchProducts(term);
  };

  // Add product to POS Cart
  const addToCart = (product) => {
    // Check stock first
    if (product.stock <= 0) {
      alert(`Product "${product.name}" is out of stock!`);
      return;
    }

    const existingIndex = cart.findIndex((item) => item.productId === product._id);
    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty >= product.stock) {
        alert(`Cannot add more. Available stock limit reached: ${product.stock}`);
        return;
      }
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          productId: product._id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          stock: product.stock,
          quantity: 1,
          taxRate: product.taxRate !== undefined ? product.taxRate : 18, // Store product-specific tax rate!
        },
      ]);
    }
    // Clear search for next item
    setSearch('');
    searchProducts('');
    searchInputRef.current?.focus();
  };

  // Update item quantity in Cart
  const updateQuantity = (productId, delta) => {
    const updatedCart = cart.map((item) => {
      if (item.productId === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null; // Flag for deletion
        if (newQty > item.stock) {
          alert(`Insufficient stock. Only ${item.stock} available.`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean);

    setCart(updatedCart);
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  const applyCouponToItem = async (productId, code) => {
    if (!code) {
      alert('Please enter a coupon code');
      return;
    }
    try {
      const res = await api.get(`/coupons/validate/${code.toUpperCase()}?productId=${productId}`);
      if (res.data.success) {
        const { discountType, discountValue } = res.data;
        const updatedCart = cart.map((item) => {
          if (item.productId === productId) {
            let discountPerItem = 0;
            if (discountType === 'Percentage') {
              discountPerItem = item.price * (discountValue / 100);
            } else if (discountType === 'Fixed') {
              discountPerItem = discountValue;
            }
            return {
              ...item,
              couponApplied: true,
              couponDiscount: parseFloat(discountPerItem.toFixed(2)),
              couponCode: code.toUpperCase(),
            };
          }
          return item;
        });
        setCart(updatedCart);
      }
    } catch (error) {
      console.error('Failed to validate coupon', error);
      alert(error.response?.data?.message || 'Invalid coupon code for this item');
    }
  };

  const removeCouponFromItem = (productId) => {
    const updatedCart = cart.map((item) => {
      if (item.productId === productId) {
        return {
          ...item,
          couponApplied: false,
          couponDiscount: 0,
          couponCode: '',
        };
      }
      return item;
    });
    setCart(updatedCart);
  };

  // Add New Customer Modal handler
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName || custModalLoading) return;

    try {
      setCustModalLoading(true);
      const res = await api.post('/customers', {
        name: newCustName,
        phone: newCustPhone,
        email: newCustEmail,
      });

      if (res.data.success) {
        const created = res.data.customer;
        await fetchCustomers();
        setSelectedCustomerId(created._id);
        setShowCustModal(false);
        setNewCustName('');
        setNewCustPhone('');
        setNewCustEmail('');
      }
    } catch (error) {
      console.error('Error creating customer', error);
      alert(error.response?.data?.message || 'Failed to create customer');
    } finally {
      setCustModalLoading(false);
    }
  };

  // Cart Calculations using custom product taxRate & Coupon Discounts
  const subtotal = cart.reduce((sum, item) => {
    const pricePostDiscount = Math.max(0, item.price - (item.couponDiscount || 0));
    return sum + pricePostDiscount * item.quantity;
  }, 0);

  const taxTotal = cart.reduce((sum, item) => {
    const rate = item.taxRate !== undefined ? item.taxRate : 18;
    const pricePostDiscount = Math.max(0, item.price - (item.couponDiscount || 0));
    return sum + (pricePostDiscount * item.quantity * (rate / 100));
  }, 0);

  const grandTotal = Math.max(0, subtotal + taxTotal - discount);

  const splitSum = (paymentSplit.UPI || 0) + (paymentSplit.Cash || 0) + (paymentSplit.Card || 0);

  const handleSplitChange = (method, value) => {
    setPaymentSplit(prev => ({
      ...prev,
      [method]: value
    }));
  };

  // Submit checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    try {
      setCheckoutLoading(true);
      const activeCust = customers.find(c => c._id === selectedCustomerId) || null;
      
      const res = await api.post('/invoices', {
        customerId: selectedCustomerId || null,
        items: cart,
        discount,
        paymentMethod,
        paymentSplit: paymentMethod === 'Mixed' ? paymentSplit : null,
      });

      if (res.data.success) {
        setLastCheckoutCustomer(activeCust);
        setTempWhatsAppPhone(activeCust?.phone || '');
        setCheckoutResult(res.data.invoice);
        setCart([]);
        setDiscount(0);
        setSelectedCustomerId('');
        setPaymentMethod('Cash');
        setPaymentSplit({ UPI: 0, Cash: 0, Card: 0 });
        searchProducts('');
      }
    } catch (error) {
      console.error('Checkout failed', error);
      alert(error.response?.data?.message || 'Transaction checkout failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const triggerPDFDownload = (invoiceId, invoiceNumber) => {
    const filename = invoiceNumber || (checkoutResult ? checkoutResult.invoiceNumber : 'receipt');
    api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `invoice-${filename}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Failed to download invoice PDF', err);
        alert('Failed to generate PDF. Check server logs.');
      });
  };

  const triggerPDFPrint = (invoiceId) => {
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
        
        let hasPrinted = false;
        const doPrint = () => {
          if (hasPrinted) return;
          hasPrinted = true;
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          } catch (e) {
            console.error('Failed to print PDF from iframe:', e);
          }
        };

        iframe.onload = doPrint;
        // Fallback for browsers (like Chrome) where onload does not fire for PDF blobs in iframes
        setTimeout(doPrint, 500);
      })
      .catch((err) => {
        console.error('Failed to print invoice PDF', err);
        alert('Failed to print PDF. Check server logs.');
      });
  };

  return (
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-gutter flex-1">
      {/* Products Search & List Catalog (2 columns on lg) */}
      <div class="lg:col-span-2 flex flex-col space-y-md">
        {/* Search header glass */}
        <div class="glass-panel p-md rounded-xl flex items-center justify-between gap-md select-none">
          <div class="relative flex-grow group">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#434656] group-focus-within:text-[#0041c8] transition-colors">search</span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search product SKU or name..."
              class="w-full pl-10 pr-4 py-2.5 bg-white border border-[#c3c5d9] rounded-lg focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] transition-all font-body-md outline-none"
              value={search}
              onChange={handleSearchChange}
            />
          </div>
          <button
            onClick={() => {
              setSearch('');
              searchProducts('');
            }}
            class="px-md h-11 border border-[#c3c5d9]/60 rounded-lg text-sm text-[#434656] hover:bg-[#dae2fd]/40 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Product Cards List */}
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-md overflow-y-auto max-h-[640px] pr-2 custom-scrollbar flex-1">
          {products.map((product) => (
            <div
              key={product._id}
              onClick={() => addToCart(product)}
              class={`glass-panel p-md rounded-xl cursor-pointer select-none transition-all duration-150 hover:shadow-md hover:scale-[1.02] flex flex-col justify-between min-h-[140px] relative ${
                product.stock <= 0 ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {product.stock <= product.minStockLevel && product.stock > 0 && (
                <span class="absolute top-2 right-2 w-2 h-2 bg-[#ba1a1a] rounded-full" title="Low stock warning"></span>
              )}
              <div>
                <span class="text-[10px] font-mono text-[#737688] block">{product.sku}</span>
                <h5 class="font-bold text-body-md text-[#131b2e] leading-snug mt-1 line-clamp-2">{product.name}</h5>
              </div>
              <div class="flex items-end justify-between mt-lg">
                <div class="flex flex-col">
                  <span class="font-bold font-mono text-[#0041c8] text-body-md">₹{(product.price * (1 + (product.taxRate !== undefined ? product.taxRate : 18) / 100)).toFixed(2)}</span>
                  <span class="text-[9px] font-semibold text-[#737688] font-mono">Tax: {product.taxRate !== undefined ? product.taxRate : 18}% (incl.)</span>
                </div>
                <span class={`text-[11px] font-semibold px-sm py-0.5 rounded-full ${
                  product.stock <= 0 
                    ? 'bg-[#ffdad6] text-[#ba1a1a]' 
                    : product.stock <= product.minStockLevel 
                    ? 'bg-orange-100 text-orange-700' 
                    : 'bg-[#83ffc6]/20 text-[#005c3e]'
                }`}>
                  Stock: {product.stock}
                </span>
              </div>
            </div>
          ))}
          {products.length === 0 && !loading && (
            <div class="col-span-full py-2xl text-center text-[#737688] font-body-md select-none">
              No matching active items found in database
            </div>
          )}
        </div>
      </div>

      {/* POS Cart Sidebar (1 column) */}
      <div class="glass-panel rounded-xl flex flex-col p-lg justify-between min-h-[680px] h-fit shadow-lg sticky top-24 select-none">
        <div>
          {/* Cart Header */}
          <div class="flex items-center justify-between pb-md border-b border-[#c3c5d9]/40 mb-md">
            <h4 class="font-bold text-headline-md flex items-center gap-sm">
              <span class="material-symbols-outlined text-[#0041c8]">shopping_basket</span>
              Shopping Cart
            </h4>
            <span class="bg-[#0041c8]/10 text-[#0041c8] px-sm py-0.5 rounded-full text-xs font-bold font-mono">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
            </span>
          </div>

          {/* Customer Selection */}
          <div class="mb-md flex items-end gap-sm">
            <div class="flex-grow space-y-1">
              <label class="text-xs font-bold text-[#434656]">Customer (Optional)</label>
              <select
                class="w-full border border-[#c3c5d9] bg-white/50 rounded-lg p-2 text-sm outline-none cursor-pointer focus:border-[#0041c8] transition-colors"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">Walk-in Guest</option>
                {customers.map((cust) => (
                  <option key={cust._id} value={cust._id}>
                    {cust.name} ({cust.phone || 'No Phone'})
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowCustModal(true)}
              title="Add New Customer"
              class="h-10 w-10 border border-[#c3c5d9] bg-white hover:bg-[#0041c8]/5 rounded-lg flex items-center justify-center text-[#0041c8] transition-colors shrink-0"
            >
              <span class="material-symbols-outlined text-[20px]">person_add</span>
            </button>
          </div>

          {/* Cart Items List */}
          <div class="overflow-y-auto max-h-[300px] divide-y divide-[#c3c5d9]/20 pr-1 custom-scrollbar">
            {cart.map((item) => (
              <div key={item.productId} class="py-md space-y-xs">
                <div class="flex items-start justify-between gap-sm">
                  <div class="flex-grow min-w-0">
                    <h6 class="font-bold text-[#131b2e] text-sm truncate">{item.name}</h6>
                    <span class="text-xs font-mono text-[#737688]">
                      ₹{(item.price * (1 + (item.taxRate !== undefined ? item.taxRate : 18) / 100)).toFixed(2)} {item.couponApplied && <span class="text-[#005c3e] font-bold">(Coupon Applied)</span>} (incl. {item.taxRate || 18}% Tax)
                    </span>
                  </div>
                  <div class="flex items-center gap-sm shrink-0">
                    <button
                      onClick={() => updateQuantity(item.productId, -1)}
                      class="w-7 h-7 border border-[#c3c5d9] rounded-lg flex items-center justify-center hover:bg-[#dae2fd]/40 transition-colors"
                    >
                      <span class="material-symbols-outlined text-[16px]">remove</span>
                    </button>
                    <span class="font-mono text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, 1)}
                      class="w-7 h-7 border border-[#c3c5d9] rounded-lg flex items-center justify-center hover:bg-[#dae2fd]/40 transition-colors"
                    >
                      <span class="material-symbols-outlined text-[16px]">add</span>
                    </button>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      class="text-[#ba1a1a] hover:bg-red-50 p-1 rounded transition-colors ml-xs"
                    >
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>

                {/* Coupon Code Inline Input */}
                <div class="flex items-center gap-sm bg-[#faf8ff] p-xs rounded-lg border border-[#c3c5d9]/20">
                  <span class="text-[9px] font-bold text-[#737688] uppercase tracking-wider shrink-0">Coupon:</span>
                  <input
                    type="text"
                    placeholder="CODE"
                    value={item.couponCode || ''}
                    disabled={!!item.couponApplied}
                    onChange={(e) => {
                      const code = e.target.value.toUpperCase();
                      setCart(cart.map(c => c.productId === item.productId ? { ...c, couponCode: code } : c));
                    }}
                    class="h-6 px-1.5 border border-[#c3c5d9] rounded text-xs outline-none bg-white font-mono flex-grow focus:border-[#0041c8] uppercase disabled:opacity-60"
                  />
                  {item.couponApplied ? (
                    <button
                      onClick={() => removeCouponFromItem(item.productId)}
                      class="h-6 px-2 bg-[#ffdad6] text-[#ba1a1a] hover:bg-red-100 rounded text-[10px] font-bold transition-all"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => applyCouponToItem(item.productId, item.couponCode)}
                      class="h-6 px-2 bg-[#0041c8] text-white hover:opacity-90 rounded text-[10px] font-bold transition-all"
                    >
                      Apply
                    </button>
                  )}
                </div>
                {item.couponApplied && (
                  <div class="text-[10px] text-[#005c3e] font-bold flex items-center gap-xs pl-1">
                    <span class="material-symbols-outlined text-[12px]">check_circle</span>
                    Discount: -₹{(item.couponDiscount * item.quantity).toFixed(2)} applied
                  </div>
                )}
              </div>
            ))}
            {cart.length === 0 && (
              <div class="py-xl text-center text-[#737688] text-sm">
                Cart is empty. Select products from left catalog.
              </div>
            )}
          </div>
        </div>

        {/* Calculations Block */}
        <div class="border-t border-[#c3c5d9]/40 pt-md space-y-sm">
          <div class="flex justify-between items-center text-sm">
            <span class="text-[#434656]">Subtotal</span>
            <span class="font-mono font-bold">₹{subtotal.toFixed(2)}</span>
          </div>
          {cart.some(item => item.couponApplied) && (
            <div class="flex justify-between items-center text-sm text-[#005c3e] font-bold">
              <span>Coupon Discounts</span>
              <span class="font-mono">-₹{cart.reduce((sum, item) => sum + (item.couponDiscount || 0) * item.quantity, 0).toFixed(2)}</span>
            </div>
          )}
          <div class="flex justify-between items-center text-sm">
            <span class="text-[#434656]">GST Tax (Custom Rates)</span>
            <span class="font-mono font-bold">₹{taxTotal.toFixed(2)}</span>
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-[#434656]">Discount (₹)</span>
            <input
              type="number"
              min="0"
              class="w-20 font-mono font-bold text-right border border-[#c3c5d9] rounded p-1 outline-none focus:border-[#0041c8]"
              value={discount}
              onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </div>
          <div class="flex items-center justify-between text-sm">
            <span class="text-[#434656]">Payment</span>
            <select
              class="border border-[#c3c5d9] rounded p-1 outline-none bg-white font-semibold cursor-pointer"
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
            <div class="space-y-sm bg-[#f2f3ff]/40 p-sm rounded-lg border border-[#c3c5d9]/20 select-none text-xs">
              <div class="font-semibold text-[#434656] mb-xs">Payment Split Details</div>
              
              <div class="flex items-center justify-between gap-md">
                <span class="text-[#434656] w-12 font-medium">UPI (₹)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-24 font-mono text-right border border-[#c3c5d9] rounded p-1 outline-none focus:border-[#0041c8] text-xs font-semibold"
                  value={paymentSplit.UPI || ''}
                  onChange={(e) => handleSplitChange('UPI', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div class="flex items-center justify-between gap-md">
                <span class="text-[#434656] w-12 font-medium">Cash (₹)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-24 font-mono text-right border border-[#c3c5d9] rounded p-1 outline-none focus:border-[#0041c8] text-xs font-semibold"
                  value={paymentSplit.Cash || ''}
                  onChange={(e) => handleSplitChange('Cash', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div class="flex items-center justify-between gap-md">
                <span class="text-[#434656] w-12 font-medium">Card (₹)</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  class="w-24 font-mono text-right border border-[#c3c5d9] rounded p-1 outline-none focus:border-[#0041c8] text-xs font-semibold"
                  value={paymentSplit.Card || ''}
                  onChange={(e) => handleSplitChange('Card', parseFloat(e.target.value) || 0)}
                />
              </div>

              <div class="h-[1px] bg-[#c3c5d9]/30 my-sm"></div>
              
              <div class="flex items-center justify-between">
                <span class="text-[#434656] font-medium">Split Total:</span>
                <span class={`font-mono font-bold ${Math.abs(splitSum - grandTotal) < 0.05 ? 'text-[#005c3e]' : 'text-[#ba1a1a]'}`}>
                  ₹{splitSum.toFixed(2)}
                </span>
              </div>
              
              {Math.abs(splitSum - grandTotal) >= 0.05 && (
                <div class="text-[10px] text-[#ba1a1a] text-right font-medium animate-pulse">
                  Difference: ₹{(grandTotal - splitSum).toFixed(2)}
                </div>
              )}
            </div>
          )}

          <div class="pt-sm border-t border-[#c3c5d9]/20 flex justify-between items-center select-none">
            <span class="font-bold text-[#131b2e] text-body-lg">Grand Total</span>
            <span class="font-mono font-bold text-headline-md text-[#0041c8]">₹{grandTotal.toFixed(2)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || checkoutLoading || (paymentMethod === 'Mixed' && Math.abs(splitSum - grandTotal) >= 0.05)}
            class="w-full h-12 bg-[#0041c8] hover:bg-[#0041c8]/90 disabled:opacity-50 text-white font-bold rounded-lg shadow-md shadow-[#0041c8]/20 flex items-center justify-center gap-sm mt-md transition-all active:scale-[0.99]"
            title={paymentMethod === 'Mixed' && Math.abs(splitSum - grandTotal) >= 0.05 ? "Split sum must equal Grand Total to checkout" : ""}
          >
            {checkoutLoading ? (
              <>
                <span class="material-symbols-outlined animate-spin">progress_activity</span>
                Processing Checkout...
              </>
            ) : (
              <>
                Complete Checkout
                <span class="material-symbols-outlined">payments</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* SUCCESS MODAL */}
      {checkoutResult && (
        <div class="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg select-none animate-fade-in">
          <div class="bg-white rounded-xl max-w-md w-full p-2xl shadow-2xl glass-panel text-center relative space-y-lg border border-[#c3c5d9]/40">
            <div class="w-16 h-16 bg-[#83ffc6]/20 text-[#005c3e] rounded-full flex items-center justify-center mx-auto shadow-sm">
              <span class="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div>
              <h3 class="font-bold text-headline-lg text-[#131b2e]">Transaction Success</h3>
              <p class="text-sm text-[#434656] mt-base">Invoice generated successfully!</p>
              <p class="font-mono text-[#0041c8] font-bold text-sm mt-sm">{checkoutResult.invoiceNumber}</p>
            </div>
            
            <div class="p-md rounded-lg bg-[#eaedff]/30 space-y-xs text-sm text-left">
              <div class="flex justify-between">
                <span class="text-[#737688]">Receipt Total:</span>
                <span class="font-mono font-bold text-[#131b2e]">₹{checkoutResult.grandTotal.toFixed(2)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-[#737688]">Payment Mode:</span>
                <span class="font-semibold text-[#131b2e]">{checkoutResult.paymentMethod}</span>
              </div>
              {checkoutResult.paymentMethod === 'Mixed' && checkoutResult.paymentSplit && (
                <div class="mt-xs pt-xs border-t border-[#c3c5d9]/20 grid grid-cols-3 gap-xs text-center text-xs font-mono text-[#434656]">
                  {(checkoutResult.paymentSplit.UPI || 0) > 0 && (
                    <div>
                      <span class="text-[9px] uppercase tracking-wider block text-[#737688]">UPI</span>
                      <span class="font-bold">₹{checkoutResult.paymentSplit.UPI}</span>
                    </div>
                  )}
                  {(checkoutResult.paymentSplit.Cash || 0) > 0 && (
                    <div>
                      <span class="text-[9px] uppercase tracking-wider block text-[#737688]">Cash</span>
                      <span class="font-bold">₹{checkoutResult.paymentSplit.Cash}</span>
                    </div>
                  )}
                  {(checkoutResult.paymentSplit.Card || 0) > 0 && (
                    <div>
                      <span class="text-[9px] uppercase tracking-wider block text-[#737688]">Card</span>
                      <span class="font-bold">₹{checkoutResult.paymentSplit.Card}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* WhatsApp Offer & Invoice Sharing */}
            <div class="p-md rounded-lg border border-green-200 bg-green-50/50 text-left space-y-sm">
              <div class="flex items-center gap-xs text-green-800 font-bold text-xs">
                <span class="material-symbols-outlined text-[18px]">chat</span>
                Share Invoice & Offer on WhatsApp
              </div>
              {lastCheckoutCustomer && lastCheckoutCustomer.phone ? (
                <div class="space-y-xs">
                  <p class="text-[11px] text-[#434656]">Send to registered client: <strong>{lastCheckoutCustomer.name}</strong> ({lastCheckoutCustomer.phone})</p>
                  <button
                    onClick={() => {
                      const url = getWhatsAppInvoiceUrl(lastCheckoutCustomer.phone, checkoutResult, lastCheckoutCustomer.name);
                      window.open(url, '_blank');
                    }}
                    class="w-full h-9 bg-[#25D366] hover:bg-[#1ebd59] text-white font-semibold rounded-lg flex items-center justify-center gap-xs shadow-sm text-xs transition-colors"
                  >
                    <span class="material-symbols-outlined text-[16px]">send</span>
                    Send to {lastCheckoutCustomer.name}
                  </button>
                </div>
              ) : (
                <div class="space-y-xs">
                  <p class="text-[11px] text-[#737688]">This was checkout for a <strong>Walk-in Guest</strong>. Enter a phone number to share receipt:</p>
                  <div class="flex gap-xs">
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      class="flex-grow h-9 px-3 border border-[#c3c5d9] bg-white rounded-lg text-xs outline-none focus:border-[#0041c8]"
                      value={tempWhatsAppPhone}
                      onChange={(e) => setTempWhatsAppPhone(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        if (!tempWhatsAppPhone) {
                          alert('Please enter a WhatsApp phone number');
                          return;
                        }
                        const url = getWhatsAppInvoiceUrl(tempWhatsAppPhone, checkoutResult, 'Guest');
                        window.open(url, '_blank');
                      }}
                      class="h-9 px-md bg-[#25D366] hover:bg-[#1ebd59] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <span class="material-symbols-outlined text-[14px]">send</span>
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div class="flex gap-md pt-sm">
              <button
                onClick={() => triggerPDFDownload(checkoutResult._id)}
                class="flex-1 h-11 border border-[#0041c8] text-[#0041c8] hover:bg-[#eaedff] font-semibold rounded-lg flex items-center justify-center gap-xs transition-all active:scale-95"
              >
                <span class="material-symbols-outlined text-[20px]">download</span>
                Download
              </button>
              <button
                onClick={() => triggerPDFPrint(checkoutResult._id)}
                class="flex-1 h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center gap-xs shadow-md transition-all active:scale-95"
              >
                <span class="material-symbols-outlined text-[20px]">print</span>
                Print Bill
              </button>
            </div>
            <button
              onClick={() => {
                setCheckoutResult(null);
                setLastCheckoutCustomer(null);
                setTempWhatsAppPhone('');
              }}
              class="w-full h-11 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg transition-all active:scale-95 mt-sm"
            >
              Close & Reset
            </button>
          </div>
        </div>
      )}

      {/* CREATE CUSTOMER MODAL */}
      {showCustModal && (
        <div class="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg animate-fade-in select-none">
          <div class="bg-white rounded-xl max-w-sm w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40">
            <h3 class="font-bold text-headline-md text-[#131b2e] mb-lg flex items-center gap-sm">
              <span class="material-symbols-outlined text-[#0041c8]">person_add</span>
              Create Customer Profile
            </h3>
            
            <form onSubmit={handleCreateCustomer} class="space-y-md">
              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Smith"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 555-0199"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. jordan.smith@gmail.com"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={newCustEmail}
                  onChange={(e) => setNewCustEmail(e.target.value)}
                />
              </div>

              {/* Real-time pre-existing customer check */}
              {matchingCustomers.length > 0 && (
                <div class="p-md bg-[#eaedff] rounded-lg border border-[#c3c5d9]/60 max-h-36 overflow-y-auto animate-fade-in">
                  <span class="text-xs font-bold text-[#0041c8] block mb-xs">Existing Customer Found:</span>
                  <div class="space-y-xs">
                    {matchingCustomers.map(cust => (
                      <button
                        key={cust._id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomerId(cust._id);
                          setShowCustModal(false);
                          setNewCustName('');
                          setNewCustPhone('');
                          setNewCustEmail('');
                        }}
                        class="w-full text-left p-2 hover:bg-white rounded border border-[#c3c5d9]/30 hover:border-[#0041c8]/40 transition-all flex items-center justify-between text-xs"
                      >
                        <div>
                          <span class="font-bold text-[#131b2e] block">{cust.name}</span>
                          <span class="text-[#434656] text-[10px]">{cust.phone || 'No Phone'}</span>
                        </div>
                        <span class="text-[10px] font-bold text-[#0041c8] bg-white px-2 py-1 rounded border border-[#0041c8] shadow-sm hover:bg-[#0041c8] hover:text-white transition-colors">
                          Use Customer
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div class="flex gap-md pt-lg">
                <button
                  type="submit"
                  disabled={custModalLoading}
                  class="flex-grow h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center gap-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  {custModalLoading ? 'Creating...' : 'Create Profile'}
                </button>
                <button
                  type="button"
                  disabled={custModalLoading}
                  onClick={() => setShowCustModal(false)}
                  class="h-11 px-4 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg transition-all active:scale-95 disabled:opacity-50"
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

export default POS;

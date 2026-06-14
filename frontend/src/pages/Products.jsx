import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useShop } from '../context/ShopContext';
import { QRCodeSVG } from 'qrcode.react';

// SVG-based Barcode Rendering Component
const BarcodeRenderer = ({ value, height = 55, scale = 1.5, showSkuText = true }) => {
  const safeValue = value || '';
  const bars = [];
  let totalWidth = 0;
  // Generate pseudo-random barcode lines based on the SKU characters
  for (let i = 0; i < 46; i++) {
    const isBlack = i % 2 === 0;
    const charCode = safeValue.charCodeAt(i % (safeValue.length || 1)) || 0;
    const width = (1 + (charCode % 3)) * scale; // line width adjusted by scale factor
    bars.push({
      width,
      isBlack,
    });
    totalWidth += width;
  }

  let currentX = 0;
  const rects = bars.map((bar, index) => {
    const rect = bar.isBlack ? (
      <rect
        key={index}
        x={currentX}
        y={0}
        width={bar.width}
        height={height}
        fill="#000000"
      />
    ) : null;
    currentX += bar.width;
    return rect;
  });

  return (
    <div className="flex flex-col items-center p-md bg-white border border-[#c3c5d9]/40 rounded-lg">
      <div className="flex items-end justify-center bg-white px-lg py-sm barcode-lines-svg-container">
        <svg width={totalWidth} height={height} viewBox={`0 0 ${totalWidth} ${height}`} xmlns="http://www.w3.org/2000/svg">
          {rects}
        </svg>
      </div>
      {showSkuText && (
        <span className="font-mono text-sm tracking-[5px] mt-2 font-bold text-black">{safeValue}</span>
      )}
    </div>
  );
};

const Products = () => {
  const { isManager } = useAuth();
  const { shopProfile } = useShop();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('-updatedAt');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Product Form Modal state
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    price: 0,
    costPrice: 0,
    stock: 0,
    minStockLevel: 10,
    supplier: '',
    taxRate: 18,
    mrp: 0,
  });

  // Barcode Printer Modal state
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeSku, setBarcodeSku] = useState('');
  const [barcodeProductName, setBarcodeProductName] = useState('');
  const [barcodeProductPrice, setBarcodeProductPrice] = useState(0);
  const [barcodeProductTaxRate, setBarcodeProductTaxRate] = useState(18);
  const [barcodeBrandText, setBarcodeBrandText] = useState(shopProfile.name || '');
  const [barcodeShowBrand, setBarcodeShowBrand] = useState(true);
  const [barcodeShowName, setBarcodeShowName] = useState(true);
  const [barcodeShowPrice, setBarcodeShowPrice] = useState(true);
  const [barcodeShowSkuText, setBarcodeShowSkuText] = useState(true);
  const [barcodeHeight, setBarcodeHeight] = useState(55);
  const [barcodeScale, setBarcodeScale] = useState(1.5);
  const [barcodeBorderStyle, setBarcodeBorderStyle] = useState('dashed');
  const [barcodeBorderColor, setBarcodeBorderColor] = useState('#c3c5d9');
  const [barcodeBgColor, setBarcodeBgColor] = useState('#faf8ff');
  const [barcodeShowLogo, setBarcodeShowLogo] = useState(true);
  const [barcodeCustomText, setBarcodeCustomText] = useState('Special Offer');
  const [barcodeShowCustomText, setBarcodeShowCustomText] = useState(false);
  const [barcodeCodeType, setBarcodeCodeType] = useState('barcode');
  
  // Advanced customization states
  const [barcodeCodePosition, setBarcodeCodePosition] = useState('bottom');
  const [barcodeFontFamily, setBarcodeFontFamily] = useState('Inter');
  const [barcodeAlignment, setBarcodeAlignment] = useState('center');
  const [barcodeWidth, setBarcodeWidth] = useState(280);
  const [barcodeMinHeight, setBarcodeMinHeight] = useState(180);
  const [barcodePadding, setBarcodePadding] = useState(24);
  const [barcodeQrSize, setBarcodeQrSize] = useState(80);
  const [barcodeBrandSize, setBarcodeBrandSize] = useState(10);
  const [barcodeNameSize, setBarcodeNameSize] = useState(14);
  const [barcodePriceSize, setBarcodePriceSize] = useState(13);
  const [barcodeCustomTextSize, setBarcodeCustomTextSize] = useState(11);

  // MRP states
  const [barcodeMrpText, setBarcodeMrpText] = useState('');
  const [barcodeShowMrp, setBarcodeShowMrp] = useState(false);
  const [barcodeMrpSize, setBarcodeMrpSize] = useState(12);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/products?page=${page}&search=${search}&category=${category}&sort=${sort}`
      );
      if (res.data.success) {
        setProducts(res.data.products);
        setTotalPages(res.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error fetching products', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      if (res.data.success) {
        setSuppliers(res.data.suppliers);
      }
    } catch (error) {
      console.error('Error fetching suppliers', error);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, category, sort]);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearch(searchParam);
      const fetchWithSearch = async () => {
        try {
          setLoading(true);
          const res = await api.get(
            `/products?page=1&search=${encodeURIComponent(searchParam)}&category=${category}&sort=${sort}`
          );
          if (res.data.success) {
            setProducts(res.data.products);
            setTotalPages(res.data.pagination.pages);
          }
        } catch (error) {
          console.error('Error fetching products', error);
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
    fetchProducts();
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setFormData({
      sku: '',
      name: '',
      description: '',
      category: '',
      price: 0,
      costPrice: 0,
      stock: 0,
      minStockLevel: 10,
      supplier: '',
      taxRate: 18,
      mrp: 0,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (product) => {
    setEditId(product._id);
    const taxRate = product.taxRate !== undefined ? product.taxRate : 18;
    const inclusivePrice = product.price * (1 + taxRate / 100);
    setFormData({
      sku: product.sku,
      name: product.name,
      description: product.description || '',
      category: product.category,
      price: parseFloat(inclusivePrice.toFixed(2)),
      costPrice: product.costPrice,
      stock: product.stock,
      minStockLevel: product.minStockLevel,
      supplier: product.supplier?._id || '',
      taxRate,
      mrp: product.mrp !== undefined ? product.mrp : 0,
    });
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const taxRate = formData.taxRate !== undefined ? formData.taxRate : 18;
      const basePrice = formData.price / (1 + taxRate / 100);
      const submitData = { ...formData, price: parseFloat(basePrice.toFixed(4)) };

      if (editId) {
        const { stock, ...updateData } = submitData;
        const res = await api.put(`/products/${editId}`, updateData);
        if (res.data.success) {
          setShowModal(false);
          fetchProducts();
        }
      } else {
        const res = await api.post('/products', submitData);
        if (res.data.success) {
          setShowModal(false);
          fetchProducts();
        }
      }
    } catch (error) {
      console.error('Error saving product details', error);
      alert(error.response?.data?.message || 'Failed to save product details');
    }
  };

  const handleDeleteProduct = async (id, name) => {
    if (window.confirm(`Are you sure you want to remove product "${name}" from catalog?`)) {
      try {
        const res = await api.delete(`/products/${id}`);
        if (res.data.success) {
          fetchProducts();
        }
      } catch (error) {
        console.error('Error deleting product', error);
        alert(error.response?.data?.message || 'Failed to delete product');
      }
    }
  };

  const handleOpenBarcode = (product) => {
    setBarcodeSku(product.sku);
    setBarcodeProductName(product.name);
    setBarcodeProductPrice(product.price);
    setBarcodeProductTaxRate(product.taxRate !== undefined ? product.taxRate : 18);
    setBarcodeBrandText(shopProfile.name || '');
    setBarcodeShowBrand(true);
    setBarcodeShowName(true);
    setBarcodeShowPrice(true);
    setBarcodeShowSkuText(true);
    setBarcodeHeight(55);
    setBarcodeScale(1.5);
    setBarcodeBorderStyle('dashed');
    setBarcodeBorderColor('#c3c5d9');
    setBarcodeBgColor('#faf8ff');
    setBarcodeShowLogo(true);
    setBarcodeCustomText('Special Sale');
    setBarcodeShowCustomText(false);
    setBarcodeCodeType('barcode');
    
    // Reset advanced layouts
    setBarcodeCodePosition('bottom');
    setBarcodeFontFamily('Inter');
    setBarcodeAlignment('center');
    setBarcodeWidth(280);
    setBarcodeMinHeight(180);
    setBarcodePadding(24);
    setBarcodeQrSize(80);
    setBarcodeBrandSize(10);
    setBarcodeNameSize(14);
    setBarcodePriceSize(13);
    setBarcodeCustomTextSize(11);

    // Reset MRP states
    const productMrp = product.mrp !== undefined ? product.mrp : 0;
    setBarcodeMrpText(productMrp.toString());
    setBarcodeShowMrp(productMrp > 0);
    setBarcodeMrpSize(12);
    
    setShowBarcodeModal(true);
  };

  const handlePrintBarcodeLabel = () => {
    const isQrCode = barcodeCodeType === 'qrcode';
    let codeHtml = '';
    
    if (isQrCode) {
      const qrContainer = document.querySelector('.qr-code-svg-container');
      codeHtml = qrContainer ? qrContainer.innerHTML : '';
    } else {
      const svgContainer = document.querySelector('.barcode-lines-svg-container');
      codeHtml = svgContainer ? svgContainer.innerHTML : '';
    }
    
    const logoImgEl = document.querySelector('#printable-barcode-card img.logo-preview');
    const logoSrc = logoImgEl ? logoImgEl.src : '';

    const inclusivePrice = barcodeProductPrice * (1 + barcodeProductTaxRate / 100);
    
    const logoHtml = barcodeShowLogo && logoSrc ? `<img src="${logoSrc}" class="logo-img" />` : '';
    const brandHtml = barcodeShowBrand ? `<div class="brand">${barcodeBrandText}</div>` : '';
    const nameHtml = barcodeShowName ? `<div class="name">${barcodeProductName}</div>` : '';
    const mrpHtml = barcodeShowMrp ? `<div class="mrp">MRP: Rs. ${parseFloat(barcodeMrpText || 0).toFixed(2)}</div>` : '';
    const priceHtml = barcodeShowPrice ? `<div class="price">Price: INR ${inclusivePrice.toFixed(2)} (incl. tax)</div>` : '';
    const customTextHtml = barcodeShowCustomText && barcodeCustomText ? `<div class="custom-text">${barcodeCustomText}</div>` : '';
    const codeContainerHtml = `
      <div class="barcode-lines">
        ${codeHtml}
        ${barcodeShowSkuText ? `<div class="sku-num">${barcodeSku}</div>` : ''}
      </div>
    `;

    let contentHtml = '';
    
    // Build order
    if (barcodeCodePosition === 'top') {
      contentHtml += codeContainerHtml;
    }
    contentHtml += logoHtml;
    contentHtml += brandHtml;
    if (barcodeCodePosition === 'below-brand') {
      contentHtml += codeContainerHtml;
    }
    contentHtml += nameHtml;
    if (barcodeCodePosition === 'below-name') {
      contentHtml += codeContainerHtml;
    }
    contentHtml += mrpHtml;
    contentHtml += priceHtml;
    if (barcodeCodePosition === 'below-price') {
      contentHtml += codeContainerHtml;
    }
    contentHtml += customTextHtml;
    if (barcodeCodePosition === 'bottom') {
      contentHtml += codeContainerHtml;
    }

    const printWindow = window.open('', '', 'width=600,height=400');
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Label - ${barcodeProductName}</title>
          <style>
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
            body { 
              font-family: '${barcodeFontFamily}', sans-serif; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              height: 100vh; 
              margin: 0; 
            }
            .print-card { 
              border: 1px ${barcodeBorderStyle} ${barcodeBorderColor}; 
              padding: ${barcodePadding}px; 
              text-align: ${barcodeAlignment}; 
              width: ${barcodeWidth}px; 
              min-height: ${barcodeMinHeight}px;
              background-color: ${barcodeBgColor};
              border-radius: 8px;
              display: flex;
              flex-direction: column;
              align-items: ${barcodeAlignment === 'center' ? 'center' : barcodeAlignment === 'right' ? 'flex-end' : 'flex-start'};
              justify-content: center;
              box-sizing: border-box;
            }
            .logo-img { width: 40px; height: 40px; object-fit: contain; border-radius: 50%; margin-bottom: 4px; background: white; border: 1px solid #eee; }
            .brand { font-size: ${barcodeBrandSize}px; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px; text-transform: uppercase; color: #737688; }
            .name { font-size: ${barcodeNameSize}px; font-weight: bold; margin-bottom: 5px; color: #131b2e; }
            .mrp { font-size: ${barcodePriceSize}px; font-weight: bold; text-decoration: line-through; color: #737688; margin-bottom: 5px; }
            .price { font-size: ${barcodePriceSize}px; font-weight: bold; margin-bottom: 8px; color: #434656; font-family: monospace; }
            .custom-text { font-size: ${barcodeCustomTextSize}px; color: #434656; font-style: italic; margin-bottom: 8px; max-width: 260px; word-break: break-word; }
            .barcode-lines { display: flex; flex-direction: column; justify-content: center; align-items: center; margin-top: 4px; margin-bottom: 8px; width: 100%; }
            .sku-num { font-family: monospace; font-size: 12px; font-weight: bold; letter-spacing: 4px; margin-top: 4px; color: #000; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="print-card">
            ${contentHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div class="space-y-gutter flex-grow flex flex-col select-none">
      {/* Page Title & Button */}
      <div class="flex items-end justify-between">
        <div>
          <h2 class="font-headline-lg text-headline-lg text-[#131b2e]">Product Catalog</h2>
          <p class="font-body-md text-[#434656] mt-1">Manage core product records, custom tax values, and generate SKU barcode stickers.</p>
        </div>
        {isManager && (
          <button
            onClick={handleOpenCreate}
            class="px-lg py-md bg-[#0041c8] text-white rounded-lg font-label-sm flex items-center gap-sm shadow-lg shadow-[#0041c8]/20 hover:opacity-90 transition-all active:scale-95"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            Add Product
          </button>
        )}
      </div>

      {/* Filters & Search Bar */}
      <div class="glass-panel p-md rounded-xl flex flex-wrap items-center justify-between gap-md">
        <form onSubmit={handleSearchSubmit} class="flex items-center gap-sm flex-grow max-w-md">
          <input
            type="text"
            placeholder="Search SKU or product name..."
            class="flex-grow h-10 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="submit"
            class="px-md h-10 bg-[#0041c8] text-white rounded-lg text-sm font-semibold hover:opacity-90 active:scale-95"
          >
            Search
          </button>
        </form>

        <div class="flex gap-md">
          <select
            class="h-10 px-3 border border-[#c3c5d9] bg-white rounded-lg text-sm outline-none cursor-pointer focus:border-[#0041c8]"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Categories</option>
            <option value="Apparel">Apparel</option>
            <option value="Electronics">Electronics</option>
            <option value="Home & Living">Home & Living</option>
            <option value="Accessories">Accessories</option>
          </select>

          <select
            class="h-10 px-3 border border-[#c3c5d9] bg-white rounded-lg text-sm outline-none cursor-pointer focus:border-[#0041c8]"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="-updatedAt">Newest Updated</option>
            <option value="price">Price: Low to High</option>
            <option value="-price">Price: High to Low</option>
            <option value="stock">Stock: Low to High</option>
            <option value="-stock">Stock: High to Low</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div class="glass-panel rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col justify-between">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-[#f2f3ff]/50 sticky top-0 backdrop-blur-md">
              <tr>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">SKU Barcode</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Product Name</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Category</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Retail Price</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Cost Price</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">GST Tax</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Stock</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Supplier</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#c3c5d9]/20 font-body-md">
              {loading ? (
                <tr>
                  <td colspan="9" class="text-center py-xl">
                    <span class="material-symbols-outlined text-[36px] text-[#0041c8] animate-spin">progress_activity</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colspan="9" class="px-lg py-xl text-center text-[#737688]">No products registered in database</td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product._id} class="hover:bg-[#0041c8]/5 transition-colors group">
                    <td class="px-lg py-md font-mono text-[#131b2e] font-semibold flex items-center gap-sm">
                      {product.sku}
                      <button
                        onClick={() => handleOpenBarcode(product)}
                        class="p-1 hover:bg-[#0041c8]/5 rounded text-[#0041c8]"
                        title="Display & Print Barcode Label"
                      >
                        <span class="material-symbols-outlined text-[16px]">barcode_scanner</span>
                      </button>
                    </td>
                    <td class="px-lg py-md font-bold text-[#131b2e]">{product.name}</td>
                    <td class="px-lg py-md text-[#434656]">{product.category}</td>
                    <td class="px-lg py-md font-mono font-bold text-[#0041c8]">₹{(product.price * (1 + (product.taxRate !== undefined ? product.taxRate : 18) / 100)).toFixed(2)}</td>
                    <td class="px-lg py-md font-mono text-[#737688]">₹{product.costPrice.toFixed(2)}</td>
                    <td class="px-lg py-md font-mono text-[#434656]">{product.taxRate !== undefined ? product.taxRate : 18}%</td>
                    <td class="px-lg py-md">
                      <span class={`px-sm py-1 rounded-full text-xs font-bold inline-flex items-center gap-xs ${
                        product.stock <= 0 
                          ? 'bg-[#ffdad6] text-[#ba1a1a]' 
                          : product.stock <= product.minStockLevel 
                          ? 'bg-orange-100 text-orange-700' 
                          : 'bg-[#83ffc6]/20 text-[#005c3e]'
                      }`}>
                        <span class={`w-1.5 h-1.5 rounded-full ${
                          product.stock <= 0 ? 'bg-[#ba1a1a]' : product.stock <= product.minStockLevel ? 'bg-orange-600' : 'bg-[#005c3e]'
                        }`}></span>
                        {product.stock} units
                      </span>
                    </td>
                    <td class="px-lg py-md text-[#434656]">{product.supplier ? product.supplier.name : 'N/A'}</td>
                    <td class="px-lg py-md">
                      <div class="flex items-center gap-sm">
                        {isManager && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(product)}
                              class="p-1 text-[#0041c8] hover:bg-[#0041c8]/5 rounded transition-colors"
                              title="Edit Product Details"
                            >
                              <span class="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product._id, product.name)}
                              class="p-1 text-[#ba1a1a] hover:bg-red-50 rounded transition-colors"
                              title="Remove Product"
                            >
                              <span class="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </>
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
          <div class="px-lg py-md bg-white/30 flex items-center justify-between border-t border-[#c3c5d9]/30 select-none">
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

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div class="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg">
          <div class="bg-white rounded-xl max-w-lg w-full p-2xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 class="font-bold text-headline-md text-[#131b2e] mb-lg flex items-center gap-sm">
              <span class="material-symbols-outlined text-[#0041c8]">{editId ? 'edit' : 'add_box'}</span>
              {editId ? 'Edit Product Details' : 'Register New Product'}
            </h3>

            <form onSubmit={handleFormSubmit} class="grid grid-cols-2 gap-md">
              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">SKU Barcode (Optional)</label>
                <input
                  type="text"
                  placeholder="Blank for Auto-Generated"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  disabled={!!editId}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Black T-Shirt"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div class="col-span-2 space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Description</label>
                <textarea
                  rows="2"
                  placeholder="Product specifications, details, etc."
                  class="w-full p-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Category *</label>
                <select
                  required
                  class="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8]"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select Category</option>
                  <option value="Apparel">Apparel</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Home & Living">Home & Living</option>
                  <option value="Accessories">Accessories</option>
                </select>
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Wholesale Supplier</label>
                <select
                  class="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8]"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Retail Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all font-mono"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Maximum Retail Price (MRP) (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all font-mono"
                  value={formData.mrp}
                  onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Buying Cost (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all font-mono"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Initial Stock *</label>
                <input
                  type="number"
                  required
                  min="0"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all font-mono"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value, 10) || 0 })}
                  disabled={!!editId}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Low Stock Limit *</label>
                <input
                  type="number"
                  required
                  min="0"
                  class="w-full h-11 px-3 border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] transition-all font-mono"
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value, 10) || 0 })}
                />
              </div>

              <div class="space-y-xs">
                <label class="text-xs font-bold text-[#434656] px-1">Product GST Tax Rate *</label>
                <select
                  required
                  class="w-full h-11 px-3 border border-[#c3c5d9] bg-white rounded-lg outline-none focus:border-[#0041c8]"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: parseInt(e.target.value, 10) || 0 })}
                >
                  <option value="0">0% (Tax Free / Exempt)</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST (Standard)</option>
                  <option value="28">28% GST (Luxury)</option>
                </select>
              </div>

              <div class="col-span-2 flex gap-md pt-lg border-t border-[#c3c5d9]/30 mt-sm">
                <button
                  type="submit"
                  class="flex-grow h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center shadow-md active:scale-95 transition-all"
                >
                  Save Product
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  class="h-11 px-6 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARCODE STICKER DISPLAY MODAL */}
      {showBarcodeModal && (
        <div class="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-lg">
          <div class="bg-white rounded-xl max-w-4xl w-full p-xl shadow-2xl glass-panel relative border border-[#c3c5d9]/40 flex flex-col md:flex-row gap-xl">
            <button
              onClick={() => setShowBarcodeModal(false)}
              class="absolute top-4 right-4 p-1 hover:bg-[#dae2fd]/40 rounded-full transition-colors text-[#434656]"
            >
              <span class="material-symbols-outlined text-[24px]">close</span>
            </button>

            {/* Left side: Live Preview */}
            <div class="flex-1 flex flex-col items-center justify-center space-y-md border-r border-[#c3c5d9]/20 pr-xl">
              <div class="text-center">
                <h3 class="font-bold text-headline-md text-[#131b2e]">{barcodeCodeType === 'qrcode' ? 'QR Code Print Label' : 'Barcode Print Label'}</h3>
                <p class="text-xs text-[#434656] mt-1">Live sticker design preview.</p>
              </div>

              {/* Dynamic preview block */}
              <div class="flex-grow flex items-center justify-center min-h-[260px] w-full bg-[#f2f3ff]/30 border border-[#c3c5d9]/20 rounded-xl p-md overflow-auto">
                <div 
                  id="printable-barcode-card" 
                  style={{
                    border: `1px ${barcodeBorderStyle} ${barcodeBorderColor}`,
                    backgroundColor: barcodeBgColor,
                    borderRadius: '8px',
                    width: `${barcodeWidth}px`,
                    minHeight: `${barcodeMinHeight}px`,
                    padding: `${barcodePadding}px`,
                    fontFamily: barcodeFontFamily,
                    textAlign: barcodeAlignment,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: barcodeAlignment === 'center' ? 'center' : barcodeAlignment === 'right' ? 'flex-end' : 'flex-start',
                    justifyContent: 'center',
                    boxSizing: 'border-box'
                  }}
                  class="shadow-md bg-white"
                >
                  {/* Top code position */}
                  {barcodeCodePosition === 'top' && (
                    <div class="barcode-lines-render my-1 w-full flex flex-col items-center">
                      {barcodeCodeType === 'qrcode' ? (
                        <div className="flex flex-col items-center p-md bg-white border border-[#c3c5d9]/40 rounded-lg qr-code-svg-container">
                          <QRCodeSVG value={barcodeSku} size={barcodeQrSize} bgColor="#ffffff" fgColor="#000000" level="M" />
                        </div>
                      ) : (
                        <BarcodeRenderer value={barcodeSku} height={barcodeHeight} scale={barcodeScale} showSkuText={barcodeShowSkuText} />
                      )}
                    </div>
                  )}

                  {barcodeShowLogo && shopProfile.logo && (
                    <img src={shopProfile.logo} alt="Logo" class="logo-preview w-10 h-10 object-contain rounded-full bg-white mb-1 p-0.5 shadow-sm inline-block border border-[#eee]" />
                  )}
                  {barcodeShowBrand && (
                    <div style={{ fontSize: `${barcodeBrandSize}px` }} class="brand-text uppercase tracking-wider text-[#737688] font-bold mb-1 w-full">
                      {barcodeBrandText}
                    </div>
                  )}

                  {/* Below brand code position */}
                  {barcodeCodePosition === 'below-brand' && (
                    <div class="barcode-lines-render my-1 w-full flex flex-col items-center">
                      {barcodeCodeType === 'qrcode' ? (
                        <div className="flex flex-col items-center p-md bg-white border border-[#c3c5d9]/40 rounded-lg qr-code-svg-container">
                          <QRCodeSVG value={barcodeSku} size={barcodeQrSize} bgColor="#ffffff" fgColor="#000000" level="M" />
                        </div>
                      ) : (
                        <BarcodeRenderer value={barcodeSku} height={barcodeHeight} scale={barcodeScale} showSkuText={barcodeShowSkuText} />
                      )}
                    </div>
                  )}

                  {barcodeShowName && (
                    <div style={{ fontSize: `${barcodeNameSize}px` }} class="name-text font-bold text-[#131b2e] line-clamp-2 mb-1 w-full">
                      {barcodeProductName}
                    </div>
                  )}

                  {/* Below name code position */}
                  {barcodeCodePosition === 'below-name' && (
                    <div class="barcode-lines-render my-1 w-full flex flex-col items-center">
                      {barcodeCodeType === 'qrcode' ? (
                        <div className="flex flex-col items-center p-md bg-white border border-[#c3c5d9]/40 rounded-lg qr-code-svg-container">
                          <QRCodeSVG value={barcodeSku} size={barcodeQrSize} bgColor="#ffffff" fgColor="#000000" level="M" />
                        </div>
                      ) : (
                        <BarcodeRenderer value={barcodeSku} height={barcodeHeight} scale={barcodeScale} showSkuText={barcodeShowSkuText} />
                      )}
                    </div>
                  )}

                  {barcodeShowMrp && (
                    <div style={{ fontSize: `${barcodePriceSize}px` }} class="mrp-text text-[#737688] font-bold line-through mb-1 w-full">
                      MRP: ₹{parseFloat(barcodeMrpText || 0).toFixed(2)}
                    </div>
                  )}

                  {barcodeShowPrice && (
                    <div style={{ fontSize: `${barcodePriceSize}px` }} class="price-text text-[#434656] font-bold font-mono mb-2 w-full">
                      Price: ₹{(barcodeProductPrice * (1 + barcodeProductTaxRate / 100)).toFixed(2)} <span class="text-[9px] font-normal text-[#737688]">(incl. GST)</span>
                    </div>
                  )}

                  {/* Below price code position */}
                  {barcodeCodePosition === 'below-price' && (
                    <div class="barcode-lines-render my-1 w-full flex flex-col items-center">
                      {barcodeCodeType === 'qrcode' ? (
                        <div className="flex flex-col items-center p-md bg-white border border-[#c3c5d9]/40 rounded-lg qr-code-svg-container">
                          <QRCodeSVG value={barcodeSku} size={barcodeQrSize} bgColor="#ffffff" fgColor="#000000" level="M" />
                        </div>
                      ) : (
                        <BarcodeRenderer value={barcodeSku} height={barcodeHeight} scale={barcodeScale} showSkuText={barcodeShowSkuText} />
                      )}
                    </div>
                  )}

                  {barcodeShowCustomText && barcodeCustomText && (
                    <div style={{ fontSize: `${barcodeCustomTextSize}px` }} class="custom-text-rendered text-[#434656] font-semibold mb-2 line-clamp-2 italic max-w-full px-xs w-full">
                      {barcodeCustomText}
                    </div>
                  )}

                  {/* Bottom code position */}
                  {barcodeCodePosition === 'bottom' && (
                    <div class="barcode-lines-render my-1 w-full flex flex-col items-center">
                      {barcodeCodeType === 'qrcode' ? (
                        <div className="flex flex-col items-center p-md bg-white border border-[#c3c5d9]/40 rounded-lg qr-code-svg-container">
                          <QRCodeSVG value={barcodeSku} size={barcodeQrSize} bgColor="#ffffff" fgColor="#000000" level="M" />
                        </div>
                      ) : (
                        <BarcodeRenderer value={barcodeSku} height={barcodeHeight} scale={barcodeScale} showSkuText={barcodeShowSkuText} />
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div class="flex gap-md w-full pt-md border-t border-[#c3c5d9]/20">
                <button
                  onClick={handlePrintBarcodeLabel}
                  class="flex-1 h-11 bg-[#0041c8] hover:bg-[#0041c8]/90 text-white font-semibold rounded-lg flex items-center justify-center gap-xs shadow-md active:scale-95 transition-all"
                >
                  <span class="material-symbols-outlined text-[20px]">print</span>
                  Print Sticker
                </button>
                <button
                  onClick={() => setShowBarcodeModal(false)}
                  class="h-11 px-6 border border-[#c3c5d9] hover:bg-[#dae2fd]/40 text-[#434656] font-semibold rounded-lg active:scale-95 transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Right side: Editor & Styles controls */}
            <div class="w-full md:w-[360px] space-y-md flex flex-col justify-between">
              <div>
                <h4 class="font-bold text-headline-sm text-[#131b2e] pb-sm border-b border-[#c3c5d9]/30">Sticker Customizer</h4>
                
                <div class="space-y-sm mt-md overflow-y-auto max-h-[460px] pr-2 custom-scrollbar">
                  {/* Code Type Choice */}
                  <div class="space-y-xs">
                    <label class="text-xs font-bold text-[#434656]">Code Symbol Type</label>
                    <div class="grid grid-cols-2 gap-xs">
                      <button
                        type="button"
                        onClick={() => setBarcodeCodeType('barcode')}
                        class={`h-8 rounded-lg text-xs font-semibold border transition-all ${
                          barcodeCodeType === 'barcode'
                            ? 'bg-[#eaedff] border-[#0041c8] text-[#0041c8]'
                            : 'border-[#c3c5d9]/40 hover:bg-[#eaedff]/30 text-[#434656]'
                        }`}
                      >
                        Barcode
                      </button>
                      <button
                        type="button"
                        onClick={() => setBarcodeCodeType('qrcode')}
                        class={`h-8 rounded-lg text-xs font-semibold border transition-all ${
                          barcodeCodeType === 'qrcode'
                            ? 'bg-[#eaedff] border-[#0041c8] text-[#0041c8]'
                            : 'border-[#c3c5d9]/40 hover:bg-[#eaedff]/30 text-[#434656]'
                        }`}
                      >
                        QR Code
                      </button>
                    </div>
                  </div>

                  {/* Code Position */}
                  <div class="space-y-xs">
                    <label class="text-xs font-bold text-[#434656]">Code Vertical Position</label>
                    <select
                      value={barcodeCodePosition}
                      onChange={(e) => setBarcodeCodePosition(e.target.value)}
                      class="w-full h-9 px-2 text-xs border border-[#c3c5d9] bg-white rounded-lg outline-none cursor-pointer focus:border-[#0041c8]"
                    >
                      <option value="bottom">Bottom of Sticker</option>
                      <option value="below-price">Below Price</option>
                      <option value="below-name">Below Product Name</option>
                      <option value="below-brand">Below Brand Text</option>
                      <option value="top">Top of Sticker</option>
                    </select>
                  </div>

                  {/* Font & Alignment */}
                  <div class="grid grid-cols-2 gap-sm">
                    <div class="space-y-xs">
                      <label class="text-xs font-bold text-[#434656]">Font Family</label>
                      <select
                        value={barcodeFontFamily}
                        onChange={(e) => setBarcodeFontFamily(e.target.value)}
                        class="w-full h-9 px-2 text-xs border border-[#c3c5d9] bg-white rounded-lg outline-none cursor-pointer focus:border-[#0041c8]"
                      >
                        <option value="Inter">Inter (Sans)</option>
                        <option value="Geist">Geist (Modern)</option>
                        <option value="Courier New">Courier (Mono)</option>
                        <option value="Georgia">Georgia (Serif)</option>
                      </select>
                    </div>

                    <div class="space-y-xs">
                      <label class="text-xs font-bold text-[#434656]">Text Alignment</label>
                      <select
                        value={barcodeAlignment}
                        onChange={(e) => setBarcodeAlignment(e.target.value)}
                        class="w-full h-9 px-2 text-xs border border-[#c3c5d9] bg-white rounded-lg outline-none cursor-pointer focus:border-[#0041c8]"
                      >
                        <option value="center">Centered</option>
                        <option value="left">Left Aligned</option>
                        <option value="right">Right Aligned</option>
                      </select>
                    </div>
                  </div>

                  {/* Brand label section */}
                  <div class="space-y-xs">
                    <div class="flex items-center justify-between">
                      <label class="text-xs font-bold text-[#434656]">Brand Text</label>
                      <label class="flex items-center gap-xs text-[10px] font-semibold text-[#434656] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={barcodeShowBrand}
                          onChange={(e) => setBarcodeShowBrand(e.target.checked)}
                          class="rounded text-[#0041c8] focus:ring-[#0041c8]"
                        />
                        Show
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={!barcodeShowBrand}
                      value={barcodeBrandText}
                      onChange={(e) => setBarcodeBrandText(e.target.value)}
                      placeholder="e.g. Luminous Ledger"
                      class="w-full h-9 px-2 text-xs border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] disabled:opacity-50"
                    />
                  </div>

                   {/* MRP Section */}
                  <div class="space-y-xs">
                    <div class="flex items-center justify-between">
                      <label class="text-xs font-bold text-[#434656]">
                        MRP: <span class="font-mono text-[#0041c8]">₹{parseFloat(barcodeMrpText || 0).toFixed(2)}</span>
                      </label>
                      <label class="flex items-center gap-xs text-[10px] font-semibold text-[#434656] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={barcodeShowMrp}
                          onChange={(e) => setBarcodeShowMrp(e.target.checked)}
                          class="rounded text-[#0041c8] focus:ring-[#0041c8]"
                        />
                        Show
                      </label>
                    </div>
                  </div>

                  {/* Custom Label Note */}
                  <div class="space-y-xs">
                    <div class="flex items-center justify-between">
                      <label class="text-xs font-bold text-[#434656]">Custom Label Note</label>
                      <label class="flex items-center gap-xs text-[10px] font-semibold text-[#434656] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={barcodeShowCustomText}
                          onChange={(e) => setBarcodeShowCustomText(e.target.checked)}
                          class="rounded text-[#0041c8] focus:ring-[#0041c8]"
                        />
                        Show
                      </label>
                    </div>
                    <input
                      type="text"
                      disabled={!barcodeShowCustomText}
                      value={barcodeCustomText}
                      onChange={(e) => setBarcodeCustomText(e.target.value)}
                      placeholder="e.g. Special Sale / Warranty"
                      class="w-full h-9 px-2 text-xs border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8] disabled:opacity-50"
                    />
                  </div>

                  {/* Toggle switches for fields */}
                  <div class="space-y-xs">
                    <label class="text-xs font-bold text-[#434656] block">Content Fields</label>
                    <div class="grid grid-cols-2 gap-xs">
                      <label class="flex items-center gap-sm p-2 bg-[#f2f3ff]/50 rounded-lg border border-[#c3c5d9]/20 text-xs font-semibold text-[#131b2e] cursor-pointer hover:bg-[#eaedff]/30">
                        <input
                          type="checkbox"
                          checked={barcodeShowLogo}
                          onChange={(e) => setBarcodeShowLogo(e.target.checked)}
                          class="rounded text-[#0041c8] focus:ring-[#0041c8]"
                        />
                        Show Logo
                      </label>
                      <label class="flex items-center gap-sm p-2 bg-[#f2f3ff]/50 rounded-lg border border-[#c3c5d9]/20 text-xs font-semibold text-[#131b2e] cursor-pointer hover:bg-[#eaedff]/30">
                        <input
                          type="checkbox"
                          checked={barcodeShowName}
                          onChange={(e) => setBarcodeShowName(e.target.checked)}
                          class="rounded text-[#0041c8] focus:ring-[#0041c8]"
                        />
                        Name
                      </label>
                      <label class="flex items-center gap-sm p-2 bg-[#f2f3ff]/50 rounded-lg border border-[#c3c5d9]/20 text-xs font-semibold text-[#131b2e] cursor-pointer hover:bg-[#eaedff]/30">
                        <input
                          type="checkbox"
                          checked={barcodeShowPrice}
                          onChange={(e) => setBarcodeShowPrice(e.target.checked)}
                          class="rounded text-[#0041c8] focus:ring-[#0041c8]"
                        />
                        Price
                      </label>
                      <label class="flex items-center gap-sm p-2 bg-[#f2f3ff]/50 rounded-lg border border-[#c3c5d9]/20 text-xs font-semibold text-[#131b2e] cursor-pointer hover:bg-[#eaedff]/30 col-span-2">
                        <input
                          type="checkbox"
                          checked={barcodeShowSkuText}
                          onChange={(e) => setBarcodeShowSkuText(e.target.checked)}
                          class="rounded text-[#0041c8] focus:ring-[#0041c8]"
                        />
                        SKU Number Text
                      </label>
                    </div>
                  </div>

                  {/* Sticker Dimensions */}
                  <div class="space-y-xs">
                    <label class="text-xs font-bold text-[#434656] block">Sticker Dimensions (px)</label>
                    <div class="grid grid-cols-3 gap-xs">
                      <div class="space-y-xs">
                        <label class="text-[10px] font-semibold text-[#434656]">Width</label>
                        <input
                          type="number" min="180" max="400" value={barcodeWidth}
                          onChange={(e) => setBarcodeWidth(parseInt(e.target.value, 10) || 280)}
                          class="w-full h-8 px-2 text-xs border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8]"
                        />
                      </div>
                      <div class="space-y-xs">
                        <label class="text-[10px] font-semibold text-[#434656]">Min H</label>
                        <input
                          type="number" min="100" max="400" value={barcodeMinHeight}
                          onChange={(e) => setBarcodeMinHeight(parseInt(e.target.value, 10) || 180)}
                          class="w-full h-8 px-2 text-xs border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8]"
                        />
                      </div>
                      <div class="space-y-xs">
                        <label class="text-[10px] font-semibold text-[#434656]">Padding</label>
                        <input
                          type="number" min="4" max="50" value={barcodePadding}
                          onChange={(e) => setBarcodePadding(parseInt(e.target.value, 10) || 24)}
                          class="w-full h-8 px-2 text-xs border border-[#c3c5d9] rounded-lg outline-none focus:border-[#0041c8]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Code Dimensions */}
                  {barcodeCodeType === 'qrcode' ? (
                    <div class="space-y-xs">
                      <div class="flex justify-between items-center text-xs font-bold text-[#434656]">
                        <span>QR Code Size</span>
                        <span class="font-mono text-[#0041c8]">{barcodeQrSize}px</span>
                      </div>
                      <input
                        type="range" min="50" max="150" value={barcodeQrSize}
                        onChange={(e) => setBarcodeQrSize(parseInt(e.target.value, 10))}
                        class="w-full accent-[#0041c8]"
                      />
                    </div>
                  ) : (
                    <>
                      <div class="space-y-xs">
                        <div class="flex justify-between items-center text-xs font-bold text-[#434656]">
                          <span>Barcode Height</span>
                          <span class="font-mono text-[#0041c8]">{barcodeHeight}px</span>
                        </div>
                        <input
                          type="range" min="30" max="90" value={barcodeHeight}
                          onChange={(e) => setBarcodeHeight(parseInt(e.target.value, 10))}
                          class="w-full accent-[#0041c8]"
                        />
                      </div>

                      <div class="space-y-xs">
                        <div class="flex justify-between items-center text-xs font-bold text-[#434656]">
                          <span>Bar Thickness / Density</span>
                          <span class="font-mono text-[#0041c8]">{barcodeScale.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range" min="1.0" max="2.5" step="0.1" value={barcodeScale}
                          onChange={(e) => setBarcodeScale(parseFloat(e.target.value))}
                          class="w-full accent-[#0041c8]"
                        />
                      </div>
                    </>
                  )}

                  {/* Font Sizes controls */}
                  <div class="space-y-xs border-t border-[#c3c5d9]/20 pt-sm">
                    <label class="text-xs font-bold text-[#131b2e] block font-semibold">Element Font Sizes (px)</label>
                    <div class="grid grid-cols-2 gap-sm">
                      <div class="space-y-xs">
                        <div class="flex justify-between text-[10px] font-semibold text-[#434656]">
                          <span>Brand Text</span>
                          <span>{barcodeBrandSize}px</span>
                        </div>
                        <input
                          type="range" min="8" max="18" value={barcodeBrandSize}
                          onChange={(e) => setBarcodeBrandSize(parseInt(e.target.value, 10))}
                          class="w-full accent-[#0041c8]"
                        />
                      </div>
                      <div class="space-y-xs">
                        <div class="flex justify-between text-[10px] font-semibold text-[#434656]">
                          <span>Prod Name</span>
                          <span>{barcodeNameSize}px</span>
                        </div>
                        <input
                          type="range" min="10" max="22" value={barcodeNameSize}
                          onChange={(e) => setBarcodeNameSize(parseInt(e.target.value, 10))}
                          class="w-full accent-[#0041c8]"
                        />
                      </div>
                      <div class="space-y-xs">
                        <div class="flex justify-between text-[10px] font-semibold text-[#434656]">
                          <span>Price & MRP</span>
                          <span>{barcodePriceSize}px</span>
                        </div>
                        <input
                          type="range" min="10" max="20" value={barcodePriceSize}
                          onChange={(e) => setBarcodePriceSize(parseInt(e.target.value, 10))}
                          class="w-full accent-[#0041c8]"
                        />
                      </div>
                      <div class="space-y-xs">
                        <div class="flex justify-between text-[10px] font-semibold text-[#434656]">
                          <span>Custom Note</span>
                          <span>{barcodeCustomTextSize}px</span>
                        </div>
                        <input
                          type="range" min="8" max="16" value={barcodeCustomTextSize}
                          onChange={(e) => setBarcodeCustomTextSize(parseInt(e.target.value, 10))}
                          class="w-full accent-[#0041c8]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sticker border options */}
                  <div class="grid grid-cols-2 gap-sm">
                    <div class="space-y-xs">
                      <label class="text-xs font-bold text-[#434656]">Border Style</label>
                      <select
                        value={barcodeBorderStyle}
                        onChange={(e) => setBarcodeBorderStyle(e.target.value)}
                        class="w-full h-9 px-2 text-xs border border-[#c3c5d9] bg-white rounded-lg outline-none cursor-pointer focus:border-[#0041c8]"
                      >
                        <option value="dashed">Dashed</option>
                        <option value="solid">Solid</option>
                        <option value="double">Double</option>
                        <option value="none">None</option>
                      </select>
                    </div>

                    <div class="space-y-xs">
                      <label class="text-xs font-bold text-[#434656]">Background</label>
                      <select
                        value={barcodeBgColor}
                        onChange={(e) => setBarcodeBgColor(e.target.value)}
                        class="w-full h-9 px-2 text-xs border border-[#c3c5d9] bg-white rounded-lg outline-none cursor-pointer focus:border-[#0041c8]"
                      >
                        <option value="#ffffff">Pure White</option>
                        <option value="#faf8ff">Pastel Cream</option>
                        <option value="#f1f3f9">Light Silver</option>
                        <option value="#fffef2">Soft Gold</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom border color input */}
                  <div class="space-y-xs">
                    <label class="text-xs font-bold text-[#434656]">Border Color</label>
                    <div class="flex gap-sm">
                      <input
                        type="color"
                        value={barcodeBorderColor}
                        onChange={(e) => setBarcodeBorderColor(e.target.value)}
                        class="w-10 h-9 p-0 bg-transparent border-0 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={barcodeBorderColor}
                        onChange={(e) => setBarcodeBorderColor(e.target.value)}
                        placeholder="#c3c5d9"
                        class="flex-1 h-9 px-2 text-xs border border-[#c3c5d9] rounded-lg outline-none uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div class="text-[10px] text-[#737688] mt-sm leading-relaxed border-t border-[#c3c5d9]/20 pt-sm">
                Adjust the settings above to dynamically fit your sticky printer labels (e.g. 50mm x 25mm). Values are applied instantly to the print template.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;

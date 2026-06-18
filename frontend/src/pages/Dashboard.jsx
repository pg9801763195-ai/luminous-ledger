import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const isManagerOrAdmin = user?.role === 'Admin' || user?.role === 'Manager';

  useEffect(() => {
    if (user && !hasPermission('dashboard')) {
      const allowedPaths = {
        billing: '/billing',
        returns: '/returns',
        products: '/products',
        inventory: '/inventory',
        coupons: '/coupons',
        broadcast: '/broadcast',
        customers: '/customers',
        suppliers: '/suppliers',
        reports: '/reports',
        settings: '/settings'
      };
      const firstAllowed = Object.keys(allowedPaths).find(perm => hasPermission(perm));
      if (firstAllowed) {
        navigate(allowedPaths[firstAllowed]);
      }
    }
  }, [user, hasPermission, navigate]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    kpis: {
      todaySales: 0,
      todayCashSales: 0,
      todayCardSales: 0,
      todayUPISales: 0,
      yesterdaySales: 0,
      monthlyRevenue: 0,
      monthlyCashSales: 0,
      monthlyCardSales: 0,
      monthlyUPISales: 0,
      lowStockItems: 0,
      inventoryHealth: 100,
    },
    weeklyChart: [],
    recentTransactions: [],
  });

  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const searchInvoices = async (e) => {
    if (e) e.preventDefault();
    if (!invoiceSearch.trim() && !invoiceDate) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchLoading(true);
      let queryStr = '';
      if (invoiceSearch.trim()) {
        queryStr += `search=${invoiceSearch.trim()}&`;
      }
      if (invoiceDate) {
        queryStr += `startDate=${invoiceDate}&endDate=${invoiceDate}&limit=100&`;
      } else {
        queryStr += `limit=10&`;
      }
      const res = await api.get(`/invoices?${queryStr}`);
      if (res.data.success) {
        setSearchResults(res.data.invoices);
      }
    } catch (error) {
      console.error('Error searching invoices', error);
      alert('Failed to query invoices');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleRefundInvoice = async (invoiceId, invoiceNumber) => {
    const reason = prompt(`Are you sure you want to refund Invoice ${invoiceNumber}? Please enter refund reason:`);
    if (!reason) return;
    try {
      const res = await api.post(`/invoices/${invoiceId}/refund`, { reason });
      if (res.data.success) {
        alert(`Invoice ${invoiceNumber} has been successfully refunded!`);
        // Refresh search results
        searchInvoices();
        // Refresh dashboard KPIs & charts
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Refund failed', error);
      alert(error.response?.data?.message || 'Refund request failed');
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
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Failed to download invoice PDF', err);
        alert('Failed to generate PDF');
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
        alert('Failed to print PDF');
      });
  };

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/reports/dashboard');
      if (res.data.success) {
        setStats(res.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard statistics', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Ignore if user is already typing in an input/textarea
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
         document.activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }

      // Ignore modifier keys like Ctrl, Alt, Meta
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Check if it's a single character that could be the start of invoice number (alphanumeric, dash)
      if (e.key && e.key.length === 1 && /^[a-zA-Z0-9-]$/.test(e.key)) {
        const inputEl = document.getElementById('dashboard-bill-lookup-input');
        if (inputEl) {
          inputEl.focus();
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

  if (loading) {
    return (
      <div class="flex-1 flex items-center justify-center">
        <span class="material-symbols-outlined text-[48px] text-[#0041c8] animate-spin">progress_activity</span>
      </div>
    );
  }

  // Chart configuration
  const chartLabels = stats.weeklyChart.map((d) => d.day);
  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Gross Revenue',
        data: stats.weeklyChart.map((d) => d.revenue),
        backgroundColor: '#0055ff',
        borderRadius: 4,
      },
      {
        label: 'Net Profit',
        data: stats.weeklyChart.map((d) => d.profit),
        backgroundColor: '#6063ee',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: 'Inter',
            size: 11,
          },
          color: '#434656',
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(context.parsed.y);
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#737688',
        },
      },
      y: {
        grid: {
          color: 'rgba(195, 197, 217, 0.2)',
        },
        ticks: {
          color: '#737688',
          callback: function (value) {
            return '₹' + value;
          },
        },
      },
    },
  };

  // Calculate trends comparison
  const salesDiff = stats.kpis.todaySales - stats.kpis.yesterdaySales;
  const salesTrendPercentage = stats.kpis.yesterdaySales > 0 
    ? Math.round((salesDiff / stats.kpis.yesterdaySales) * 100) 
    : 0;

  return (
    <div class="space-y-gutter flex-grow flex flex-col">
      {/* Header Section */}
      <div class="flex items-end justify-between select-none">
        <div>
          <h2 class="font-headline-lg text-headline-lg text-[#131b2e]">Dashboard Overview</h2>
          <p class="font-body-md text-[#434656] mt-1">Welcome back, {user?.name}. Here's what's happening today.</p>
        </div>
        <div class="flex gap-md">
          <Link
            to="/billing"
            class="px-lg py-md bg-[#0041c8] text-white rounded-lg font-label-sm flex items-center gap-sm shadow-lg shadow-[#0041c8]/20 hover:opacity-90 transition-all active:scale-95"
          >
            <span class="material-symbols-outlined text-[18px]">add</span>
            New Invoice
          </Link>
        </div>
      </div>

      {/* KPI Cards Bento Grid */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter select-none">
        {/* Sales KPI */}
        <div class="glass-panel p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-start mb-md">
              <div class="p-sm bg-[#0041c8]/10 rounded-lg text-[#0041c8]">
                <span class="material-symbols-outlined">shopping_cart</span>
              </div>
              {salesTrendPercentage >= 0 ? (
                <span class="text-[#005c3e] font-label-sm bg-[#6ffbbe]/30 px-sm py-1 rounded-full flex items-center gap-xs">
                  <span class="material-symbols-outlined text-[14px]">trending_up</span>
                  {salesTrendPercentage}%
                </span>
              ) : (
                <span class="text-[#ba1a1a] font-label-sm bg-[#ffdad6] px-sm py-1 rounded-full flex items-center gap-xs">
                  <span class="material-symbols-outlined text-[14px]">trending_down</span>
                  {Math.abs(salesTrendPercentage)}%
                </span>
              )}
            </div>
            <p class="font-label-sm text-[#434656] uppercase tracking-wider">Today's Sales</p>
            <h3 class="font-display-lg text-display-lg text-[#131b2e] mt-base">
              ₹{stats.kpis.todaySales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <p class="text-label-sm text-[#434656] mt-sm">
              Compared to ₹{stats.kpis.yesterdaySales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} yesterday
            </p>
          </div>
          <div>
            <div class="h-[1px] bg-[#c3c5d9]/30 my-md"></div>
            <div class="grid grid-cols-3 gap-xs text-center select-none">
              <div class="bg-[#f2f3ff]/50 rounded-lg p-xs flex flex-col justify-center border border-[#c3c5d9]/10">
                <span class="text-[10px] uppercase tracking-wider text-[#434656] font-semibold">UPI</span>
                <span class="font-mono text-xs font-bold text-[#0041c8] mt-0.5">
                  ₹{(stats.kpis.todayUPISales || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div class="bg-[#f2f3ff]/50 rounded-lg p-xs flex flex-col justify-center border border-[#c3c5d9]/10">
                <span class="text-[10px] uppercase tracking-wider text-[#434656] font-semibold">Cash</span>
                <span class="font-mono text-xs font-bold text-[#005c3e] mt-0.5">
                  ₹{(stats.kpis.todayCashSales || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div class="bg-[#f2f3ff]/50 rounded-lg p-xs flex flex-col justify-center border border-[#c3c5d9]/10">
                <span class="text-[10px] uppercase tracking-wider text-[#434656] font-semibold">Card</span>
                <span class="font-mono text-xs font-bold text-[#4648d4] mt-0.5">
                  ₹{(stats.kpis.todayCardSales || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue KPI */}
        <div class="glass-panel p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          {isManagerOrAdmin ? (
            <>
              <div>
                <div class="flex justify-between items-start mb-md">
                  <div class="p-sm bg-[#4648d4]/10 rounded-lg text-[#4648d4]">
                    <span class="material-symbols-outlined">payments</span>
                  </div>
                  <span class="text-[#005c3e] font-label-sm bg-[#6ffbbe]/30 px-sm py-1 rounded-full flex items-center gap-xs">
                    <span class="material-symbols-outlined text-[14px]">trending_up</span>
                    Active Month
                  </span>
                </div>
                <p class="font-label-sm text-[#434656] uppercase tracking-wider">Monthly Revenue</p>
                <h3 class="font-display-lg text-display-lg text-[#131b2e] mt-base">
                  ₹{stats.kpis.monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <p class="text-label-sm text-[#434656] mt-sm">Accumulated billing records</p>
              </div>
              <div>
                <div class="h-[1px] bg-[#c3c5d9]/30 my-md"></div>
                <div class="grid grid-cols-3 gap-xs text-center select-none">
                  <div class="bg-[#f2f3ff]/50 rounded-lg p-xs flex flex-col justify-center border border-[#c3c5d9]/10">
                    <span class="text-[10px] uppercase tracking-wider text-[#434656] font-semibold">UPI</span>
                    <span class="font-mono text-xs font-bold text-[#0041c8] mt-0.5">
                      ₹{(stats.kpis.monthlyUPISales || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div class="bg-[#f2f3ff]/50 rounded-lg p-xs flex flex-col justify-center border border-[#c3c5d9]/10">
                    <span class="text-[10px] uppercase tracking-wider text-[#434656] font-semibold">Cash</span>
                    <span class="font-mono text-xs font-bold text-[#005c3e] mt-0.5">
                      ₹{(stats.kpis.monthlyCashSales || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div class="bg-[#f2f3ff]/50 rounded-lg p-xs flex flex-col justify-center border border-[#c3c5d9]/10">
                    <span class="text-[10px] uppercase tracking-wider text-[#434656] font-semibold">Card</span>
                    <span class="font-mono text-xs font-bold text-[#4648d4] mt-0.5">
                      ₹{(stats.kpis.monthlyCardSales || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div class="flex-1 flex flex-col items-center justify-center text-center p-md select-none h-full min-h-[180px]">
              <span class="material-symbols-outlined text-[32px] text-[#737688] mb-xs">lock</span>
              <h5 class="font-bold text-[#131b2e] text-sm">Monthly Sales Locked</h5>
              <p class="text-xs text-[#737688] max-w-[200px] mt-xs">Access restricted to Managers and Admins.</p>
            </div>
          )}
        </div>

        {/* Low Stock KPI */}
        <div class={`glass-panel p-lg rounded-xl shadow-sm hover:shadow-md transition-shadow border ${
          stats.kpis.lowStockItems > 0 ? 'border-[#ba1a1a]/20' : 'border-transparent'
        }`}>
          <div class="flex justify-between items-start mb-md">
            <div class={`p-sm rounded-lg ${
              stats.kpis.lowStockItems > 0 ? 'bg-[#ba1a1a]/10 text-[#ba1a1a]' : 'bg-[#005c3e]/10 text-[#005c3e]'
            }`}>
              <span class="material-symbols-outlined">inventory</span>
            </div>
            {stats.kpis.lowStockItems > 0 ? (
              <span class="text-[#ba1a1a] font-label-sm bg-[#ffdad6] px-sm py-1 rounded-full">
                Action Needed
              </span>
            ) : (
              <span class="text-[#005c3e] font-label-sm bg-[#6ffbbe]/30 px-sm py-1 rounded-full">
                All Good
              </span>
            )}
          </div>
          <p class="font-label-sm text-[#434656] uppercase tracking-wider">Low Stock Items</p>
          <h3 class="font-display-lg text-display-lg text-[#131b2e] mt-base">{stats.kpis.lowStockItems}</h3>
          <p class="text-label-sm text-[#434656] mt-sm">Items requiring immediate reorder</p>
        </div>
      </div>

      {/* Revenue Chart and Action Section */}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Large Bar Chart */}
        <div class="lg:col-span-2 glass-panel p-lg rounded-xl flex flex-col min-h-[360px]">
          {isManagerOrAdmin ? (
            <>
              <div class="flex items-center justify-between mb-lg select-none">
                <h4 class="font-headline-md text-headline-md">Weekly Revenue Analysis</h4>
                <div class="flex items-center gap-md">
                  <div class="flex items-center gap-sm">
                    <span class="w-3 h-3 rounded-full bg-[#0055ff]"></span>
                    <span class="text-label-sm text-[#434656]">Gross Revenue</span>
                  </div>
                  <div class="flex items-center gap-sm">
                    <span class="w-3 h-3 rounded-full bg-[#6063ee]"></span>
                    <span class="text-label-sm text-[#434656]">Net Profit</span>
                  </div>
                </div>
              </div>
              <div class="flex-1 min-h-[260px] relative">
                {stats.weeklyChart.length > 0 ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <div class="absolute inset-0 flex items-center justify-center text-[#737688] text-sm">
                    No revenue records recorded in the past week
                  </div>
                )}
              </div>
            </>
          ) : (
            <div class="flex-1 flex flex-col items-center justify-center text-center p-lg select-none">
              <span class="material-symbols-outlined text-[48px] text-[#737688] mb-sm">lock</span>
              <h5 class="font-bold text-[#131b2e] text-lg">Sales Analytics Restricted</h5>
              <p class="text-sm text-[#434656] max-w-sm mt-xs">
                Weekly and monthly sales performance graphs are only accessible to Manager or Admin roles.
              </p>
            </div>
          )}
        </div>

        {/* Inventory Health Widget */}
        <div class="glass-panel p-lg rounded-xl flex flex-col justify-between select-none">
          <div>
            <h4 class="font-headline-md text-headline-md mb-lg">Inventory Health</h4>
            <div class="space-y-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-md">
                  <div class="w-10 h-10 rounded-full bg-[#005c3e]/10 flex items-center justify-center text-[#005c3e]">
                    <span class="material-symbols-outlined text-[20px]">check_circle</span>
                  </div>
                  <div>
                    <p class="font-body-md font-bold text-[#131b2e]">Catalog Status</p>
                    <p class="text-label-sm text-[#434656]">Healthy stock buffers</p>
                  </div>
                </div>
                <span class="font-mono text-[#0041c8] font-bold text-body-lg">{stats.kpis.inventoryHealth}%</span>
              </div>
              <div class="w-full bg-[#eaedff] rounded-full h-2">
                <div class="bg-[#005c3e] h-2 rounded-full transition-all duration-500" style={{ width: `${stats.kpis.inventoryHealth}%` }}></div>
              </div>
              <div class="h-[1px] bg-[#c3c5d9]/30"></div>
              
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-md">
                  <div class="w-10 h-10 rounded-full bg-[#ba1a1a]/10 flex items-center justify-center text-[#ba1a1a]">
                    <span class="material-symbols-outlined text-[20px]">warning</span>
                  </div>
                  <div>
                    <p class="font-body-md font-bold text-[#131b2e]">Critical Items</p>
                    <p class="text-label-sm text-[#434656]">{stats.kpis.lowStockItems} low products flagged</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="pt-lg">
            <Link
              to="/products"
              class="relative overflow-hidden rounded-xl h-24 flex items-center px-lg bg-[#0055ff] hover:opacity-95 transition-opacity text-white"
            >
              <div class="relative z-10">
                <p class="font-body-md font-bold">Product Catalog</p>
                <p class="text-white/80 text-label-sm">Manage products & pricing</p>
              </div>
              <span class="material-symbols-outlined ml-auto text-white">arrow_forward</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Bill Search & Invoice Lookup */}
      <div class="glass-panel p-lg rounded-xl shadow-sm space-y-md">
        <div class="flex items-center justify-between select-none border-b border-[#c3c5d9]/30 pb-sm">
          <h4 class="font-headline-md text-headline-md">Bill Lookup & Reprint</h4>
          <span class="text-xs text-[#737688] font-mono">Search any invoice by number</span>
        </div>

        <form onSubmit={searchInvoices} class="flex flex-col md:flex-row gap-md select-none">
          <div class="relative flex-grow group">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#434656] group-focus-within:text-[#0041c8] transition-colors">receipt</span>
            <input
              id="dashboard-bill-lookup-input"
              type="text"
              placeholder="Search by invoice number..."
              class="w-full pl-10 pr-4 py-2.5 bg-white border border-[#c3c5d9] rounded-lg focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] transition-all font-mono text-sm outline-none uppercase"
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
            />
          </div>
          
          <div class="relative w-full md:w-56 group">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#434656] group-focus-within:text-[#0041c8] transition-colors">calendar_today</span>
            <input
              type="date"
              class="w-full pl-10 pr-4 py-2.5 bg-white border border-[#c3c5d9] rounded-lg focus:ring-2 focus:ring-[#0041c8]/20 focus:border-[#0041c8] transition-all text-sm outline-none text-[#434656]"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div class="flex gap-sm">
            <button
              type="submit"
              disabled={searchLoading}
              class="px-lg h-11 bg-[#0041c8] text-white rounded-lg font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center gap-xs text-sm shadow-md shrink-0"
            >
              {searchLoading ? (
                <span class="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              ) : (
                <span class="material-symbols-outlined text-[20px]">search</span>
              )}
              Search
            </button>
            {(invoiceSearch.trim() || invoiceDate || searchResults.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setInvoiceSearch('');
                  setInvoiceDate('');
                  setSearchResults([]);
                }}
                class="px-md h-11 border border-[#c3c5d9] rounded-lg text-sm text-[#434656] hover:bg-[#dae2fd]/40 transition-colors shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Invoice Results list */}
        {searchResults.length > 0 ? (
          <div class="border border-[#c3c5d9]/30 rounded-lg overflow-hidden select-none">
            <table class="w-full text-left text-sm">
              <thead class="bg-[#f2f3ff]/50 font-bold text-[#434656]">
                <tr>
                  <th class="px-md py-sm">Invoice No</th>
                  <th class="px-md py-sm">Date</th>
                  <th class="px-md py-sm">Customer</th>
                  <th class="px-md py-sm">Total</th>
                  <th class="px-md py-sm">Payment</th>
                  <th class="px-md py-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#c3c5d9]/10 font-body-md text-xs">
                {searchResults.map((inv) => (
                  <tr key={inv._id} class="hover:bg-[#0041c8]/5 transition-colors">
                    <td class="px-md py-sm font-mono font-bold text-[#0041c8]">{inv.invoiceNumber}</td>
                    <td class="px-md py-sm font-mono text-[#737688]">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td class="px-md py-sm font-semibold">{inv.customer ? inv.customer.name : 'Walk-in Guest'}</td>
                    <td class="px-md py-sm font-bold text-[#131b2e]">₹{inv.grandTotal.toFixed(2)}</td>
                    <td class="px-md py-sm text-[#434656]">{inv.paymentMethod}</td>
                    <td class="px-md py-sm text-right space-x-xs">
                      {inv.paymentStatus === 'Refunded' ? (
                        <span class="px-sm py-1 rounded-full text-[10px] font-bold bg-[#ffdad6] text-[#ba1a1a] inline-flex items-center gap-xs select-none">
                          <span class="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]"></span>
                          Refunded
                        </span>
                      ) : (
                        <button
                          onClick={() => navigate(`/returns?search=${inv.invoiceNumber}`)}
                          class="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6] rounded-lg transition-colors inline-flex items-center animate-pulse"
                          title="Refund / Return Bill"
                        >
                          <span class="material-symbols-outlined text-[18px]">keyboard_return</span>
                        </button>
                      )}
                      <button
                        onClick={() => triggerPDFPrint(inv._id)}
                        class="p-1.5 text-[#0041c8] hover:bg-[#0041c8]/10 rounded-lg transition-colors inline-flex items-center"
                        title="Print Bill (Silent)"
                      >
                        <span class="material-symbols-outlined text-[18px]">print</span>
                      </button>
                      <button
                        onClick={() => triggerPDFDownload(inv._id, inv.invoiceNumber)}
                        class="p-1.5 text-[#434656] hover:bg-[#eaedff] rounded-lg transition-colors inline-flex items-center"
                        title="Download PDF Copy"
                      >
                        <span class="material-symbols-outlined text-[18px]">download</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (invoiceSearch.trim() || invoiceDate) && !searchLoading && (
          <div class="p-md text-center text-[#737688] text-xs select-none">
            {invoiceDate && !invoiceSearch.trim() 
              ? "No bills on this day" 
              : "No bills found matching search query. Scan or enter a valid invoice number."}
          </div>
        )}
      </div>

      {/* Recent Transactions Table */}
      <div class="glass-panel rounded-xl overflow-hidden shadow-sm">
        <div class="px-lg py-md border-b border-white/40 flex items-center justify-between select-none">
          <h4 class="font-headline-md text-headline-md">Recent Transactions</h4>
          <span class="text-xs text-[#737688] font-mono">Real-time ledger updates</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-[#f2f3ff]/50 sticky top-0 backdrop-blur-md select-none">
              <tr>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Transaction ID</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Invoice No</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Type</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Date</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Amount</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Payment Method</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold">Cashier</th>
                <th class="px-lg py-md text-label-sm text-[#434656] uppercase font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#c3c5d9]/20 font-body-md">
              {stats.recentTransactions.length === 0 ? (
                <tr>
                  <td colspan="8" class="px-lg py-xl text-center text-[#737688]">No transactions recorded yet</td>
                </tr>
              ) : (
                stats.recentTransactions.map((trx) => (
                  <tr key={trx._id} class="hover:bg-[#0041c8]/5 transition-colors group">
                    <td class="px-lg py-md font-mono text-[#131b2e] font-medium">{trx.transactionNumber}</td>
                    <td class="px-lg py-md font-mono font-bold text-[#0041c8]">
                      {trx.invoice?.invoiceNumber || trx.referenceId || '-'}
                    </td>
                    <td class="px-lg py-md">
                      <span class={`px-sm py-1 rounded-full text-xs font-bold inline-flex items-center gap-xs ${
                        trx.type === 'Sale' 
                          ? 'bg-[#83ffc6]/20 text-[#005c3e]' 
                          : trx.type === 'Refund'
                          ? 'bg-[#ffdad6] text-[#ba1a1a]'
                          : 'bg-[#e3e6ff] text-[#4648d4]'
                      }`}>
                        <span class={`w-1.5 h-1.5 rounded-full ${
                          trx.type === 'Sale' ? 'bg-[#005c3e]' : trx.type === 'Refund' ? 'bg-[#ba1a1a]' : 'bg-[#4648d4]'
                        }`}></span>
                        {trx.type}
                      </span>
                    </td>
                    <td class="px-lg py-md font-mono text-[#434656]">
                      {new Date(trx.createdAt).toLocaleDateString()} {new Date(trx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td class="px-lg py-md font-mono font-bold text-[#131b2e]">₹{trx.amount.toFixed(2)}</td>
                    <td class="px-lg py-md text-[#434656]">{trx.paymentMethod}</td>
                    <td class="px-lg py-md text-[#434656]">{trx.cashier ? trx.cashier.name : 'System'}</td>
                    <td class="px-lg py-md text-right space-x-xs">
                      {trx.invoice?._id ? (
                        <>
                          <button
                            onClick={() => triggerPDFPrint(trx.invoice._id)}
                            class="p-1.5 text-[#0041c8] hover:bg-[#0041c8]/10 rounded-lg transition-colors inline-flex items-center"
                            title="Print Invoice"
                          >
                            <span class="material-symbols-outlined text-[16px]">print</span>
                          </button>
                          <button
                            onClick={() => triggerPDFDownload(trx.invoice._id, trx.invoice.invoiceNumber)}
                            class="p-1.5 text-[#434656] hover:bg-[#eaedff] rounded-lg transition-colors inline-flex items-center"
                            title="Download PDF"
                          >
                            <span class="material-symbols-outlined text-[16px]">download</span>
                          </button>
                        </>
                      ) : (
                        <span class="text-[#737688]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

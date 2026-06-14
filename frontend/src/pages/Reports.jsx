import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const Reports = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [reportData, setReportData] = useState({
    summary: {
      totalSales: 0,
      totalCashSales: 0,
      totalCardSales: 0,
      totalUPISales: 0,
      totalTaxCollected: 0,
      totalCOGS: 0,
      totalDiscount: 0,
      netProfit: 0,
    },
    topProducts: [],
    categoryInventory: [],
    restockRecommendations: [],
  });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/reports/analytics?startDate=${startDate}&endDate=${endDate}`);
      if (res.data.success) {
        setReportData(res.data);
      }
    } catch (error) {
      console.error('Error fetching analytics reports', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchReports();
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    // Direct trigger since state updates are asynchronous
    setLoading(true);
    api.get('/reports/analytics')
      .then((res) => {
        if (res.data.success) {
          setReportData(res.data);
        }
      })
      .finally(() => setLoading(false));
  };

  return (
    <div class="space-y-gutter flex-grow flex flex-col select-none">
      {/* Title & Filter bar */}
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h2 class="font-headline-lg text-headline-lg text-[#131b2e]">Profit & Loss Reports</h2>
          <p class="font-body-md text-[#434656] mt-1">Generate comprehensive business reports and replenishment intelligence.</p>
        </div>

        <form onSubmit={handleFilterSubmit} class="glass-panel p-sm rounded-xl flex items-center flex-wrap gap-sm">
          <div class="flex items-center gap-xs">
            <span class="text-xs text-[#434656] font-bold pl-1">From:</span>
            <input
              type="date"
              class="border border-[#c3c5d9] bg-white rounded p-1 text-xs outline-none"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div class="flex items-center gap-xs">
            <span class="text-xs text-[#434656] font-bold pl-1">To:</span>
            <input
              type="date"
              class="border border-[#c3c5d9] bg-white rounded p-1 text-xs outline-none"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button
            type="submit"
            class="h-8 px-md bg-[#0041c8] text-white rounded text-xs font-semibold hover:opacity-90 active:scale-95"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleResetFilter}
            class="h-8 px-md border border-[#c3c5d9] hover:bg-[#dae2fd]/40 rounded text-xs text-[#434656]"
          >
            Reset
          </button>
        </form>
      </div>

      {loading ? (
        <div class="flex-grow flex items-center justify-center">
          <span class="material-symbols-outlined text-[48px] text-[#0041c8] animate-spin">progress_activity</span>
        </div>
      ) : (
        <div class="space-y-gutter">
          {/* Summary KPIs Row */}
          <div class="grid grid-cols-2 lg:grid-cols-5 gap-md">
            <div class="glass-panel p-md rounded-xl">
              <span class="text-[10px] uppercase font-bold text-[#737688]">Gross Income</span>
              <p class="font-mono text-body-lg font-bold text-[#131b2e] mt-1">₹{reportData.summary.totalSales.toFixed(2)}</p>
            </div>
            <div class="glass-panel p-md rounded-xl">
              <span class="text-[10px] uppercase font-bold text-[#737688]">Tax Collected (GST)</span>
              <p class="font-mono text-body-lg font-bold text-[#4648d4] mt-1">₹{reportData.summary.totalTaxCollected.toFixed(2)}</p>
            </div>
            <div class="glass-panel p-md rounded-xl">
              <span class="text-[10px] uppercase font-bold text-[#737688]">Cost of Goods (COGS)</span>
              <p class="font-mono text-body-lg font-bold text-[#737688] mt-1">₹{reportData.summary.totalCOGS.toFixed(2)}</p>
            </div>
            <div class="glass-panel p-md rounded-xl">
              <span class="text-[10px] uppercase font-bold text-[#737688]">Discounts Given</span>
              <p class="font-mono text-body-lg font-bold text-[#ba1a1a] mt-1">₹{reportData.summary.totalDiscount.toFixed(2)}</p>
            </div>
            <div class="glass-panel p-md rounded-xl bg-[#6ffbbe]/10 border border-[#4edea3]/30 col-span-2 lg:col-span-1">
              <span class="text-[10px] uppercase font-bold text-[#005c3e]">Net Retail Profit</span>
              <p class="font-mono text-headline-md font-bold text-[#005c3e] mt-1">₹{reportData.summary.netProfit.toFixed(2)}</p>
            </div>
          </div>

          {/* Payment Method Sales Breakdown Row */}
          <div class="glass-panel p-lg rounded-xl shadow-sm space-y-md select-none">
            <h4 class="font-headline-md text-headline-md flex items-center gap-sm border-b border-[#c3c5d9]/30 pb-sm">
              <span class="material-symbols-outlined text-[#0041c8]">donut_large</span>
              Payment Method Breakdown
            </h4>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-md">
              <div class="bg-[#f2f3ff]/50 rounded-xl p-md border border-[#c3c5d9]/15 flex items-center justify-between">
                <div>
                  <span class="text-[10px] uppercase font-bold text-[#737688]">UPI Sales</span>
                  <p class="font-mono text-headline-md font-bold text-[#0041c8] mt-1">
                    ₹{(reportData.summary.totalUPISales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div class="w-10 h-10 rounded-full bg-[#0041c8]/10 text-[#0041c8] flex items-center justify-center font-bold text-xs">
                  {reportData.summary.totalSales > 0 
                    ? Math.round(((reportData.summary.totalUPISales || 0) / reportData.summary.totalSales) * 100)
                    : 0}%
                </div>
              </div>

              <div class="bg-[#f2f3ff]/50 rounded-xl p-md border border-[#c3c5d9]/15 flex items-center justify-between">
                <div>
                  <span class="text-[10px] uppercase font-bold text-[#737688]">Cash Sales</span>
                  <p class="font-mono text-headline-md font-bold text-[#005c3e] mt-1">
                    ₹{(reportData.summary.totalCashSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div class="w-10 h-10 rounded-full bg-[#005c3e]/10 text-[#005c3e] flex items-center justify-center font-bold text-xs">
                  {reportData.summary.totalSales > 0 
                    ? Math.round(((reportData.summary.totalCashSales || 0) / reportData.summary.totalSales) * 100)
                    : 0}%
                </div>
              </div>

              <div class="bg-[#f2f3ff]/50 rounded-xl p-md border border-[#c3c5d9]/15 flex items-center justify-between">
                <div>
                  <span class="text-[10px] uppercase font-bold text-[#737688]">Card Sales</span>
                  <p class="font-mono text-headline-md font-bold text-[#4648d4] mt-1">
                    ₹{(reportData.summary.totalCardSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div class="w-10 h-10 rounded-full bg-[#4648d4]/10 text-[#4648d4] flex items-center justify-center font-bold text-xs">
                  {reportData.summary.totalSales > 0 
                    ? Math.round(((reportData.summary.totalCardSales || 0) / reportData.summary.totalSales) * 100)
                    : 0}%
                </div>
              </div>
            </div>

            {/* Distribution Bar */}
            {reportData.summary.totalSales > 0 && (
              <div class="space-y-xs pt-xs">
                <span class="text-[10px] uppercase font-bold text-[#737688]">Sales Distribution</span>
                <div class="w-full h-3 rounded-full overflow-hidden flex bg-gray-100">
                  <div 
                    title={`UPI Sales: ${Math.round(((reportData.summary.totalUPISales || 0) / reportData.summary.totalSales) * 100)}%`} 
                    class="bg-[#0041c8] h-full transition-all" 
                    style={{ width: `${((reportData.summary.totalUPISales || 0) / reportData.summary.totalSales) * 100}%` }}
                  ></div>
                  <div 
                    title={`Cash Sales: ${Math.round(((reportData.summary.totalCashSales || 0) / reportData.summary.totalSales) * 100)}%`} 
                    class="bg-[#005c3e] h-full transition-all" 
                    style={{ width: `${((reportData.summary.totalCashSales || 0) / reportData.summary.totalSales) * 100}%` }}
                  ></div>
                  <div 
                    title={`Card Sales: ${Math.round(((reportData.summary.totalCardSales || 0) / reportData.summary.totalSales) * 100)}%`} 
                    class="bg-[#4648d4] h-full transition-all" 
                    style={{ width: `${((reportData.summary.totalCardSales || 0) / reportData.summary.totalSales) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            {/* Top Selling Products List */}
            <div class="glass-panel rounded-xl overflow-hidden shadow-sm flex flex-col justify-between min-h-[300px]">
              <div class="px-lg py-md border-b border-white/40 bg-white/20">
                <h4 class="font-bold text-body-lg text-[#131b2e] flex items-center gap-sm">
                  <span class="material-symbols-outlined text-[#0041c8]">trending_up</span>
                  Top-Selling Products
                </h4>
              </div>
              <div class="overflow-x-auto flex-grow">
                <table class="w-full text-left text-sm">
                  <thead class="bg-[#f2f3ff]/50">
                    <tr>
                      <th class="p-3 text-xs font-bold text-[#434656]">Rank</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">Product Name</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">SKU</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">Qty Sold</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">Gross Revenue</th>
                      <th class="p-3 text-xs font-bold text-[#434656]">Estimated Profit</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[#c3c5d9]/20">
                    {reportData.topProducts.length === 0 ? (
                      <tr>
                        <td colspan="6" class="p-4 text-center text-[#737688]">No product sales recorded in date range</td>
                      </tr>
                    ) : (
                      reportData.topProducts.map((p, idx) => (
                        <tr key={p.sku} class="hover:bg-[#0041c8]/5 transition-colors">
                          <td class="p-3 font-mono font-bold text-[#737688]">#{idx + 1}</td>
                          <td class="p-3 font-bold text-[#131b2e]">{p.name}</td>
                          <td class="p-3 font-mono text-xs text-[#434656]">{p.sku}</td>
                          <td class="p-3 font-mono text-[#131b2e]">{p.quantity} units</td>
                          <td class="p-3 font-mono font-bold text-[#0041c8]">₹{p.revenue.toFixed(2)}</td>
                          <td class="p-3 font-mono font-bold text-[#005c3e]">₹{p.profit.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AI Predictive restocking recommendation panel */}
            <div class="glass-panel rounded-xl overflow-hidden shadow-sm flex flex-col justify-between min-h-[300px]">
              <div class="px-lg py-md border-b border-white/40 bg-white/20 flex items-center justify-between">
                <h4 class="font-bold text-body-lg text-[#131b2e] flex items-center gap-sm">
                  <span class="material-symbols-outlined text-[#0041c8]">insights</span>
                  Predictive Supply Replenishment
                </h4>
                <span class="text-[10px] text-[#005c3e] bg-[#6ffbbe]/30 px-2 py-0.5 rounded-full font-bold">Autopilot Active</span>
              </div>
              <div class="p-md space-y-md flex-grow overflow-y-auto max-h-[360px] custom-scrollbar">
                {reportData.restockRecommendations.length === 0 ? (
                  <div class="py-xl text-center text-[#737688] text-sm">
                    All products maintain a healthy stock level. No reorders needed!
                  </div>
                ) : (
                  reportData.restockRecommendations.map((rec) => (
                    <div key={rec.id} class="p-md rounded-xl border border-[#c3c5d9]/30 bg-[#faf8ff] space-y-sm flex flex-col justify-between">
                      <div class="flex justify-between items-start">
                        <div>
                          <span class="text-[9px] font-mono text-[#737688]">{rec.sku}</span>
                          <h6 class="font-bold text-[#131b2e] text-sm">{rec.name}</h6>
                        </div>
                        <span class="bg-[#ffdad6] text-[#ba1a1a] px-sm py-0.5 rounded-full text-xs font-bold font-mono">
                          Stock: {rec.stock} / Min: {rec.minLevel}
                        </span>
                      </div>
                      
                      <div class="p-sm bg-white/60 border border-[#c3c5d9]/20 rounded-lg text-xs space-y-1">
                        <div class="flex justify-between">
                          <span class="text-[#737688]">Recommended Reorder:</span>
                          <span class="font-bold text-[#0041c8] font-mono">+{rec.suggestedRestockQty} units</span>
                        </div>
                        <div class="flex justify-between">
                          <span class="text-[#737688]">Preferred Supplier:</span>
                          <span class="font-bold text-[#131b2e]">{rec.supplierName}</span>
                        </div>
                        {rec.contactPerson && (
                          <div class="flex justify-between">
                            <span class="text-[#737688]">Representative:</span>
                            <span>{rec.contactPerson} ({rec.phone})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowDownRight, ArrowUpRight, Package, AlertTriangle, Clock, Activity, FileText, CheckCircle, Search, Filter, Calendar, TrendingUp, TrendingDown, DollarSign, Archive, Download, BellRing, Plus, Minus, Layers, LayoutDashboard, Eye , ChevronRight, ChevronLeft} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';
import TransactionDetailsModal from '../../components/storeCommon/TransactionDetailsModal';


const Dashboard = () => {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const [stats, setStats] = useState(null);

  const CARDS = [
    { label: 'إجمالي الأصناف', value: stats?.totalItems || 0, icon: Package, color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
    { label: 'أصناف تحت الحد الأدنى', value: stats?.lowStock || 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' },
    { label: 'إجمالي القيمة المالية', value: `${parseFloat(stats?.totalValue || 0).toLocaleString()} ريال`, icon: TrendingUp, color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
    { label: 'أصناف وشيكة الانتهاء', value: stats?.expiringCount || 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
  ];
  const [loading, setLoading] = useState(true);
  
  // Transactions Ledger State
  const [txPage, setTxPage] = useState(1);
  const [txDateFilter, setTxDateFilter] = useState('all');
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [txData, setTxData] = useState([]);
  const [txPagination, setTxPagination] = useState({ page: 1, totalPages: 1 });
  const [txStats, setTxStats] = useState({ totalReceived: 0, totalIssued: 0, receivedCount: 0, issuedCount: 0 });
  const [txLoading, setTxLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  
  // Custom Date States
  const [txStartDate, setTxStartDate] = useState('');
  const [txEndDate, setTxEndDate] = useState('');

  const lastFetchRef = useRef(0);
  const latestSilentUpdate = useSocketStore(s => s.latestSilentUpdate);

  const fetchStats = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;
    try {
      const res = await fetch('/api/inventory/or/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {
      toast.error('فشل تحميل الإحصائيات');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const exportToExcel = (data, filename) => {
    if (!data || data.length === 0) {
      toast.info('لا توجد بيانات للتصدير');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const handleExportLowStock = () => {
    const dataToExport = stats?.lowStockItems?.map(item => ({
      'اسم الصنف': item.name,
      'الكمية الحالية': parseInt(item.quantity, 10),
      'الحد الأدنى': parseInt(item.min_quantity, 10),
      'الوحدة': item.unit
    }));
    exportToExcel(dataToExport, 'نواقص_المخزون');
  };

  const handleExportExpiring = () => {
    const dataToExport = stats?.expiringItems?.map(item => ({
      'اسم الصنف': item.name,
      'الكمية الحالية': parseInt(item.quantity, 10),
      'تاريخ الانتهاء': item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-GB') : 'غير محدد',
      'الوحدة': item.unit
    }));
    exportToExcel(dataToExport, 'أصناف_وشيكة_الانتهاء');
  };

  useEffect(() => {
    if (latestSilentUpdate?.type === 'inventory') fetchStats();
  }, [latestSilentUpdate, fetchStats]);

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      let queryUrl = `/api/inventory/or/dashboard/transactions?page=${txPage}&limit=10&dateFilter=${txDateFilter}&typeFilter=${txTypeFilter}&grouped=false`;
      if (txDateFilter === 'custom' && txStartDate && txEndDate) {
        queryUrl += `&startDate=${txStartDate}&endDate=${txEndDate}`;
      }
      const res = await fetch(queryUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setTxData(data.transactions);
        setTxPagination(data.pagination);
        setTxStats(data.stats);
      }
    } catch {
      toast.error('فشل تحميل سجل الإجراءات');
    } finally {
      setTxLoading(false);
    }
  }, [token, txPage, txDateFilter, txTypeFilter, txStartDate, txEndDate]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => {
    if (latestSilentUpdate?.type === 'inventory') fetchTransactions();
  }, [latestSilentUpdate, fetchTransactions]);

  const handleExportTransactions = async () => {
    try {
      let queryUrl = `/api/inventory/or/dashboard/transactions?dateFilter=${txDateFilter}&typeFilter=${txTypeFilter}&export=true&grouped=false`;
      if (txDateFilter === 'custom' && txStartDate && txEndDate) {
        queryUrl += `&startDate=${txStartDate}&endDate=${txEndDate}`;
      }
      const res = await fetch(queryUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.transactions.length > 0) {
        const exportData = data.transactions.map(tx => ({
          'الصنف': tx.item_name,
          'النوع': tx.transaction_type === 'in' ? 'إستلام' : 'صرف',
          'الكمية': parseInt(tx.quantity, 10),
          'المصدر / الوجهة': tx.transaction_type === 'in' ? tx.source_entity : tx.destination_entity,
          'التاريخ': `${new Date(tx.created_at).toLocaleDateString('en-GB')} - ${new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
          'بواسطة': tx.user_name || 'النظام'
        }));
        exportToExcel(exportData, 'سجل_الإجراءات');
      } else {
         toast.info('لا توجد بيانات للتصدير');
      }
    } catch {
      toast.error('فشل تصدير السجل');
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-6" dir="rtl">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />)}
        <div className="col-span-3 h-64 bg-white rounded-2xl animate-pulse mt-6" />
      </div>
    );
  }


  return (
    <div className="p-6 min-h-full flex flex-col space-y-6" dir="rtl">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-800 text-white flex items-center justify-center shadow-lg">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">لوحة تحكم مخزن العمليات</h1>
            <p className="text-sm font-bold text-gray-500 mt-0.5">مراقبة المخزون، الحركات، والتقييم المالي</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/general-store/receive')} className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-900 transition-colors shadow-sm">
            <Plus size={16} /> إستلام جديد
          </button>
          <button onClick={() => navigate('/general-store/issue')} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm">
            <Minus size={16} /> صرف للأقسام
          </button>
        </div>
      </div>

      {/* ── Quick Stats Grid (Accountant-Style) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        {CARDS.map((s, i) => (
          <div key={i} className={`p-4 rounded-2xl border ${s.border} bg-white shadow-sm relative overflow-hidden flex flex-col justify-between`}>
            <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${s.bg} to-transparent opacity-50 rounded-bl-[100px] -z-10`} />
            <div className="flex justify-between items-start mb-2">
              <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <div>
              <p className="text-xl font-black text-gray-800">{s.value}</p>
              <p className="text-xs font-bold text-gray-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Dual Alerts Panels (Middle Row) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-shrink-0">
        
        {/* Right Panel: Low Stock Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden max-h-80">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <BellRing size={18} className="text-red-500" />
              <h3 className="font-bold text-gray-800 text-sm">أصناف تحت الحد الأدنى</h3>
              <span className="bg-red-100 text-red-700 py-0.5 px-2 rounded-full text-xs font-black">
                {stats?.lowStock || 0}
              </span>
            </div>
            <button onClick={handleExportLowStock} className="text-gray-500 hover:text-emerald-600 transition-colors bg-white p-1.5 rounded-lg shadow-sm border border-gray-200">
              <Download size={14} />
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {(!stats?.lowStockItems || stats.lowStockItems.length === 0) ? (
              <div className="text-center py-10 text-gray-400 text-sm font-bold">لا توجد أصناف تحت الحد الأدنى</div>
            ) : (
              stats.lowStockItems.map(item => (
                <div key={item.id} className="relative overflow-hidden flex flex-col p-4 rounded-xl border border-gray-100 bg-white hover:border-red-200 hover:shadow-md transition-all group">
                  <div className="absolute top-0 right-0 w-1 h-full bg-red-500 rounded-r-xl opacity-80 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex items-center justify-between pr-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                        <AlertTriangle size={14} className="text-red-500" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm line-clamp-1">{item.name}</p>
                      </div>
                    </div>
                    <button onClick={() => navigate('/general-store/receive')} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-red-50 hover:text-red-600 transition-colors border border-gray-100 shadow-sm shrink-0" title="توريد جديد">
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pr-2">
                    <div className="flex flex-col bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 w-1/2">
                      <span className="text-[10px] text-gray-500 font-bold mb-0.5">الحد الأدنى</span>
                      <span className="text-xs font-black text-gray-700">{parseInt(item.min_quantity, 10)} {item.unit}</span>
                    </div>
                    <div className="flex flex-col bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 w-1/2">
                      <span className="text-[10px] text-red-600 font-bold mb-0.5">الكمية الحالية</span>
                      <span className="text-xs font-black text-red-700">{parseInt(item.quantity, 10)} {item.unit}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Left Panel: Expiring Soon */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden max-h-80">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              <h3 className="font-bold text-gray-800 text-sm">أصناف وشيكة على الانتهاء أو منتهية</h3>
              <span className="bg-amber-100 text-amber-700 py-0.5 px-2 rounded-full text-xs font-black">
                {stats?.expiringCount || 0}
              </span>
            </div>
            <button onClick={handleExportExpiring} className="text-gray-500 hover:text-emerald-600 transition-colors bg-white p-1.5 rounded-lg shadow-sm border border-gray-200">
              <Download size={14} />
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-3">
            {(!stats?.expiringItems || stats.expiringItems.length === 0) ? (
              <div className="text-center py-10 text-gray-400 text-sm font-bold">لا توجد أصناف وشيكة الانتهاء</div>
            ) : (
              stats.expiringItems.map(item => {
                const daysLeft = Math.ceil((new Date(item.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={item.id} className="relative overflow-hidden flex flex-col p-4 rounded-xl border border-gray-100 bg-white hover:border-amber-200 hover:shadow-md transition-all group">
                    <div className="absolute top-0 right-0 w-1 h-full bg-amber-500 rounded-r-xl opacity-80 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex items-center justify-between pr-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                          <Clock size={14} className="text-amber-500" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-sm line-clamp-1">{item.name}</p>
                          {daysLeft > 0 && daysLeft <= 90 ? (
                            <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                              ينتهي خلال {daysLeft} يوم
                            </p>
                          ) : daysLeft <= 0 ? (
                            <p className="text-[10px] font-bold text-red-600 mt-0.5">
                              منتهي الصلاحية
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <button onClick={() => navigate('/general-store/issue')} className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-500 rounded-full hover:bg-amber-50 hover:text-amber-600 transition-colors border border-gray-100 shadow-sm shrink-0" title="صرف عاجل">
                        <Minus size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pr-2">
                      <div className="flex flex-col bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 w-1/2">
                        <span className="text-[10px] text-gray-500 font-bold mb-0.5">تاريخ الانتهاء</span>
                        <span className="text-xs font-black text-gray-700"><span dir="ltr">{new Date(item.expiry_date).toLocaleDateString('en-GB')}</span></span>
                      </div>
                      <div className="flex flex-col bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100 w-1/2">
                        <span className="text-[10px] text-amber-600 font-bold mb-0.5">الكمية الحالية</span>
                        <span className="text-xs font-black text-amber-700">{parseInt(item.quantity, 10)} {item.unit}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Full Width Ledger (Unified Module) ── */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-200 overflow-hidden flex-shrink-0 flex flex-col">
        
        {/* Sticky Header */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100 p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-100 text-indigo-600 flex items-center justify-center shadow-inner">
               <Layers size={22} />
             </div>
             <div>
               <h3 className="text-xl font-black text-gray-800">سجل الإجراءات</h3>
               <p className="text-slate-500 text-sm font-bold mt-0.5">تتبع حركات المخزون من إستلام وصرف</p>
             </div>
          </div>
          
          <div className="flex items-center gap-3 w-full xl:w-auto">
            <button onClick={handleExportTransactions} className="px-5 py-2.5 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm shrink-0 w-full xl:w-auto justify-center">
              <Download size={16} /> تصدير كـ Excel
            </button>
          </div>
        </div>

        {/* Ledger Body (Filters + Stats + Table) */}
        <div className="p-6 bg-slate-50/30 space-y-6">
          
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="flex flex-wrap gap-1.5 bg-gray-100 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500 flex-1 lg:flex-none">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'in', label: 'إستلام' },
                    { id: 'out', label: 'صرف' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setTxTypeFilter(f.id); setTxPage(1); }}
                      className={`px-4 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        txTypeFilter === f.id ? 'bg-white text-indigo-800 shadow-sm' : 'hover:bg-white/40'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto overflow-hidden">
                <div className="flex gap-1.5 bg-gray-100 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500 w-full md:w-auto overflow-x-auto">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'today', label: 'اليوم' },
                    { id: '7days', label: 'هذا الأسبوع' },
                    { id: '30days', label: 'هذا الشهر' },
                    { id: 'custom', label: 'تاريخ مخصص' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setTxDateFilter(f.id); setTxPage(1); }}
                      className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        txDateFilter === f.id ? 'bg-white text-indigo-800 shadow-sm' : 'hover:bg-white/40'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {txDateFilter === 'custom' && (
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-wrap gap-4 items-center animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">من:</span>
                  <input 
                    type="date" 
                    value={txStartDate} 
                    onChange={e => setTxStartDate(e.target.value)} 
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none text-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">إلى:</span>
                  <input 
                    type="date" 
                    value={txEndDate} 
                    onChange={e => setTxEndDate(e.target.value)} 
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none text-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2 mr-auto">
                  <button 
                    onClick={() => { setTxStartDate(''); setTxEndDate(''); setTxDateFilter('all'); setTxPage(1); }}
                    className="px-4 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-colors"
                  >
                    إعادة تعيين
                  </button>
                  <button 
                    onClick={() => setTxPage(1)} 
                    disabled={!txStartDate || !txEndDate}
                    className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    تطبيق الفلتر
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Ledger Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
               <div className="space-y-1">
                 <p className="text-xs font-black text-gray-400 tracking-wider">إجمالي الحركات المستلمة</p>
                 <h3 className="text-3xl font-black text-emerald-600">+{txStats.receivedCount || 0}</h3>
               </div>
               <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 flex items-center justify-center shadow-inner">
                 <ArrowDownToLine size={26} />
               </div>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
               <div className="space-y-1">
                 <p className="text-xs font-black text-gray-400 tracking-wider">إجمالي الحركات المنصرفة</p>
                 <h3 className="text-3xl font-black text-amber-600">-{txStats.issuedCount || 0}</h3>
               </div>
               <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                 <ArrowUpFromLine size={26} />
               </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto min-h-[300px]">
            {txLoading ? (
              <div className="flex justify-center items-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
              </div>
            ) : (
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">نوع الحركة</th>
                    <th className="px-4 py-3.5 text-right font-black">الصنف</th>
                    <th className="px-4 py-3.5 text-right font-black">نوع الصنف</th>
                    <th className="px-4 py-3.5 text-right font-black">الكمية</th>
                    <th className="px-4 py-3.5 text-right font-black">القيمة</th>
                    <th className="px-4 py-3.5 text-right font-black">المصدر / الوجهة</th>
                    <th className="px-4 py-3.5 text-right font-black">التاريخ</th>
                    <th className="px-4 py-3.5 text-center font-black w-16">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {txData.length === 0 ? (
                    <tr><td colSpan="8" className="p-12 text-center text-gray-400 font-bold">لا توجد حركات مسجلة مطابقة للبحث</td></tr>
                  ) : (
                    txData.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                            tx.transaction_type === 'in' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/60' : 'bg-rose-50 text-rose-700 border border-rose-100/60'
                          }`}>
                            {tx.transaction_type === 'in' ? <ArrowDownRight size={14}/> : <ArrowUpRight size={14}/>}
                            {tx.transaction_type === 'in' ? 'إستلام' : 'صرف'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-black text-gray-800">{tx.item_name}</td>
                        <td className="px-4 py-3.5 text-gray-500 font-bold text-xs">{tx.item_unit || '-'}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span dir="ltr" className={`font-black text-base ${tx.transaction_type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {tx.transaction_type === 'in' ? '+' : '-'}{parseInt(tx.total_quantity || tx.quantity, 10).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-gray-700">
                          {Number(tx.total_value || 0).toLocaleString()} <span className="text-[10px] text-gray-400">ر.ي</span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 font-bold max-w-[150px] truncate" title={tx.transaction_type === 'in' ? tx.source_entity : tx.destination_entity}>
                          {tx.transaction_type === 'in' ? tx.source_entity : tx.destination_entity}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 font-bold">
                          <span dir="ltr">{new Date(tx.created_at).toLocaleDateString('en-GB')} - {new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button 
                            onClick={() => setSelectedTransaction({ ...tx, is_single_view: true })}
                            className="p-2 text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-xl transition-all border border-indigo-100 shadow-sm"
                            title="عرض التفاصيل"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
            </div>
            {/* Pagination Footer */}
            {!txLoading && txPagination.totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500">
                  صفحة {txPagination.page} من {txPagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <button 
                    disabled={txPage <= 1}
                    onClick={() => setTxPage(p => p - 1)}
                    className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 text-sm font-bold shadow-sm transition-colors"
                  ><ChevronRight size={18} /></button>
                  <button 
                    disabled={txPage >= txPagination.totalPages}
                    onClick={() => setTxPage(p => p + 1)}
                    className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 text-sm font-bold shadow-sm transition-colors"
                  ><ChevronLeft size={18} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TransactionDetailsModal storeType="or"
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
      />
    </div>
  );
};

export default Dashboard;

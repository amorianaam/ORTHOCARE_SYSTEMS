import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Calendar, Filter, Download, ArrowUpRight, ArrowDownLeft,
  DollarSign, RotateCcw, RefreshCcw, LayoutGrid, List, Search, ChevronRight, User, X, Printer,
  Maximize2, Minimize2, History, CheckCircle2, Clock
} from 'lucide-react';
import { toast } from 'react-toastify';
import Fuse from 'fuse.js';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';
import FinancialRecordModal from '../../components/common/FinancialRecordModal';

const PAGE_SIZE = 12;

const CAT_LABELS = {
  entry_fee: 'رسم الكشف',
  lab: 'تحاليل',
  radiology: 'أشعة',
  surgery_payment: 'عمليات',
  general_income: 'إيراد عام',
  external_lab: 'مختبر خارجي',
  external_radiology: 'أشعة خارجية',
  treasury_deposit: 'إيداع خزينة',
  external_surgery: 'عمليات خارجية',
  refund: 'استرداد',
  expense: 'مصروفات',
  general_expense: 'مصروف عام',
  emergency_expense: 'مصروف طوارئ',
  emergency_purchase: 'مشتريات طوارئ',
  income: 'إيرادات'
};

const CashierReports = () => {
  const { token } = useAuthStore();
  const { latestSilentUpdate } = useSocketStore();
  
  // Data state
  const [data, setData] = useState({ transactions: [], breakdown: [] });
  const [loading, setLoading] = useState(true);

  // Filters & Layout
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem('cashier_reports_layout') || 'grid');
  const [page, setPage] = useState(1);

  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  useEffect(() => {
    localStorage.setItem('cashier_reports_layout', layoutMode);
  }, [layoutMode]);

  const cleanDescription = (desc) => {
    if (!desc) return '';
    return desc.replace(/-\s*خصم\s*0\s*0/g, '').replace(/-\s*خصم\s*0/g, '').replace(/\s+0\b/g, '').replace(/\s*-\s*$/, '').trim();
  };

  const fetchPatientRecord = async (id) => {
    if (!id) return;
    setSelectedPatientId(id);
    setRecordLoading(true);
    try {
      const res = await fetch(`/api/cashier/archive/patient/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setRecordData(await res.json());
      }
    } catch (err) { toast.error('خطأ في جلب السجل المالي'); }
    setRecordLoading(false);
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/cashier/stats/transactions?period=${dateFilter}`;
      if (dateFilter === 'custom' && customRange.start && customRange.end) {
        url += `&from=${customRange.start}&to=${customRange.end}`;
      }
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        setData(await res.json());
      } else {
        toast.error('تعذر جلب التقارير');
      }
    } catch (err) {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [dateFilter, customRange, token]);

  useEffect(() => {
    if (dateFilter !== 'custom' || (dateFilter === 'custom' && customRange.start && customRange.end)) {
      fetchReports();
    }
    
  }, [fetchReports, dateFilter, customRange, token]); 

  // Filtering transactions based on search query
  const filteredTransactions = useMemo(() => {
    let result = data.transactions || [];
    if (query.trim()) {
      const fuse = new Fuse(result, {
        keys: ['patient_name', 'description', 'id'],
        threshold: 0.3
      });
      result = fuse.search(query).map(r => r.item);
    }
    return result;
  }, [data.transactions, query]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = useMemo(() => {
    return filteredTransactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredTransactions, page]);

  // Derived calculations
  const totalIncome = data.breakdown.reduce((sum, item) => sum + parseFloat(item.total), 0);
  const totalRefunds = (data.transactions || []).filter(t => t.is_refund).reduce((sum, t) => sum + parseFloat(t.amount), 0);
  const totalExpenses = (data.transactions || []).filter(t => t.type === 'expense' && !t.is_refund).reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const exportCSV = () => {
    const headers = ['التاريخ', 'رقم الحركة', 'المريض', 'النوع', 'القسم', 'المبلغ', 'البيان'];
    const rows = filteredTransactions.map(t => [
      new Date(t.created_at).toLocaleString('en-GB'),
      t.id,
      t.patient_name || '—',
      t.is_refund ? 'استرداد' : t.type === 'income' ? 'إيراد' : 'مصروف',
      CAT_LABELS[t.category] || t.category,
      t.amount,
      t.description
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `financial_report_${dateFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResetFilters = () => {
    setQuery('');
    setDateFilter('today');
    setCustomRange({ start: '', end: '' });
    setPage(1);
  };

  useEffect(() => {
    if (latestSilentUpdate?.type === "cashier") {
      if (typeof fetchData === "function") fetchData();
      if (typeof fetchSummary === "function") fetchSummary();
      if (typeof fetchDetail === "function") fetchDetail();
      if (typeof fetchPatients === "function") fetchPatients();
      if (typeof fetchReports === "function") fetchReports();
      if (typeof fetchSurgeries === "function") fetchSurgeries();
    }
  }, [latestSilentUpdate]);

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-3xl shadow-xl text-white border border-slate-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-700/80 flex items-center justify-center shadow-lg text-rose-400">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">التقارير المالية اليومية</h1>
              <p className="text-slate-400 text-xs mt-1">تحليلات الأداء المالي وإحصائيات الإيرادات والمصروفات</p>
            </div>
          </div>
          <button onClick={exportCSV} className="btn-secondary bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 flex items-center gap-2 text-xs py-2 shadow-sm rounded-xl px-4">
            <Download size={14} /> تصدير CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <DollarSign className="absolute left-[-20px] top-[-20px] text-white/10" size={120} />
          <p className="text-sky-100 font-bold mb-1">إجمالي الإيرادات</p>
          <h3 className="text-3xl font-black">{totalIncome.toLocaleString('ar')} <span className="text-sm opacity-80">YER</span></h3>
        </div>
        <div className="bg-gradient-to-l from-rose-500 to-rose-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <RotateCcw className="absolute left-[-20px] top-[-20px] text-white/10" size={120} />
          <p className="text-rose-100 font-bold mb-1">المرتجعات (استرداد)</p>
          <h3 className="text-3xl font-black">{totalRefunds.toLocaleString('ar')} <span className="text-sm opacity-80">YER</span></h3>
        </div>
        <div className="bg-gradient-to-l from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
          <ArrowDownLeft className="absolute left-[-20px] top-[-20px] text-white/10" size={120} />
          <p className="text-amber-100 font-bold mb-1">المصروفات العامة</p>
          <h3 className="text-3xl font-black">{totalExpenses.toLocaleString('ar')} <span className="text-sm opacity-80">YER</span></h3>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search bar */}
          <div className="md:col-span-6 relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder="ابحث باسم المريض أو البيان أو رقم الحركة..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-10 pl-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Temporal filter tabs */}
          <div className="md:col-span-6 flex gap-1.5 bg-gray-100 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500 overflow-x-auto">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'هذا الأسبوع' },
              { id: 'month', label: 'هذا الشهر' },
              { id: 'year', label: 'هذه السنة' },
              { id: 'custom', label: 'تاريخ مخصص' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { setDateFilter(f.id); setPage(1); }}
                className={`whitespace-nowrap px-3 py-1.5 rounded-xl transition-all ${
                  dateFilter === f.id ? 'bg-white text-slate-800 shadow-sm' : 'hover:bg-white/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {dateFilter === 'custom' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gray-50 rounded-2xl border border-gray-150 flex flex-wrap gap-4 items-center"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">من:</span>
              <input
                type="date"
                value={customRange.start}
                onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none text-gray-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">إلى:</span>
              <input
                type="date"
                value={customRange.end}
                onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold outline-none text-gray-700"
              />
            </div>
            <button
              onClick={() => { setPage(1); fetchReports(); }}
              className="px-4 py-1.5 text-xs bg-sky-700 text-white hover:bg-sky-700 shadow-sm rounded-xl font-bold"
            >
              تطبيق
            </button>
            <button
              onClick={handleResetFilters}
              className="px-4 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold mr-auto"
            >
              إعادة تعيين
            </button>
          </motion.div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-xs font-semibold text-gray-500">
          <span>تم العثور على {filteredTransactions.length} حركة مالية</span>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setLayoutMode('grid')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'grid' ? 'bg-white text-slate-800' : 'text-gray-400'}`}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setLayoutMode('list')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'list' ? 'bg-white text-slate-800' : 'text-gray-400'}`}>
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid or List of Transactions */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-150 h-80 flex flex-col justify-center items-center">
          <Search size={40} className="text-gray-300 mb-3 animate-pulse" />
          <p className="font-extrabold text-gray-700 text-sm">لا توجد سجلات مالية مطابقة</p>
          <p className="text-xs text-gray-400 mt-1">تأكد من كلمات البحث أو تغيير فترة التصفية.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {layoutMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedTransactions.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTx(t)}
                  className="bg-white border border-gray-100 hover:border-slate-300 rounded-3xl p-5 shadow-xs hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between h-40 group relative overflow-hidden"
                >
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    t.is_refund ? 'bg-red-400' :
                    t.type === 'income' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  
                  <div className="space-y-2 mt-1">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${t.patient_id ? 'bg-slate-50 text-sky-700' : 'bg-slate-100 text-slate-700'}`}>
                            {t.patient_id ? (t.patient_name || 'م').charAt(0) : <User size={14} />}
                          </div>
                          <span className="font-extrabold text-xs text-gray-800 group-hover:text-slate-800 line-clamp-1">{t.patient_name || 'عام / جهة أخرى'}</span>
                       </div>
                       <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[9px] ${
                          t.is_refund ? 'bg-red-100 text-red-700' :
                          t.type === 'income' ? 'bg-sky-100 text-sky-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {t.is_refund ? 'استرداد' : t.type === 'income' ? 'إيراد' : 'مصروف'}
                        </span>
                    </div>

                    <div className="text-[10px] text-gray-500 font-bold space-y-1.5 mt-3">
                      <p className="flex items-center gap-1"><FileText size={11} /> الفئة: {CAT_LABELS[t.category] || t.category}</p>
                      <p className="flex items-center gap-1"><Clock size={11} /> الوقت: {new Date(t.created_at).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-gray-50 pt-2 mt-2">
                    <div className="flex gap-1.5 items-center">
                       <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">#{t.id}</span>
                       <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{t.payment_method === 'cash' ? 'نقدي' : 'بنكي'}</span>
                    </div>
                    <span className={`font-black text-sm tracking-tight ${
                        t.is_refund ? 'text-red-600' :
                        t.type === 'income' ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                      {parseFloat(t.amount).toLocaleString('ar')} <span className="text-[8px]">YER</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                  <tr>
                    <th className="p-4">المريض / الجهة</th>
                    <th className="p-4">القسم والنوع</th>
                    <th className="p-4 w-40">البيان (اسم الخدمة)</th>
                    <th className="p-4">المستخدم</th>
                    <th className="p-4">الوقت</th>
                    <th className="p-4 w-32">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedTransactions.map((t) => (
                    <tr 
                      key={t.id} 
                      onClick={() => setSelectedTx(t)}
                      className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${t.is_refund ? 'bg-red-50/20' : ''}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${t.patient_id ? 'bg-slate-50 text-sky-600' : 'bg-slate-100 text-slate-500'}`}>
                            {t.patient_id ? (t.patient_name || 'م').charAt(0) : <User size={18} />}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-800">{t.patient_name || 'عام / جهة أخرى'}</h3>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1">
                              حركة #{t.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[9px] ${
                            t.is_refund ? 'bg-red-100 text-red-700' :
                            t.type === 'income' ? 'bg-sky-100 text-sky-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {t.is_refund ? <RotateCcw size={10}/> : t.type === 'income' ? <ArrowDownLeft size={10}/> : <ArrowUpRight size={10}/>}
                            {t.is_refund ? 'استرداد' : t.type === 'income' ? 'إيراد' : 'مصروف'}
                          </span>
                          <span className="text-[10px] font-bold text-gray-500">{CAT_LABELS[t.category] || t.category}</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 font-semibold max-w-[180px]">
                        <p className="truncate">{cleanDescription(t.description)}</p>
                        {!!t.is_refund && <p className="text-red-500 text-[9px] mt-0.5 font-bold truncate">السبب: {t.refund_reason}</p>}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-sky-100/50">
                          <User size={12} /> {t.cashier_name || 'غير معروف'}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-gray-500 text-[11px] font-bold">
                        {new Date(t.created_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="p-4">
                        <span className={`font-black text-sm ${
                          t.is_refund ? 'text-red-600' :
                          t.type === 'income' ? 'text-emerald-600' :
                          'text-amber-600'
                        }`}>
                          {parseFloat(t.amount).toLocaleString('ar')} <span className="text-[9px] text-gray-400">YER</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-xs font-bold text-gray-500 bg-gray-50/50 p-4 rounded-2xl border">
              <span>صفحة {page} من {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 bg-white border rounded-xl disabled:opacity-40 font-black hover:bg-gray-50 transition-colors">السابق</button>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1.5 bg-white border rounded-xl disabled:opacity-40 font-black hover:bg-gray-50 transition-colors">التالي</button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedPatientId && (
        <FinancialRecordModal token={localStorage.getItem('token')} onRefresh={() => fetchPatientRecord(selectedPatientId)} 
          recordData={recordData}
          recordLoading={recordLoading}
          onClose={() => setSelectedPatientId(null)}
        />
      )}

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center print:hidden" dir="rtl">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
            <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:20, opacity:0}} 
              className="relative bg-white shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-300 border border-slate-100 rounded-3xl max-w-md">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-sky-600 shadow-sm border border-slate-100">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">تفاصيل العملية</h3>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">#{selectedTx.id}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedTx(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-rose-500">
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 md:p-5 space-y-4 overflow-y-auto">
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl p-4 md:p-5 text-center shadow-inner">
                  <span className="text-xs font-bold text-slate-500 mb-1">المبلغ الإجمالي</span>
                  <div className={`text-2xl md:text-3xl font-black tracking-tight flex items-center justify-center gap-2 ${selectedTx.is_refund || selectedTx.category === 'refund' ? 'text-orange-600' : selectedTx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <span>{selectedTx.type === 'income' && !(selectedTx.is_refund || selectedTx.category === 'refund') ? '+' : '-'}</span>
                    {parseFloat(selectedTx.amount).toLocaleString('ar')} 
                    <span className="text-xs font-bold opacity-70 mt-1.5">YER</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${selectedTx.is_refund || selectedTx.category === 'refund' ? 'bg-orange-50 text-orange-600' : selectedTx.type === 'income' ? 'bg-sky-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {selectedTx.is_refund || selectedTx.category === 'refund' ? <RefreshCcw size={18}/> : selectedTx.type === 'income' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-0.5">نوع العملية</span>
                      <span className="text-xs font-black text-slate-700">{selectedTx.is_refund || selectedTx.category === 'refund' ? 'استرداد نقدي' : selectedTx.type === 'income' ? 'إيراد (إيداع)' : 'مصروفات'}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 text-sky-600 shrink-0">
                      <LayoutGrid size={18}/>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-0.5">الفئة التصنيفية</span>
                      <span className="text-xs font-black text-slate-700">{CAT_LABELS[selectedTx.category] || selectedTx.category}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 shrink-0">
                      <Calendar size={18}/>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-0.5">التاريخ والوقت</span>
                      <span className="text-xs font-black text-slate-700 font-mono" dir="ltr">{new Date(selectedTx.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 shrink-0">
                      <User size={18}/>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-0.5">الموظف المنفذ</span>
                      <span className="text-xs font-black text-slate-700">{selectedTx.cashier_name || 'غير معروف'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2 text-slate-600">
                    <FileText size={16}/>
                    <span className="font-bold text-xs">الوصف والملاحظات</span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed">{selectedTx.description || 'لا توجد ملاحظات إضافية.'}</p>
                </div>
              </div>
              <div className="p-4 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center mt-auto">
                <div>
                  {selectedTx.patient_id && (
                    <button onClick={() => {
                        const pid = selectedTx.patient_id;
                        setSelectedTx(null);
                        fetchPatientRecord(pid);
                      }} 
                      className="px-4 py-2 bg-slate-100 hover:bg-sky-200 text-sky-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2">
                      <User size={14}/> عرض ملف المريض
                    </button>
                  )}
                </div>
                <button onClick={() => setSelectedTx(null)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all">
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CashierReports;




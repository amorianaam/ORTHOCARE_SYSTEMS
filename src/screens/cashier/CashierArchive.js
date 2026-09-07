import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Archive, Search, FileText, X, Printer, User, History, ArrowDownLeft, 
  ArrowUpRight, CheckCircle2, LayoutGrid, List, ChevronRight, Phone,
  Maximize2, Minimize2
} from 'lucide-react';
import { toast } from 'react-toastify';
import Fuse from 'fuse.js';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';
import FinancialRecordModal from '../../components/common/FinancialRecordModal';
import { useLocation } from 'react-router-dom';
const PAGE_SIZE = 12;

const CashierArchive = () => {
  const { token } = useAuthStore();
  const { latestSilentUpdate } = useSocketStore();
  const location = useLocation();
  
  // Core Data
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filters
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month', 'year', 'custom'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'suspended', 'surgeries'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem('cashier_archive_layout') || 'grid');
  const [page, setPage] = useState(1);

  useEffect(() => {
    localStorage.setItem('cashier_archive_layout', layoutMode);
  }, [layoutMode]);

  // Selected Patient Record
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cashier/archive/patients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setPatients(await res.json());
      } else {
        toast.error('تعذر جلب بيانات الأرشيف');
      }
    } catch (err) {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPatients();
    
  }, [fetchPatients, token]);

  // Client-side filtering
  const filteredPatients = useMemo(() => {
    let result = patients;

    // Search filter
    if (query.trim()) {
      const fuse = new Fuse(patients, {
        keys: ['full_name', 'phone', 'id'],
        threshold: 0.35
      });
      result = fuse.search(query).map(r => r.item);
    }

    // Temporal filter (using last_visit_date)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilter === 'today') {
      result = result.filter(p => p.last_visit_date && new Date(p.last_visit_date) >= startOfDay);
    } else if (dateFilter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(p => p.last_visit_date && new Date(p.last_visit_date) >= oneWeekAgo);
    } else if (dateFilter === 'month') {
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      result = result.filter(p => p.last_visit_date && new Date(p.last_visit_date) >= oneMonthAgo);
    } else if (dateFilter === 'year') {
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      result = result.filter(p => p.last_visit_date && new Date(p.last_visit_date) >= oneYearAgo);
    } else if (dateFilter === 'custom' && customRange.start && customRange.end) {
      const start = new Date(customRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter(p => {
        if (!p.last_visit_date) return false;
        const pDate = new Date(p.last_visit_date);
        return pDate >= start && pDate <= end;
      });
    }

    // Category filter
    if (categoryFilter === 'suspended') {
      result = result.filter(p => p.has_suspended_services === 1);
    } else if (categoryFilter === 'surgeries') {
      result = result.filter(p => p.has_surgeries === 1);
    }

    return result;
  }, [patients, query, dateFilter, customRange, categoryFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));
  const paginatedPatients = useMemo(() => {
    return filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredPatients, page]);

  const handleResetFilters = () => {
    setQuery('');
    setDateFilter('all');
    setCategoryFilter('all');
    setCustomRange({ start: '', end: '' });
    setPage(1);
    toast.info('تم إعادة تعيين الفلاتر');
  };

  const openPatientRecord = useCallback(async (id) => {
    setSelectedPatientId(id);
    setRecordLoading(true);
    try {
      const res = await fetch(`/api/cashier/archive/patient/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRecordData(await res.json());
      } else {
        toast.error('تعذر جلب السجل المالي');
      }
    } catch (err) {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setRecordLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const patientId = params.get('patientId');
    if (patientId) {
      openPatientRecord(patientId);
    }
  }, [location.search, openPatientRecord]);

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
    <div className="space-y-6 p-6 print:p-0 print:space-y-0 h-full flex flex-col" dir="rtl">
      
      {/* Top Banner (Hidden in Print) */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-3xl shadow-xl text-white border border-slate-700 print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-700/80 flex items-center justify-center shadow-lg text-teal-400">
              <Archive size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">السجل المالي الشامل</h1>
              <p className="text-slate-400 text-xs mt-1">البحث والاطلاع على السجلات المالية وتاريخ المدفوعات للمرضى</p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Toolbar (Hidden in Print) */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search bar */}
          <div className="md:col-span-6 relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setPage(1); }}
              placeholder="ابحث بالاسم الرباعي، رقم الهاتف، أو معرف المريض..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-10 pl-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-500"
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
          {/* Category filter tabs */}
          <div className="md:col-span-12 flex gap-1.5 bg-gray-100 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500 overflow-x-auto mt-2">
            {[
              { id: 'all', label: 'جميع المرضى' },
              { id: 'suspended', label: 'مرضى بخدمات معلقة' },
              { id: 'surgeries', label: 'مرضى العمليات' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => { setCategoryFilter(f.id); setPage(1); }}
                className={`whitespace-nowrap px-4 py-2 rounded-xl transition-all ${
                  categoryFilter === f.id ? (f.id === 'suspended' ? 'bg-orange-100 text-orange-800 shadow-sm' : f.id === 'surgeries' ? 'bg-slate-100 text-sky-800 shadow-sm' : 'bg-white text-slate-800 shadow-sm') : 'hover:bg-white/40'
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
              onClick={() => { setPage(1); }}
              className="px-4 py-1.5 text-xs bg-slate-800 text-white hover:bg-slate-700 shadow-sm rounded-xl font-bold"
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
          <span>تم العثور على {filteredPatients.length} مريض</span>
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

      {/* Grid or List of Patients (Hidden in Print) */}
      {loading ? (
        <div className="flex justify-center py-20 print:hidden">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-150 h-80 flex flex-col justify-center items-center print:hidden">
          <Search size={40} className="text-gray-300 mb-3 animate-pulse" />
          <p className="font-extrabold text-gray-700 text-sm">لا توجد سجلات مطابقة</p>
          <p className="text-xs text-gray-400 mt-1">تأكد من إدخال اسم صحيح أو تحديد تاريخ صحيح للبحث.</p>
        </div>
      ) : (
        <div className="space-y-6 flex-1 print:hidden">
          {layoutMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {paginatedPatients.map(p => (
                <div
                  key={p.id}
                  onClick={() => openPatientRecord(p.id)}
                  className="bg-white border border-gray-100 hover:border-slate-300 rounded-3xl p-5 shadow-xs hover:shadow-sm cursor-pointer transition-all flex flex-col justify-between h-40 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs">
                        {p.full_name?.charAt(0)}
                      </div>
                      <span className="font-extrabold text-xs text-gray-800 group-hover:text-slate-800 line-clamp-1">{p.full_name}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold space-y-1 mt-2">
                      <p className="flex items-center gap-1"><History size={11} /> إجمالي الزيارات: {p.total_visits}</p>
                      <p className="flex items-center gap-1"><FileText size={11} /> إجمالي المبلغ: {parseFloat(p.total_amount || 0).toLocaleString('ar')} YER</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center border-t border-gray-50 pt-2 text-[9px] font-black text-slate-500 mt-2">
                    <div className="flex gap-1 items-center">
                      {p.has_suspended_services === 1 && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[8px]" title="يوجد خدمات معلقة">معلقة</span>}
                      {p.has_surgeries === 1 && <span className="bg-slate-100 text-sky-700 px-1.5 py-0.5 rounded text-[8px]" title="يوجد عمليات">عمليات</span>}
                    </div>
                    <span>
                      آخر زيارة: {p.last_visit_date ? new Date(p.last_visit_date).toLocaleDateString('ar') : '—'}
                      {p.last_visit_date && ` - ${new Date(p.last_visit_date).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                    <ChevronRight size={14} className="group-hover:translate-x-[-4px] transition-transform text-slate-400" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                  <tr>
                    <th className="p-3.5">المريض / المعرف</th>
                    <th className="p-3.5">إجمالي الزيارات</th>
                    <th className="p-3.5">إجمالي المبلغ</th>
                    <th className="p-3.5">تاريخ آخر زيارة</th>
                    <th className="p-3.5">الوقت</th>
                    <th className="p-3.5 w-28">تفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedPatients.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => openPatientRecord(p.id)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs">
                            {p.full_name?.charAt(0)}
                          </div>
                          <div>
                            <span className="font-extrabold text-gray-800 block flex items-center gap-2">
                              {p.full_name}
                              {p.has_suspended_services === 1 && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[8px] whitespace-nowrap" title="يوجد خدمات معلقة">معلقة</span>}
                              {p.has_surgeries === 1 && <span className="bg-slate-100 text-sky-700 px-1.5 py-0.5 rounded text-[8px] whitespace-nowrap" title="يوجد عمليات">عمليات</span>}
                            </span>
                            <span className="font-mono text-[9px] text-gray-400">ID: {p.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-bold text-gray-600">{p.total_visits} زيارات</td>
                      <td className="p-3.5 font-black text-emerald-600">{parseFloat(p.total_amount || 0).toLocaleString('ar')} YER</td>
                      <td className="p-3.5 text-gray-600 font-bold">{p.last_visit_date ? new Date(p.last_visit_date).toLocaleDateString('ar') : '—'}</td>
                      <td className="p-3.5 text-gray-500 font-bold">{p.last_visit_date ? new Date(p.last_visit_date).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="p-3.5">
                        <button className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-black text-[10px] transition-colors shadow-sm">
                          السجل المالي
                        </button>
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

      {/* Financial Record Modal */}
      {selectedPatientId && (
        <FinancialRecordModal token={localStorage.getItem('token')} 
          recordData={recordData}
          recordLoading={recordLoading}
          onClose={() => setSelectedPatientId(null)}
        />
      )}
    </div>
  );
};

export default CashierArchive;




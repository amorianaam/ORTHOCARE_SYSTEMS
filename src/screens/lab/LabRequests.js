import React, { useState, useEffect, useCallback, useMemo } from 'react';

import {
  FlaskConical, Clock, RefreshCcw, CheckCircle,
  TrendingUp, LayoutGrid, List, Activity, Eye, ChevronLeft, ChevronRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';
import { LabRecordDetailModal } from '../../components/lab/LabModals';

// ── Reports Tab (Statistics and Consumption Logs) ─────────────────
const PAGE_SIZE = 12;

const LabRequests = () => {
  const { token } = useAuthStore();
  const location = useLocation();
  const latestLabEvent = useSocketStore(state => state.latestLabEvent);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem("labViewMode") || "grid");
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  // Filters
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [page, setPage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const visitId = params.get('visitId');
    if (visitId) {
      setSelectedVisitId(Number(visitId));
      window.history.replaceState({}, '', '/lab/reports');
    }
  }, [location.search]);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let url = '/api/lab/stats?';
      
      if (dateFilter === 'custom' && customRange.start && customRange.end) {
        url += `startDate=${customRange.start}&endDate=${customRange.end}`;
      } else if (dateFilter !== 'all') {
        const now = new Date();
        let start = '';
        const pad = (n) => n.toString().padStart(2, '0');
        const format = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        
        if (dateFilter === 'today') {
          start = format(now);
        } else if (dateFilter === 'week') {
          const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          start = format(past);
        } else if (dateFilter === 'month') {
          const past = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          start = format(past);
        }
        url += `startDate=${start}&endDate=${format(now)}`;
      }

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
      setStats(await res.json());
      setPage(1);
    } catch { 
      toast.error('فشل تحميل الإحصائيات'); 
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, dateFilter, customRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (latestLabEvent?.id) {
      fetchStats(true);
    }
  }, [latestLabEvent?.id, fetchStats]);


  useEffect(() => {
    localStorage.setItem("labViewMode", layoutMode);
  }, [layoutMode]);

  const handleResetFilters = () => {
    setDateFilter('all');
    setCustomRange({ start: '', end: '' });
    setPage(1);
    toast.info('تم إعادة تعيين فلاتر التقارير');
  };

  const totalPages = Math.ceil((stats?.tableData?.length || 0) / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    if (!stats?.tableData) return [];
    return stats.tableData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [stats?.tableData, page]);

  return (
    <div className="flex-1 overflow-y-auto space-y-6 w-full custom-scrollbar pr-2 pb-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-violet-900 to-indigo-900 p-6 rounded-3xl text-white border border-violet-950 shadow-lg relative overflow-hidden flex-shrink-0 mt-2">
        <div className="absolute top-0 right-0 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-violet-200 shadow-inner backdrop-blur-sm">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black">تقارير وإحصائيات المختبر التحليلية</h1>
              <p className="text-violet-200/70 text-xs mt-1 font-bold">تتبع الأداء، عدد العينات، وحالة الفحوصات المنجزة</p>
            </div>
          </div>
          <button onClick={fetchStats} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center gap-2 text-sm font-bold py-2.5 px-5 shadow-lg backdrop-blur-md rounded-xl transition-all hover:scale-105 active:scale-95 group">
            <RefreshCcw size={16} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} /> تحديث البيانات
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-2xl text-xs font-bold text-gray-500">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'آخر 7 أيام' },
              { id: 'month', label: 'آخر 30 يوماً' },
              { id: 'custom', label: 'تاريخ مخصص' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-4 py-2 rounded-xl transition-all ${
                  dateFilter === f.id ? 'bg-white text-violet-800 shadow-sm' : 'hover:bg-white/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dateFilter !== 'all' && (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors"
            >
              إعادة تعيين
            </button>
          )}
        </div>

        {/* Custom Range Picker */}
        {dateFilter === 'custom' && (
          <div className="overflow-hidden mt-4">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 flex flex-wrap gap-4 items-center text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-500">من تاريخ:</span>
                <input
                  type="date"
                  value={customRange.start}
                  onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold outline-none text-gray-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-500">إلى تاريخ:</span>
                <input
                  type="date"
                  value={customRange.end}
                  onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold outline-none text-gray-700"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {loading && !stats ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* KPI Overviews */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 flex-shrink-0">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-violet-200 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">إجمالي الفحوصات المطلوبة</span>
                <h3 className="text-2xl font-black text-gray-800">{stats?.summary?.total_requests || 0}</h3>
              </div>
              <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shadow-inner"><FlaskConical size={20} /></div>
            </div>
            
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-emerald-200 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">الفحوصات المنجزة (النتائج مسجلة)</span>
                <h3 className="text-2xl font-black text-gray-800">{stats?.summary?.completed || 0}</h3>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner"><CheckCircle size={20} /></div>
            </div>
            
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-violet-200 transition-all">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400">الفحوصات قيد العمل / المعلقة</span>
                <h3 className="text-2xl font-black text-gray-800">{stats?.summary?.pending || 0}</h3>
              </div>
              <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shadow-inner"><Clock size={20} /></div>
            </div>
          </div>

          {/* Results Counter & Layout Toggle */}
          <div className="flex justify-between items-center bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm text-xs font-semibold text-gray-500 flex-shrink-0">
            <span>تم العثور على {stats?.tableData?.length || 0} من السجلات</span>
            <div className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
              <button onClick={() => setLayoutMode('grid')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'grid' ? 'bg-white text-violet-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}>
                <LayoutGrid size={15} />
              </button>
              <button onClick={() => setLayoutMode('list')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'list' ? 'bg-white text-violet-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}>
                <List size={15} />
              </button>
            </div>
          </div>

          {/* Table / Grid Data Render */}
          {(!stats?.tableData || stats.tableData.length === 0) ? (
            <div className="bg-white rounded-3xl p-16 flex flex-col justify-center items-center border border-gray-100 shadow-sm flex-shrink-0 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-gray-100">
                <FlaskConical size={40} className="text-gray-300" />
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">لا يوجد سجلات مخبرية</h3>
              <p className="text-gray-500 font-bold text-sm max-w-sm text-center">
                لم نتمكن من العثور على أي سجلات مخبرية للزيارات في هذه الفترة. حاول تغيير الفلتر الزمني.
              </p>
            </div>
          ) : layoutMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-shrink-0 animate-in fade-in duration-500">
              {paginatedData.map(row => (
                <div key={row.visit_id || row.visit_number} onClick={() => setSelectedVisitId(row.visit_id)}
                  className="bg-white border border-slate-200 hover:border-violet-300 rounded-[1.5rem] p-5 shadow-sm hover:shadow-md hover:shadow-violet-900/5 cursor-pointer transition-all duration-300 flex flex-col justify-between gap-5 group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 flex items-center justify-center font-black text-xl border border-violet-100 flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                          {row.patient_name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-[15px] text-slate-800 line-clamp-1 group-hover:text-violet-700 transition-colors">{row.patient_name}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {row.visit_number}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2.5 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5"><Activity size={14}/> إجمالي الفحوصات</span>
                        <span className="font-black text-slate-700">{row.total_tests}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5"><Clock size={14}/> آخر تحديث</span>
                        <span className="font-bold text-slate-700" dir="ltr">{new Date(row.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-violet-600 transition-colors flex items-center gap-1.5">
                      <Eye size={14} /> عرض التقرير
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col flex-shrink-0">
              <div className="px-5 py-4 border-b bg-gray-50/50 flex items-center gap-2">
                <FlaskConical size={18} className="text-gray-400" />
                <h4 className="font-black text-gray-700 text-sm">سجل المرضى والفحوصات المخبرية</h4>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-50 text-gray-500 border-b border-gray-150 text-xs font-bold">
                    <tr>
                      <th className="px-5 py-3">المعرف (الرقم المرجعي)</th>
                      <th className="px-5 py-3">اسم المريض</th>
                      <th className="px-5 py-3">إجمالي الفحوصات</th>
                      <th className="px-5 py-3">آخر تحديث للنتائج</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((row) => (
                      <tr 
                        key={row.visit_id || row.visit_number}
                        onClick={() => setSelectedVisitId(row.visit_id)}
                        className="border-b border-gray-50 hover:bg-violet-50/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-4 font-black text-gray-500 text-xs bg-gray-50/50">{row.visit_number}</td>
                        <td className="px-5 py-4 font-extrabold text-gray-800">{row.patient_name}</td>
                        <td className="px-5 py-4 font-black text-gray-700">
                          {row.total_tests} <span className="text-gray-400 font-bold text-[10px]">فحوصات</span>
                        </td>
                        <td className="px-5 py-4 font-bold text-gray-500 text-xs" dir="ltr">
                          {new Date(row.date).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-violet-100 group-hover:text-violet-600 transition-colors">
                            <Eye size={16} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-xs font-bold text-gray-500 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex-shrink-0 mt-4">
              <span>صفحة {page} من {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl disabled:opacity-40 transition-colors"><ChevronRight size={16}/></button>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="p-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl disabled:opacity-40 transition-colors"><ChevronLeft size={16}/></button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedVisitId && (
        <LabRecordDetailModal
          visitId={selectedVisitId}
          token={token}
          onClose={() => setSelectedVisitId(null)}
        />
      )}
    </div>
  );
};

export default LabRequests;

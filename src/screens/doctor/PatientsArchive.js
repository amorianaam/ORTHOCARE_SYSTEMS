import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import SearchInput from '../../components/common/SearchInput';
import PatientExaminationCard from '../../components/common/PatientExaminationCard';
import PatientEMRModal from '../../components/common/PatientEMRModal';
import {
  Search, RefreshCcw, LayoutGrid, List,
  History, ChevronRight, ChevronLeft, Crown,
  Clock
} from 'lucide-react';
import { toast } from 'react-toastify';
import Fuse from 'fuse.js';
import axios from 'axios';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';
import { useLocation } from 'react-router-dom';

const PAGE_SIZE = 12;

export default function PatientsArchive() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };

  // Core Data
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const latestPatientEvent = useSocketStore(state => state.latestPatientEvent);
  const lastFetchRef = useRef(0);
  const location = useLocation();

  // Search & Filters
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [layoutMode, setLayoutMode] = usePersistentState('global_layout_preference', 'grid'); // 'grid' | 'list'
  const [page, setPage] = useState(1);

  // Selected EMR Patient View
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [loadingPrescription, setLoadingPrescription] = useState(false);


  // ─── Fetch All Patients ──────────────────────────────────────────
  const fetchPatients = useCallback(async (silent = false) => {
    if (!silent && patients.length === 0) setLoading(true);
    try {
      const res = await axios.get('/api/patients', { headers });
      setPatients(Array.isArray(res.data) ? res.data : []);
      lastFetchRef.current = Date.now();
    } catch {
      if (!silent) toast.error('فشل تحميل أرشيف المرضى');
    } finally {
      if (!silent || loading) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    if (latestPatientEvent?.timestamp && latestPatientEvent.timestamp > lastFetchRef.current) {
      fetchPatients(true);
    }
  }, [latestPatientEvent]);

  useEffect(() => {
    if (location.state?.autoOpenPatientId && patients.length > 0) {
      const patientToOpen = patients.find(p => p.id === location.state.autoOpenPatientId);
      if (patientToOpen) {
        setSelectedPatient(patientToOpen);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, patients]);

  // ─── Advanced Search & Temporal Filtering ──────────────────────────
  const filteredPatients = useMemo(() => {
    let result = patients;

    // 1. Search filter
    if (query.trim()) {
      const fuse = new Fuse(patients, {
        keys: ['full_name', 'phone'],
        threshold: 0.35
      });
      result = fuse.search(query).map(r => r.item);
    }

    // 2. Temporal/Date filters
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilter === 'today') {
      result = result.filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= startOfDay;
      });
    } else if (dateFilter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= oneWeekAgo;
      });
    } else if (dateFilter === 'month') {
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      result = result.filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= oneMonthAgo;
      });
    } else if (dateFilter === 'custom' && customRange.start && customRange.end) {
      const start = new Date(customRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter(p => {
        const pDate = new Date(p.created_at);
        return pDate >= start && pDate <= end;
      });
    }

    return result;
  }, [patients, query, dateFilter, customRange]);

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / PAGE_SIZE);
  const paginatedPatients = useMemo(() => {
    return filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredPatients, page]);

  // Reset all filters
  const handleResetFilters = () => {
    setQuery('');
    setDateFilter('all');
    setCustomRange({ start: '', end: '' });
    setPage(1);
    toast.info('تم إعادة تعيين فلاتر البحث لليوم الحالي');
  };

  // ─── Historic EMR Loading ─────────────────────────────────────────
  const handleOpenEMR = async (patient) => {
    setSelectedPatient(patient);
    setPatientHistory([]);
    setSelectedVisit(null);
    setPrescriptionItems([]);

    try {
      setHistoryLoading(true);
      const res = await axios.get(`/api/doctor/patient/${patient.id}/history`, { headers });
      const visits = Array.isArray(res.data) ? res.data : [];
      setPatientHistory(visits);
      
      // Auto-select the latest visit if any exists
      if (visits.length > 0) {
        handleSelectVisit(visits[0]);
      }
    } catch {
      toast.error('فشل تحميل السجل التاريخي للمريض');
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshPatientHistory = async () => {
    if (!selectedPatient) return;
    try {
      const res = await axios.get(`/api/doctor/patient/${selectedPatient.id}/history`, { headers });
      const visits = Array.isArray(res.data) ? res.data : [];
      setPatientHistory(visits);
      if (selectedVisit) {
        const updatedVisit = visits.find(v => v.id === selectedVisit.id);
        if (updatedVisit) setSelectedVisit(updatedVisit);
      }
    } catch {
      console.error('فشل التحديث الصامت للسجل التاريخي');
    }
  };

  const handleSelectVisit = async (visit) => {
    setSelectedVisit(visit);
    setPrescriptionItems([]);
    setLoadingPrescription(true);

    try {
      const prescRes = await axios.get(`/api/doctor/visit/${visit.id}/prescription`, { headers });
      if (prescRes.data && prescRes.data.items) {
        setPrescriptionItems(prescRes.data.items);
      }
    } catch {
      setPrescriptionItems([]);
    } finally {
      setLoadingPrescription(false);
    }
  };

  const handlePrintPrescription = () => {
    if (!selectedVisit) return;
    const printContent = document.getElementById('print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة الوصفة الطبية</title>
          <style>
            body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 40px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .patient-info { display: grid; grid-cols: 2; gap: 15px; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
            .rx-title { font-size: 20px; font-weight: bold; color: #1e3a8a; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; }
            .item { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #eee; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">أرشيف المرضى والزيارات السابقة</h1>
            <p className="text-xs text-gray-400 mt-1 font-semibold">البحث في السجلات الطبية التاريخية والاطلاع عليها بوضع القراءة فقط الصارم</p>
          </div>
        </div>
        <button onClick={fetchPatients} disabled={loading} className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl font-bold transition-all flex items-center gap-2 text-xs">
          <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} /> تحديث
        </button>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search bar */}
          <SearchInput
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            placeholder="ابحث بالاسم الرباعي أو رقم الهاتف..."
            className="md:col-span-6"
          />

{/* Layout Toggle & Temporal filter tabs */}
          <div className="md:col-span-6 flex flex-col md:flex-row justify-end items-center gap-3">
            <div className="flex gap-1.5 bg-gray-100 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500 w-full md:w-auto overflow-x-auto">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'today', label: 'اليوم' },
                { id: 'week', label: 'هذا الأسبوع' },
                { id: 'month', label: 'هذا الشهر' },
                { id: 'custom', label: 'تاريخ مخصص' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { setDateFilter(f.id); setPage(1); }}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                    dateFilter === f.id ? 'bg-white text-slate-800 shadow-xs' : 'hover:bg-white/40'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl flex-shrink-0">
              <button onClick={() => setLayoutMode('grid')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-400'}`}>
                <LayoutGrid size={15} />
              </button>
              <button onClick={() => setLayoutMode('list')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-gray-400'}`}>
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {dateFilter === 'custom' && (
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-wrap gap-4 items-center animate-fade-in">
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
              onClick={handleResetFilters}
              className="px-4 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold mr-auto"
            >
              إعادة تعيين
            </button>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-xs font-semibold text-gray-500">
          <span>تم العثور على {filteredPatients.length} مريض</span>
        </div>
      </div>

      {/* Grid or List of Patients */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 h-80 flex flex-col justify-center items-center">
          <Search size={40} className="text-gray-300 mb-3 animate-pulse" />
          <p className="font-extrabold text-gray-700 text-sm">لا توجد سجلات مطابقة</p>
          <p className="text-xs text-gray-400 mt-1">تأكد من كتابة الاسم بشكل صحيح أو تصفية التواريخ بدقة.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {layoutMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedPatients.map(p => (
                <PatientExaminationCard
                  key={p.id}
                  patient={p}
                  onClick={() => handleOpenEMR(p)}
                  isVIP={Boolean(p.is_exempt || p.latest_visit?.is_exempt)}
                  isFollowUp={Boolean(p.is_follow_up || p.latest_visit?.is_follow_up)}
                  actionText="عرض الملف"
                  showDate={true}
                  dateLabel="آخر زيارة:"
                  dateValue={new Date(p.last_visit_date || p.created_at).toLocaleDateString('ar')}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 font-black text-gray-600">رقم الملف</th>
                    <th className="px-6 py-4 font-black text-gray-600">المريض</th>
                    <th className="px-6 py-4 font-black text-gray-600">الجنس / العمر</th>
                    <th className="px-6 py-4 font-black text-gray-600">آخر زيارة</th>
                    <th className="px-6 py-4 font-black text-gray-600 w-28">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedPatients.map(p => {
                    const isVIP = Boolean(p.is_exempt || p.latest_visit?.is_exempt);
                    const isFollowUp = Boolean(p.is_follow_up || p.latest_visit?.is_follow_up);
                    const dateStr = new Date(p.last_visit_date || p.created_at).toLocaleDateString('ar');
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleOpenEMR(p)}
                        className="hover:bg-indigo-50/20 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 text-xs font-black text-indigo-700 w-24">
                          <div className="bg-indigo-50 border border-indigo-100 rounded-lg py-1.5 px-3 text-center inline-block">
                            {p.id || p.patient_id}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-800">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{p.full_name}</span>
                            {isFollowUp && (
                              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded-md flex-shrink-0">
                                مراجعة
                              </span>
                            )}
                            {isVIP && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md flex-shrink-0">
                                <Crown size={10} /> إعفاء
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-500">
                          {p.gender === "male" ? "ذكر" : "أنثى"} · {p.age ? `${p.age} سنة` : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-100 flex items-center gap-1 w-max">
                            <Clock size={12} /> {dateStr}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            className="px-3.5 py-1.5 font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                          >
                            <History size={12} />
                            استعراض
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-xs font-bold text-gray-500 bg-gray-50/50 p-4 rounded-2xl border">
              <span>صفحة {page} من {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors" title="السابق">
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="p-2 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 transition-colors" title="التالي">
                  <ChevronLeft size={18} className="text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── HISTORIC READ-ONLY EMR MODAL ─── */}
      <PatientEMRModal
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        patient={selectedPatient}
        visit={selectedVisit || selectedPatient}
        readOnly={true}
        isArchiveScreen={true}
        historyLoading={historyLoading}
        patientHistory={patientHistory}
        selectedVisit={selectedVisit}
        onSelectVisit={handleSelectVisit}
        onRefresh={refreshPatientHistory}
        prescriptionItems={prescriptionItems}
        loadingPrescription={loadingPrescription}
        onPrintPrescription={handlePrintPrescription}
      />
    </div>
  );
}

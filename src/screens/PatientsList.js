import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { usePersistentState } from '../hooks/usePersistentState';
import SearchInput from '../components/common/SearchInput';
import { useLocation, useNavigate } from 'react-router-dom';
import EditPatientModal from '../components/secretary/EditPatientModal';
import {
  Search, Calendar, RefreshCcw, LayoutGrid, List,
  History, User, Phone, ChevronRight,
  Pencil, SendHorizontal, ChevronLeft, Crown, FileText, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import Fuse from 'fuse.js';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import HistoricEMRModal from '../components/HistoricEMRModal';
import useSocketStore from '../store/useSocketStore';

const PAGE_SIZE = 12;

export default function PatientsList() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };
  const location = useLocation();
  const navigate = useNavigate();

  // Core Data
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [query, setQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [layoutMode, setLayoutMode] = usePersistentState('global_layout_preference', 'grid'); // 'grid' | 'list'
  const [page, setPage] = useState(1);
  const [reviewModal, setReviewModal] = useState({ isOpen: false, patient: null, mode: '' });

  // Selected Patient (opens HistoricEMRModal)
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Actions
  const [editPatient, setEditPatient] = useState(null);
  const [sendingReview, setSendingReview] = useState(null);

  // ─── Deep Hydration State ────────────────────────────────────────
  const latestPatientEvent = useSocketStore(s => s.latestPatientEvent);
  const latestSilentUpdate = useSocketStore(s => s.latestSilentUpdate);
  const lastFetchRef = useRef(0);

  // ─── Fetch All Patients ──────────────────────────────────────────
  const fetchPatients = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const res = await axios.get('/api/patients', { headers });
      setPatients(Array.isArray(res.data) ? res.data : []);
      lastFetchRef.current = Date.now();
    } catch {
      if (!isPolling) toast.error('فشل تحميل أرشيف المرضى');
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [token]);

  // Initial Load
  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // Deep Hydration (Socket Integration)
  useEffect(() => {
    const evTime = latestPatientEvent?.timestamp || 0;
    const silentTime = latestSilentUpdate?.timestamp || 0;
    const maxTime = Math.max(evTime, silentTime);

    if (maxTime > lastFetchRef.current) {
      fetchPatients(true);
    }
  }, [latestPatientEvent?.timestamp, latestSilentUpdate?.timestamp, fetchPatients]);

  useEffect(() => {
    if (location.state?.openPatientId && patients.length > 0 && !selectedPatient) {
      const p = patients.find(x => x.id === location.state.openPatientId);
      if (p) {
        handleOpenEMR(p);
      }
      // Clear state so it doesn't reopen if the user refreshes
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, patients, selectedPatient, navigate, location.pathname]);

  // ─── Advanced Search & Temporal Filtering ──────────────────────────
  const filteredPatients = useMemo(() => {
    let result = patients;

    if (query.trim()) {
      const fuse = new Fuse(patients, {
        keys: ['full_name', 'phone'],
        threshold: 0.35
      });
      result = fuse.search(query).map(r => r.item);
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilter === 'today') {
      result = result.filter(p => {
        const pDate = new Date(p.last_visit_date || p.created_at);
        return pDate >= startOfDay;
      });
    } else if (dateFilter === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      result = result.filter(p => {
        const pDate = new Date(p.last_visit_date || p.created_at);
        return pDate >= oneWeekAgo;
      });
    } else if (dateFilter === 'month') {
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      result = result.filter(p => {
        const pDate = new Date(p.last_visit_date || p.created_at);
        return pDate >= oneMonthAgo;
      });
    } else if (dateFilter === 'custom' && customRange.start && customRange.end) {
      const start = new Date(customRange.start);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      result = result.filter(p => {
        const pDate = new Date(p.last_visit_date || p.created_at);
        return pDate >= start && pDate <= end;
      });
    }

    return result;
  }, [patients, query, dateFilter, customRange]);

  const totalPages = Math.ceil(filteredPatients.length / PAGE_SIZE);
  const paginatedPatients = useMemo(() => {
    return filteredPatients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredPatients, page]);

  const handleResetFilters = () => {
    setQuery('');
    setDateFilter('all');
    setCustomRange({ start: '', end: '' });
    setPage(1);
    toast.info('تم إعادة تعيين فلاتر البحث');
  };

  const handleSendReview = (e, patient) => {
    if (e?.stopPropagation) e.stopPropagation();
    
    const todayVisitsCount = patient.today_visits_count || 0;
    if (todayVisitsCount > 0) {
      toast.warning('المريض مسجل بالفعل في قائمة زيارات اليوم.');
      return;
    }

    const followUpCount = patient.reviews_count || 0;
    const diffDays = Math.floor((new Date() - new Date(patient.created_at)) / (1000 * 60 * 60 * 24));
    
    const reasons = [];
    if (diffDays > 7) reasons.push(`تجاوز مدة المراجعة المجانية (7 أيام) - حيث مرت ${diffDays} يوم/أيام`);
    if (followUpCount >= 2) reasons.push('استنفذ عدد المراجعات المجانية المسموحة (مراجعتين)');

    if (reasons.length === 0) {
      setReviewModal({ isOpen: true, patient, mode: 'confirm' });
    } else {
      setReviewModal({ isOpen: true, patient, mode: 'reject', reasons });
    }
  };

  const executeSendReview = async () => {
    const patient = reviewModal.patient;
    if (!patient) return;
    setReviewModal({ isOpen: false, patient: null, mode: '' });
    setSendingReview(patient.id);
    try {
      const res = await fetch('/api/patients/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patientId: patient.id }),
      });
      const data = await res.json();
      if (res.ok) toast.success(`تم إرسال ${patient.full_name || 'المريض'} إلى قائمة الانتظار`);
      else toast.error(data.message || 'حدث خطأ');
    } catch { toast.error('تعذر الاتصال'); }
    finally { setSendingReview(null); }
  };

  const handleEditPatient = (e, patient) => {
    e.stopPropagation();
    setEditPatient(patient);
  };

  // ─── Open Historic EMR Modal ─────────────────────────────────────
  const handleOpenEMR = (patient) => setSelectedPatient(patient);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-800 p-6 rounded-3xl shadow-xl text-white border border-teal-600">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-lg text-teal-100">
              <History size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white">أرشيف المرضى</h1>
              <p className="text-teal-100/70 text-xs mt-1">البحث السريع والتعديل وإدارة السجلات الطبية السابقة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <SearchInput
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            placeholder="ابحث بالاسم الرباعي أو رقم الهاتف..."
            className="md:col-span-6"
          />

          <div className="md:col-span-6 flex gap-1.5 bg-gray-50 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500 border border-gray-100">
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
                className={`px-3 py-1.5 rounded-xl transition-all ${
                  dateFilter === f.id ? 'bg-white text-teal-800 shadow-xs ring-1 ring-gray-100' : 'hover:bg-gray-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 flex flex-wrap gap-4 items-center animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-700">من:</span>
              <input type="date" value={customRange.start} onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                className="px-3 py-1.5 bg-white border border-teal-200 rounded-xl text-xs font-bold outline-none text-gray-700" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-700">إلى:</span>
              <input type="date" value={customRange.end} onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                className="px-3 py-1.5 bg-white border border-teal-200 rounded-xl text-xs font-bold outline-none text-gray-700" />
            </div>
            <button onClick={handleResetFilters} className="px-4 py-1.5 text-xs bg-white text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl font-bold mr-auto border border-gray-200 transition-colors">
              إعادة تعيين
            </button>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-gray-50 text-xs font-semibold text-gray-500">
          <span>تم العثور على {filteredPatients.length} مريض مسجل</span>
          <div className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
            <button onClick={() => setLayoutMode('grid')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'grid' ? 'bg-white text-teal-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setLayoutMode('list')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'list' ? 'bg-white text-teal-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}>
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Patients View (Grid/List) */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
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
                <div key={p.id} onClick={() => handleOpenEMR(p)}
                  className="bg-white border border-gray-100 hover:border-teal-300 rounded-2xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 text-teal-600 flex items-center justify-center font-black text-lg border border-teal-100 flex-shrink-0">
                          {p.full_name?.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-gray-800 line-clamp-1">{p.full_name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              {p.gender === 'male' ? 'ذكر' : 'أنثى'}
                            </span>
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              {p.age ? `${p.age} سنة` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-[11px] font-black text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-lg">
                          #{p.id}
                        </span>
                        <div className="flex flex-col items-end gap-1">
                          {Boolean(p.is_exempt) && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-md flex-shrink-0">
                              <Crown size={9} />
                              إعفاء
                            </span>
                          )}
                          {Boolean(p.is_follow_up) && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-md flex-shrink-0">مراجعة</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 bg-gray-50 p-3 rounded-xl border border-gray-100/50">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Phone size={14} className="text-gray-400" />
                          رقم الهاتف
                        </div>
                        <span dir="ltr" className="text-gray-800 font-black">{p.phone || "—"}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                        <div className="flex items-center gap-1.5 text-gray-500">
                          <Calendar size={14} className="text-gray-400" />
                          آخر زيارة
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <span className="text-teal-700 bg-white border border-teal-100 px-2 py-0.5 rounded-md text-[10px] font-black">{new Date(p.last_visit_date || p.created_at).toLocaleDateString('ar')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={(e) => { e.stopPropagation(); handleEditPatient(e, p); }} className="p-2.5 bg-amber-50 border border-amber-100 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors" title="تعديل">
                      <Pencil size={15} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleSendReview(e, p); }} disabled={sendingReview === p.id} className="p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors font-bold flex items-center justify-center gap-2 disabled:opacity-50" title="تسجيل مراجعة مجانية">
                      {sendingReview === p.id ? <span className="animate-spin w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full inline-block" /> : <SendHorizontal size={15} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenEMR(p); }}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 text-gray-600 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-200 rounded-xl text-xs font-black transition-all shadow-sm"
                    >
                      <FileText size={15} />
                      فتح الملف الطبي
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-100 font-bold text-gray-500">
                  <tr>
                    <th className="p-4">المريض</th>
                    <th className="p-4">العمر والجنس</th>
                    <th className="p-4">رقم الهاتف</th>
                    <th className="p-4">تاريخ آخر زيارة</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.map((p, idx) => (
                    <tr key={p.id} onClick={() => handleOpenEMR(p)} className={`border-b border-gray-50 hover:bg-teal-50/30 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 text-teal-700 flex items-center justify-center font-black flex-shrink-0">
                            {p.full_name?.charAt(0)}
                          </div>
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="font-extrabold text-gray-800 text-sm">{p.full_name}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {Boolean(p.is_exempt) && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-lg">
                                  <Crown size={9} />
                                  إعفاء
                                </span>
                              )}
                              {Boolean(p.is_follow_up) && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-lg">مراجعة</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-gray-500">{p.age ? `${p.age} سنة` : '—'} · {p.gender === 'male' ? 'ذكر' : 'أنثى'}</td>
                      <td className="p-4 font-mono text-gray-500 font-bold">{p.phone || '—'}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-500 font-black text-xs">{new Date(p.last_visit_date || p.created_at).toLocaleDateString('ar')}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleEditPatient(e, p); }} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors" title="تعديل">
                            <Pencil size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleSendReview(e, p); }} disabled={sendingReview === p.id} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors disabled:opacity-50" title="تسجيل مراجعة مجانية">
                            <SendHorizontal size={16} className={sendingReview === p.id ? 'animate-pulse' : ''} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleOpenEMR(p); }} className="p-2 bg-teal-50 text-teal-600 hover:bg-teal-100 rounded-xl transition-colors" title="عرض الملف">
                            <FileText size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-xs font-bold text-gray-500 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <span>صفحة {page} من {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="p-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl disabled:opacity-40 transition-colors"><ChevronRight size={16}/></button>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="p-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 rounded-xl disabled:opacity-40 transition-colors"><ChevronLeft size={16}/></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal (Secretary specific) */}
      {editPatient && (
        <EditPatientModal patient={editPatient} token={token} onClose={() => setEditPatient(null)} onSaved={fetchPatients} />
      )}

      {/* ─── HISTORIC READ-ONLY EMR MODAL ─── */}
      {selectedPatient && !editPatient && (
        <HistoricEMRModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          token={token}
          hideFinancials={true}
          onEditPatient={() => setEditPatient(selectedPatient)}
          onSendReview={(e) => handleSendReview(e, selectedPatient)}
          sendingReview={sendingReview}
        />
      )}

      {/* Review Confirmation/Rejection Modal */}
      {reviewModal.isOpen && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
          <div className="bg-white rounded-3xl shadow-luxury overflow-hidden flex flex-col border border-gray-100 animate-scale-in transition-all duration-300 w-full max-w-md">
            <div className="p-6 text-center space-y-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${reviewModal.mode === 'confirm' ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                {reviewModal.mode === 'confirm' ? <SendHorizontal size={32} /> : <AlertCircle size={32} />}
              </div>
              <h3 className="font-extrabold text-lg text-gray-800">
                {reviewModal.mode === 'confirm' ? 'تأكيد تسجيل المراجعة' : 'لا يمكن تسجيل مراجعة'}
              </h3>
              <div className="text-gray-500 text-sm font-semibold leading-relaxed space-y-2">
                {reviewModal.mode === 'confirm' ? (
                  <p>هل أنت متأكد من تسجيل مراجعة للمريض <span className="text-emerald-600 font-black">{reviewModal.patient?.full_name}</span> وإرساله لطابور الطبيب؟</p>
                ) : (
                  <>
                    <p>عذراً، المريض <span className="text-red-500 font-black">{reviewModal.patient?.full_name}</span> لا يستوفي شروط المراجعة المجانية للأسباب التالية:</p>
                    <ul className="text-red-500 font-bold list-disc list-inside bg-red-50 p-3 rounded-xl inline-block text-right">
                      {reviewModal.reasons?.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                    <p>يرجى فتح زيارة جديدة.</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex gap-3 p-4 bg-gray-50/50 border-t border-gray-150">
              <button
                onClick={() => setReviewModal({ isOpen: false, patient: null, mode: '' })}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm transition-colors"
              >
                {reviewModal.mode === 'confirm' ? 'إلغاء' : 'إغلاق'}
              </button>
              {reviewModal.mode === 'confirm' && (
                <button
                  onClick={executeSendReview}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl text-sm shadow-md transition-colors"
                >
                  تأكيد وإرسال
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

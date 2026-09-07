import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User, Phone, Save, UserCheck, Users, FileText, Clock, LayoutGrid, List, AlertCircle, Eye } from 'lucide-react';
import { usePersistentState } from '../hooks/usePersistentState';
import HistoricEMRModal from '../components/HistoricEMRModal';
import { toast } from 'react-toastify';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import useSocketStore from '../store/useSocketStore';

// Timezone-safe date string enforcing Yemen Time (Asia/Aden, UTC+3)
const toLocalDateStr = (dateInput) => {
  const d = new Date(dateInput);
  // Convert the input to the exact local time in Yemen
  const yemenDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Aden' }));
  return `${yemenDate.getFullYear()}-${String(yemenDate.getMonth() + 1).padStart(2, '0')}-${String(yemenDate.getDate()).padStart(2, '0')}`;
};
const EMPTY_FORM = {
  fullName: '', age: '', gender: 'male', phone: '',
  entity: 'clinic',
};

const RegisterPatient = () => {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };
  
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [todayVisits, setTodayVisits] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(true);

  // Smart Matching Engine
  const [strictMatches, setStrictMatches] = useState([]);
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const debounceRef = useRef(null);
  const isAutoFillingRef = useRef(false);

  // EMR Modal State
  const [selectedPatientForModal, setSelectedPatientForModal] = useState(null);
  const [isEMRModalOpen, setIsEMRModalOpen] = useState(false);

  const searchMatches = useCallback((currentForm) => {
    clearTimeout(debounceRef.current);
    const query = currentForm.fullName?.trim() || '';
    if (query.length < 2) {
      setStrictMatches([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearchingMatch(true);
      try {
        const res = await axios.get(`/api/patients?q=${encodeURIComponent(query)}`, { headers });
        const all = Array.isArray(res.data) ? res.data : [];

        // CLIENT-SIDE TRI-FILTER: gender must match
        const filtered = all.filter(p => {
          const genderMatch = p.gender === currentForm.gender;
          // Phone match: only enforce if secretary typed >= 3 digits of phone
          const phoneQuery = (currentForm.phone || '').trim();
          const phoneMatch = phoneQuery.length < 3 || (p.phone || '').includes(phoneQuery);
          return genderMatch && phoneMatch;
        });

        setStrictMatches(filtered.slice(0, 5));
      } catch {
        setStrictMatches([]);
      } finally {
        setIsSearchingMatch(false);
      }
    }, 500);
  }, [headers]);

  // Clean up debounce on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  // Layout & Sorting
  const [layoutMode, setLayoutMode] = usePersistentState('global_layout_preference', 'list');
  const sortedVisits = useMemo(() => {
    const todayStr = toLocalDateStr(new Date());
    return [...todayVisits]
      .filter(v => toLocalDateStr(v.created_at) === todayStr)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [todayVisits]);

  const isAlreadyRegisteredToday = useMemo(() => {
    if (!selectedMatch) return false;
    return sortedVisits.some(v => v.patient_id === selectedMatch.id);
  }, [selectedMatch, sortedVisits]);

  // Deep Hydration: Listen for updates (cashier payments, lab completions)
  const latestSilentUpdate = useSocketStore(state => state.latestSilentUpdate);
  const lastFetchRef = useRef(0);

  const fetchTodayVisits = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingVisits(true);
      const res = await axios.get('/api/patients/visits/today', { headers });
      setTodayVisits(res.data);
      lastFetchRef.current = Date.now();
    } catch (err) {
      if (!silent) toast.error('تعذر مزامنة سجل زيارات اليوم');
    } finally {
      setLoadingVisits(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTodayVisits();
  }, [fetchTodayVisits]);

  useEffect(() => {
    if (latestSilentUpdate?.timestamp > lastFetchRef.current) {
      fetchTodayVisits(true);
    }
  }, [latestSilentUpdate?.timestamp, fetchTodayVisits]);

  const set = (field, val) => {
    setForm(p => {
      const newForm = { ...p, [field]: val };
      // Guard: skip search trigger during auto-fill from handleSelectMatch
      if (!isAutoFillingRef.current && (field === 'fullName' || field === 'phone' || field === 'gender')) {
        searchMatches(newForm);
        if (selectedMatch) setSelectedMatch(null);
      }
      return newForm;
    });
  };

  const handleChange = (e) => {
    set(e.target.name, e.target.value);
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setStrictMatches([]);
    setSelectedMatch(null);
    clearTimeout(debounceRef.current);
  };

  // Toggle selection: clicking same row deselects; clicking new row auto-fills form
  const handleSelectMatch = (row) => {
    // Toggle: if clicking the same row, deselect without wiping form
    if (selectedMatch?.id === row.id) {
      setSelectedMatch(null);
      return;
    }

    // Guard: suppress debounce trigger during auto-fill
    isAutoFillingRef.current = true;

    // Auto-fill form with exact database record values
    setForm(p => ({
      ...p,
      fullName: row.full_name,
      age: String(row.age || ''),
      gender: row.gender || 'male',
      phone: row.phone || '',
    }));
    setSelectedMatch(row);

    // Release guard after synchronous render cycle completes
    requestAnimationFrame(() => {
      isAutoFillingRef.current = false;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) return toast.error('يرجى إدخال اسم المريض');
    if (!form.age || isNaN(form.age) || form.age < 0 || form.age > 150)
      return toast.error('يرجى التحقق من صحة العمر المُدخل');

    setLoading(true);
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`تم فتح ملف طبي للمريض "${form.fullName || 'المريض'}" بنجاح — رقم الزيارة: ${data.visitNumber ?? 'جديد'}`);
        handleReset();
        fetchTodayVisits(true);
      } else {
        toast.error(data.message || 'فشلت عملية إنشاء الملف الطبي');
      }
    } catch {
      toast.error('فقدان الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  const handleNewVisit = async () => {
    if (!selectedMatch) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${selectedMatch.id}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entity: form.entity, visitType: 'paid_revisit' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`تم تسجيل زيارة للملف الطبي بنجاح "${selectedMatch.full_name}"`);
        handleReset();
        fetchTodayVisits(true);
      } else {
        toast.error(data.message || 'حدث خطأ أثناء تسجيل الزيارة');
      }
    } catch {
      toast.error('فقدان الاتصال بالخادم، يرجى المحاولة لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  const openEMRModal = (patient) => {
    setSelectedPatientForModal(patient);
    setIsEMRModalOpen(true);
  };
  const closeEMRModal = () => {
    setIsEMRModalOpen(false);
    setSelectedPatientForModal(null);
  };

  const renderPatientTable = ({ rows, onRowClick, onViewFile, selectedId, isMatch }) => {
    if (layoutMode === 'list') {
      return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-black text-gray-600">رقم الملف</th>
                <th className="px-6 py-4 font-black text-gray-600">المريض</th>
                <th className="px-6 py-4 font-black text-gray-600">الجنس / العمر</th>
                <th className="px-6 py-4 font-black text-gray-600">رقم الهاتف</th>
                <th className="px-6 py-4 font-black text-gray-600">{isMatch ? 'تاريخ آخر مراجعة' : 'وقت الدخول'}</th>
                {(isMatch || !!onViewFile) && <th className="px-6 py-4 font-black text-gray-600 text-left">الإجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(row => {
                const timeStr = isMatch 
                  ? (row.last_visit_date ? new Date(row.last_visit_date).toLocaleDateString("ar-LY") : "لا يوجد")
                  : new Date(row.created_at).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" });
                
                return (
                  <tr 
                    key={row.id} 
                    onClick={() => onRowClick?.(row)}
                    className={`transition-colors ${
                      onRowClick ? 'cursor-pointer hover:bg-teal-50/40' : 'hover:bg-teal-50/30'
                    } ${selectedId === row.id ? 'bg-teal-50 ring-1 ring-inset ring-teal-200' : ''}`}
                  >
                    <td className="px-6 py-4 text-xs font-bold text-teal-700">
                      #{isMatch ? row.id : (row.patient_id || row.id)}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800">
                      <div className="flex flex-col items-start gap-1">
                        <span>{row.full_name}</span>
                        <div className="flex flex-wrap gap-1">
                          {Boolean(row.is_follow_up) && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-lg">مراجعة</span>
                          )}
                          {Boolean(row.is_exempt) && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-lg">إعفاء VIP</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">
                      {row.gender === "male" ? "ذكر" : "أنثى"} · {row.age} سنة
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">
                      {row.phone || "—"}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">
                      <div className="flex items-center gap-1.5">
                        {!isMatch && <Clock size={12} className="text-gray-400" />} {timeStr}
                      </div>
                    </td>
                    {(isMatch || !!onViewFile) && (
                      <td className="px-6 py-4 text-left">
                        <div className="flex items-center gap-2 justify-end">
                          {/* Selection Circle (Radio-style toggle) */}
                          {isMatch && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onRowClick?.(row); }}
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                selectedId === row.id
                                  ? 'border-teal-500 bg-teal-500'
                                  : 'border-gray-300 bg-white hover:border-teal-400'
                              }`}
                              title={selectedId === row.id ? 'إلغاء التحديد' : 'تحديد السجل الطبي'}
                            >
                              {selectedId === row.id && (
                                <div className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </button>
                          )}

                          {/* View File (Eye icon) */}
                          {onViewFile && (
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                onViewFile({ ...row, id: row.patient_id || row.id }); 
                              }}
                              className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                              title="عرض السجل الطبي"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(row => {
          const timeStr = isMatch 
            ? (row.last_visit_date ? new Date(row.last_visit_date).toLocaleDateString("ar-LY") : "لا يوجد")
            : new Date(row.created_at).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" });

          return (
            <div
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={`bg-white border rounded-2xl p-4 shadow-sm transition-all flex flex-col justify-between gap-4 ${
                onRowClick ? 'cursor-pointer hover:border-teal-300' : 'border-gray-100 hover:shadow-md'
              } ${selectedId === row.id ? 'ring-2 ring-teal-400 border-teal-400 bg-teal-50/20' : ''}`}
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-50 to-teal-100 text-teal-600 flex items-center justify-center font-black text-lg border border-teal-100">
                      {row.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <h3 className="font-black text-sm text-gray-800">{row.full_name}</h3>
                        {Boolean(row.is_follow_up) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-lg">مراجعة</span>
                        )}
                        {Boolean(row.is_exempt) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-lg">إعفاء VIP</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          {row.gender === 'male' ? 'ذكر' : 'أنثى'}
                        </span>
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          {row.age} سنة
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Selection/ID Area */}
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[11px] font-black text-teal-700 bg-teal-50 border border-teal-100 px-2.5 py-1 rounded-lg">
                      #{isMatch ? row.id : (row.patient_id || row.id)}
                    </span>
                    {isMatch && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRowClick?.(row); }}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                          selectedId === row.id
                            ? 'border-teal-500 bg-teal-500'
                            : 'border-gray-300 bg-white hover:border-teal-400'
                        }`}
                        title={selectedId === row.id ? 'إلغاء التحديد' : 'تحديد السجل الطبي'}
                      >
                        {selectedId === row.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 bg-gray-50 p-3 rounded-xl border border-gray-100/50">
                  <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Phone size={14} className="text-gray-400" />
                      رقم الهاتف
                    </div>
                    <span dir="ltr" className="text-gray-800 font-black">{row.phone || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold text-gray-600">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Clock size={14} className="text-gray-400" />
                      {isMatch ? 'تاريخ المراجعة' : 'وقت الدخول'}
                    </div>
                    <span className="text-teal-700 bg-white border border-teal-100 px-2 py-0.5 rounded-md">{timeStr}</span>
                  </div>
                </div>
              </div>

              {/* Action Button at Bottom */}
              {onViewFile && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewFile({ ...row, id: row.patient_id || row.id });
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-gray-200 text-gray-600 hover:text-teal-700 hover:bg-teal-50 hover:border-teal-200 rounded-xl text-xs font-black transition-all shadow-sm"
                >
                  <FileText size={15} />
                  فتح الملف الطبي
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* EMR Modal (Z-index supreme) */}
      {isEMRModalOpen && selectedPatientForModal && (
        <HistoricEMRModal
          patient={selectedPatientForModal}
          onClose={closeEMRModal}
          token={token}
          hideFinancials={true}
        />
      )}

      {/* ── Page Header (Quick Stats) ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <UserCheck className="text-teal-500" />
            استقبال المرضى
            <span className="text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
              مريض جديد
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            يرجى تعبئة البيانات الشخصية لفتح ملف طبي جديد
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="bg-teal-50 border border-teal-100 px-4 py-2 rounded-xl text-center flex-1 md:flex-none">
            <span className="text-[10px] block font-black text-teal-600">التسجيلات المنجزة</span>
            <span className="text-xl font-black text-teal-700">{sortedVisits.filter(v => !v.is_follow_up && !v.is_exempt).length}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl text-center flex-1 md:flex-none">
            <span className="text-[10px] block font-black text-emerald-600">إجمالي المراجعات</span>
            <span className="text-xl font-black text-emerald-700">{sortedVisits.filter(v => v.is_follow_up).length}</span>
          </div>
        </div>
      </div>

      {/* ── Horizontal Registration Form ── */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-gray-50">
          <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-500">
            <User size={15} />
          </div>
          <h2 className="font-black text-sm text-gray-800">المعلومات الشخصية</h2>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Full Name */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">اسم المريض *</label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="الاسم الرباعي للمريض"
              className="input-base text-xs font-bold py-2.5"
              required
            />
          </div>
          
          {/* Age */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">العمر *</label>
            <input
              type="number"
              name="age"
              value={form.age}
              onChange={handleChange}
              placeholder="بالسنوات"
              min="0"
              max="150"
              className="input-base text-xs font-bold py-2.5"
              required
            />
          </div>

          {/* Gender */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">الجنس *</label>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => set('gender', 'male')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  form.gender === 'male' ? 'bg-white shadow text-teal-700' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                ذكر
              </button>
              <button
                type="button"
                onClick={() => set('gender', 'female')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  form.gender === 'female' ? 'bg-white shadow text-pink-700' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                أنثى
              </button>
            </div>
          </div>

          {/* Phone */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">رقم الهاتف <span className="text-gray-400 font-normal">(اختياري)</span></label>
            <div className="relative">
              <Phone size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="09xxxxxxxx"
                className="input-base pr-8 text-xs font-bold py-2.5"
              />
            </div>
          </div>

          {/* Entity */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">وجهة الإحالة *</label>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => set('entity', 'clinic')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  form.entity === 'clinic' ? 'bg-white shadow text-teal-700' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                العيادة
              </button>
              <button
                type="button"
                onClick={() => set('entity', 'center')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  form.entity === 'center' ? 'bg-white shadow text-teal-700' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                المركز
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="md:col-span-12 flex flex-col sm:flex-row justify-end items-center gap-3 mt-2 pt-4 border-t border-gray-50">

            {/* Button 2: Returning Patient — HIDDEN until selectedMatch is set */}
            {selectedMatch && (
              <button
                type="button"
                disabled={loading || isAlreadyRegisteredToday}
                onClick={handleNewVisit}
                className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border bg-white border-teal-200 text-teal-700 shadow-sm ${
                  isAlreadyRegisteredToday
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-teal-50'
                }`}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Users size={15} />
                )}
                تسجيل زيارة للملف المحدد
              </button>
            )}

            {/* Button 1: New Patient — Visually + functionally disabled when matches exist */}
            <button
              type="submit"
              disabled={loading || strictMatches.length > 0}
              className={`w-full sm:w-auto bg-teal-600 text-white font-black py-2.5 px-8 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-teal-100/50 ${
                strictMatches.length > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-teal-700'
              }`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={15} />
              )}
              {loading ? 'جاري إنشاء الملف...' : 'إنشاء ملف طبي'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Same-Day Duplicate Guard Warning ── */}
      {selectedMatch && isAlreadyRegisteredToday && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 shadow-sm">
          <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-black text-sm text-red-700">
              تنبيه: السجل مُدرج مسبقاً
            </p>
            <p className="text-xs font-semibold text-red-500 mt-0.5">
              المريض مسجل بالفعل في قائمة زيارات اليوم.
            </p>
          </div>
        </div>
      )}

      {/* ── Smart Match Results ── */}
      {(isSearchingMatch || strictMatches.length > 0) && (
        <div className="bg-amber-50/50 rounded-3xl p-5 shadow-sm border border-amber-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-amber-600" />
            <h3 className="font-black text-sm text-amber-800">
              {isSearchingMatch ? 'جاري البحث عن سجلات مطابقة...' : `تنبيه: يوجد تطابق في السجلات الطبية (${strictMatches.length} نتائج)`}
            </h3>
          </div>
          {isSearchingMatch ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            renderPatientTable({
              rows: strictMatches,
              onRowClick: handleSelectMatch,
              onViewFile: openEMRModal,
              selectedId: selectedMatch?.id,
              isMatch: true,
            })
          )}
        </div>
      )}

      {/* ── Recent Registrations Section ── */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-gray-50">
          <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-500">
            <Users size={15} />
          </div>
          <div>
            <h2 className="font-black text-sm text-gray-800">قائمة زيارات اليوم</h2>
          </div>
          <div className="mr-auto flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                layoutMode === 'grid' ? 'bg-white shadow text-teal-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setLayoutMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                layoutMode === 'list' ? 'bg-white shadow text-teal-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <List size={15} />
            </button>
          </div>
        </div>

        {loadingVisits ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : todayVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-gray-300 mb-4 shadow-sm">
              <FileText size={32} />
            </div>
            <p className="text-sm font-black text-gray-500">قائمة الانتظار فارغة</p>
            <p className="text-[11px] text-gray-400 mt-1 font-semibold">استخدم النموذج أعلاه لإضافة مريض جديد</p>
          </div>
        ) : (
          renderPatientTable({
            rows: sortedVisits,
            onRowClick: null,
            onViewFile: openEMRModal,
            selectedId: null,
            isMatch: false,
          })
        )}
      </div>

    </div>
  );
};

export default RegisterPatient;

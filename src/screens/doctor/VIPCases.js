import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePersistentState } from "../../hooks/usePersistentState";
import { useNavigate } from "react-router-dom";
import PatientQueueCard from "../../components/common/PatientQueueCard";
import {
  Plus,
  Crown,
  UserPlus,
  RefreshCcw,
  Users,
  ShieldCheck,
  LayoutGrid,
  List,
  Stethoscope,
  Grid,
  Eye,
  AlertCircle,
  Check
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import useAuthStore from "../../store/useAuthStore";
import useSocketStore from "../../store/useSocketStore";
import taffyot from "../../utils/taffyot";
import { createPortal } from "react-dom";

export default function VIPCases() {
  const { token } = useAuthStore();
  const lastFetchRef = useRef(0);
  const latestPatientEvent = useSocketStore(state => state.latestPatientEvent);
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  // Intake Form State
  const [formData, setFormData] = useState({
    fullName: "",
    age: "",
    gender: "male",
    phone: "",
  });
  const [submittingIntake, setSubmittingIntake] = useState(false);
  const [layoutMode, setLayoutMode] = usePersistentState('global_layout_preference', 'grid');
  const [duplicateAlert, setDuplicateAlert] = useState({ isOpen: false, message: '' });

  // Smart Matching Engine State
  const [strictMatches, setStrictMatches] = useState([]);
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const debounceRef = useRef(null);
  const isAutoFillingRef = useRef(false);

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

        const filtered = all.filter(p => {
          const genderMatch = p.gender === currentForm.gender;
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

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const setField = (field, val) => {
    setFormData(p => {
      const newForm = { ...p, [field]: val };
      if (!isAutoFillingRef.current && (field === 'fullName' || field === 'phone' || field === 'gender')) {
        searchMatches(newForm);
        if (selectedMatch) setSelectedMatch(null);
      }
      return newForm;
    });
  };

  // Active VIP Queue & Selected Active Patient
  const [vipQueue, setVipQueue] = useState([]);
    const [loadingQueue, setLoadingQueue] = useState(true);  // ─── Data Fetching ───────────────────────────────────────────────
  const fetchQueue = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingQueue(true);
      lastFetchRef.current = Date.now();
      const res = await axios.get("/api/doctor/queue", { headers });
      if (Array.isArray(res.data)) {
        // Filter only exempt/VIP cases for today that are not completed/cancelled
        const vips = res.data.filter(
          (v) =>
            v.is_exempt === 1 &&
            v.status !== "completed" &&
            v.status !== "cancelled",
        );
        setVipQueue(vips);
      }
    } catch {
      toast.error("فشل تحميل قائمة الحالات المعفاة");
    } finally {
      setLoadingQueue(false);
    }
  }, [token]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Real-time synchronization via Zustand
  useEffect(() => {
    if (latestPatientEvent?.timestamp > lastFetchRef.current) {
      fetchQueue(true); // silent fetch
    }
  }, [latestPatientEvent?.timestamp, fetchQueue]);

  const handleSelectMatch = (row) => {
    if (selectedMatch?.id === row.id) {
      setSelectedMatch(null);
      return;
    }
    isAutoFillingRef.current = true;
    setSelectedMatch(row);
    setFormData(prev => ({
      ...prev,
      fullName: row.full_name,
      phone: row.phone || '',
      gender: row.gender || 'male',
      age: row.age || prev.age
    }));
    setStrictMatches([]);
    setTimeout(() => { isAutoFillingRef.current = false; }, 100);
  };

  // ─── Intake Form Handler ─────────────────────────────────────────
  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName.trim()) return toast.warning("الاسم مطلوب");
    setSubmittingIntake(true);
    try {
      const payload = {
        ...formData,
        patientId: selectedMatch ? selectedMatch.id : undefined,
      };
      const res = await axios.post("/api/doctor/vip-intake", payload, {
        headers,
      });
      toast.success("تم تسجيل حالة الإعفاء المباشرة وبدء المعاينة");
      setFormData({ fullName: "", age: "", gender: "male", phone: "" });
      setSelectedMatch(null);
      setStrictMatches([]);
      fetchQueue();
      // Select the patient immediately
      if (res.data && res.data.visit) {
        handleSelectPatient(res.data.visit);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setDuplicateAlert({ isOpen: true, message: err.response?.data?.message || 'هذا المريض مسجل بالفعل في قائمة اليوم.' });
      } else {
        toast.error(err.response?.data?.message || "خطأ في حفظ الحالة");
      }
    } finally {
      setSubmittingIntake(false);
    }
  };

  const handleSelectPatient = (visit) => {
    navigate('/doctor/queue', { state: { autoOpenVisitId: visit.visitId } });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Page Header (Matches DoctorQueue but Amber Theme) ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Stethoscope className="text-amber-500" />
            الحالات المعفاة المباشرة
            <span className="text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
              <Crown size={10} /> إعفاء VIP
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            تسجيل الحالات المعفاة وإجراء المعاينة مباشرةً دون المرور بقسم المحاسبة.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl text-center">
            <span className="text-[10px] block font-black text-amber-600">حالات نشطة</span>
            <span className="text-xl font-black text-amber-700">{vipQueue.length}</span>
          </div>
        </div>
      </div>

      {/* ── Horizontal Intake Form ── */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-gray-50">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
            <UserPlus size={15} />
          </div>
          <h2 className="font-black text-sm text-gray-800">تسجيل حالة إعفاء جديدة</h2>
        </div>
        <form onSubmit={handleIntakeSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Full Name */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">الاسم الكامل *</label>
            <input
              type="text"
              placeholder="اسم المريض الرباعي..."
              value={formData.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              className="input-base text-xs font-bold py-2.5"
              required
            />
          </div>
          {/* Age */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">العمر *</label>
            <input
              type="number"
              placeholder="مثال: 35"
              min="0"
              max="120"
              value={formData.age}
              onChange={(e) => setField('age', e.target.value)}
              className="input-base text-xs font-bold py-2.5"
              required
            />
          </div>
          {/* Gender */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">الجنس</label>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setField('gender', 'male')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  formData.gender === 'male' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                ذكر
              </button>
              <button
                type="button"
                onClick={() => setField('gender', 'female')}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                  formData.gender === 'female' ? 'bg-white shadow text-pink-700' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                أنثى
              </button>
            </div>
          </div>
          {/* Phone */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 mb-1.5">رقم الهاتف</label>
            <input
              type="text"
              placeholder="09xxxxxxxx"
              value={formData.phone}
              onChange={(e) => setField('phone', e.target.value)}
              className="input-base text-xs font-bold py-2.5"
            />
          </div>
          {/* Submit */}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submittingIntake}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black py-2.5 rounded-xl text-xs transition-all shadow-md shadow-amber-100/50 flex items-center justify-center gap-2"
            >
              {submittingIntake ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus size={15} /> إضافة للحالة
                </>
              )}
            </button>
          </div>
        </form>
      </div>

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
            <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden shadow-sm">
              <table className="w-full text-right text-sm">
                <thead className="bg-amber-50/80 border-b border-amber-100">
                  <tr>
                    <th className="px-4 py-3 font-black text-amber-900 w-12 text-center">تحديد</th>
                    <th className="px-4 py-3 font-black text-amber-900">المريض</th>
                    <th className="px-4 py-3 font-black text-amber-900">الجنس / العمر</th>
                    <th className="px-4 py-3 font-black text-amber-900">رقم الهاتف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-50">
                  {strictMatches.map(row => {
                    const isSelected = selectedMatch?.id === row.id;
                    return (
                      <tr 
                        key={row.id}
                        onClick={() => handleSelectMatch(row)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-100/50' : 'hover:bg-amber-50/30'
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          <div className={`w-5 h-5 mx-auto rounded flex items-center justify-center border transition-colors ${
                            isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-amber-200 bg-white'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={4} />}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-800">
                          {row.full_name}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-gray-500">
                          {row.gender === 'male' ? 'ذكر' : 'أنثى'} · {row.age || '-'} سنة
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-gray-500">
                          <span dir="ltr">{row.phone || '-'}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Active Queue Section ── */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        {/* Section Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-50 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
              <Users size={15} />
            </div>
            <div>
              <h2 className="font-black text-sm text-gray-800">الحالات النشطة اليوم</h2>
            </div>
          </div>
          {/* View Toggles */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setLayoutMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${
                layoutMode === "grid" ? "bg-white text-blue-700 shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setLayoutMode("list")}
              className={`p-1.5 rounded-lg transition-all ${
                layoutMode === "list" ? "bg-white text-blue-700 shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        {loadingQueue ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : vipQueue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-gray-300 mb-4 shadow-sm">
              <ShieldCheck size={32} />
            </div>
            <p className="text-sm font-black text-gray-500">لا توجد حالات إعفاء معلقة</p>
            <p className="text-[11px] text-gray-400 mt-1 font-semibold">استخدم النموذج أعلاه لإضافة حالة جديدة</p>
          </div>
        ) : layoutMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {vipQueue.map((item) => (
              <PatientQueueCard
                key={item.visitId}
                visit={{ ...item, is_exempt: item.is_exempt ?? 1 }}
                onClick={() => handleSelectPatient(item)}
                colorTheme="amber"
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-black text-gray-600">المريض</th>
                  <th className="px-6 py-4 font-black text-gray-600">الجنس / العمر</th>
                  <th className="px-6 py-4 font-black text-gray-600">رقم الملف</th>
                  <th className="px-6 py-4 font-black text-gray-600">الحالة</th>
                  <th className="px-6 py-4 font-black text-gray-600 w-28">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {vipQueue.map(visit => {
                  const timeStr = new Date(visit.created_at).toLocaleTimeString("ar-LY", {
                    hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <tr
                      key={visit.visitId}
                      onClick={() => handleSelectPatient(visit)}
                      className="hover:bg-amber-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-gray-800">
                        <div className="flex items-center gap-2">
                          <span>{visit.full_name}</span>
                          <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-lg flex-shrink-0">
                            <Crown size={9} /> إعفاء
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-500">
                        {visit.gender === "male" ? "ذكر" : "أنثى"} · {visit.age} سنة
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-blue-700">
                        {visit.visit_number}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                          جاهز · {timeStr}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button className="px-3.5 py-1.5 font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 bg-amber-500 text-white hover:bg-amber-600">
                          <Stethoscope size={12} /> معاينة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── CUSTOM DUPLICATE ALERT MODAL ─── */}
      {duplicateAlert.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
          <div className="bg-white rounded-3xl shadow-luxury overflow-hidden flex flex-col border border-gray-100 animate-scale-in transition-all duration-300 w-full max-w-md">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertCircle size={32} />
              </div>
              <h3 className="font-extrabold text-lg text-gray-800">تنبيه تسجيل مكرر</h3>
              <p className="text-gray-500 text-sm font-semibold leading-relaxed">
                {duplicateAlert.message}
              </p>
            </div>
            <div className="flex gap-3 p-4 bg-gray-50/50 border-t border-gray-150">
              <button 
                onClick={() => setDuplicateAlert({ isOpen: false, message: '' })}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-sm shadow-md transition-colors"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

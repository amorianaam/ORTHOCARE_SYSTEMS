import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";

import {
  Users,
  Search,
  Filter,
  RefreshCcw,
  User,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
  Printer,

  ChevronLeft,

  X,
  FileText,
  FlaskConical,
  Maximize,
  Minimize,
  LayoutDashboard
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import useAuthStore from "../store/useAuthStore";
import useSocketStore from "../store/useSocketStore";
import { usePersistentState } from "../hooks/usePersistentState";
import HistoricEMRModal from "../components/HistoricEMRModal";

const getPatientLiveBadge = (v) => {
  const allRequests = [
    ...(v.labRequests || []).map((r) => ({ ...r, type: "lab" })),
    ...(v.radiologyRequests || []).map((r) => ({ ...r, type: "radiology" })),
    ...(v.clinicalRequests || []).map((r) => ({ ...r, type: "clinical" })),
  ];

  if (allRequests.some((r) => r.status === "pending_payment")) return "pending_payment";
  const activeExec = allRequests.filter((r) => r.type === "lab" || r.type === "radiology");
  if (activeExec.some((r) => r.status === "paid" || r.status === "in_progress")) return "in_progress";
  
  const hasLabOrRad = activeExec.length > 0;
  const allLabRadCompleted = activeExec.every((r) => r.status === "completed");
  
  if (hasLabOrRad && allLabRadCompleted) return "ready";
  if (allRequests.length > 0) return "tracking";
  return "normal";
};

const STATUS_CONFIG = {
  registered: { label: "تسجيل جديد", color: "bg-gray-100 text-gray-600", dot: "#9CA3AF" },
  pending_payment: { label: "قيد الدفع", color: "bg-amber-100 text-amber-700", dot: "#F59E0B" },
  awaiting_service_payment: { label: "دفع الخدمات", color: "bg-amber-100 text-amber-700", dot: "#F59E0B" },
  waiting: { label: "في قاعة الانتظار", color: "bg-sky-100 text-sky-700", dot: "#0EA5E9" },
  with_doctor: { label: "مع الطبيب", color: "bg-teal-100 text-teal-700", dot: "#2563EB" },
  awaiting_lab: { label: "في المختبر", color: "bg-purple-100 text-purple-700", dot: "#9333EA" },
  awaiting_radiology: { label: "في الأشعة", color: "bg-violet-100 text-violet-700", dot: "#7C3AED" },
  completed: { label: "مكتمل", color: "bg-emerald-100 text-emerald-700", dot: "#10B981" },
  cancelled: { label: "ملغي", color: "bg-red-100 text-red-700", dot: "#EF4444" },
  transferred_to_center: { label: "محول للعمليات", color: "bg-purple-100 text-purple-700", dot: "#9333EA" },
  post_surgery: { label: "ما بعد عملية", color: "bg-teal-100 text-teal-700", dot: "#4F46E5" },
};

const TABS = [
  { id: 'waiting', label: 'قاعة الانتظار', icon: Clock, color: 'text-sky-600', bg: 'bg-sky-100', activeBg: 'bg-sky-600' },
  { id: 'under_examination', label: 'قيد المعاينة', icon: Stethoscope, color: 'text-teal-600', bg: 'bg-teal-100', activeBg: 'bg-teal-600' },
  { id: 'active_investigations', label: 'فحوصات نشطة', icon: FlaskConical, color: 'text-purple-600', bg: 'bg-purple-100', activeBg: 'bg-purple-600' },
  { id: 'ready_results', label: 'نتائج جاهزة', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100', activeBg: 'bg-amber-600' },
  { id: 'examined', label: 'تمت المعاينة', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100', activeBg: 'bg-emerald-600' },
];

const PatientRow = React.memo(({ v, setSelectedVisit, setSelectedPatientForModal, displayMode = 'primary' }) => {
  const cfg = STATUS_CONFIG[v.status] || { label: "حالة غير معروفة", color: "bg-gray-100 text-gray-600", dot: "#9CA3AF" };
  const isReady = v.isReady || v.hasReadyResults;
  const isTask = displayMode === 'task';

  return (
    <div
      className={`bg-white p-4 rounded-2xl border transition-all shadow-sm flex flex-col md:flex-row md:items-center gap-4 ${
        isReady ? 'border-amber-300 shadow-amber-100' : 'border-gray-100 hover:border-teal-200'
      } ${isTask ? 'bg-slate-50/30 scale-[0.99] md:scale-[0.98] md:mx-2 border-dashed' : ''}`}
    >
      {/* Patient Identity */}
      <div className="flex items-center gap-4 flex-1">
        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center font-black text-lg ${
          isReady ? 'bg-amber-100 text-amber-700' : 'bg-teal-50 text-teal-700'
        }`}>
          {v.full_name?.charAt(0) || <User size={20} />}
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-base">{v.full_name || 'مريض غير معروف'}</h3>
          {isTask ? (
             <div className="flex items-center gap-2 mt-1.5 flex-wrap">
               {v.hasActiveInvestigations && <span className="text-[10px] font-black bg-purple-100 text-purple-700 px-2 py-0.5 rounded-lg border border-purple-200 flex items-center gap-1"><FlaskConical size={10} /> فحوصات معلقة</span>}
               {v.hasReadyResults && <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1"><AlertTriangle size={10} /> نتائج جاهزة</span>}
             </div>
          ) : (
            <div className="flex items-center gap-3 text-xs text-gray-500 font-medium mt-1">
              <span>{v.age ? `${v.age} سنة` : ''} • {v.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
              <span className="flex items-center gap-1"><Phone size={12}/> {v.phone || 'لا يوجد هاتف'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status & Badges */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {isReady && !isTask && (
          <span className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shadow-sm">
            <AlertTriangle size={14} /> مستعد للدخول
          </span>
        )}
        <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${cfg.color}`}>
          {cfg.label}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 flex-shrink-0 border-t md:border-t-0 md:border-r border-gray-100 pt-3 md:pt-0 md:pr-4 mt-1 md:mt-0">
        {v.prescription && !isTask && (
          <button
            onClick={() => setSelectedVisit(v)}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            <Printer size={14} /> طباعة الروشتة
          </button>
        )}
        <button 
          onClick={() => setSelectedPatientForModal({ id: v.patient_id, full_name: v.full_name, age: v.age, gender: v.gender })}
          className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            isTask ? 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-100' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
          }`}>
          {isTask ? 'متابعة المهام' : 'ملف المريض'} <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
});

export default function SecretaryDashboard() {
  const { token } = useAuthStore();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("waiting");

  
  // Modals
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedPatientForModal, setSelectedPatientForModal] = useState(null);
  const [isPrescriptionFullscreen, setIsPrescriptionFullscreen] = usePersistentState('secretary_prescription_fullscreen', false);
  
  const latestPatientEvent = useSocketStore(state => state.latestPatientEvent);
  const latestSilentUpdate = useSocketStore(state => state.latestSilentUpdate);
  const latestLabEvent = useSocketStore(state => state.latestLabEvent);
  const latestRadiologyEvent = useSocketStore(state => state.latestRadiologyEvent);
  const lastFetchRef = useRef(0);

  const fetchData = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      // Fetch today's queue
      const res = await axios.get("/api/doctor/queue", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const vData = Array.isArray(res.data) ? res.data : [];
      setVisits(vData);
      lastFetchRef.current = Date.now();
    } catch (err) {
      if (!isPolling) toast.error("فشل تحميل البيانات");
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Deep Hydration trigger (Optimistic State Mutation)
  useEffect(() => {
    if (!latestPatientEvent || latestPatientEvent.timestamp <= lastFetchRef.current) return;
    
    if (latestPatientEvent.visitId && latestPatientEvent.status) {
      // Optimistically update the specific visit in memory without triggering full refetch
      setVisits(prev => prev.map(v => 
        (v.visitId === latestPatientEvent.visitId || v.id === latestPatientEvent.visitId)
          ? { ...v, status: latestPatientEvent.status }
          : v
      ));
    } else {
      fetchData(true);
    }
  }, [latestPatientEvent?.timestamp, fetchData]);

  useEffect(() => {
    const maxTime = Math.max(
      latestSilentUpdate?.timestamp || 0,
      latestLabEvent?.timestamp || 0,
      latestRadiologyEvent?.timestamp || 0
    );
    if (maxTime > lastFetchRef.current) {
      fetchData(true);
    }
  }, [latestSilentUpdate?.timestamp, latestLabEvent?.timestamp, latestRadiologyEvent?.timestamp, fetchData]);

  // Filter and derive data (Phase 1: Hybrid Routing State Matrix)
  const processedVisits = useMemo(() => {
    return visits.map(v => {
      const labs = v.labRequests || [];
      const rads = v.radiologyRequests || [];
      const allServices = [...labs, ...rads];

      // Axis 2: Diagnostic States (Overlapping queues)
      const hasActiveInvestigations = allServices.some(r => 
        ['pending', 'pending_payment', 'paid', 'in_progress'].includes(r.status)
      );
      const hasReadyResults = allServices.some(r => r.status === 'completed');

      // Axis 1: Physical Location (Mutually Exclusive)
      let locationState = 'waiting';
      if (v.status === 'completed' || v.status === 'cancelled') {
        locationState = 'examined';
      } else if (v.status === 'with_doctor') {
        locationState = 'under_examination';
      } else {
        locationState = 'waiting';
      }

      return {
        ...v,
        locationState,
        hasActiveInvestigations,
        hasReadyResults,
        // For backwards compatibility in stats mapping
        isWaiting: locationState === 'waiting',
        isUnderExamination: locationState === 'under_examination',
        isExamined: locationState === 'examined'
      };
    });
  }, [visits]);

  const filtered = useMemo(() => {
    return processedVisits.filter(v => {
      const matchQuery = !query.trim() || 
        (v.full_name || '').toLowerCase().includes(query.toLowerCase()) || 
        (v.phone || '').includes(query);
        
      let matchFilter = false;
      if (activeFilter === "waiting") matchFilter = v.locationState === 'waiting';
      else if (activeFilter === "under_examination") matchFilter = v.locationState === 'under_examination';
      else if (activeFilter === "active_investigations") matchFilter = v.hasActiveInvestigations;
      else if (activeFilter === "ready_results") matchFilter = v.hasReadyResults;
      else if (activeFilter === "examined") matchFilter = v.locationState === 'examined';

      return matchQuery && matchFilter;
    });
  }, [processedVisits, query, activeFilter]);

  // Dashboard Stats
  const stats = useMemo(() => ({
    waiting: processedVisits.filter(v => v.locationState === 'waiting').length,
    underExamination: processedVisits.filter(v => v.locationState === 'under_examination').length,
    activeInvestigations: processedVisits.filter(v => v.hasActiveInvestigations).length,
    readyResults: processedVisits.filter(v => v.hasReadyResults).length,
    examined: processedVisits.filter(v => v.locationState === 'examined').length,
    total: processedVisits.length
  }), [processedVisits]);

  const handlePrintPrescription = () => {
    if (!selectedVisit) return;
    const printContent = document.getElementById('print-area').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة الروشتة</title>
          <style>
            body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 40px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .patient-info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
            .rx-title { font-size: 20px; font-weight: bold; color: #0284c7; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; }
            .item { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #eee; font-size: 18px; }
            .note { font-size: 14px; color: #666; margin-top: 5px; }
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
    <div className="p-6 min-h-full flex flex-col space-y-6" dir="rtl">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-lg">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">لوحة تحكم الاستقبال</h1>
            <p className="text-sm font-bold text-gray-500 mt-0.5">متابعة وإدارة تدفق المرضى بشكل لحظي</p>
          </div>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm text-sm font-bold text-gray-600 cursor-help" title="إجمالي عدد المرضى الفعليين في العيادة. الأرقام في التبويبات قد تتجاوز هذا العدد لأن المريض الواحد قد يتواجد في مسار المعاينة ومسار المهام (كالمختبر) معاً.">
          إجمالي المرضى: <span className="text-teal-700 font-black text-lg">{stats.total}</span>
        </div>
      </div>

      {/* ── Quick Stats Grid (Accountant-Style) ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
        {[
          { label: 'قاعة الانتظار', value: stats.waiting, icon: Clock, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-100' },
          { label: 'قيد المعاينة', value: stats.underExamination, icon: Stethoscope, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-100' },
          { label: 'فحوصات نشطة', value: stats.activeInvestigations, icon: FlaskConical, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
          { label: 'نتائج جاهزة', value: stats.readyResults, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'تمت المعاينة', value: stats.examined, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        ].map((s, i) => (
          <div key={i} className={`p-4 rounded-2xl border ${s.border} bg-white shadow-sm relative overflow-hidden flex flex-col justify-between`}>
            <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${s.bg} to-transparent opacity-50 rounded-bl-[100px] -z-10`} />
            <div className="flex justify-between items-start mb-2">
              <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon size={16} className={s.color} />
              </div>
            </div>
            <div>
              {loading ? (
                 <div className="h-6 bg-gray-200 rounded animate-pulse w-10 mb-1"></div>
              ) : (
                 <p className="text-xl font-black text-gray-800">{s.value.toLocaleString('ar')}</p>
              )}
              <p className="text-xs font-bold text-gray-500 mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs Menu ── */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex-shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map(tab => {
          let badgeVal = 0;
          if (tab.id === 'waiting') badgeVal = stats.waiting;
          if (tab.id === 'under_examination') badgeVal = stats.underExamination;
          if (tab.id === 'active_investigations') badgeVal = stats.activeInvestigations;
          if (tab.id === 'ready_results') badgeVal = stats.readyResults;
          if (tab.id === 'examined') badgeVal = stats.examined;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all whitespace-nowrap ${
                activeFilter === tab.id 
                  ? `${tab.activeBg} text-white shadow-md transform scale-[1.02]` 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeFilter === tab.id ? 'bg-white/20 text-white' : tab.bg + ' ' + tab.color}`}>
                <tab.icon size={14} />
              </div>
              {tab.label}
              {badgeVal > 0 && (
                <span className={`mr-1 px-2 py-0.5 rounded-full text-xs font-black ${
                  activeFilter === tab.id ? 'bg-white text-gray-800' : 'bg-red-500 text-white shadow-sm animate-pulse'
                }`}>
                  {badgeVal}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main Content Area ── */}
      <div className="bg-gray-50 rounded-3xl p-4 flex-1 flex flex-col min-h-0 border border-gray-100 shadow-inner">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative w-full md:w-96">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl pr-10 pl-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-sm"
              placeholder="ابحث بالاسم أو الهاتف..."
            />
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
          <div
            key={activeFilter}
            className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
          >
          {loading && visits.length === 0 ? (
            <div className="flex justify-center items-center h-full min-h-[200px]">
              <RefreshCcw size={32} className="animate-spin text-teal-500 opacity-50" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400 space-y-3">
              <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-2">
                <Users size={32} className="text-gray-300" />
              </div>
              <p className="font-bold text-lg">لا توجد سجلات مطابقة</p>
              <p className="text-sm">لم يتم العثور على مرضى في هذه القائمة.</p>
            </div>
          ) : (
            <>
              {filtered.map(v => (
                <PatientRow 
                  key={v.visitId} 
                  v={v} 
                  setSelectedVisit={setSelectedVisit} 
                  setSelectedPatientForModal={setSelectedPatientForModal} 
                  displayMode={['active_investigations', 'ready_results'].includes(activeFilter) ? 'task' : 'primary'}
                />
              ))}
            </>
          )}
          </div>
        </div>
      </div>

      {/* ── Prescription Modal ── */}
      {selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          <div className={`bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 animate-in zoom-in-95 duration-200 ${
            isPrescriptionFullscreen ? 'w-screen h-screen rounded-none' : 'w-full max-w-3xl max-h-[90vh] rounded-3xl'
          }`}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3 text-teal-700">
                <FileText size={24} />
                <h2 className="text-lg font-black">معاينة الروشتة الدوائية</h2>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsPrescriptionFullscreen(!isPrescriptionFullscreen)} className="p-2 bg-gray-200/50 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors">
                  {isPrescriptionFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
                <button onClick={() => setSelectedVisit(null)} className="p-2 bg-gray-200/50 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Invisible print area */}
              <div id="print-area" className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
                <div className="header">
                  <h2 className="title text-teal-700 font-black">عيادة المفاصل والعظام - ORTHOCARE</h2>
                  <p style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>هاتف: 09XXXXXXXX | العنوان: صنعاء - شارع الستين</p>
                </div>
                <div className="patient-info">
                  <div>
                    <p className="text-sm font-bold text-gray-500 mb-1">اسم المريض:</p>
                    <p className="font-black text-gray-900 text-lg">{selectedVisit.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-500 mb-1">تاريخ الزيارة:</p>
                    <p className="font-black text-gray-900 text-lg">{new Date(selectedVisit.created_at).toLocaleDateString('ar')}</p>
                  </div>
                </div>
                <div>
                  <h3 className="rx-title flex items-center gap-2"><span className="text-3xl font-serif mr-1">Rx</span> الوصفة الطبية</h3>
                  {selectedVisit.prescription ? (
                    <div className="space-y-4 mt-6">
                      {typeof selectedVisit.prescription === 'string' 
                        ? <div className="text-lg font-medium whitespace-pre-wrap leading-relaxed">{selectedVisit.prescription}</div>
                        : Array.isArray(selectedVisit.prescription) 
                          ? selectedVisit.prescription.map((rx, idx) => (
                              <div key={idx} className="item flex justify-between items-start">
                                <div>
                                  <div className="font-bold text-xl text-gray-900">{rx.medication_name}</div>
                                  <div className="note mt-1 text-gray-600 font-medium">{rx.dosage} - {rx.frequency}</div>
                                </div>
                                {rx.duration && <div className="text-sm font-bold bg-gray-100 px-3 py-1 rounded-lg text-gray-700">لمدة {rx.duration}</div>}
                              </div>
                            ))
                          : <div className="text-gray-500">تفاصيل الروشتة غير متوفرة بصيغة صحيحة.</div>
                      }
                    </div>
                  ) : (
                    <p className="text-gray-400 py-10 text-center font-bold">لم يتم تسجيل أدوية في هذه الزيارة</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3">
              <button onClick={() => setSelectedVisit(null)} className="btn-secondary px-6">إغلاق</button>
              <button onClick={handlePrintPrescription} className="btn-primary px-8 flex items-center gap-2 bg-teal-600 hover:bg-teal-700">
                <Printer size={18} /> طباعة الآن
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Historic EMR Modal ── */}
      {selectedPatientForModal && (
        <HistoricEMRModal 
          patient={selectedPatientForModal} 
          onClose={() => setSelectedPatientForModal(null)} 
          token={token} 
          hideFinancials={true}
        />
      )}
    </div>
  );
}

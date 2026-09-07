import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePersistentState } from "../hooks/usePersistentState";
import SearchInput from "../components/common/SearchInput";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Scissors,
  CheckCircle,
  Stethoscope,
  Grid,
  List,
  Eye,
  Layers,
  Crown
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import useAuthStore from "../store/useAuthStore";
import useSocketStore from "../store/useSocketStore";
import PatientQueueCard from "../components/common/PatientQueueCard";
import PatientEMRModal from "../components/common/PatientEMRModal";
import SmartOrderModal from "../components/common/SmartOrderModal";

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function DoctorQueue() {
  const { token } = useAuthStore();
  const lastFetchRef = useRef(0);
  const latestPatientEvent = useSocketStore(state => state.latestPatientEvent);
  const latestLabEvent = useSocketStore(state => state.latestLabEvent);
  const latestRadiologyEvent = useSocketStore(state => state.latestRadiologyEvent);
  const latestSilentUpdate = useSocketStore(state => state.latestSilentUpdate);
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const location = useLocation();
  const navigate = useNavigate();

  // ── Core queue state ───────────────────────────────────────────────────────
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspaceTab, setWorkspaceTab] = useState("waiting_list");
  const [layoutMode, setLayoutMode] = usePersistentState('global_layout_preference', "grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Catalogs & favorites (fed to SmartOrderModal) ─────────────────────────
  const [catalogs, setCatalogs] = useState({
    lab: [], radiology: [], clinical: [], prep: [], medications: [],
  });
  const [favoriteTests, setFavoriteTests] = useState([]);
  const [favoriteMeds, setFavoriteMeds] = useState([]);
  const [bundles, setBundles] = useState([]);

  // ── Patient EMR data (passed as props to PatientEMRModal) ─────────────────
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [prescriptionItems, setPrescriptionItems] = useState([]);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      const res = await axios.get("/api/doctor/queue", { headers });
      setQueue(Array.isArray(res.data) ? res.data : []);
      lastFetchRef.current = Date.now();
    } catch {
      toast.error("فشل تحميل قائمة الانتظار");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchCatalogs = useCallback(async () => {
    try {
      const [lab, rad, clin, prep, meds] = await Promise.all([
        axios.get("/api/catalog/lab", { headers }),
        axios.get("/api/catalog/radiology", { headers }),
        axios.get("/api/admin/catalog/clinical-services", { headers }),
        axios.get("/api/admin/catalog/surgery-prep", { headers }),
        axios.get("/api/admin/catalog/medications", { headers }),
      ]);
      setCatalogs({
        lab:       lab.data  || [],
        radiology: rad.data  || [],
        clinical:  clin.data || [],
        prep:      prep.data || [],
        medications: meds.data || [],
      });
    } catch {
      // Failed to load catalogs
    }
  }, [token]);

  const fetchFavorites = useCallback(async () => {
    try {
      const [testsRes, bundlesRes, medsRes] = await Promise.all([
        axios.get("/api/doctor/favorites/tests",   { headers }),
        axios.get("/api/doctor/favorites/bundles", { headers }),
        axios.get("/api/doctor/favorites/medications", { headers }),
      ]);
      setFavoriteTests(testsRes.data  || []);
      setBundles(bundlesRes.data || []);
      setFavoriteMeds(medsRes.data || []);
    } catch (err) {
      // Failed to load favorites
    }
  }, [headers]);

  useEffect(() => {
    fetchQueue();
    fetchCatalogs();
    if (token) fetchFavorites();
  }, [fetchQueue, fetchCatalogs, fetchFavorites, token]);

  // Zustand store live updates
  useEffect(() => {
    if (latestPatientEvent?.timestamp && latestPatientEvent.timestamp > lastFetchRef.current) {
      fetchQueue(true); // silent fetch
    }
  }, [latestPatientEvent, fetchQueue]);

  useEffect(() => {
    if (latestLabEvent?.timestamp && latestLabEvent.timestamp > lastFetchRef.current) {
      fetchQueue(true);
    }
  }, [latestLabEvent, fetchQueue]);

  useEffect(() => {
    if (latestRadiologyEvent?.timestamp && latestRadiologyEvent.timestamp > lastFetchRef.current) {
      fetchQueue(true);
    }
  }, [latestRadiologyEvent, fetchQueue]);

  useEffect(() => {
    if (latestSilentUpdate?.timestamp && latestSilentUpdate.timestamp > lastFetchRef.current) {
      fetchQueue(true);
    }
  }, [latestSilentUpdate, fetchQueue]);

  // ─────────────────────────────────────────────────────────────────────────
  // Patient Selection & EMR data loading
  // ─────────────────────────────────────────────────────────────────────────
  const handleSelectPatient = async (visit, isReadOnly = false) => {
    setActive({ ...visit, is_readonly: isReadOnly });
    setSelectedVisit(null);
    setPrescriptionItems([]);
    setPatientHistory([]);

    // Transition visit to "with_doctor" status
    const validStatuses = [
      "waiting", "awaiting_lab", "awaiting_radiology",
      "pending_payment", "awaiting_service_payment",
    ];
    if (!isReadOnly && validStatuses.includes(visit.status)) {
      try {
        await axios.put(`/api/doctor/visit/${visit.visitId}/start`, {}, { headers });
        setQueue(q =>
          q.map(v => v.visitId === visit.visitId ? { ...v, status: "with_doctor" } : v)
        );
      } catch { /* non-critical */ }
    }

    // Load patient history
    try {
      setHistoryLoading(true);
      const res = await axios.get(
        `/api/doctor/patient/${visit.patient_id}/history`, { headers }
      );
      const history = Array.isArray(res.data) ? res.data : [];
      setPatientHistory(history);
      // Auto-select the most recent visit as the displayed visit
      if (history.length > 0) setSelectedVisit(history[0]);
    } catch {
      setPatientHistory([]);
    } finally {
      setHistoryLoading(false);
    }

    // Load existing prescription for this visit
    try {
      const prescRes = await axios.get(
        `/api/doctor/visit/${visit.visitId}/prescription`, { headers }
      );
      if (prescRes.data?.items?.length > 0) {
        setPrescriptionItems(prescRes.data.items);
      }
    } catch { /* no prescription yet */ }
  };

  const refreshPatientHistory = async () => {
    if (!active) return;
    try {
      const res = await axios.get(
        `/api/doctor/patient/${active.patient_id}/history`, { headers }
      );
      const history = Array.isArray(res.data) ? res.data : [];
      setPatientHistory(history);
      if (selectedVisit) {
        const updatedVisit = history.find(v => v.id === selectedVisit.id);
        if (updatedVisit) setSelectedVisit(updatedVisit);
      }
    } catch {
      console.error('فشل التحديث الصامت للسجل التاريخي');
    }
  };

  // ── Smart Router Radar (Auto-open VIP Cases) ───────────────────────────────
  useEffect(() => {
    if (!loading && location.state?.autoOpenVisitId) {
      const targetVisit = queue.find(v => v.visitId === location.state.autoOpenVisitId);
      if (targetVisit) {
        handleSelectPatient(targetVisit);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [loading, location.state, queue, navigate, location.pathname]);


  // ─────────────────────────────────────────────────────────────────────────
  // Visit Actions
  // ─────────────────────────────────────────────────────────────────────────
  const handleCloseVisit = async () => {
    if (!active) return;
    setSubmitting(true);
    try {
      await axios.put(`/api/doctor/visit/${active.visitId}/close`, {}, { headers });
      toast.success("تم إغلاق الزيارة بنجاح");
      setActive(null);
      fetchQueue();
    } catch {
      toast.error("فشل إغلاق الزيارة");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReferSurgery = async () => {
    if (!active) return;
    setSubmitting(true);
    try {
      await axios.put(`/api/doctor/visit/${active.visitId}/refer-surgery`, {}, { headers });
      toast.success("تم إحالة المريض للعمليات");
      setActive(null);
      fetchQueue();
    } catch {
      toast.error("فشل الإحالة");
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel a single service order (lab / radiology / clinical)
  const handleCancelOrder = async (itemId, itemType) => {
    try {
      await axios.delete(`/api/doctor/order-service/${itemType}/${itemId}`, { headers });
      toast.success("تم إلغاء الطلب بنجاح");
      // Reload patient history to reflect the cancelled item
      if (active?.patient_id) {
        try {
          const res = await axios.get(
            `/api/doctor/patient/${active.patient_id}/history`, { headers }
          );
          const history = Array.isArray(res.data) ? res.data : [];
          setPatientHistory(history);
          // Re-select the same visit to refresh the table
          if (selectedVisit) {
            const refreshed = history.find(
              v => String(v.id) === String(selectedVisit.id)
            );
            if (refreshed) setSelectedVisit(refreshed);
          }
        } catch { /* non-critical */ }
      }
    } catch (err) {
      const msg = err?.response?.data?.message || "فشل إلغاء الطلب";
      toast.error(msg);
    }
  };

  const toggleFavoriteTest = async (item, svcType) => {
    const isFav = favoriteTests.some(
      f => f.test_id === item.id && f.test_type === svcType
    );
    try {
      if (isFav) {
        await axios.delete(
          `/api/doctor/favorites/tests/type/${svcType}/id/${item.id}`, { headers }
        );
      } else {
        await axios.post(
          "/api/doctor/favorites/tests",
          { testId: item.id, testType: svcType },
          { headers }
        );
      }
      const res = await axios.get("/api/doctor/favorites/tests", { headers });
      setFavoriteTests(res.data || []);
    } catch {
      toast.error("فشل تحديث المفضلة");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Live Badge Computation
  // ─────────────────────────────────────────────────────────────────────────
  const getPatientLiveBadge = useCallback((v) => {
    const all = [
      ...(v.labRequests       || []).map(r => ({ ...r, type: "lab" })),
      ...(v.radiologyRequests || []).map(r => ({ ...r, type: "radiology" })),
      ...(v.clinicalRequests  || []).map(r => ({ ...r, type: "clinical" })),
    ];

    if (all.some(r => r.status === "pending_payment")) {
      return { label: "بانتظار الدفع", color: "bg-rose-100 text-rose-700 border-rose-200" };
    }

    const exec = all.filter(r => r.type === "lab" || r.type === "radiology");
    if (exec.some(r => r.status === "paid" || r.status === "in_progress")) {
      return { label: "قيد التنفيذ", color: "bg-amber-100 text-amber-700 border-amber-200 animate-pulse" };
    }

    if (exec.length > 0 && exec.every(r => r.status === "completed")) {
      return { label: "النتائج جاهزة", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    }

    return { label: "متابعة خدمات", color: "bg-blue-100 text-blue-700 border-blue-200" };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Queue List Segmentation
  // ─────────────────────────────────────────────────────────────────────────
  const activeWaitingList = useMemo(() => queue.filter(v =>
    (v.status === "waiting" || v.status === "with_doctor" || v.status === "post_surgery") &&
    !v.labRequests?.length && !v.radiologyRequests?.length && !v.clinicalRequests?.length
  ), [queue]);

  const pendingTrackingList = useMemo(() => queue.filter(v =>
    v.status !== "completed" && v.status !== "cancelled" &&
    (v.labRequests?.length > 0 || v.radiologyRequests?.length > 0 || v.clinicalRequests?.length > 0)
  ), [queue]);

  const completedList = useMemo(() => queue.filter(v => v.status === "completed"), [queue]);

  const filteredPatients = useMemo(() => {
    const list =
      workspaceTab === "waiting_list"    ? activeWaitingList  :
      workspaceTab === "pending_tracking"? pendingTrackingList :
      completedList;
    if (!searchTerm) return list;
    const q = searchTerm.toLowerCase();
    return list.filter(v =>
      v.full_name?.toLowerCase().includes(q) ||
      v.visit_number?.toLowerCase().includes(q)
    );
  }, [workspaceTab, searchTerm, activeWaitingList, pendingTrackingList, completedList]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Stethoscope className="text-blue-600" />
            مساحة العمل السريرية اليومية
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            إدارة قائمة الانتظار، طلبات الخدمات، وتتبع نتائج الفحوصات والزيارات الجارية لحظياً.
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <SearchInput
            placeholder="بحث باسم المريض أو ملفه..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full md:w-56"
          />
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
      </div>

      {/* ── Workspace Tab Selector ───────────────────────────────────────── */}
      <div className="flex p-1 gap-2 bg-gray-50/50 rounded-2xl border border-gray-100 max-w-2xl">
        {[
          { id: "waiting_list",    label: "قائمة الانتظار",    count: activeWaitingList.length,   color: "bg-blue-100 text-blue-700",     activeBorder: "border-b-blue-600"   },
          { id: "pending_tracking",label: "متابعة الإجراءات",   count: pendingTrackingList.length, color: "bg-rose-100 text-rose-700",     activeBorder: "border-b-rose-600"   },
          { id: "completed_list",  label: "تمت المعاينة",       count: completedList.length,       color: "bg-emerald-100 text-emerald-700", activeBorder: "border-b-emerald-600" },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setWorkspaceTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black transition-all border-b-2 ${
              workspaceTab === tab.id
                ? `bg-white text-blue-700 shadow-sm border border-gray-100 ${tab.activeBorder}`
                : "text-gray-500 hover:bg-white/50 hover:text-gray-700 border-transparent"
            }`}
          >
            {tab.label}
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${tab.color}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Patient Cards / Table ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-100 shadow-sm">
          <Users className="mx-auto text-gray-300 mb-3" size={48} />
          <h3 className="text-base font-black text-gray-700">لا توجد نتائج تطابق بحثك</h3>
          <p className="text-gray-400 text-xs mt-1.5 font-semibold">
            تأكد من اختيار التبويب الصحيح أو تغيير معيار البحث.
          </p>
        </div>
      ) : layoutMode === "grid" ? (
        /* ── Grid Mode ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPatients.map(visit => (
            <PatientQueueCard
              key={visit.visitId}
              visit={visit}
              onClick={() => handleSelectPatient(visit, workspaceTab === "completed_list")}
              badge={workspaceTab !== "waiting_list" ? getPatientLiveBadge(visit) : null}
              colorTheme={
                workspaceTab === "waiting_list"     ? "blue"    :
                workspaceTab === "pending_tracking" ? "rose"    :
                "emerald"
              }
            />
          ))}
        </div>
      ) : (
        /* ── List Mode ── */
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
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
              {filteredPatients.map(visit => {
                const isReadOnly = workspaceTab === "completed_list";
                const badge      = workspaceTab !== "waiting_list" ? getPatientLiveBadge(visit) : null;
                const timeStr    = new Date(visit.created_at).toLocaleTimeString("ar-LY", {
                  hour: "2-digit", minute: "2-digit",
                });
                return (
                  <tr
                    key={visit.visitId}
                    onClick={() => handleSelectPatient(visit, isReadOnly)}
                    className="hover:bg-blue-50/20 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-gray-800">
                      <div className="flex items-center gap-2">
                        <span>{visit.full_name}</span>
                        {Boolean(visit.is_follow_up) && (
                          <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 inline-flex items-center text-[9px] font-black px-1.5 py-0.5 rounded-lg flex-shrink-0">
                            مراجعة
                          </span>
                        )}
                        {Boolean(visit.is_exempt) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded-lg flex-shrink-0">
                            <Crown size={9} /> إعفاء
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-500">
                      {visit.gender === "male" ? "ذكر" : "أنثى"} · {visit.age} سنة
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-blue-700">
                      {visit.visit_number}
                    </td>
                    <td className="px-6 py-4">
                      {badge ? (
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${badge.color}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                          جاهز · {timeStr}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className={`px-3.5 py-1.5 font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 ${
                          isReadOnly
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {isReadOnly ? <Eye size={12} /> : <Stethoscope size={12} />}
                        {isReadOnly ? "اطلاع" : "معاينة"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── PatientEMRModal ──────────────────────────────────────────────── */}
      {active && (
        <PatientEMRModal
          isOpen={!!active}
          onClose={() => { setActive(null); fetchQueue(); }}
          patient={active}
          readOnly={active.is_readonly}
          startMaximized={true}
          patientHistory={patientHistory}
          selectedVisit={selectedVisit}
          onSelectVisit={setSelectedVisit}
          onRefresh={refreshPatientHistory}
          prescriptionItems={prescriptionItems}
          onFinishVisit={active.is_readonly ? null : handleCloseVisit}
          onReferToSurgery={!active.is_readonly ? handleReferSurgery : undefined}
          onCancelOrder={!active.is_readonly ? handleCancelOrder : undefined}
          visit={active}
          favoriteMeds={favoriteMeds}
          catalogs={catalogs}
          onPrescriptionSave={() => fetchQueue()}
          renderActiveActions={
            !active.is_readonly
              ? () => (
                  <button
                    onClick={() => setIsOrderModalOpen(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm"
                  >
                    <Layers size={14} />
                    إضافة طلبات
                  </button>
                )
              : null
          }
        />
      )}

      {/* ── SmartOrderModal ──────────────────────────────────────────────── */}
      <SmartOrderModal
        isOpen={isOrderModalOpen}
        onClose={() => {
          setIsOrderModalOpen(false);
          // Refresh queue after orders submitted so pending_tracking updates
          if (active) fetchQueue();
        }}
        onOrderSuccess={() => refreshPatientHistory()}
        visit={active}
        catalogs={catalogs}
        favoriteTests={favoriteTests}
        bundles={bundles}
        onToggleFavorite={toggleFavoriteTest}
        token={token}
      />
    </div>
  );
}

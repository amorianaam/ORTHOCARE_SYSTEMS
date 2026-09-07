import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useSearchParams } from "react-router-dom";
import {
  FlaskConical,
  Search,
  RefreshCcw,
  ChevronLeft,
  CheckCircle,
  Clock,
  CheckSquare
} from "lucide-react";
import { toast } from "react-toastify";
import useAuthStore from "../../store/useAuthStore";
import useSocketStore from "../../store/useSocketStore";
import { LabPatientDetailPanel } from "../../components/lab/LabModals";

// ── Constants ─────────────
const TABS = [
  { id: 'pending', label: 'الطلبات الواردة', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', activeBg: 'bg-indigo-600' },
  { id: 'in_progress', label: 'قيد الإجراء', icon: FlaskConical, color: 'text-purple-600', bg: 'bg-purple-50', activeBg: 'bg-purple-600' },
  { id: 'completed', label: 'تحاليل منجزة', icon: CheckSquare, color: 'text-emerald-600', bg: 'bg-emerald-50', activeBg: 'bg-emerald-600' },
];

// ── Main Dashboard ─────────────
const LaboratoryDashboard = () => {
  const { token } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "pending";
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [dailyStats, setDailyStats] = useState({ totalRequests: 0, completed: 0, pending: 0 });
  const [tabCounters, setTabCounters] = useState({ pending: 0, in_progress: 0, completed: 0 });
  const latestLabEvent = useSocketStore(state => state.latestLabEvent);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchStats = useCallback(async (signal) => {
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const url = `/api/lab/stats?startDate=${today}&endDate=${today}`;
      const res = await fetch(url, { headers, signal });
      if (res.ok) {
        const data = await res.json();
        setDailyStats({
          totalRequests: data.summary?.total_requests || 0,
          completed: data.summary?.completed || 0,
          pending: data.summary?.pending || 0,
        });
        if (data.tabCounters) {
          setTabCounters(data.tabCounters);
        }
      }
    } catch (err) {
      // Silently ignore AbortError; other errors fail silently to not block main UI
    }
  }, [headers]);

  const fetchRequests = useCallback(async (signal, silent = false) => {
    if (!silent) setLoading(true);
    try {
      let url = `/api/lab/requests?tab=${activeTab}`;
      if (activeTab === "completed") {
        const today = new Date().toLocaleDateString("en-CA");
        url += `&startDate=${today}&endDate=${today}`;
      }
      const res = await fetch(url, { headers, signal });
      if (!res.ok) throw new Error("API failed");
      setRequests(await res.json());
    } catch (err) {
      if (err.name !== 'AbortError') toast.error("فشل تحميل القائمة");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [headers, activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRequests(controller.signal, false);
    fetchStats(controller.signal);
    
    return () => {
      controller.abort();
    };
  }, [fetchRequests, fetchStats]);

  useEffect(() => {
    if (latestLabEvent?.id) {
      fetchRequests(undefined, true);
      fetchStats();
    }
  }, [latestLabEvent?.id, fetchRequests, fetchStats]);

  const handleStartAll = useCallback(async (visitId) => {
    // Optimistic Update
    setRequests(prev => prev.filter(r => r.visit_id !== visitId));
    try {
      const res = await fetch(`/api/lab/visit/${visitId}/start-all`, {
        method: "PUT",
        headers,
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message || "تم استلام العينات وبدء الفحص");
      } else {
        toast.error(d.message);
        fetchRequests(); // Revert on failure
      }
    } catch {
      toast.error("فشل التنفيذ");
      fetchRequests(); // Revert on failure
    }
  }, [headers, fetchRequests]);

  const filtered = useMemo(() => requests.filter(
    (r) =>
      !query || r.full_name?.includes(query) || r.visit_number?.includes(query),
  ), [requests, query]);

  const emptyState = useMemo(() => {
    if (query) return { icon: FlaskConical, title: 'لا توجد سجلات مطابقة', desc: 'لم يتم العثور على مرضى بهذا الاسم أو الرقم المرجعي.' };
    switch (activeTab) {
      case 'pending': return { icon: Clock, title: 'لا توجد طلبات واردة', desc: 'جميع الطلبات تم التعامل معها ولا يوجد عينات في الانتظار.' };
      case 'in_progress': return { icon: FlaskConical, title: 'لا يوجد تحاليل قيد الإجراء', desc: 'لم يتم استلام أي عينات للتحليل حالياً.' };
      case 'completed': return { icon: CheckSquare, title: 'لا يوجد تحاليل منجزة', desc: 'لم يتم اعتماد أي نتائج تحليل لهذا اليوم بعد.' };
      default: return { icon: FlaskConical, title: 'لا توجد سجلات', desc: 'القائمة فارغة.' };
    }
  }, [activeTab, query]);

  const statsCards = useMemo(() => [
    { label: 'إجمالي الفحوصات اليوم', value: dailyStats.totalRequests, icon: FlaskConical, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: 'تحاليل قيد الإجراء', value: dailyStats.pending, icon: Clock, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: 'تحاليل منجزة', value: dailyStats.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  ], [dailyStats]);

  return (
    <div className="p-6 min-h-full flex flex-col space-y-6" dir="rtl">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-lg">
            <FlaskConical size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">قسم المختبر والتحاليل الطبية</h1>
            <p className="text-sm font-bold text-gray-500 mt-0.5">إدارة ومتابعة التحاليل المخبرية</p>
          </div>
        </div>
      </div>

      {/* ── Quick Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-shrink-0">
        {statsCards.map((s, i) => (
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

      {/* ── Tabs Menu ── */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex-shrink-0 overflow-x-auto no-scrollbar">
        {TABS.map(tab => {
          const badgeCount = tabCounters[tab.id] || 0;
          return (
            <button
              key={tab.id}
              onClick={() => setSearchParams({ tab: tab.id })}
              className={`flex-1 flex items-center justify-between gap-3 py-3 px-5 rounded-2xl font-bold text-sm transition-all whitespace-nowrap border ${
                activeTab === tab.id 
                  ? `${tab.activeBg} text-white shadow-md transform scale-[1.02] border-transparent` 
                  : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-gray-100 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeTab === tab.id ? 'bg-white/25 text-white' : tab.bg + ' ' + tab.color}`}>
                  <tab.icon size={16} />
                </div>
                <span>{tab.label}</span>
              </div>
              
              {badgeCount > 0 && (
                <div className="relative flex items-center justify-center">
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 duration-1000 ${activeTab === tab.id ? 'bg-white' : tab.color.replace('text-', 'bg-')}`}></span>
                  <span className={`relative inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-[11px] font-extrabold shadow-sm animate-in zoom-in duration-300 ${activeTab === tab.id ? 'bg-white text-slate-800' : `${tab.bg} ${tab.color} border border-current`}`}>
                    {badgeCount > 99 ? '+99' : badgeCount}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main Content Area ── */}
      <div className="bg-gray-50 rounded-3xl p-4 flex-1 flex flex-col min-h-0 border border-gray-100 shadow-inner">
        <>
          <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
              <div className="relative w-full md:w-96">
                <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-violet-500 focus:border-violet-500 block pr-12 py-2.5 font-bold transition-all shadow-sm"
                  placeholder="بحث سريع باسم المريض أو رقم الزيارة..."
                />
              </div>
              <button
                onClick={() => {
                  fetchRequests();
                  fetchStats();
                }}
                className="h-10 w-10 flex flex-shrink-0 items-center justify-center p-0 rounded-xl bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white transition-all border border-violet-100 shadow-sm"
              >
                <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
              {loading ? (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-gray-100 shadow-sm" />
                ))
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-gray-400 space-y-3">
                  <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-2">
                    <emptyState.icon size={32} className="text-gray-300" />
                  </div>
                  <p className="font-bold text-lg">{emptyState.title}</p>
                  <p className="text-sm">{emptyState.desc}</p>
                </div>
              ) : (
                filtered.map((v, i) => {
                  const isActive = selected === v.visit_id;
                  
                  const tabTestsCount = v.total_tab_tests || 0;
                  const completedCount = v.total_completed_tests || 0;
                  
                  return (
                    <div
                      key={v.visit_id}
                      onClick={() => setSelected(v.visit_id)}
                      className={`rounded-2xl border p-5 cursor-pointer transition-all ${
                        isActive
                          ? "border-violet-500 shadow-md bg-violet-50/40 ring-2 ring-violet-50 scale-[1.01]"
                          : "border-gray-200 bg-white hover:border-violet-300 hover:shadow-sm"
                      }`}>
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm ${
                              activeTab === "completed"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gradient-to-br from-violet-100 to-violet-200 text-violet-700"
                            }`}>
                            {v.full_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-lg">
                              {v.full_name}
                            </p>
                            <p className="text-xs font-semibold text-gray-500 mt-1 flex items-center gap-2">
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                العمر: {v.age} سنة
                              </span>
                              <span className="bg-gray-100 px-2 py-0.5 rounded">
                                الرقم المرجعي: {v.visit_number}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <div className="text-left flex flex-col items-end gap-1.5">
                            {activeTab === 'pending' && (
                              <span className="text-xs font-bold bg-violet-50 text-violet-700 px-3 py-1.5 rounded-lg border border-violet-200 flex items-center gap-1.5">
                                <Clock size={14} /> {tabTestsCount} تحاليل مطلوبة
                              </span>
                            )}
                            
                            {activeTab === 'in_progress' && (
                              <span className="text-xs font-bold bg-violet-50 text-violet-700 px-3 py-1.5 rounded-lg border border-violet-200 flex items-center gap-1.5">
                                <FlaskConical size={14} /> {tabTestsCount} قيد الإجراء
                              </span>
                            )}
                            
                            {activeTab === 'completed' && (
                              <span className="text-xs font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                                <CheckCircle size={14} /> {completedCount} تحاليل منجزة
                              </span>
                            )}
                          </div>

                          {activeTab === "pending" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartAll(v.visit_id);
                              }}
                              className="text-sm font-bold bg-violet-600 text-white px-5 py-2.5 rounded-xl hover:bg-violet-700 shadow-sm transition-all active:scale-95 flex items-center gap-2">
                              <CheckCircle size={18} /> استلام العينات
                            </button>
                          )}
                          {activeTab !== "pending" && (
                            <div className="text-violet-400 bg-violet-50 p-2 rounded-xl">
                              <ChevronLeft size={20} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
        </>
      </div>

      {selected && (
        <LabPatientDetailPanel
          visitId={selected}
          token={token}
          isCompletedTab={activeTab === "completed"}
          isPendingTab={activeTab === "pending"}
          onStartAll={handleStartAll}
          onClose={() => setSelected(null)}
          onCompleted={fetchRequests}
        />
      )}
    </div>
  );
};

export default LaboratoryDashboard;

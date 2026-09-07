import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  RefreshCcw,
  Film,
  Image as ImageIcon,
  BarChart3,
  Calendar,
  AlertCircle,
  LayoutGrid,
  List,
  Eye,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  BookOpen,
  X
} from "lucide-react";
import { toast } from "react-toastify";
import { AnimatePresence, motion } from "framer-motion";
import useAuthStore from "../../store/useAuthStore";
import { RecordDetailModal, PatientDetailPanel } from "../../components/radiology/RadiologyModals";

// ── Reports Tab ───────────────────────────────────────────────────
const PAGE_SIZE = 12;

const ReportsPanel = ({ token }) => {
  const location = useLocation();
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const visitId = params.get('visitId');
    if (visitId) {
      setSelectedVisitId(Number(visitId));
      window.history.replaceState({}, '', '/radiology/reports');
    }
  }, [location.search]);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem("radiologyViewMode") || "grid");
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [dateFilter, setDateFilter] = useState("all"); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [filmTypeFilter, setFilmTypeFilter] = useState("all"); // 'all' | 'large' | 'small' | 'none'
  const [customRange, setCustomRange] = useState({ start: "", end: "" });

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/radiology/stats?";

      if (dateFilter === "custom" && customRange.start && customRange.end) {
        url += `startDate=${customRange.start}&endDate=${customRange.end}`;
      } else if (dateFilter !== "all") {
        const now = new Date();
        let start = "";
        const pad = (n) => n.toString().padStart(2, "0");
        const format = (d) =>
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        if (dateFilter === "today") {
          start = format(now);
        } else if (dateFilter === "week") {
          const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          start = format(past);
        } else if (dateFilter === "month") {
          const past = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            now.getDate(),
          );
          start = format(past);
        }
        url += `startDate=${start}&endDate=${format(now)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(await res.json());
    } catch {
      toast.error(<div className="flex items-center gap-2"><AlertCircle size={20} /><span>"فشل تحميل الإحصائيات"</span></div>, { className: "!bg-red-50 !border-red-200 !text-red-800 !z-[999999]" });
    } finally {
      setLoading(false);
    }
  }, [token, dateFilter, customRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    localStorage.setItem("radiologyViewMode", layoutMode);
  }, [layoutMode]);

  // Phase 2: Ensure pagination resets when deep filters change
  useEffect(() => {
    setPage(1);
  }, [filmTypeFilter, dateFilter]);

  const handleResetFilters = () => {
    setDateFilter("all");
    setFilmTypeFilter("all");
    setCustomRange({ start: "", end: "" });
    toast.info("تم إعادة تعيين فلاتر التقارير");
  };

  const handleViewRecord = async (group) => {
    if (!group.visit_id) return toast.error("معرّف الزيارة غير متاح");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/radiology/visit/${group.visit_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      // Enrich each detail row with result_file and result_notes
      // by matching against the full visit requests from the API
      const enrichedDetails = group.details.map(detail => {
        const firstScanName = detail.scan_names?.split(' - ')[0]?.trim();
        const matchedReq = data.requests.find(r => r.name === firstScanName);
        return {
          ...detail,
          result_file: matchedReq?.result_file || null,
          result_notes: matchedReq?.result_notes || null,
        };
      });
      setSelectedRecord({ ...group, details: enrichedDetails });
    } catch {
      toast.error("فشل تحميل تفاصيل السجل");
    } finally {
      setDetailLoading(false);
    }
  };

  const groupedData = useMemo(() => {
    if (!stats?.tableData) return [];
    
    // Phase 1: Deep Filter (Pre-Grouping)
    let sourceData = stats.tableData;
    if (filmTypeFilter !== "all") {
      sourceData = sourceData.filter(row => {
        if (filmTypeFilter === "large") return row.film_size === "large";
        if (filmTypeFilter === "small") return row.film_size === "small";
        if (filmTypeFilter === "none") return !row.film_size || row.film_size === "none";
        return true;
      });
    }

    const map = new Map();
    sourceData.forEach((row) => {
      if (!map.has(row.visit_number)) {
        map.set(row.visit_number, {
          visit_id: row.visit_id,
          visit_number: row.visit_number,
          patient_name: row.patient_name,
          date: row.date,
          age: row.patient_age || null,
          gender: row.patient_gender || null,
          total_scans: 0,
          large_films: 0,
          small_films: 0,
          without_films: 0,
          details: [],
        });
      }
      const group = map.get(row.visit_number);
      const scansCount = parseInt(row.scans_in_film || 1, 10);
      group.total_scans += scansCount;

      if (row.film_size === "large") group.large_films += 1;
      else if (row.film_size === "small") group.small_films += 1;
      else group.without_films += scansCount;

      if (new Date(row.date) > new Date(group.date)) {
        group.date = row.date;
      }
      group.details.push(row);
    });

    const filteredGroups = Array.from(map.values());

    return filteredGroups.sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
  }, [stats?.tableData, filmTypeFilter]);

  const totalPages = Math.ceil(groupedData.length / PAGE_SIZE);
  const paginatedData = useMemo(() => {
    return groupedData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [groupedData, page]);

  return (
    <div className="flex-1 overflow-y-auto space-y-6 w-full custom-scrollbar pr-2 pb-6">
      {/* Banner */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-500 p-6 rounded-3xl text-white shadow-lg shadow-blue-500/20 relative overflow-hidden flex-shrink-0 mt-2">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shadow-inner border border-white/20">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black">
                تقارير الأداء والإحصائيات التحليلية
              </h1>
              <p className="text-blue-100 text-xs mt-1 font-bold">
                تتبع استهلاك أفلام التصوير الطبي وعدد الإشعة المنجزة
              </p>
            </div>
          </div>
          <button
            onClick={fetchStats}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center gap-2 text-sm font-bold py-2.5 px-5 shadow-lg backdrop-blur-md rounded-xl transition-all hover:scale-105 active:scale-95 group">
            <RefreshCcw size={16} className={loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />{" "}
            تحديث البيانات
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4 flex-shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-2xl text-xs font-bold text-gray-500">
            {[
              { id: "all", label: "الكل" },
              { id: "today", label: "اليوم" },
              { id: "week", label: "آخر 7 أيام" },
              { id: "month", label: "آخر 30 يوماً" },
              { id: "custom", label: "تاريخ مخصص" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setDateFilter(f.id)}
                className={`px-4 py-2 rounded-xl transition-all ${
                  dateFilter === f.id
                    ? "bg-white text-blue-800 shadow-sm"
                    : "hover:bg-white/40"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-2xl text-xs font-bold text-gray-500">
            {[
              { id: "all", label: "الكل" },
              { id: "large", label: "فيلم كبير" },
              { id: "small", label: "فيلم صغير" },
              { id: "none", label: "بدون فيلم" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilmTypeFilter(f.id)}
                className={`px-4 py-2 rounded-xl transition-all ${
                  filmTypeFilter === f.id
                    ? "bg-white text-blue-800 shadow-sm"
                    : "hover:bg-white/40"
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {(dateFilter !== "all" || filmTypeFilter !== "all") && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 16 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              className="overflow-hidden flex justify-end border-t border-gray-100/60 pt-3"
            >
              <button
                onClick={handleResetFilters}
                className="px-3.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5">
                <X size={14} /> إعادة تعيين الفلاتر
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Range Picker */}
        {dateFilter === "custom" && (
          <div className="overflow-hidden mt-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 flex flex-wrap gap-4 items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-500">من تاريخ:</span>
                  <input
                    type="date"
                    value={customRange.start}
                    onChange={(e) =>
                      setCustomRange({ ...customRange, start: e.target.value })
                    }
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold outline-none text-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-500">إلى تاريخ:</span>
                  <input
                    type="date"
                    value={customRange.end}
                    onChange={(e) =>
                      setCustomRange({ ...customRange, end: e.target.value })
                    }
                    className="px-3 py-2 bg-white border border-gray-200 rounded-xl font-bold outline-none text-gray-700"
                  />
                </div>
              </div>
            </div>
          )}
              </div>

      {loading && !stats ? (
        <div className="space-y-6 flex-1 flex flex-col mt-4">
          {/* KPI Skeletons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="space-y-3">
                  <div className="w-24 h-3 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="w-16 h-8 bg-gray-200 rounded-xl animate-pulse"></div>
                </div>
                <div className="w-12 h-12 bg-gray-100 rounded-2xl animate-pulse"></div>
              </div>
            ))}
          </div>
          {/* Content Skeletons */}
          <div className="flex justify-between items-center bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-32 h-4 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="w-16 h-8 bg-gray-100 rounded-xl animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm h-[180px] animate-pulse">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gray-100"></div>
                  <div className="space-y-2 flex-1">
                    <div className="w-32 h-4 bg-gray-200 rounded-full"></div>
                    <div className="w-16 h-3 bg-gray-100 rounded-full"></div>
                  </div>
                </div>
                <div className="w-full h-16 bg-gray-50 rounded-xl mb-3"></div>
                <div className="w-20 h-5 bg-gray-100 rounded-md"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* KPI Overviews */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 flex-shrink-0">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-indigo-200 transition-all group">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400 group-hover:text-indigo-500 transition-colors">
                  أفلام كبيرة مستخدمة
                </span>
                <h3 className="text-2xl font-black text-gray-800">
                  {stats?.summary?.large_films || 0}
                </h3>
              </div>
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <Film size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-cyan-200 transition-all group">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400 group-hover:text-cyan-500 transition-colors">
                  أفلام صغيرة مستخدمة
                </span>
                <h3 className="text-2xl font-black text-gray-800">
                  {stats?.summary?.small_films || 0}
                </h3>
              </div>
              <div className="w-12 h-12 bg-cyan-50 text-cyan-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <Film size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-violet-200 transition-all group">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400 group-hover:text-violet-500 transition-colors">
                  حفظ رقمي بدون فيلم
                </span>
                <h3 className="text-2xl font-black text-gray-800">
                  {stats?.summary?.without_film || 0}
                </h3>
              </div>
              <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <ImageIcon size={20} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-emerald-200 transition-all group">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-gray-400 group-hover:text-emerald-500 transition-colors">
                  إجمالي الأشعة المنجزة
                </span>
                <h3 className="text-2xl font-black text-gray-800">
                  {stats?.summary?.total_operations || 0}
                </h3>
              </div>
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <BarChart3 size={20} />
              </div>
            </div>
          </div>

          {/* Results Counter & Layout Toggle */}
          <div className="flex justify-between items-center bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm text-xs font-semibold text-gray-500 flex-shrink-0">
            <span>تم العثور على {groupedData.length} سجل استهلاك</span>
            <div className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
              <button onClick={() => setLayoutMode('grid')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}>
                <LayoutGrid size={15} />
              </button>
              <button onClick={() => setLayoutMode('list')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'list' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}>
                <List size={15} />
              </button>
            </div>
          </div>

          {/* Table / Grid Data Render */}
          {groupedData.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 flex flex-col justify-center items-center border border-gray-100 shadow-sm flex-shrink-0 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-gray-100">
                <Film size={40} className="text-gray-300" />
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">لا يوجد سجلات استهلاك</h3>
              <p className="text-gray-500 font-bold text-sm max-w-sm text-center">
                لم نتمكن من العثور على أي استهلاك لأفلام الأشعة في هذه الفترة. تأكد من تعديل فلاتر التواريخ بالأعلى.
              </p>
            </div>
          ) : layoutMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-shrink-0 animate-in fade-in duration-500">
              {paginatedData.map(group => (
                <div key={group.visit_number} onClick={() => handleViewRecord(group)}
                  className="bg-white border border-slate-200 hover:border-blue-300 rounded-[1.5rem] p-5 shadow-sm hover:shadow-md hover:shadow-blue-900/5 cursor-pointer transition-all duration-300 flex flex-col justify-between gap-5 group"
                >
                  <div>
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center font-black text-xl border border-blue-100 flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                          {group.patient_name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-[15px] text-slate-800 line-clamp-1 group-hover:text-blue-700 transition-colors">{group.patient_name}</h3>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              {group.visit_number}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <button className="text-slate-400 group-hover:text-blue-600 p-2 rounded-xl bg-slate-50 group-hover:bg-blue-50 transition-colors border border-transparent group-hover:border-blue-100" title="عرض التفاصيل">
                          <Eye size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5"><Calendar size={14}/> التاريخ</span>
                        <span className="font-black text-slate-700" dir="ltr">{new Date(group.date).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-500 flex items-center gap-1.5"><BookOpen size={14}/> إجمالي الأشعة</span>
                        <span className="font-black text-slate-700">{group.total_scans} أشعة</span>
                      </div>
                    </div>

                    <div className="flex flex-nowrap gap-1.5 pt-3 w-full">
                      {group.large_films > 0 && (
                        <span className="flex-1 justify-center px-1.5 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[9px] font-black border border-blue-100 flex items-center gap-1 shadow-sm whitespace-nowrap">
                          <Film size={12} className="shrink-0" /> {group.large_films} فيلم كبير
                        </span>
                      )}
                      {group.small_films > 0 && (
                        <span className="flex-1 justify-center px-1.5 py-1.5 bg-slate-50 text-slate-700 rounded-xl text-[9px] font-black border border-slate-200 flex items-center gap-1 shadow-sm whitespace-nowrap">
                          <Film size={12} className="shrink-0" /> {group.small_films} فيلم صغير
                        </span>
                      )}
                      {group.without_films > 0 && (
                        <span className="flex-1 justify-center px-1.5 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black border border-slate-200 flex items-center gap-1 shadow-sm whitespace-nowrap">
                          <ImageIcon size={12} className="shrink-0" /> {group.without_films} حفظ رقمي
                        </span>
                      )}
                    </div>
                  </div>


                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col flex-shrink-0 animate-in fade-in duration-500">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-sm text-right">
                  <thead className="bg-gray-50/80 text-gray-500 border-b border-gray-150 text-xs font-bold">
                    <tr>
                      <th className="px-5 py-3">المريض والمرجع</th>
                      <th className="px-5 py-3">الأفلام المستهلكة</th>
                      <th className="px-5 py-3">إجمالي الأشعة</th>
                      <th className="px-5 py-3">التاريخ والوقت</th>
                      <th className="px-5 py-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((group, i) => (
                      <tr
                        key={group.visit_number}
                        onClick={() => handleViewRecord(group)}
                        className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className="font-extrabold text-slate-800 text-[13px] group-hover:text-blue-700 transition-colors">{group.patient_name}</span>
                            <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{group.visit_number}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            {group.large_films > 0 && (
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black border border-blue-100 shadow-sm flex items-center gap-1"><Film size={10}/> {group.large_films} كبير</span>
                            )}
                            {group.small_films > 0 && (
                              <span className="px-2 py-1 bg-slate-50 text-slate-700 rounded-lg text-[10px] font-black border border-slate-200 shadow-sm flex items-center gap-1"><Film size={10}/> {group.small_films} صغير</span>
                            )}
                            {group.without_films > 0 && (
                              <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black border border-slate-200 shadow-sm flex items-center gap-1"><ImageIcon size={10}/> {group.without_films} رقمي</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg text-[11px] font-black shadow-sm">
                            {group.total_scans} أشعة
                          </span>
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-500 text-[11px]" dir="ltr">
                          {new Date(group.date).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors mx-auto">
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
          {/* Detail Modal Portal */}
          {selectedRecord && createPortal(
            <RecordDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />,
            document.body
          )}
          {selectedVisitId && createPortal(
            <PatientDetailPanel visitId={selectedVisitId} token={token} onClose={() => setSelectedVisitId(null)} activeTab="completed" />,
            document.body
          )}
        </>
      )}
    </div>
  );
};

// ── Main Dashboard (Legacy - Now used exclusively for Reports) ─────────────
const RadiologyRequests = () => {
  const { token } = useAuthStore();

  return <ReportsPanel token={token} />;
};

export default RadiologyRequests;

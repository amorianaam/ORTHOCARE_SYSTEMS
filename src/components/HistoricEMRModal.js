import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePersistentState } from '../hooks/usePersistentState';
import { Eye, X, Pencil, SendHorizontal, Clock, History, FlaskConical, Pill, Radiation, Printer, Maximize, Minimize, User, Phone, LayoutGrid, List, Scan, Stethoscope, CheckCircle, Calendar, Crown } from "lucide-react";
import axios from "axios";
import useAuthStore from '../store/useAuthStore';
import { toast } from "react-toastify";
import useSocketStore from '../store/useSocketStore';
import { RadiologyResultDetailsModal } from "./radiology/RadiologyModals";
import { LabResultDetailsModal } from "./lab/LabModals";
import UnifiedTimelineNavigator from './common/UnifiedTimelineNavigator';

function resolveFileUrl(raw) {
  if (!raw) return null;

  if (typeof raw === 'string' && raw.startsWith('http')) {
    return { url: raw, isPdf: raw.endsWith('.pdf') };
  }

  if (typeof raw === 'string' && raw.startsWith('data:')) {
    const isPdf = raw.includes('application/pdf');
    const parts = raw.split(',');
    if (parts.length < 2) return null;
    const header = parts[0];
    const base64 = parts[1];
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : (isPdf ? 'application/pdf' : 'image/jpeg');
    try {
      const bytes = atob(base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      return { url: URL.createObjectURL(blob), isPdf };
    } catch { return null; }
  }

  if (typeof raw === 'string' && raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed[0]) {
        return resolveFileUrl(parsed[0].data || parsed[0].url || parsed[0].base64 || parsed[0].result_file);
      }
    } catch { /* fall through */ }
  }

  if (typeof raw === 'string' && raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return resolveFileUrl(parsed.data || parsed.url || parsed.base64 || parsed.result_file);
    } catch { /* fall through */ }
  }

  if (typeof raw === 'string' && raw.length > 100) {
    try {
      const bytes = atob(raw);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const isPdf = bytes.startsWith('%PDF-');
      const mime = isPdf ? 'application/pdf' : 'image/jpeg';
      const blob = new Blob([arr], { type: mime });
      return { url: URL.createObjectURL(blob), isPdf };
    } catch { /* invalid base64 */ }
  }

  return null;
}

const groupRadByFilm = (rads) => {
  const groups = {};
  const sizeMap = { 'large': 'كبير', 'small': 'صغير', 'medium': 'وسط' };

  rads.forEach((r, idx) => {
    const key = r.radiology_film_id ? `film_${r.radiology_film_id}` : `standalone_${idx}`;

    if (!groups[key]) {
      let translatedSize = r.film_size ? (sizeMap[r.film_size.toLowerCase()] || r.film_size) : '';
      groups[key] = {
        ...r,
        names: [r.name],
        t: 'أشعة',
        c: 'bg-rose-50 text-rose-700 border-rose-100',
        film_type: (r.with_film === 0 || r.with_film === false)
          ? 'بدون فيلم'
          : (translatedSize ? `فيلم ${translatedSize}` : 'فيلم مجمّع'),
        items: []
      };
    } else {
      groups[key].names.push(r.name);
    }
    
    groups[key].items.push(r);
    
    if (r.result_notes && !groups[key].result_notes) groups[key].result_notes = r.result_notes;
    if (r.result_file && !groups[key].result_file) groups[key].result_file = r.result_file;
  });

  return Object.values(groups);
};

export default function HistoricEMRModal({ patient, onClose, token, onEditPatient, onSendReview, sendingReview, hideFinancials }) {
  const { role } = useAuthStore();
  const isSecretary = role === 'secretary' || role === 'receptionist';
  const enforceNoFinancials = isSecretary || hideFinancials;

  const [patientHistory, setPatientHistory] = useState([]);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [emrTab, setEmrTab] = usePersistentState('emr_last_tab', enforceNoFinancials ? 'orders' : 'timeline');
  const [ordersFilter, setOrdersFilter] = useState('lab');
  const [resultsFilter, setResultsFilter] = useState('lab');
  const [viewMode, setViewMode] = usePersistentState('global_layout_preference', 'list');
  const [ordersTabsState, setOrdersTabsState] = usePersistentState('historic_orders_tabs_state', { lab: true, rad: true, clinic: true });
  const [resultsTabsState, setResultsTabsState] = usePersistentState('historic_results_tabs_state', { lab: true, rad: true, clinic: true });
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [isFullscreen, setIsFullscreen] = usePersistentState('secretary_modal_maximized_preference', false);

  useEffect(() => {
    if (enforceNoFinancials && emrTab === 'financials') {
      setEmrTab('orders');
    }
  }, [enforceNoFinancials, emrTab, setEmrTab]);

  const safeSelectedVisit = useMemo(() => {
    if (!selectedVisit) return null;
    if (!enforceNoFinancials) return selectedVisit;
    
    const safe = { ...selectedVisit };
    delete safe.entry_fee;
    delete safe.discount_amount;
    delete safe.total_amount;
    delete safe.final_amount;
    
    if (safe.labTests) safe.labTests = safe.labTests.map(t => { const { final_price, is_free, ...rest } = t; return rest; });
    if (safe.lab_tests) safe.lab_tests = safe.lab_tests.map(t => { const { final_price, is_free, ...rest } = t; return rest; });
    if (safe.radiologyTests) safe.radiologyTests = safe.radiologyTests.map(t => { const { final_price, is_free, ...rest } = t; return rest; });
    if (safe.radiology_tests) safe.radiology_tests = safe.radiology_tests.map(t => { const { final_price, is_free, ...rest } = t; return rest; });
    if (safe.clinicalServices) safe.clinicalServices = safe.clinicalServices.map(t => { const { final_price, is_free, ...rest } = t; return rest; });
    if (safe.clinical_services) safe.clinical_services = safe.clinical_services.map(t => { const { final_price, is_free, ...rest } = t; return rest; });
    
    return safe;
  }, [selectedVisit, enforceNoFinancials]);

  // Document preview modal states
  const [previewFile, setPreviewFile] = useState("");
  const [previewFileName, setPreviewFileName] = useState("");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [resolvedPreview, setResolvedPreview] = useState(null);
  const [viewLabResult, setViewLabResult] = useState(null);
  const [viewRadResult, setViewRadResult] = useState(null);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);

  useEffect(() => {
    if (!previewFile) {
      setResolvedPreview(null);
      return;
    }
    const resolved = resolveFileUrl(previewFile);
    setResolvedPreview(resolved);

    return () => {
      if (resolved && resolved.url && resolved.url.startsWith('blob:')) {
        URL.revokeObjectURL(resolved.url);
      }
    };
  }, [previewFile]);

  const latestPatientEvent = useSocketStore(state => state.latestPatientEvent);
  const lastFetchRef = useRef(0);

  const openPreview = (file, name) => {
    setPreviewFile(file);
    setPreviewFileName(name);
    setIsPreviewModalOpen(true);
  };

  const currentIndex = patientHistory?.findIndex(v => v.id === selectedVisit?.id);
  const hasNewerVisit = currentIndex > 0;
  const newerVisit = hasNewerVisit ? patientHistory[currentIndex - 1] : null;

  const fetchHistory = async () => {
    if (!patient) return;
    try {
      const res = await axios.get(`/api/doctor/patient/${patient.id}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPatientHistory(res.data);
      if (!selectedVisit && res.data.length > 0) {
        setSelectedVisit(res.data[0]);
      } else if (selectedVisit) {
        const updatedVisit = res.data.find(v => v.id === selectedVisit.id);
        if (updatedVisit) setSelectedVisit(updatedVisit);
      }
      lastFetchRef.current = Date.now();
    } catch {
      toast.error("فشل تحميل تاريخ المريض");
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [patient, token]);

  useEffect(() => {
    if (latestPatientEvent?.timestamp && latestPatientEvent.timestamp > lastFetchRef.current) {
      if (latestPatientEvent.patientId === patient?.id || latestPatientEvent.patient_id === patient?.id) {
        fetchHistory();
      }
    }
  }, [latestPatientEvent, patient]);

  useEffect(() => {
    if (selectedVisit?.id) {
      setLoadingPrescription(true);
      axios.get(`/api/doctor/visit/${selectedVisit.id}/prescription`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.data && Array.isArray(res.data.items)) {
            setPrescriptionItems(res.data.items);
          } else if (Array.isArray(res.data)) {
            setPrescriptionItems(res.data);
          } else {
            setPrescriptionItems([]);
          }
        })
        .catch(err => setPrescriptionItems([]))
        .finally(() => setLoadingPrescription(false));
    } else {
      setPrescriptionItems([]);
    }
  }, [selectedVisit?.id, token]);

  const handleSelectVisit = (visit) => {
    setSelectedVisit(visit);
    setEmrTab(enforceNoFinancials ? 'orders' : 'timeline');
  };

  const handlePrintPrescription = () => {
    const printContent = document.getElementById('print-area').innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = `
      <div dir="rtl" style="font-family: 'Cairo', sans-serif; padding: 20px;">
        <h2 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px;">وصفة طبية - ${patient.full_name}</h2>
        ${printContent}
      </div>
    `;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  if (!patient) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
        <div
          className={`bg-white shadow-luxury overflow-hidden flex flex-col border border-gray-100 relative animate-scale-in transition-all duration-300 ${
            isFullscreen ? 'w-[98vw] h-[98vh] rounded-3xl' : 'w-full max-w-6xl h-[88vh] rounded-3xl'
          }`}
        >
          <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-teal-700 text-white px-5 py-2.5 flex items-center justify-between flex-shrink-0 shadow-md">
            <div className="flex items-center gap-2">
              <Eye size={16} />
              <span className="text-xs font-black tracking-wide">وضع العرض الشامل: الأرشيف الطبي والزيارات السابقة</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                {isFullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}
              </button>
              <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X size={16}/></button>
            </div>
          </div>

          {/* Modal Header — Compact Single-Row Premium Design */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-white relative z-10">
            <div className="flex items-center justify-between gap-3">
              {/* RIGHT: Patient Identity — compact row */}
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-100 to-teal-200 text-teal-700 flex items-center justify-center font-black text-lg border border-teal-200 shadow-sm flex-shrink-0">
                  {patient.full_name?.charAt(0)}
                </div>

                {/* Name + meta */}
                <div className="flex flex-col min-w-0">
                  <h3 className="font-black text-sm text-gray-900 leading-tight truncate">{patient.full_name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-md border border-teal-100">#{patient.id || patient.patient_id}</span>
                    {patient.age && <span className="text-[10px] font-bold text-gray-400">{patient.age} سنة</span>}
                    {patient.gender && <span className="text-[10px] font-bold text-gray-400">{patient.gender === 'male' ? '♂ ذكر' : '♀ أنثى'}</span>}
                    {patient.phone && <span className="text-[10px] font-bold text-gray-400 flex items-center gap-0.5"><Phone size={10}/><span dir="ltr">{patient.phone}</span></span>}
                  </div>
                </div>
              </div>

              {/* LEFT: Action Buttons & Metadata */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {onEditPatient && (
                    <button onClick={() => onEditPatient(patient)} className="btn-secondary text-[11px] font-black flex items-center gap-1 px-3 py-1.5 border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all shadow-sm whitespace-nowrap active:scale-95">
                      <Pencil size={12}/> تعديل
                    </button>
                  )}
                  {onSendReview && (
                    <button onClick={(e) => onSendReview(e, patient)} disabled={sendingReview === patient.id} className="btn-primary text-[11px] font-black flex items-center gap-1 px-3 py-1.5 shadow-sm rounded-xl transition-all whitespace-nowrap active:scale-95 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white">
                      {sendingReview === patient.id ? <span className="animate-spin w-3 h-3 border-2 border-white/30 border-t-white rounded-full inline-block" /> : <SendHorizontal size={12}/>}
                      تسجيل مراجعة مجانية
                    </button>
                  )}
                </div>

                {/* Visit Metadata */}
                {selectedVisit && (
                  <div className="hidden md:flex items-center gap-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                      <Calendar size={10} className="text-teal-400"/>
                      {new Date(selectedVisit.created_at || Date.now()).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      <div className="w-px h-2.5 bg-gray-200 mx-0.5"/>
                      <Clock size={10} className="text-amber-500"/>
                      <span dir="ltr">{new Date(selectedVisit.created_at || Date.now()).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>

                    {Boolean(selectedVisit.is_exempt) && (
                      <span className="text-[10px] font-black px-1.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Crown size={10}/> إعفاء
                      </span>
                    )}
                    <span className={`text-[10px] font-black px-1.5 py-1 rounded-lg border ${
                      Boolean(selectedVisit.is_follow_up)
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                    }`}>
                      {Boolean(selectedVisit.is_follow_up) ? 'مراجعة' : 'كشف جديد'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/30">
            <UnifiedTimelineNavigator 
              patientHistory={patientHistory} 
              selectedVisit={selectedVisit} 
              onSelectVisit={handleSelectVisit} 
              theme="teal"
            />
            <div className="flex flex-col md:flex-row justify-center items-center border-b border-gray-150 px-4 py-2 bg-gray-50/50 flex-shrink-0 gap-3">
              <div className="flex justify-center gap-2 text-xs font-bold text-gray-500 overflow-x-auto w-full pb-1 md:pb-0 hide-scrollbar">
                {(!enforceNoFinancials ? [
                  { id: 'timeline', label: 'المالية', icon: History },
                  { id: 'orders', label: 'الفحوصات والخدمات', icon: FlaskConical },
                  { id: 'results', label: 'النتائج الطبية', icon: Eye },
                  { id: 'prescription', label: 'الروشتة', icon: Pill }
                ] : [
                  { id: 'orders', label: 'الفحوصات والخدمات', icon: FlaskConical },
                  { id: 'results', label: 'النتائج الطبية', icon: Eye },
                  { id: 'prescription', label: 'الروشتة', icon: Pill }
                ]).map(tab => (
                  <button 
                    key={tab.id} 
                    onClick={() => setEmrTab(tab.id)}
                    className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl transition-all whitespace-nowrap text-sm font-bold ${
                      emrTab === tab.id 
                        ? 'bg-white text-teal-700 shadow-sm border border-teal-100 ring-1 ring-teal-50 font-black' 
                        : 'hover:bg-gray-100 text-gray-500'
                    }`}
                  >
                    <tab.icon size={15} /> 
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 min-h-0">
              {!selectedVisit ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                  <History size={48} className="mb-4" />
                  <p className="text-sm font-bold">اختر زيارة لعرض التفاصيل</p>
                </div>
              ) : (
                <div className="max-w-5xl mx-auto w-full">
                  {emrTab === 'timeline' && !enforceNoFinancials && (
                    <div className="space-y-4">
                      <h4 className="font-extrabold text-sm text-gray-800 flex items-center gap-2"><History size={16} className="text-teal-600"/> البيانات المالية للزيارة</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500"></div>
                          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                            <span className="text-xs text-gray-500 font-bold">رسم الدخول</span>
                            <span className="text-sm font-black text-emerald-700">{selectedVisit.entry_fee || 0} ريال</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                            <span className="text-xs text-gray-500 font-bold">الخصم المالي</span>
                            <span className="text-sm font-black text-rose-600">{selectedVisit.discount_amount || 0} ريال</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {emrTab === 'orders' && (
                    <div className="space-y-4">
                      {(() => {
                        const labs    = safeSelectedVisit.labTests    || safeSelectedVisit.lab_tests    || [];
                        const rads    = safeSelectedVisit.radiologyTests || safeSelectedVisit.radiology_tests || [];
                        const clinics = safeSelectedVisit.clinicalServices || safeSelectedVisit.clinical_services || [];

                        if (labs.length === 0 && rads.length === 0 && clinics.length === 0) {
                          return (
                            <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-8 text-center text-gray-400 text-xs font-bold">
                              لا توجد خدمات أو فحوصات مطلوبة في هذه الزيارة.
                            </div>
                          );
                        }

                        const statusBadge = (status) => {
                          const map = {
                            completed:       'bg-emerald-100 text-emerald-700',
                            paid:            'bg-emerald-100 text-emerald-700',
                            in_progress:     'bg-teal-100 text-teal-700',
                            pending_payment: 'bg-orange-100 text-orange-700',
                            pending:         'bg-amber-100 text-amber-700',
                            refunded:        'bg-gray-100 text-gray-500',
                            cancelled:       'bg-red-100 text-red-600',
                          };
                          const label = {
                            completed:       'مكتملة ✓',
                            paid:            'مدفوعة ✓',
                            in_progress:     'قيد التنفيذ',
                            pending_payment: 'بانتظار الدفع',
                            pending:         'معلّقة ⏳',
                            refunded:        'مُستردة',
                            cancelled:       'ملغاة',
                          };
                          return (
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap ${map[status] || 'bg-gray-100 text-gray-500'}`}>
                              {label[status] || status}
                            </span>
                          );
                        };

                        const AccordionTable = ({ title, items, colorClass, borderColor, bgHover, icon: Icon, serviceHeader, isOpen, setIsOpen }) => {
                          if (items.length === 0) return null;
                          return (
                            <details className="group bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden mb-3" open={isOpen}>
                              <summary 
                                onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
                                className={`p-4 cursor-pointer font-black text-xs ${colorClass} flex justify-between items-center ${bgHover} transition-colors`}
                              >
                                <span className="flex items-center gap-2">
                                  <Icon size={14} className="text-teal-500" />
                                  {title} ({items.length})
                                </span>
                                <span className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                              </summary>
                              <div className={`border-t ${borderColor} overflow-x-auto`}>
                                <table className="w-full text-right text-xs md:text-sm border-collapse">
                                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-extrabold text-xs">
                                    <tr>
                                      <th className="p-3">{serviceHeader}</th>
                                      <th className="p-3 w-32">الحالة</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {items.map((item, i) => {
                                      const isRadNoFilm = title === 'فحوصات الأشعة' && (item.with_film === false || item.with_film === 0 || item.withFilm === false);
                                      return (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                          <td className="p-3 align-middle">
                                            <div className="flex items-center gap-2">
                                              {isRadNoFilm && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[9px] font-black">بدون فيلم</span>
                                              )}
                                              <span className="inline-flex items-center px-2 py-1 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-lg text-[11px] font-black">
                                                {item.name}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="p-3">{statusBadge(item.status)}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          );
                        };

                        return (
                          <div className="space-y-3">
                            <h4 className="font-extrabold text-sm text-gray-700 px-1 mb-2 flex items-center gap-2"><FlaskConical size={16} className="text-teal-600"/> الفحوصات والخدمات المضافة</h4>
                            <AccordionTable
                              title="التحاليل المخبرية"
                              items={labs}
                              colorClass="text-slate-800"
                              borderColor="border-gray-150"
                              bgHover="hover:bg-slate-50/50"
                              icon={FlaskConical}
                              serviceHeader="الفحص المنفذ"
                              isOpen={ordersTabsState.lab}
                              setIsOpen={(val) => setOrdersTabsState(prev => ({ ...prev, lab: val }))}
                            />
                            <AccordionTable
                              title="فحوصات الأشعة"
                              items={rads}
                              colorClass="text-slate-800"
                              borderColor="border-gray-150"
                              bgHover="hover:bg-slate-50/50"
                              icon={Scan}
                              serviceHeader="الأشعة المطلوبة"
                              isOpen={ordersTabsState.rad}
                              setIsOpen={(val) => setOrdersTabsState(prev => ({ ...prev, rad: val }))}
                            />
                            <AccordionTable
                              title="الخدمات السريرية"
                              items={clinics}
                              colorClass="text-slate-800"
                              borderColor="border-gray-150"
                              bgHover="hover:bg-slate-50/50"
                              icon={Stethoscope}
                              serviceHeader="الخدمة المنفذة"
                              isOpen={ordersTabsState.clinic}
                              setIsOpen={(val) => setOrdersTabsState(prev => ({ ...prev, clinic: val }))}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {emrTab === 'results' && (
                    <div className="space-y-6 modal-overlay-anim mt-2">
                      {(() => {
                        const labs = (safeSelectedVisit.labTests || safeSelectedVisit.lab_tests || []).filter(t => t.status === 'completed' || t.result_notes || t.result_file);
                        const rads = (safeSelectedVisit.radiologyTests || safeSelectedVisit.radiology_tests || []).filter(t => t.status === 'completed' || t.result_notes || t.result_file);
                        const clinics = (safeSelectedVisit.clinicalServices || safeSelectedVisit.clinical_services || []).filter(t => t.status === 'completed' || t.result_notes || t.result_file);
                        
                        if (labs.length === 0 && rads.length === 0 && clinics.length === 0) {
                          return <div className="text-center py-20 bg-white rounded-3xl border shadow-sm text-gray-400 text-xs font-bold">لا يوجد أي نتائج أو تقارير طبية مرفوعة لهذه الزيارة حتى الآن.</div>;
                        }

                        const labRows = labs.map(t => ({...t, typeLabel: 'مختبر', items: [t]}));
                        const radRows = groupRadByFilm(rads);
                        const clinicRows = clinics.map(c => ({...c, typeLabel: 'سريري', items: [c]}));

                        const ResultsTable = ({ rows, colorTheme, showFilmColumn, serviceLabel, isOpen, setIsOpen }) => {
                          if (rows.length === 0) return null;
                          return (
                            <details className={`group overflow-hidden border rounded-3xl ${colorTheme.border} shadow-sm bg-white mb-6`} open={isOpen}>
                              <summary 
                                onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
                                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors bg-white outline-none select-none"
                              >
                                <div className="flex items-center gap-2">
                                  <colorTheme.Icon className={colorTheme.iconColor} size={18} />
                                  <h4 className={`font-extrabold text-sm text-gray-800`}>{colorTheme.title}</h4>
                                </div>
                                <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </div>
                              </summary>
                              <div className="overflow-x-auto border-t border-slate-100">
                                <table className="w-full text-right text-xs border-collapse min-w-[600px] bg-white">
                                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-extrabold text-xs">
                                    <tr>
                                      {showFilmColumn && <th className="p-3 w-32">النوع (الفيلم)</th>}
                                      <th className="p-3 w-48">{serviceLabel}</th>
                                      <th className="p-3 w-32 text-center">عرض النتائج</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {rows.map((row, i) => {
                                      return (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                          {showFilmColumn && (
                                            <td className="p-3 align-top">
                                              <span className="inline-flex items-center px-2.5 py-1 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-lg text-[11px] font-black w-fit">
                                                {row.film_type || row.typeLabel}
                                              </span>
                                            </td>
                                          )}
                                          <td className="p-3 align-top">
                                            <div className="flex gap-1.5 flex-wrap">
                                              {row.items.map((srv, idx) => (
                                                <span key={idx} className="inline-flex items-center px-2.5 py-1 bg-teal-50 border border-teal-100 shadow-sm text-teal-700 rounded-lg text-[11px] font-black w-fit">
                                                  {srv.name}
                                                </span>
                                              ))}
                                            </div>
                                          </td>
                                          <td className="p-3 align-top text-center">
                                            {(row.result_notes || row.result_file || row.file_url || row.attachment || row.status === 'completed') ? (
                                              <button 
                                                onClick={() => {
                                                  if (colorTheme.title === 'التحاليل المخبرية') {
                                                    setViewLabResult(row.items[0]);
                                                  } else if (colorTheme.title === 'التقارير الإشعاعية') {
                                                    setViewRadResult(row.items[0] || row);
                                                  }
                                                }}
                                                className="text-[11px] bg-teal-50 border border-teal-100 shadow-sm px-3 py-1.5 rounded-lg text-teal-700 hover:bg-teal-600 hover:text-white font-black transition-all flex items-center justify-center gap-1.5 w-full max-w-[120px] mx-auto group/btn whitespace-nowrap flex-nowrap"
                                              >
                                                <Eye size={14} className="text-teal-500 group-hover/btn:text-white transition-colors flex-shrink-0" /> عرض النتائج
                                              </button>
                                            ) : (
                                              <span className="text-gray-300 font-bold">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </details>
                          );
                        };

                        return (
                          <>
                            <ResultsTable 
                              rows={labRows} 
                              showFilmColumn={false}
                              serviceLabel="الفحص المنفذ"
                              colorTheme={{
                                title: 'التحاليل المخبرية',
                                border: 'border-blue-100',
                                iconColor: 'text-blue-600',
                                Icon: FlaskConical
                              }}
                              isOpen={resultsTabsState.lab}
                              setIsOpen={(val) => setResultsTabsState(prev => ({ ...prev, lab: val }))}
                            />
                            <ResultsTable 
                              rows={radRows} 
                              showFilmColumn={true}
                              serviceLabel="الأشعة المنفذة"
                              colorTheme={{
                                title: 'التقارير الإشعاعية',
                                border: 'border-rose-100',
                                iconColor: 'text-rose-600',
                                Icon: Scan
                              }}
                              isOpen={resultsTabsState.rad}
                              setIsOpen={(val) => setResultsTabsState(prev => ({ ...prev, rad: val }))}
                            />
                            <ResultsTable 
                              rows={clinicRows} 
                              showFilmColumn={false}
                              serviceLabel="الخدمة المنفذة"
                              colorTheme={{
                                title: 'الخدمات السريرية',
                                border: 'border-emerald-100',
                                iconColor: 'text-emerald-600',
                                Icon: Stethoscope
                              }}
                              isOpen={resultsTabsState.clinic}
                              setIsOpen={(val) => setResultsTabsState(prev => ({ ...prev, clinic: val }))}
                            />
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {emrTab === 'prescription' && (
                    <div className="space-y-6 modal-overlay-anim mt-2">
                      <div className="bg-teal-600 rounded-3xl p-6 shadow-md text-white">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-teal-500 pb-5 gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner">
                              <Pill size={24} className="text-white" />
                            </div>
                            <div>
                              <h3 className="font-black text-xl text-white">الأدوية المصروفة والتوجيهات الطبية.</h3>
                              <p className="text-teal-200 text-xs font-bold mt-1">الزيارة: {selectedVisit?.visit_number || '—'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
                            <div className="flex items-center gap-2 pr-3">
                              {Array.isArray(prescriptionItems) && prescriptionItems.length > 0 && (
                                <button
                                  onClick={handlePrintPrescription}
                                  className="px-4 py-2 bg-white text-teal-600 hover:bg-teal-50 rounded-xl transition-colors flex items-center gap-2 font-black text-xs shadow-sm"
                                >
                                  <Printer size={16} />
                                  طباعة
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {!loadingPrescription && (
                        <div id="print-area" className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                          <div className="flex items-center gap-3 p-5 border-b border-gray-150 bg-gray-50/50">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                              <CheckCircle size={20} className="text-emerald-500" />
                            </div>
                            <div>
                              <h3 className="font-black text-gray-800 text-base">الوصفات العلاجية المقررة</h3>
                              <p className="text-gray-500 text-[11px] font-bold mt-0.5">قائمة بالأدوية التي تم إضافتها للمريض في هذه الزيارة</p>
                            </div>
                          </div>
                          
                          {Array.isArray(prescriptionItems) && prescriptionItems.length > 0 ? (
                            <table className="w-full text-right text-sm">
                              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs font-black">
                                <tr>
                                  <th className="p-4 w-1/4">اسم الدواء</th>
                                  <th className="p-4">الجرعة</th>
                                  <th className="p-4">التكرار</th>
                                  <th className="p-4">التوجيهات</th>
                                  <th className="p-4">المدة</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {prescriptionItems.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-teal-50/30 transition-colors group">
                                    <td className="p-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                        <span className="font-black text-teal-900">{item.medication_name}</span>
                                      </div>
                                    </td>
                                    <td className="p-4 text-xs font-bold text-gray-700">{item.dosage || '—'}</td>
                                    <td className="p-4 text-xs font-bold text-gray-700">{item.frequency || '—'}</td>
                                    <td className="p-4 text-xs font-bold text-gray-500">{item.instructions || '—'}</td>
                                    <td className="p-4 text-xs font-bold text-gray-700">{item.duration || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-12 text-center flex flex-col items-center justify-center">
                              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
                                <Pill size={28} className="text-gray-300" />
                              </div>
                              <div className="text-gray-400 text-sm font-bold">لا يوجد أدوية مسجلة لهذه الزيارة</div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {loadingPrescription && (
                        <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div></div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isPreviewModalOpen && (
          <div
            style={{ zIndex: 100005 }}
            className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md modal-overlay-anim"
            dir="rtl">
            <div
              className={`bg-white rounded-3xl shadow-luxury flex flex-col overflow-hidden animate-scale-in transition-all duration-300 border border-gray-100 ${isPreviewMaximized ? 'w-[98vw] h-[98vh]' : 'w-full max-w-4xl h-[80vh]'}`}>
              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
                <div>
                  <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                    <Eye size={18} className="text-teal-600 animate-pulse" /> معاينة التقرير الطبي
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5 font-semibold">
                    {previewFileName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsPreviewMaximized(!isPreviewMaximized)} className="p-2 bg-gray-200 text-gray-600 rounded-xl hover:bg-teal-500 hover:text-white transition-colors">
                    {isPreviewMaximized ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                  <button
                    onClick={() => {
                      setIsPreviewModalOpen(false);
                      setPreviewFile("");
                      setPreviewFileName("");
                    }}
                    className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer">
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Viewer Area */}
              <div className="flex-1 bg-gray-100/50 p-6 overflow-hidden flex items-center justify-center min-h-0">
                {(() => {
                  if (!resolvedPreview) return null;

                  if (resolvedPreview.isPdf) {
                    return (
                      <iframe
                        src={resolvedPreview.url}
                        className="w-full h-full rounded-2xl border border-gray-200 shadow-sm"
                        title="PDF Medical Report Preview"
                      />
                    );
                  }
                  return (
                    <div className="w-full h-full overflow-auto flex items-center justify-center p-2">
                      <img
                        src={resolvedPreview.url}
                        alt="Medical Report Preview"
                        className="max-w-full max-h-full object-contain rounded-2xl shadow-md border border-gray-200"
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50 flex justify-end">
                <button
                  onClick={() => {
                    setIsPreviewModalOpen(false);
                    setPreviewFile("");
                    setPreviewFileName("");
                  }}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors cursor-pointer">
                  إغلاق النافذة
                </button>
              </div>
            </div>
          </div>
        )}
      {viewLabResult && (
        <LabResultDetailsModal
          isOpen={true}
          onClose={() => setViewLabResult(null)}
          request={viewLabResult}
        />
      )}
      {viewRadResult && (
        <RadiologyResultDetailsModal
          isOpen={true}
          onClose={() => setViewRadResult(null)}
          request={viewRadResult}
        />
      )}
    </>,
    document.body
  );
}

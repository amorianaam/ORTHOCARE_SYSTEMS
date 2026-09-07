import React, { useState, useEffect, useRef } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';
import { RadiologyResultDetailsModal } from "../../components/radiology/RadiologyModals";
import { LabResultDetailsModal } from "../../components/lab/LabModals";
import MedicationSelect from '../MedicationSelect';
import UnifiedTimelineNavigator from './UnifiedTimelineNavigator';
import { 
  X, History, FlaskConical, Eye, Pill, Printer, AlertCircle, Clock, Crown, Maximize2, Minimize2, Calendar, CheckCircle, Trash2,
  Plus,
  Trash, Search, ChevronDown, Star, Phone, User, Layers, ArrowLeft } from 'lucide-react';

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
        film_type: (r.with_film === 0 || r.with_film === false) 
          ? 'بدون فيلم' 
          : (translatedSize ? `فيلم ${translatedSize}` : 'فيلم مجمّع'),
        items: [],
        result_notes: r.result_notes,
        result_file: r.result_file
      };
    }
    
    groups[key].items.push(r);
    
    if (r.result_notes && !groups[key].result_notes) groups[key].result_notes = r.result_notes;
    if (r.result_file && !groups[key].result_file) groups[key].result_file = r.result_file;
  });
  
  return Object.values(groups);
};

const ResultsTable = ({ rows, colorTheme, onPreview, showFilmColumn, serviceLabel, showNotesColumn = true }) => {
  if (rows.length === 0) return null;
  return (
    <details className={`group overflow-hidden border rounded-3xl ${colorTheme.border} shadow-sm bg-white mb-6`} open>
      <summary className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors bg-white outline-none select-none">
        <div className="flex items-center gap-2">
          <colorTheme.Icon className={colorTheme.iconColor} size={18} />
          <h4 className={`font-extrabold text-sm text-gray-800`}>{colorTheme.title}</h4>
        </div>
        <div className="text-gray-400 group-open:rotate-180 transition-transform duration-300">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
      </summary>
      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full text-right text-xs border-collapse min-w-[600px] bg-white">
          <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-extrabold text-xs">
            <tr>
              {showFilmColumn && <th className="p-3 w-32">النوع (الفيلم)</th>}
              <th className="p-3 w-48">{serviceLabel}</th>
              {showNotesColumn && <th className="p-3 min-w-[200px]">الملاحظات</th>}
              <th className="p-3 w-32 text-center">التقرير المرفق</th>
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
                        <span key={idx} className="inline-flex items-center px-2.5 py-1 bg-indigo-50 border border-indigo-100 shadow-sm text-indigo-700 rounded-lg text-[11px] font-black w-fit">
                          {srv.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  {showNotesColumn && (
                    <td className="p-3 align-top">
                      <div className="text-[11px] text-gray-600 font-semibold break-words whitespace-pre-wrap max-h-32 overflow-y-auto custom-scrollbar pr-1">
                        {row.result_notes || 'لم يُسجل تقرير.'}
                      </div>
                    </td>
                  )}
                  <td className="p-3 align-top text-center">
                    {(row.result_file || row.file_url || row.attachment || row.result_notes) ? (
                      <button onClick={() => onPreview(row)} className="text-[11px] bg-indigo-50 border border-indigo-100 shadow-sm px-3 py-1.5 rounded-lg text-indigo-700 hover:bg-indigo-600 hover:text-white font-black transition-all flex items-center justify-center gap-1.5 w-full max-w-[120px] mx-auto group/btn whitespace-nowrap flex-nowrap">
                        <Eye size={14} className="text-indigo-500 group-hover/btn:text-white transition-colors flex-shrink-0" /> عرض النتيجة
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


// ─────────────────────────────────────────────────────────────────────────────
// RxFavoritesDropdown Component
// ─────────────────────────────────────────────────────────────────────────────
const RxFavoritesDropdown = ({ favoriteMeds, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredMeds = (favoriteMeds || []).filter(fav => 
    fav.medication_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[11px] font-bold text-white transition-all focus:border-white/40 focus:ring-1 focus:ring-white/40 min-w-[180px] justify-between shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Star size={14} className="text-amber-300 flex-shrink-0" />
          <span className="truncate">إضافة سريع من المفضلة</span>
        </div>
        <ChevronDown size={14} className="text-white/70" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-100 shadow-2xl rounded-2xl z-50 overflow-hidden flex flex-col animate-scale-in">
          <div className="p-3 border-b border-gray-100 bg-gray-50/80">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={13} />
              <input
                type="text"
                placeholder="ابحث باسم الدواء..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="w-full pl-3 pr-8 py-2 text-[11px] font-bold bg-white border border-gray-200 rounded-xl outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 text-gray-700 shadow-inner transition-all"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar bg-white">
            {filteredMeds.length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center justify-center">
                <Star size={24} className="text-gray-200 mb-2" />
                <span className="text-[11px] text-gray-400 font-bold">لا يوجد دواء مطابق</span>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMeds.map(fav => (
                  <button
                    key={fav.id}
                    onClick={() => {
                      onSelect(fav);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className="w-full flex flex-col px-3 py-2 text-right transition-colors hover:bg-indigo-50/80 rounded-xl group border border-transparent hover:border-indigo-100"
                  >
                    <span className="text-[12px] font-black text-gray-800 group-hover:text-indigo-700 truncate">{fav.medication_name}</span>
                    {(fav.dosage || fav.frequency) && (
                      <span className="text-[10px] font-bold text-gray-400 group-hover:text-indigo-500 mt-1 truncate">
                        {fav.dosage} {fav.frequency ? `• ${fav.frequency}` : ''}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};




export default function PatientEMRModal({

  isOpen,
  onClose,
  patient,
  readOnly = false,
  isArchiveScreen = false,
  historyLoading = false,
  patientHistory = [],
  selectedVisit = null,
  onSelectVisit,
  prescriptionItems = [],
  loadingPrescription = false,
  onPrintPrescription,
  onFinishVisit,
  onReferToSurgery,
  renderActiveActions,
  startMaximized = false,
  onCancelOrder,
  visit = null,
  favoriteMeds = [],
  catalogs = {},
  onPrescriptionSave,
  onRefresh,
}) {
  const latestPatientEvent = useSocketStore(state => state.latestPatientEvent);
  const latestLabEvent = useSocketStore(state => state.latestLabEvent);
  const latestRadiologyEvent = useSocketStore(state => state.latestRadiologyEvent);
  const latestSilentUpdate = useSocketStore(state => state.latestSilentUpdate);
  const lastFetchRef = useRef(0);
  
  const [emrTab, setEmrTab] = usePersistentState('emr_active_tab', 'timeline');
  const [isMaximized, setIsMaximized] = usePersistentState('doctor_modal_maximized_preference', startMaximized);
  const [previewFile, setPreviewFile] = useState(null);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  const [resolvedPreview, setResolvedPreview] = useState(null);

  const [discountAccOpen, setDiscountAccOpen] = usePersistentState('emr_acc_discount', false);
  const [freeAccOpen, setFreeAccOpen] = usePersistentState('emr_acc_free', false);
  const [labAccOpen, setLabAccOpen] = usePersistentState('emr_acc_lab', false);
  const [radAccOpen, setRadAccOpen] = usePersistentState('emr_acc_rad', false);
  const [clinicAccOpen, setClinicAccOpen] = usePersistentState('emr_acc_clinic', false);

  // ── Time Machine Logic ──
  const activeVisitId = visit?.visitId || visit?.id;
  const selectedVisitId = selectedVisit?.id;
  const isHistoricalView = Boolean(selectedVisitId && activeVisitId && String(selectedVisitId) !== String(activeVisitId));
  const showArchiveHeader = isHistoricalView || isArchiveScreen;
  const effectiveReadOnly = readOnly || showArchiveHeader;

  const currentIndex = patientHistory?.findIndex(v => v.id === (selectedVisit?.id || visit?.id));
  const hasNewerVisit = currentIndex > 0;
  const newerVisit = hasNewerVisit ? patientHistory[currentIndex - 1] : null;

  let visitTypeLabel = "زيارة جديدة";
  if (Boolean(visit?.is_follow_up) === true) {
    visitTypeLabel = "مراجعة";
  }


  // ── Rx Form State ──
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };
  const [rxItems, setRxItems] = useState([]);
  const canEditVisit = true;

  useEffect(() => {
    if (latestPatientEvent?.timestamp && latestPatientEvent.timestamp > lastFetchRef.current) {
      if (latestPatientEvent.patientId === patient?.id || latestPatientEvent.patient_id === patient?.id) {
        lastFetchRef.current = Date.now();
        if (onRefresh) onRefresh();
      }
    }
  }, [latestPatientEvent, patient, onRefresh]);

  // ── Live hydration for lab & radiology results ──
  useEffect(() => {
    const visitId = visit?.visitId || visit?.id;
    if (!visitId || !latestLabEvent?.timestamp) return;
    if (latestLabEvent.timestamp > lastFetchRef.current) {
      if (!latestLabEvent.visitId || String(latestLabEvent.visitId) === String(visitId)) {
        lastFetchRef.current = Date.now();
        if (onRefresh) onRefresh();
      }
    }
  }, [latestLabEvent, visit, onRefresh]);

  useEffect(() => {
    const visitId = visit?.visitId || visit?.id;
    if (!visitId || !latestRadiologyEvent?.timestamp) return;
    if (latestRadiologyEvent.timestamp > lastFetchRef.current) {
      if (!latestRadiologyEvent.visitId || String(latestRadiologyEvent.visitId) === String(visitId)) {
        lastFetchRef.current = Date.now();
        if (onRefresh) onRefresh();
      }
    }
  }, [latestRadiologyEvent, visit, onRefresh]);

  useEffect(() => {
    const visitId = visit?.visitId || visit?.id;
    if (!visitId || !latestSilentUpdate?.timestamp) return;
    if (latestSilentUpdate.timestamp > lastFetchRef.current) {
      if (!latestSilentUpdate.visitId || String(latestSilentUpdate.visitId) === String(visitId)) {
        lastFetchRef.current = Date.now();
        if (onRefresh) onRefresh();
      }
    }
  }, [latestSilentUpdate, visit, onRefresh]);

  const [labTests, setLabTests] = useState([]);
  const [radiologyTests, setRadiologyTests] = useState([]);
  const [viewLabResult, setViewLabResult] = useState(null);
  const [viewRadResult, setViewRadResult] = useState(null);
  const [rxMedName, setRxMedName] = useState('');
  const [rxDosage, setRxDosage] = useState('');
  const [rxFrequency, setRxFrequency] = useState('');
  const [rxDuration, setRxDuration] = useState('');
  const [rxInstructions, setRxInstructions] = useState('');
  const [savingRx, setSavingRx] = useState(false);
  const [favSearch, setFavSearch] = useState('');

  const syncRxItems = async (itemsToSync) => {
    setSavingRx(true);
    try {
      const vId = visit?.visitId || visit?.id || patient?.visitId;
      await axios.post(
        `/api/doctor/visit/${vId}/prescription`,
        { items: itemsToSync },
        { headers }
      );
      if (onPrescriptionSave) onPrescriptionSave(itemsToSync);
    } catch {
      toast.error('فشل حفظ الوصفة الطبية في الخلفية');
    } finally {
      setSavingRx(false);
    }
  };

  useEffect(() => {
    if (prescriptionItems && prescriptionItems.length > 0) {
      setRxItems(prescriptionItems);
    } else {
      setRxItems([]);
    }
  }, [prescriptionItems, selectedVisit]);


  const handleAddRxItem = () => {
    if (!rxMedName.trim()) {
      toast.error('الرجاء إدخال اسم الدواء');
      return;
    }
    const newItem = {
      medication_name: rxMedName,
      dosage: rxDosage,
      frequency: rxFrequency,
      duration: rxDuration,
      instructions: rxInstructions
    };
    const updatedItems = [...rxItems, newItem];
    setRxItems(updatedItems);
    syncRxItems(updatedItems);
    setRxMedName(''); setRxDosage(''); setRxFrequency(''); setRxDuration(''); setRxInstructions('');
  };




  useEffect(() => {
    if (!previewFile) {
      setResolvedPreview(null);
      return;
    }
    const rawFile = previewFile.file_url || previewFile.result_file || previewFile.attachment;
    const resolved = resolveFileUrl(rawFile);
    setResolvedPreview(resolved);

    return () => {
      if (resolved && resolved.url && resolved.url.startsWith('blob:')) {
        URL.revokeObjectURL(resolved.url);
      }
    };
  }, [previewFile]);

  if (!isOpen || !patient) return null;

  return (
    <>
      {createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
      <div className={`bg-white rounded-3xl shadow-luxury overflow-hidden flex flex-col border border-gray-100 relative animate-scale-in transition-all duration-300 ${isMaximized ? 'w-[98vw] h-[98vh]' : 'w-full max-w-6xl h-[88vh]'}`}>
        
        {/* Top Control Bar */}
        <div className={`px-5 py-2.5 flex items-center justify-between flex-shrink-0 shadow-md text-white transition-colors duration-300 ${showArchiveHeader ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600' : 'bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700'}`}>
          <div className="flex items-center gap-2">
            <Layers size={16} />
            <span className="text-xs font-black tracking-wide">
              {showArchiveHeader 
                ? `السجل السريري المؤرشف | زيارة رقم (${selectedVisit?.visit_number || selectedVisit?.id}) للمراجع: ${patient?.full_name || patient?.name} — [للقراءة فقط]`
                : 'الملف الطبي الشامل والمتابعة السريرية'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setIsMaximized(!isMaximized)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              {isMaximized ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors"><X size={16}/></button>
          </div>
        </div>

        {/* Modal Header — Compact Single-Row Premium Design */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0 bg-white relative z-10">
          <div className="flex items-center justify-between gap-3">

            {/* LEFT: Patient Identity — compact row */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-700 flex items-center justify-center font-black text-lg border border-indigo-200 shadow-sm flex-shrink-0">
                {patient.full_name?.charAt(0)}
              </div>

              {/* Name + meta */}
              <div className="flex flex-col min-w-0">
                <h3 className="font-black text-sm text-gray-900 leading-tight truncate">{patient.full_name}</h3>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">#{patient.id || patient.patient_id}</span>
                  {patient.age && <span className="text-[10px] font-bold text-gray-400">{patient.age} سنة</span>}
                  {patient.gender && <span className="text-[10px] font-bold text-gray-400">{patient.gender === 'male' ? '♂ ذكر' : '♀ أنثى'}</span>}
                  {patient.phone && <span className="text-[10px] font-bold text-gray-400 flex items-center gap-0.5"><Phone size={10}/><span dir="ltr">{patient.phone}</span></span>}
                </div>
              </div>
            </div>

            {/* CENTER: Visit metadata chips */}
            <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                <Calendar size={11} className="text-indigo-400"/>
                {new Date(visit?.created_at || Date.now()).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                <div className="w-px h-3 bg-gray-200 mx-0.5"/>
                <Clock size={11} className="text-amber-500"/>
                <span dir="ltr">{new Date(visit?.created_at || Date.now()).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}</span>
              </div>

              {Boolean(visit?.is_exempt) && (
                <span className="text-[10px] font-black px-2 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Crown size={11}/> إعفاء
                </span>
              )}
              <span className={`text-[10px] font-black px-2 py-1.5 rounded-lg border ${
                Boolean(visit?.is_follow_up)
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
              }`}>
                {visitTypeLabel}
              </span>
            </div>

            {/* RIGHT: Action Buttons */}
            {!effectiveReadOnly && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {renderActiveActions && renderActiveActions()}
                {onReferToSurgery && (
                  <button
                    onClick={onReferToSurgery}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-[11px] rounded-xl transition-all shadow-sm whitespace-nowrap active:scale-95"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                    إحالة
                  </button>
                )}
                {onFinishVisit && (
                  <button
                    onClick={onFinishVisit}
                    className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white font-black rounded-xl text-[11px] flex items-center gap-1 shadow-sm transition-all active:scale-95 whitespace-nowrap"
                  >
                    <CheckCircle size={12} />
                    إنهاء المعاينة
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Core Modal Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          <UnifiedTimelineNavigator 
            patientHistory={patientHistory} 
            selectedVisit={selectedVisit} 
            onSelectVisit={onSelectVisit} 
            visit={visit} 
          />
          {/* Tab bar and Global Actions */}
          <div className="flex flex-col md:flex-row justify-center items-center border-b border-gray-150 px-4 py-2 bg-gray-50/50 flex-shrink-0 gap-3">
            <div className="flex justify-center gap-2 text-xs font-bold text-gray-500 overflow-x-auto w-full pb-1 md:pb-0">
              {[
                { id: 'timeline', label: 'سجل زيارة المريض', icon: History },
                { id: 'results', label: 'التقرير التشخيصي', icon: Eye },
                { id: 'prescription', label: 'الخطة العلاجية', icon: Pill }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setEmrTab(tab.id)}
                  className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl transition-all whitespace-nowrap ${
                    emrTab === tab.id
                      ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100 ring-1 ring-indigo-50 font-black'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  <tab.icon size={15} />
                  {tab.label}
                </button>
              ))}
            </div>

            
          </div>

          {/* Scroll Content - Apply max-w-6xl mx-auto here when maximized */}
          <div className="flex-1 overflow-y-auto bg-slate-50 min-h-0">
            <div className={`p-6 ${isMaximized ? 'max-w-6xl mx-auto w-full' : ''}`}>
              {!selectedVisit ? (
                <div className="text-center py-20 text-gray-400 text-xs font-bold">
                  قم باختيار زيارة من القائمة اليمنى لعرض تفاصيلها الطبية المؤرشفة.
                </div>
              ) : (
                <div>
                  {/* ── TIMELINE TAB ── */}
                  {emrTab === 'timeline' && (
                    <div className="space-y-5 modal-overlay-anim">
                      {/* History Intelligence Banner removed and unified */}
                      
                      


                      {(() => {
                        const labs = selectedVisit.labTests || selectedVisit.lab_tests || [];
                        const rads = selectedVisit.radiologyTests || selectedVisit.radiology_tests || [];
                        const clinics = selectedVisit.clinicalServices || selectedVisit.clinical_services || [];

                        const allItems = [
                          ...labs.map(r => ({ ...r, typeLabel: 'مختبر' })),
                          ...rads.map(r => ({ ...r, typeLabel: 'أشعة' })),
                          ...clinics.map(r => ({ ...r, typeLabel: 'خدمة' }))
                        ];

                        const getPrice = (item) => parseFloat(item.price || item.final_price || item.cost || 0);
                        const getDiscount = (item) => parseFloat(item.discount_amount || item.discount || 0);
                        const isFreeItem = (item) => item.is_free === true || getPrice(item) === 0 || getDiscount(item) >= getPrice(item);
                        const isDiscountedItem = (item) => getDiscount(item) > 0 && !isFreeItem(item);

                        const discountedItems = allItems.filter(isDiscountedItem);
                        const freeServices = allItems.filter(isFreeItem);

                        const totalDiscount = discountedItems.reduce((acc, curr) => acc + getDiscount(curr), 0);
                        const totalFreeValue = freeServices.reduce((acc, curr) => acc + getPrice(curr), 0);

                        return (
                          <>
                            {discountedItems.length > 0 && (
                              <details className="group bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden mb-5" open={discountAccOpen}>
                                <summary 
                                  onClick={(e) => { e.preventDefault(); setDiscountAccOpen(!discountAccOpen); }}
                                  className="p-4 cursor-pointer font-black text-xs text-indigo-700 flex justify-between items-center hover:bg-slate-50/50 transition-colors"
                                >
                                  الخصومات الممنوحة ({discountedItems.length})
                                  <span className={`text-gray-400 transition-transform ${discountAccOpen ? 'rotate-180' : ''}`}>▼</span>
                                </summary>
                                <div className="p-0 border-t border-gray-100 bg-white overflow-x-auto">
                                  <table className="w-full text-right text-xs md:text-sm border-collapse">
                                    <thead className="bg-slate-50 text-gray-600 font-black border-b border-gray-200">
                                      <tr>
                                        <th className="p-3">الخدمة</th>
                                        <th className="p-3">القسم</th>
                                        <th className="p-3">القيمة الأصلية</th>
                                        <th className="p-3">نسبة الخصم</th>
                                        <th className="p-3">قيمة الخصم</th>
                                        <th className="p-3">السعر بعد الخصم</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {discountedItems.map((srv, i) => {
                                        const price = getPrice(srv);
                                        const discount = getDiscount(srv);
                                        const percent = price > 0 ? Math.round((discount / price) * 100) : 0;
                                        const afterDiscount = price - discount;
                                        return (
                                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 font-bold text-gray-800">{srv.name}</td>
                                            <td className="p-3 font-bold text-gray-500">{srv.typeLabel}</td>
                                            <td className="p-3 font-bold text-gray-400 line-through">{price} ريال</td>
                                            <td className="p-3 font-bold text-indigo-500">{percent}%</td>
                                            <td className="p-3 font-black text-indigo-600">{discount} ريال</td>
                                            <td className="p-3 font-black text-indigo-700">{afterDiscount} ريال</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-slate-50/50 border-t border-slate-200">
                                      <tr>
                                        <td colSpan="2" className="p-3 font-black text-slate-700 text-right">الإجمالي:</td>
                                        <td className="p-3 font-black text-slate-600">{discountedItems.reduce((acc, curr) => acc + getPrice(curr), 0)} ريال</td>
                                        <td className="p-3"></td>
                                        <td className="p-3 font-black text-indigo-600">{totalDiscount} ريال</td>
                                        <td className="p-3 font-black text-indigo-700">{discountedItems.reduce((acc, curr) => acc + (getPrice(curr) - getDiscount(curr)), 0)} ريال</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </details>
                            )}

                            {freeServices.length > 0 && (
                              <details className="group bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden" open={freeAccOpen}>
                                <summary 
                                  onClick={(e) => { e.preventDefault(); setFreeAccOpen(!freeAccOpen); }}
                                  className="p-4 cursor-pointer font-black text-xs text-indigo-700 flex justify-between items-center hover:bg-slate-50/50 transition-colors"
                                >
                                  الخدمات المجانية والإعفاءات ({freeServices.length})
                                  <span className={`text-gray-400 transition-transform ${freeAccOpen ? 'rotate-180' : ''}`}>▼</span>
                                </summary>
                                <div className="p-0 border-t border-gray-100 bg-white overflow-x-auto">
                                  <table className="w-full text-right text-xs md:text-sm border-collapse">
                                    <thead className="bg-slate-50 text-gray-600 font-black border-b border-gray-200">
                                      <tr>
                                        <th className="p-3">الخدمة المعفاة</th>
                                        <th className="p-3">القسم</th>
                                        <th className="p-3">القيمة الممنوحة</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {freeServices.map((srv, i) => {
                                        const price = getPrice(srv);
                                        return (
                                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 font-bold text-gray-800">
                                              {srv.typeLabel === 'أشعة' && (srv.with_film === false || srv.with_film === 0 || srv.withFilm === false) && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[9px] font-black ml-2">بدون فيلم</span>
                                              )}
                                              {srv.name}
                                            </td>
                                            <td className="p-3 font-bold text-gray-500">{srv.typeLabel}</td>
                                            <td className="p-3 font-black text-indigo-600">{price > 0 ? `${price} ريال يمني` : 'مجانًا'}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="bg-slate-50/50 border-t border-slate-200">
                                      <tr>
                                        <td colSpan="2" className="p-3 font-black text-slate-700 text-right">الإجمالي:</td>
                                        <td className="p-3 font-black text-indigo-700">{totalFreeValue} ريال يمني</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              </details>
                            )}
                          </>
                        );
                      })()}

                      {(() => {
                        const labs    = selectedVisit.labTests    || selectedVisit.lab_tests    || [];
                        const rads    = selectedVisit.radiologyTests || selectedVisit.radiology_tests || [];
                        const clinics = selectedVisit.clinicalServices || selectedVisit.clinical_services || [];

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
                            in_progress:     'bg-blue-100 text-blue-700',
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

                        // ── Cancel-eligibility guard ──
                        const canCancelOrder = (item) => {
                          const isFree = item.is_free === true || item.is_free === 1 || parseFloat(item.final_price || item.price || 0) === 0;
                          const isNotExecuted = item.status === 'pending' || (isFree && item.status === 'paid');
                          const isAwaitingPayment = item.status === 'pending_payment';
                          return (isFree && isNotExecuted) || (!isFree && isAwaitingPayment);
                        };

                        const AccordionTable = ({ title, items, colorClass, borderColor, bgHover, icon: Icon, serviceHeader, serviceType, isOpen, setIsOpen }) => {
                          if (items.length === 0) return null;
                          const totalOrig = items.reduce((acc, curr) => acc + parseFloat(curr.price || 0), 0);
                          const totalFinal = items.reduce((acc, curr) => acc + parseFloat(curr.final_price ?? curr.price ?? 0), 0);
                          return (
                            <details className="group bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden" open={isOpen}>
                              <summary 
                                onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
                                className={`p-4 cursor-pointer font-black text-xs ${colorClass} flex justify-between items-center ${bgHover} transition-colors`}
                              >
                                <span className="flex items-center gap-2">
                                  <Icon size={14} className="text-indigo-500" />
                                  {title} ({items.length})
                                </span>
                                <span className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                              </summary>
                              <div className={`border-t ${borderColor} overflow-x-auto`}>
                                <table className="w-full text-right text-xs md:text-sm border-collapse">
                                  <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-extrabold text-xs">
                                    <tr>
                                      <th className="p-3">{serviceHeader}</th>
                                      <th className="p-3">الحالة</th>
                                      <th className="p-3">السعر الأصلي</th>
                                      <th className="p-3">السعر النهائي</th>
                                       {!effectiveReadOnly && onCancelOrder && <th className="p-3 w-12"></th>}

                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {items.map((item, i) => {
                                      const origPrice  = parseFloat(item.price || 0);
                                      const finalPrice = parseFloat(item.final_price ?? item.price ?? 0);
                                      const hasDiscount = item.is_free ? false : (origPrice > finalPrice && origPrice > 0);
                                      const isFree = item.is_free === true || item.is_free === 1 || finalPrice === 0;
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
                                          <td className={`p-3 font-bold ${hasDiscount ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                                            {origPrice > 0 ? `${origPrice} ريال` : '—'}
                                          </td>
                                          <td className="p-3 font-black">
                                            {isFree
                                              ? <span className="text-indigo-600">مجاني</span>
                                              : <span className={hasDiscount ? 'text-indigo-700' : 'text-gray-700'}>{finalPrice} ريال</span>
                                            }
                                          </td>
                                          {!effectiveReadOnly && onCancelOrder && (
                                            <td className="p-3 text-center">
                                              {canCancelOrder(item) ? (
                                                <button
                                                  onClick={(e) => { e.stopPropagation(); onCancelOrder(item.id, serviceType, item); }}
                                                  title="إلغاء الطلب"
                                                  className="p-1.5 rounded-lg text-red-400 hover:text-white hover:bg-red-500 border border-red-100 hover:border-red-500 transition-all"
                                                >
                                                  <Trash2 size={13} />
                                                </button>
                                              ) : (
                                                <span className="text-gray-200" title="لا يمكن الإلغاء">—</span>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot className="bg-slate-50/50 border-t border-slate-200">
                                    <tr>
                                      <td colSpan="2" className="p-3 font-black text-slate-700 text-right">الإجمالي:</td>
                                      <td className="p-3 font-black text-slate-600">{totalOrig} ريال</td>
                                      <td className="p-3 font-black text-indigo-700">{totalFinal} ريال</td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </details>
                          );
                        };

                        return (
                          <div className="space-y-3">
                            <h4 className="font-extrabold text-sm text-gray-700 px-1">سجل الخدمات والفحوصات المطلوبة</h4>
                            <AccordionTable
                              title="التحاليل المخبرية"
                              items={labs}
                              colorClass="text-slate-800"
                              borderColor="border-gray-150"
                              bgHover="hover:bg-slate-50/50"
                              icon={FlaskConical}
                              serviceHeader="الفحص المنفذ"
                              serviceType="lab"
                              isOpen={labAccOpen}
                              setIsOpen={setLabAccOpen}
                            />
                            <AccordionTable
                              title="فحوصات الأشعة"
                              items={rads}
                              colorClass="text-slate-800"
                              borderColor="border-gray-150"
                              bgHover="hover:bg-slate-50/50"
                              icon={Eye}
                              serviceHeader="الأشعة المنفذة"
                              serviceType="radiology"
                              isOpen={radAccOpen}
                              setIsOpen={setRadAccOpen}
                            />
                            <AccordionTable
                              title="الخدمات السريرية"
                              items={clinics}
                              colorClass="text-slate-800"
                              borderColor="border-gray-150"
                              bgHover="hover:bg-slate-50/50"
                              icon={AlertCircle}
                              serviceHeader="الخدمة المنفذة"
                              serviceType="clinical"
                              isOpen={clinicAccOpen}
                              setIsOpen={setClinicAccOpen}
                            />
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* ── RESULTS TAB ── */}
                  {emrTab === 'results' && (
                    <div className="space-y-6 modal-overlay-anim">
                      {(() => {
                        const labs = (selectedVisit.labTests || selectedVisit.lab_tests || []).filter(t => t.status === 'completed' || t.result_notes);
                        const rads = (selectedVisit.radiologyTests || selectedVisit.radiology_tests || []).filter(t => t.status === 'completed' || t.result_notes);
                        const clinics = (selectedVisit.clinicalServices || selectedVisit.clinical_services || []).filter(t => t.status === 'completed' || t.result_notes);
                        
                        if (labs.length === 0 && rads.length === 0 && clinics.length === 0) {
                          return <div className="text-center py-20 bg-white rounded-3xl border shadow-sm text-gray-400 text-xs font-bold">لا يوجد أي نتائج أو تقارير طبية مرفوعة لهذه الزيارة حتى الآن.</div>;
                        }

                        const labRows = labs.map(t => ({...t, typeLabel: 'مختبر', items: [t]}));
                        const radRows = groupRadByFilm(rads);
                        const clinicRows = clinics.map(c => ({...c, typeLabel: 'سريري', items: [c]}));

                        return (
                          <>
                            <ResultsTable 
                              rows={labRows} 
                              onPreview={(row) => setViewLabResult(row)}
                              showFilmColumn={false}
                              showNotesColumn={false}
                              serviceLabel="الفحص المنفذ"
                              colorTheme={{
                                title: 'التحاليل المخبرية',
                                border: 'border-blue-100',
                                iconColor: 'text-blue-600',
                                Icon: FlaskConical
                              }}
                            />
                            <ResultsTable 
                              rows={radRows} 
                              onPreview={(row) => setViewRadResult(row)}
                              showFilmColumn={true}
                              showNotesColumn={false}
                              serviceLabel="الأشعة المنفذة"
                              colorTheme={{
                                title: 'التقارير الإشعاعية',
                                border: 'border-rose-100',
                                iconColor: 'text-rose-600',
                                Icon: Eye
                              }}
                            />
                            <ResultsTable 
                              rows={clinicRows} 
                              onPreview={setPreviewFile}
                              showFilmColumn={false}
                              showNotesColumn={true}
                              serviceLabel="الخدمة المنفذة"
                              colorTheme={{
                                title: 'الخدمات السريرية',
                                border: 'border-emerald-100',
                                iconColor: 'text-emerald-600',
                                Icon: AlertCircle
                              }}
                            />
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* ── PRESCRIPTION TAB ── */}
                  {emrTab === 'prescription' && (
                    <div className="space-y-6 modal-overlay-anim">
                      {/* Top Banner & Inputs Card */}
                      <div className="bg-indigo-600 rounded-3xl p-6 shadow-md text-white">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-indigo-500 pb-5 mb-5 gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner">
                              <Pill size={24} className="text-white" />
                            </div>
                            <div>
                              <h3 className="font-black text-xl text-white">الأدوية المصروفة والتوجيهات الطبية.</h3>
                              <p className="text-indigo-200 text-xs font-bold mt-1">الزيارة: {selectedVisit.visit_number}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
                            {/* Favorites Quick-Select */}
                            {!effectiveReadOnly && favoriteMeds && favoriteMeds.length > 0 && (
                              <RxFavoritesDropdown 
                                favoriteMeds={favoriteMeds} 
                                onSelect={(fav) => {
                                  setRxMedName(fav.medication_name);
                                  setRxDosage(fav.dosage || '');
                                  setRxFrequency(fav.frequency || '');
                                  setRxDuration(fav.duration || '');
                                  setRxInstructions(fav.instructions || '');
                                }} 
                              />
                            )}
                            
                            {/* Actions */}
                            <div className="flex items-center gap-2 border-r border-indigo-500 pr-3">
                              {savingRx && <div className="text-[10px] text-indigo-200 flex items-center gap-1.5 font-bold"><div className="w-3 h-3 border-2 border-indigo-300 border-t-white rounded-full animate-spin"></div> جاري الحفظ...</div>}
                              {onPrintPrescription && rxItems.length > 0 && (
                                <button
                                  onClick={onPrintPrescription}
                                  className="px-4 py-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors flex items-center gap-2 font-black text-xs shadow-sm"
                                >
                                  <Printer size={16} />
                                  طباعة
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {loadingPrescription ? (
                          <div className="flex justify-center py-10">
                            <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin"></div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            {/* Datalists */}
                            <datalist id="dosage-suggestions">
                              <option value="125mg" />
                              <option value="250mg" />
                              <option value="500mg" />
                              <option value="1g" />
                              <option value="5ml" />
                              <option value="10ml" />
                              <option value="حبة واحدة" />
                            </datalist>
                            <datalist id="frequency-suggestions">
                              <option value="مرة واحدة يومياً (OD)" />
                              <option value="مرتين يومياً (BID)" />
                              <option value="٣ مرات يومياً (TID)" />
                              <option value="٤ مرات يومياً (QID)" />
                              <option value="عند اللزوم (PRN)" />
                            </datalist>
                            <datalist id="duration-suggestions">
                              <option value="لمدة ٣ أيام" />
                              <option value="لمدة ٥ أيام" />
                              <option value="لمدة أسبوع" />
                              <option value="لمدة أسبوعين" />
                              <option value="لمدة شهر" />
                            </datalist>
                            <datalist id="instructions-suggestions">
                              <option value="بعد الأكل" />
                              <option value="قبل الأكل" />
                              <option value="على الريق" />
                              <option value="قبل النوم" />
                              <option value="مع كمية وافرة من الماء" />
                            </datalist>

                            {/* Rx Form Grid */}
                            {!effectiveReadOnly && (
                              <div className="bg-white/10 border border-white/20 rounded-2xl p-5 shadow-inner">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-start">
                                  <div className="lg:col-span-3">
                                    <label className="block text-[11px] font-black text-indigo-100 mb-1.5">اسم الدواء <span className="text-red-300">*</span></label>
                                    <MedicationSelect
                                      value={rxMedName}
                                      onChange={(val) => setRxMedName(val)}
                                      options={catalogs?.medications?.map(m => m.name || m.scientific_name).filter(Boolean) || []}
                                      placeholder="مثال: Amoxicillin"
                                      theme="indigo"
                                    />
                                  </div>
                                  <div className="lg:col-span-2">
                                    <label className="block text-[11px] font-black text-indigo-100 mb-1.5">الجرعة</label>
                                    <input 
                                      type="text"
                                      list="dosage-suggestions"
                                      value={rxDosage} 
                                      onChange={e => setRxDosage(e.target.value)}
                                      className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-indigo-200/50 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all font-bold"
                                      placeholder="500mg"
                                    />
                                  </div>
                                  <div className="lg:col-span-2">
                                    <label className="block text-[11px] font-black text-indigo-100 mb-1.5">التكرار</label>
                                    <input 
                                      type="text"
                                      list="frequency-suggestions"
                                      value={rxFrequency} 
                                      onChange={e => setRxFrequency(e.target.value)}
                                      className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-indigo-200/50 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all font-bold"
                                      placeholder="مرتين باليوم"
                                    />
                                  </div>
                                  <div className="lg:col-span-3">
                                    <label className="block text-[11px] font-black text-indigo-100 mb-1.5">التوجيهات</label>
                                    <input 
                                      type="text"
                                      list="instructions-suggestions"
                                      value={rxInstructions} 
                                      onChange={e => setRxInstructions(e.target.value)}
                                      className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-indigo-200/50 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all font-bold"
                                      placeholder="بعد الأكل"
                                    />
                                  </div>
                                  <div className="lg:col-span-2">
                                    <label className="block text-[11px] font-black text-indigo-100 mb-1.5">المدة</label>
                                    <input 
                                      type="text"
                                      list="duration-suggestions"
                                      value={rxDuration} 
                                      onChange={e => setRxDuration(e.target.value)}
                                      className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-indigo-200/50 focus:outline-none focus:border-white focus:ring-2 focus:ring-white/20 transition-all font-bold"
                                      placeholder="5 أيام"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end pt-5 mt-1 border-t border-white/10">
                                  <button
                                    onClick={handleAddRxItem}
                                    className="h-10 px-8 bg-white hover:bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center gap-2 font-black text-sm transition-all shadow-sm hover:shadow-md"
                                  >
                                    <Plus size={16} />
                                    إضافة للوصفة
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Meds Table (Outside the Header Card) */}
                      {!loadingPrescription && (
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                          <div className="flex items-center gap-3 p-5 border-b border-gray-150 bg-gray-50/50">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                              <CheckCircle size={20} className="text-emerald-500" />
                            </div>
                            <div>
                              <h3 className="font-black text-gray-800 text-base">الوصفات العلاجية المقررة</h3>
                              <p className="text-gray-500 text-[11px] font-bold mt-0.5">قائمة بالأدوية التي تم إضافتها للمريض في هذه الزيارة</p>
                            </div>
                          </div>
                          
                          {rxItems.length > 0 ? (
                            <table className="w-full text-right text-sm">
                              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 text-xs font-black">
                                <tr>
                                  <th className="p-4 w-1/4">اسم الدواء</th>
                                  <th className="p-4">الجرعة</th>
                                  <th className="p-4">التكرار</th>
                                  <th className="p-4">التوجيهات</th>
                                  <th className="p-4">المدة</th>
                                  {!effectiveReadOnly && <th className="p-4 w-16 text-center">إجراء</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {rxItems.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="p-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                        <span className="font-black text-indigo-900">{item.medication_name}</span>
                                      </div>
                                    </td>
                                    <td className="p-4 text-xs font-bold text-gray-700">{item.dosage || '—'}</td>
                                    <td className="p-4 text-xs font-bold text-gray-700">{item.frequency || '—'}</td>
                                    <td className="p-4 text-xs font-bold text-gray-500">{item.instructions || '—'}</td>
                                    <td className="p-4 text-xs font-bold text-gray-700">{item.duration || '—'}</td>
                                    {!effectiveReadOnly && (
                                      <td className="p-4 text-center">
                                        <button
                                          onClick={() => {
                                            const updated = rxItems.filter((_, i) => i !== idx);
                                            setRxItems(updated);
                                            syncRxItems(updated);
                                          }}
                                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                          title="إزالة"
                                        >
                                          <Trash size={16} />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="p-12 text-center flex flex-col items-center justify-center">
                              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
                                <Pill size={28} className="text-gray-300" />
                              </div>
                              <p className="text-gray-500 text-sm font-bold">لم يتم إقرار أي وصفات علاجية بعد.</p>
                              <p className="text-gray-400 text-xs mt-1">قم بإضافة الأدوية من النموذج أعلاه لتظهر هنا في القائمة</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>


        </div>
      </div>
    </div>,
        document.body
      )}

      {/* File Preview Sub-Modal */}
      {previewFile && createPortal(
        <div className="fixed inset-0 z-[100001] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 modal-overlay-anim" dir="rtl">
          <div className={`bg-white rounded-3xl shadow-luxury flex flex-col overflow-hidden animate-scale-in transition-all duration-300 ${isPreviewMaximized ? 'w-[98vw] h-[98vh]' : 'w-full max-w-4xl h-[80vh]'}`}>
            <div className="flex justify-between items-center p-4 border-b bg-gray-50 flex-shrink-0">
              <h3 className="font-black text-gray-800">عرض الملف: {previewFile.name}</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsPreviewMaximized(!isPreviewMaximized)} className="p-2 bg-gray-200 text-gray-600 rounded-xl hover:bg-indigo-500 hover:text-white transition-colors">
                  {isPreviewMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                </button>
                <button onClick={() => setPreviewFile(null)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 flex items-center justify-center overflow-hidden p-4 relative">
              {!resolvedPreview ? (
                <div className="text-center text-gray-500 font-bold p-8">لا يوجد ملف مرفق بصيغة مدعومة للعرض.</div>
              ) : resolvedPreview.isPdf ? (
                <iframe
                  key={resolvedPreview.url}
                  src={resolvedPreview.url}
                  className="w-full h-full rounded-xl border border-gray-200 bg-white"
                  title="Document Preview"
                />
              ) : (
                <div className="w-full h-full overflow-auto flex items-center justify-center">
                  <img
                    src={resolvedPreview.url}
                    className="max-w-full max-h-full object-contain rounded-2xl shadow-md"
                    alt="Medical Result"
                  />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {viewLabResult && (
        <LabResultDetailsModal request={viewLabResult} onClose={() => setViewLabResult(null)} />
      )}
      {viewRadResult && (
        <RadiologyResultDetailsModal request={viewRadResult} onClose={() => setViewRadResult(null)} />
      )}
    </>
  );
}

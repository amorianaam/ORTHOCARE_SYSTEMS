import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FileText, X, UploadCloud, Eye, Trash2, CheckCircle, Minimize2, Maximize2,
  LayoutGrid, List, Activity, FlaskConical, AlertCircle, Edit, Calendar
} from "lucide-react";
import { toast } from "react-toastify";
import { getSocket } from "../../utils/socket";
import useSocketStore from "../../store/useSocketStore";

const BACKEND_URL = 'http://localhost:5000';

const resolveFileUrl = (file) => {
  if (file.previewUrl) return file.previewUrl;
  if (file.url) return file.url.startsWith('http') ? file.url : `${BACKEND_URL}${file.url}`;
  return file.base64 || null;
};

// ── Shared Result Preview Modal ──────────────────────────────────────
export const SharedResultPreviewModal = ({ file, onClose }) => {
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" dir="rtl">
      <div className={`bg-white rounded-3xl shadow-luxury flex flex-col overflow-hidden transition-all duration-300 ${isPreviewMaximized ? 'w-[98vw] h-[98vh]' : 'w-full max-w-4xl h-[80vh]'}`}>
        <div className="flex justify-between items-center p-4 border-b bg-slate-50 flex-shrink-0">
          <h3 className="font-black text-slate-800">عرض المرفق: {file.name}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsPreviewMaximized(!isPreviewMaximized)} className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
              {isPreviewMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>
            <button onClick={onClose} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden p-4 relative">
          {!resolveFileUrl(file) ? (
            <div className="text-center text-slate-500 font-bold p-8">جاري التحميل أو الملف غير متاح للمعاينة.</div>
          ) : (file.type === "application/pdf" || (file.base64 && file.base64.startsWith("data:application/pdf"))) ? (
            <iframe
              src={resolveFileUrl(file)}
              className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-inner"
              title="Document Preview"
            />
          ) : (
            <div className="w-full h-full overflow-auto flex items-center justify-center custom-scrollbar">
              <img
                src={resolveFileUrl(file)}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-md"
                alt="Medical Result"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Lab Result Details Modal ──────────────────────────────────────
export const LabResultDetailsModal = ({ request, onClose }) => {
  const [previewFile, setPreviewFile] = useState(null);
  
  let files = [];
  try {
    if (typeof request.result_file === 'string') {
      if (request.result_file.startsWith('[')) {
        files = JSON.parse(request.result_file);
      } else if (request.result_file) {
        files = [{ base64: request.result_file, name: 'نتيجة الفحص', type: 'application/pdf' }];
      }
    } else if (Array.isArray(request.result_file)) {
      files = request.result_file;
    }
  } catch {}

  return createPortal(
    <div className="fixed inset-0 z-[100002] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-full max-w-4xl h-auto max-h-[85vh] rounded-[2.5rem] border border-white/60">
        
        <div className="px-6 py-5 flex items-center justify-between bg-white border-b border-slate-100 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-sm border border-emerald-100">
              <CheckCircle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">نتيجة التحليل المخبري</h2>
              <p className="text-sm font-bold text-slate-500 mt-0.5">{request.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-8">
          <div className="w-full flex flex-col gap-3">
            <label className="text-base font-black text-slate-700 flex items-center gap-2">
              <FileText size={18} className="text-emerald-500" />
              الملاحظات والنتائج النصية
            </label>
            <div className="w-full bg-white border-2 border-slate-100 rounded-2xl p-4 sm:p-5 text-slate-700 font-semibold leading-loose shadow-sm text-[15px]">
              {request.result_notes ? (
                <div className="whitespace-pre-wrap break-words">{request.result_notes}</div>
              ) : (
                <div className="py-6 flex items-center justify-center text-slate-400 italic text-sm">لا توجد ملاحظات نصية مسجلة.</div>
              )}
            </div>
          </div>
          
          <div className="w-full flex flex-col gap-3">
            <label className="text-base font-black text-slate-700 flex items-center gap-2">
              <UploadCloud size={18} className="text-emerald-500" />
              الملفات والمرفقات
            </label>
            <div className="flex flex-col gap-3">
              {files.length === 0 && (
                <div className="w-full py-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-sm">
                  لا توجد ملفات مرفقة
                </div>
              )}
              {files.map((file, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group" onClick={() => setPreviewFile(file)}>
                  <div className="flex items-center gap-4 overflow-hidden pr-2">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:bg-emerald-50 transition-colors">
                      {(file.type && file.type.startsWith("image/")) || (file.base64 && file.base64.startsWith("data:image/")) ? (
                        <img src={resolveFileUrl(file)} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <FileText size={22} className="text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      )}
                    </div>
                    <span className="text-sm font-bold text-slate-700 line-clamp-2 break-all group-hover:text-emerald-700 transition-colors">{file.name || 'ملف مرفق'}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-100 transition-colors shrink-0">
                    <Eye size={20} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {previewFile && <SharedResultPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
      </div>
    </div>,
    document.body
  );
};


// ── Upload Result Modal (Lab - Mode B) ───────────────────────────────────────────
export const LabUploadResultModal = ({ isEditMode, endpoint, initialNotes = "", initialFiles, token, onClose, onUploaded }) => {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [notes]);

  const filesRef = useRef(files);
  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach(f => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    if (initialFiles) {
      try {
        if (typeof initialFiles === 'string') {
          if (initialFiles.trim().startsWith('[')) {
            setFiles(JSON.parse(initialFiles));
          } else {
            setFiles([{ name: 'ملف النتيجة المحفوظ', base64: initialFiles, type: 'application/pdf' }]);
          }
        } else if (Array.isArray(initialFiles)) {
          setFiles(initialFiles);
        } else {
          setFiles([]);
        }
      } catch (e) {
        setFiles([]);
      }
    } else {
      setFiles([]);
    }
  }, [initialFiles]);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      const validFiles = [];
      selected.forEach(file => {
        if (file.size > 15 * 1024 * 1024) {
          toast.error(`الملف ${file.name} يتجاوز الحجم المسموح (15MB)`);
        } else {
          if (file.type.startsWith("image/") || file.type === "application/pdf") {
            file.previewUrl = URL.createObjectURL(file);
          }
          validFiles.push(file);
        }
      });
      if (validFiles.length > 0) {
        setFiles(prev => [...prev, ...validFiles]);
      }
    }
  };

  const removeFile = (e, idx) => {
    e.stopPropagation();
    setFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[idx].previewUrl) URL.revokeObjectURL(newFiles[idx].previewUrl);
      newFiles.splice(idx, 1);
      return newFiles;
    });
  };

  const handleSave = async () => {
    if (files.length === 0 && !notes)
      return toast.error("يجب إرفاق ملف أو كتابة تقرير");
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("resultNotes", notes);

      const existingFiles = [];
      files.forEach(f => {
        if (f instanceof File) {
          formData.append("files", f); // binary upload via Multer
        } else {
          existingFiles.push(f); // preserve existing server files
        }
      });

      if (existingFiles.length > 0) {
        formData.append("existingFiles", JSON.stringify(existingFiles));
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }, // NO Content-Type header — let browser set multipart boundary
        body: formData,
      });

      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "فشل الحفظ");

      toast.success("تم حفظ النتيجة بنجاح");
      onUploaded();
    } catch (err) {
      toast.error("حدث خطأ أثناء حفظ النتيجة");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100002] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-full max-w-4xl h-auto max-h-[85vh] rounded-[2.5rem] border border-white/60">
        <div className="px-6 py-5 flex items-center justify-between bg-white border-b border-slate-100 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-black shadow-inner border border-violet-100">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="font-black text-white text-xl tracking-tight">{isEditMode ? "تعديل النتيجة والتقرير المخبري" : "إرفاق النتيجة والتقرير المخبري"}</h2>
              <p className="text-slate-500 font-medium text-xs mt-1">اكتب التقرير المخبري وارفق ملفات النتائج الصادرة عن الأجهزة</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl transition-all border border-slate-200">
            <X size={18}/>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-slate-50/50 flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/2 flex flex-col gap-3">
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <FileText size={16} className="text-violet-500" />
              كتابة التقرير
            </label>
            <div className="relative w-full">
              <textarea
                ref={textareaRef}
                autoFocus
                rows={3}
                className="w-full bg-white shadow-inner rounded-xl p-5 text-slate-700 font-medium leading-relaxed focus:ring-2 focus:ring-violet-500 border border-slate-200 transition-all resize-none placeholder-slate-300 custom-scrollbar"
                placeholder="اكتب التقرير والتشخيص هنا..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ overflow: 'hidden' }}
              />
            </div>
          </div>
          <div className="w-full lg:w-1/2 flex flex-col gap-3">
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <UploadCloud size={16} className="text-violet-500" />
              إرفاق ملفات النتائج (صور أو PDF)
            </label>
            <input type="file" multiple accept="image/*, application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <div onClick={() => fileInputRef.current.click()} className="w-full min-h-[120px] border-dashed border-2 border-slate-300 bg-slate-50 hover:bg-violet-50 hover:border-violet-300 transition-colors p-4 sm:p-5 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer group">
              <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-violet-500 group-hover:border-violet-200 transition-all duration-300 group-hover:scale-110">
                <UploadCloud size={24} />
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700 text-sm group-hover:text-violet-600 transition-colors">اسحب وأفلت الملفات أو انقر هنا</p>
                <p className="font-bold text-slate-400 text-[11px] mt-1">صور (JPG, PNG) أو ملفات PDF</p>
              </div>
            </div>
            {files.length > 0 && (
              <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                {files.map((file, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm hover:border-violet-300 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden cursor-pointer pr-1" onClick={() => setPreviewFile(file)}>
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {(file.type && file.type.startsWith("image/")) || (file.base64 && file.base64.startsWith("data:image/")) ? (
                          <img src={resolveFileUrl(file)} alt="preview" className="w-full h-full object-cover" />
                        ) : (
                          <FileText size={18} className="text-slate-400" />
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-700 line-clamp-2 break-all">{file.name}</span>
                    </div>
                    <div className="flex gap-1 shrink-0 pl-1">
                      <button onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
                        <Eye size={16} />
                      </button>
                      <button onClick={(e) => removeFile(e, idx)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="p-6 bg-white border-t border-slate-100 flex justify-end gap-3 rounded-b-[2.5rem]">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="px-8 py-2.5 rounded-xl font-bold text-sm text-white bg-violet-600 hover:bg-violet-700 hover:shadow-lg hover:shadow-violet-500/30 transition-all flex items-center gap-2">
            {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={18} />}
            حفظ واعتماد النتيجة
          </button>
        </div>
      </div>
      {previewFile && <SharedResultPreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>,
    document.body
  );
};

// ── Patient Detail Panel ────────────────────────────────────────────────
export const LabPatientDetailPanel = ({ visitId, token, isCompletedTab, isPendingTab, onStartAll, onClose, onCompleted }) => {
  const isInProgressTab = !isPendingTab && !isCompletedTab;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(
    localStorage.getItem("labFullscreen") === "true"
  );
  const [viewMode, setViewMode] = useState(
    localStorage.getItem("labViewMode") || "grid"
  );
  const [uploadingItem, setUploadingItem] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [viewResultItem, setViewResultItem] = useState(null);

  useEffect(() => {
    localStorage.setItem("labFullscreen", isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    localStorage.setItem("labViewMode", viewMode);
  }, [viewMode]);

  const latestLabEvent = useSocketStore(state => state.latestLabEvent);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/lab/visit/${visitId}`, { headers: { Authorization: `Bearer ${token}` } });
      setData(await res.json());
    } catch {
      toast.error("فشل تحميل التفاصيل");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [visitId, token]);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    if (latestLabEvent?.id) {
      if (!latestLabEvent.visitId || latestLabEvent.visitId === visitId) {
        load(true);
      }
    }
  }, [latestLabEvent?.id, latestLabEvent?.visitId, visitId, load]);

  const handleFinishPatient = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/lab/visit/${visitId}/complete`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        onCompleted();
        onClose();
        return;
      } else toast.error(d.message);
    } catch {
      toast.error("تعذر الاتصال");
    } finally {
      setCompleting(false);
    }
  };

  const handleStartIndividualRequest = async (requestId) => {
    // Optimistic UI: Update status to 'in_progress' immediately
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        requests: prev.requests.map(r => r.id === requestId ? { ...r, status: 'in_progress' } : r)
      };
    });
    
    try {
      const res = await fetch(`/api/lab/request/${requestId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "in_progress" }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success("تم استلام العينة وبدء الفحص");
        const socket = getSocket();
        socket.emit("lab:update", { visitId });
        load();
      } else {
        toast.error(d.message);
        load(); // Revert on failure
      }
    } catch {
      toast.error("فشل التنفيذ");
      load(); // Revert on failure
    }
  };

  const handleDeliverRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/lab/request/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'completed' }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success('تم تسليم النتيجة بنجاح');
        const socket = getSocket();
        socket.emit('lab:update', { visitId });
        load();
      } else toast.error(d.message);
    } catch {
      toast.error('فشل التنفيذ');
    }
  };

  const requests = useMemo(() => data?.requests || [], [data?.requests]);
  
  const workspaceRequests = useMemo(() => {
    let list = [...requests];
    if (isPendingTab) {
      list = list.filter(r => r.status === "paid");
    } else if (isCompletedTab) {
      list = list.filter(r => r.status === "completed");
    } else {
      list = list.filter(r => r.status === "in_progress" || r.status === "result_uploaded");
    }

    return list.sort((a, b) => {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
      if (a.status === 'paid' && b.status !== 'paid') return -1;
      if (a.status !== 'paid' && b.status === 'paid') return 1;
      return a.id - b.id;
    });
  }, [requests, isPendingTab, isCompletedTab]);

  const { isAllDone, hasPending } = useMemo(() => ({
    isAllDone: workspaceRequests.length > 0 && workspaceRequests.every((r) => r.status === "completed" || r.status === "result_uploaded"),
    hasPending: workspaceRequests.some((r) => r.status === "paid")
  }), [workspaceRequests]);

  const handleUploadClose = useCallback(() => setUploadingItem(null), []);
  const handleUploaded = useCallback(() => {
    setUploadingItem(null);
    load();
  }, [load]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />

      <div className={`relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] ${isFullscreen ? 'w-[98vw] h-[98vh] rounded-[2.5rem] border border-white' : 'w-full max-w-6xl h-[88vh] rounded-[2.5rem] border border-white/60'}`}>
        
        <div className="relative px-6 py-5 flex items-center justify-between flex-shrink-0 bg-gradient-to-br from-violet-900 to-indigo-900 border-b border-indigo-950/50">
          <div className="absolute inset-0 bg-white/20 mix-blend-overlay"></div>
          
          <div className="flex items-center gap-5 relative z-10">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-white/10 shadow-inner flex items-center justify-center text-violet-200 font-black text-2xl border border-white/20 backdrop-blur-sm">
                {data?.visit?.full_name?.charAt(0) || <FlaskConical size={24} />}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full"></div>
            </div>

            <div className="flex flex-col">
              <h2 className="font-black text-white text-xl tracking-tight">
                {data?.visit?.full_name || "جاري تحميل البيانات..."}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="bg-white/10 text-violet-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white/20">
                  #{data?.visit?.visit_number}
                </span>
                <span className="bg-white/10 text-violet-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white/20 flex items-center gap-1">
                  {data?.visit?.age} سنة
                </span>
                <span className="bg-white/10 text-violet-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white/20">
                  {data?.visit?.gender === 'male' ? 'ذكر' : 'أنثى'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            {isPendingTab && (
              <button 
                onClick={async () => {
                  if (onStartAll) {
                    await onStartAll(visitId);
                    onClose();
                  }
                }}
                className="mr-6 hidden sm:flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-xl font-bold shadow-inner backdrop-blur-md hover:bg-white/20 transition-all border border-white/20"
              >
                <CheckCircle size={18} />
                استلام جميع العينات
              </button>
            )}
            <div className="w-px h-8 bg-white/20 mx-2 hidden sm:block"></div>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-xl transition-all backdrop-blur-md shadow-sm border border-transparent">
              {isFullscreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-red-500/30 hover:text-red-200 text-white/80 rounded-xl transition-all backdrop-blur-md shadow-sm border border-transparent">
              <X size={18}/>
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          {loading ? (
            <div className="p-8 w-full h-full flex items-center justify-center">
              <div className="animate-spin w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full"></div>
            </div>
          ) : (
            <div className="flex flex-1 w-full h-full">
              
              <div className={`flex flex-col h-full bg-white transition-all duration-300 w-full`}>
                
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white z-10">
                  <div className="flex flex-col">
                    <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                      <LayoutGrid size={18} className="text-violet-500" />
                      مساحة عمل التحاليل المخبرية
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-black">{workspaceRequests.length}</span>
                    </h3>
                  </div>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white text-violet-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>
                      <List size={14} />
                    </button>
                    <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white text-violet-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>
                      <LayoutGrid size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
                  
                  {(data?.visit?.allergies || data?.visit?.chronic_diseases) && (
                    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {data?.visit?.allergies && (
                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 shadow-sm">
                          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-500 flex items-center justify-center shrink-0">
                            <AlertCircle size={20} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-rose-800 mb-0.5 block">الحساسية</span>
                            <p className="text-sm font-semibold text-rose-700 leading-relaxed">{data.visit.allergies}</p>
                          </div>
                        </div>
                      )}
                      {data?.visit?.chronic_diseases && (
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3 shadow-sm">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-500 flex items-center justify-center shrink-0">
                            <Activity size={20} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-amber-800 mb-0.5 block">الأمراض المزمنة</span>
                            <p className="text-sm font-semibold text-amber-700 leading-relaxed">{data.visit.chronic_diseases}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {workspaceRequests.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 opacity-80 transition-opacity duration-300">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <FlaskConical size={32} className="text-slate-300" />
                      </div>
                      <p className="font-bold text-sm text-slate-500">لا توجد تحاليل في هذا القسم</p>
                    </div>
                  ) : (
                    <div className={`${viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6" : "flex flex-col gap-3 max-w-4xl mx-auto"}`}>
                      {workspaceRequests.map((req) => {
                      const isCompleted = req.status === "completed";
                      const isInProgress = req.status === "in_progress";
                      const isResultUploaded = req.status === "result_uploaded";
                      
                      return (
                        <div key={req.id} className={`group relative bg-white rounded-3xl p-5 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/50 border ${isCompleted ? "border-emerald-100" : isResultUploaded ? "border-indigo-100" : isInProgress ? "border-purple-100" : "border-slate-100 hover:border-violet-200"} ${viewMode === "list" ? "flex flex-row items-center gap-4" : "flex flex-col h-full min-h-[190px]"}`}>
                          
                          {viewMode === "grid" && (
                            <div className={`absolute top-0 right-0 w-full h-1.5 rounded-t-3xl ${isCompleted ? "bg-emerald-400" : isResultUploaded ? "bg-indigo-400" : isInProgress ? "bg-purple-400" : "bg-gradient-to-r from-violet-400 to-violet-300"}`}></div>
                          )}
                          {viewMode === "list" && (
                            <div className={`absolute top-0 right-0 w-1.5 h-full rounded-r-3xl ${isCompleted ? "bg-emerald-400" : isResultUploaded ? "bg-indigo-400" : isInProgress ? "bg-purple-400" : "bg-gradient-to-b from-violet-400 to-violet-300"}`}></div>
                          )}

                          <div className={`flex-1 flex ${viewMode === "list" ? "items-center justify-between pl-2 pr-4" : "flex-col justify-start pt-2"}`}>
                            
                            <div className={`flex ${viewMode === "list" ? "items-center gap-5 flex-1" : "justify-between items-start mb-4"}`}>
                              <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${isCompleted ? "bg-emerald-50 text-emerald-500 border-emerald-100" : isResultUploaded ? "bg-indigo-50 text-indigo-500 border-indigo-100" : isInProgress ? "bg-purple-50 text-purple-500 border-purple-100" : "bg-violet-50 text-violet-500 border-violet-100 group-hover:scale-110 transition-transform duration-300"}`}>
                                  <FlaskConical size={22} strokeWidth={2.5} />
                                </div>
                                <div className="flex flex-col mt-0.5">
                                  <h4 className="font-black text-slate-800 text-[14px] sm:text-[15px] leading-tight line-clamp-2" title={req.name}>
                                    {req.name}
                                  </h4>
                                  {req.category_name && (
                                    <span className="text-[11px] font-bold text-slate-400 mt-1.5 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                      {req.category_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className={`shrink-0 ${viewMode === "list" ? "mr-4" : ""}`}>
                                <span className={`text-[10px] sm:text-[11px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm border ${isCompleted ? "text-emerald-700 bg-emerald-50 border-emerald-100" : isResultUploaded ? "text-indigo-700 bg-indigo-50 border-indigo-100" : isInProgress ? "text-purple-700 bg-purple-50 border-purple-100" : "text-violet-700 bg-violet-50 border-violet-100"}`}>
                                  {isCompleted && <CheckCircle size={14} />}
                                  {isCompleted ? "مكتمل" : isResultUploaded ? "نتيجة محفوظة ✓" : isInProgress ? "قيد الإجراء" : "قيد الانتظار"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className={`flex gap-3 ${viewMode === "list" ? "shrink-0" : "mt-auto pt-4 border-t border-slate-100"}`}>
                            {req.status === "paid" && (
                                <button onClick={() => handleStartIndividualRequest(req.id)} className="w-full text-xs font-black text-white bg-violet-600 hover:bg-violet-700 py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:shadow-violet-500/30">
                                  <Activity size={16} /> استلام وبدء التحليل
                                </button>
                            )}
                            
                            {req.status !== "paid" && (
                              <div className="flex w-full gap-2">
                                <button onClick={() => setUploadingItem(req)} className={`flex-1 text-xs font-black py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border ${isResultUploaded || isCompleted ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 shadow-sm' : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200'}`}>
                                  {isResultUploaded || isCompleted ? <><Edit size={16} /> تعديل النتيجة</> : <><UploadCloud size={16} /> إدخال النتيجة</>}
                                </button>
                                {isResultUploaded && !isCompleted && (
                                  <button onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleDeliverRequest(req.id);
                                  }} className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors" title="تسليم النتيجة">
                                    <CheckCircle size={18} />
                                  </button>
                                )}
                                {(isCompleted || isResultUploaded) && (
                                  <button onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setViewResultItem(req);
                                  }} className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors" title="عرض النتيجة والتفاصيل">
                                    <FileText size={18} />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Floating Action Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-between items-center z-20 flex-shrink-0">
          <div className="text-xs font-bold text-slate-400 hidden sm:block flex-1">
            {isPendingTab ? (
              <span className="flex items-center gap-2 text-indigo-500"><AlertCircle size={16}/> استلم جميع العينات أولاً لبدء التحاليل.</span>
            ) : isCompletedTab ? (
              <span className="flex items-center gap-2 text-emerald-500"><CheckCircle size={16}/> هذه الزيارة مكتملة. يمكنك تعديل النتائج إذا لزم الأمر.</span>
            ) : isAllDone ? (
              <span className="flex items-center gap-2 text-emerald-500"><CheckCircle size={16}/> تم تسليم جميع النتائج. يمكنك الآن إنهاء الزيارة لإشعار الطبيب.</span>
            ) : (
              <span className="flex items-center gap-2 text-violet-500"><AlertCircle size={16}/> يجب إكمال واعتماد نتائج جميع التحاليل قبل إنهاء الزيارة.</span>
            )}
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-black py-2.5 px-6 rounded-xl transition-all">
              إغلاق
            </button>
            
            {!isCompletedTab && !isPendingTab && (
              <button 
                onClick={handleFinishPatient} 
                disabled={!isAllDone || completing} 
                className={`flex-1 sm:flex-none font-black py-2.5 px-8 rounded-xl transition-all flex items-center justify-center gap-2 ${
                  isAllDone 
                    ? "bg-slate-800 hover:bg-slate-900 text-white shadow-lg shadow-slate-800/20" 
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {completing ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" /> : <CheckCircle size={16} />}
                إنهاء وتسليم الملف
              </button>
            )}
          </div>
        </div>
      </div>

      {uploadingItem && (
        <LabUploadResultModal
          isEditMode={uploadingItem.status === 'result_uploaded' || uploadingItem.status === 'completed'}
          endpoint={`/api/lab/request/${uploadingItem.id}/result`}
          initialNotes={uploadingItem.result_notes || ""}
          initialFiles={uploadingItem.result_file || null}
          token={token}
          onClose={handleUploadClose}
          onUploaded={handleUploaded}
        />
      )}
      {viewResultItem && (
        <LabResultDetailsModal 
          request={viewResultItem} 
          onClose={() => setViewResultItem(null)} 
        />
      )}
    </div>,
    document.body
  );
};

// ── Lab Record Detail Modal (Reports Read-Only Mode) ────────────────────────────────────────────────
export const LabRecordDetailModal = ({ visitId, token, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMaximized, setIsMaximized] = useState(() => localStorage.getItem("labFullscreen") === "true");
  const [viewResultItem, setViewResultItem] = useState(null);

  useEffect(() => {
    localStorage.setItem("labFullscreen", isMaximized);
  }, [isMaximized]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/lab/visit/${visitId}`, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        setData(json);
      } catch {
        toast.error('فشل تحميل تفاصيل الزيارة');
      } finally {
        setLoading(false);
      }
    };
    if (visitId) load();
  }, [visitId, token]);

  const visit = data?.visit;
  const requests = data?.requests || [];
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* ── Main Modal ── */}
      <div className={`relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] ${isMaximized ? 'w-[98vw] h-[98vh] rounded-[2.5rem] border border-white' : 'w-full max-w-4xl h-[88vh] rounded-[2.5rem] border border-white/60'}`}>
        
        {(loading || !data) && (
          <div className="flex flex-col items-center justify-center min-h-[400px] w-full bg-[#f8fafc] absolute inset-0 z-50">
            <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Header */}
        <div className="bg-gradient-to-br from-violet-900 to-indigo-900 px-6 py-6 flex justify-between items-start relative overflow-hidden text-white flex-shrink-0 border-b border-indigo-950/50">
          <div className="absolute inset-0 bg-white/40 mix-blend-overlay"></div>
          <div className="relative z-10 flex gap-4 items-center">
            <div className="w-16 h-16 rounded-[1.25rem] bg-white/10 shadow-inner flex items-center justify-center border border-white/20 text-violet-200 font-black text-2xl flex-shrink-0 backdrop-blur-sm">
              {visit?.full_name?.charAt(0) || visit?.patient_name?.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{visit?.full_name || visit?.patient_name}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="bg-white/10 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white/20">#{visit.visit_number}</span>
                <span className="bg-white/10 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white/20 flex items-center gap-1.5"><Calendar size={12}/> {visit.age ?? '-'} سنة</span>
                <span className="bg-white/10 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white/20">{visit.gender === 'male' ? 'ذكر' : visit.gender === 'female' ? 'أنثى' : '-'}</span>
                <span className="bg-white/10 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white/20">{new Date(visit.created_at || visit.date || new Date()).toLocaleDateString('ar-EG')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <span className="bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-black shadow-sm border border-white/30 hidden sm:block">
              التحاليل المنفذة: {requests.length}
            </span>
            <button onClick={() => setIsMaximized(v => !v)} className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white/80 hover:text-white rounded-xl transition-all shadow-sm border border-transparent backdrop-blur-sm">
              {isMaximized ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-white/80 rounded-xl transition-all shadow-sm border border-transparent backdrop-blur-sm">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 bg-slate-50/30">
          <div className="p-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4">التحليل</th>
                    <th className="px-5 py-4 text-center">القسم</th>
                    <th className="px-5 py-4 text-center">الحالة</th>
                    <th className="px-5 py-4 text-center">النتائج</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((req, idx) => (
                    <tr key={idx} className="hover:bg-violet-50/30 transition-colors group">
                      <td className="px-5 py-4 font-black text-slate-700 text-sm">
                        <div className="flex items-center gap-2">
                          <FlaskConical size={16} className="text-violet-500" />
                          {req.name || req.test_name}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1.5 rounded-lg text-[10px] font-bold shadow-sm">
                          {req.category_name}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1.5 shadow-sm border ${req.status === 'completed' || req.status === 'result_uploaded' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-violet-50 text-violet-700 border-violet-100'}`}>
                          {req.status === 'completed' || req.status === 'result_uploaded' ? 'منجز' : 'قيد الإجراء'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-center gap-2">
                          {(req.status === 'completed' || req.status === 'result_uploaded') ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); setViewResultItem(req); }}
                              className="px-4 py-1.5 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center hover:bg-violet-100 transition-colors border border-violet-100 font-bold text-xs gap-1.5 shadow-sm"
                              title="عرض النتائج"
                            >
                              <FileText size={14} />
                              عرض النتائج
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold flex items-center justify-center px-4 py-1.5">لا توجد نتائج</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-slate-400 font-bold">لا توجد فحوصات</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {viewResultItem && (
        <LabResultDetailsModal 
          request={viewResultItem} 
          onClose={() => setViewResultItem(null)} 
        />
      )}
    </div>,
    document.body
  );
};


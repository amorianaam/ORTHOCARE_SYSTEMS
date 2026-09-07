import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  X,
  UploadCloud,
  Eye,
  Trash2,
  CheckCircle,
  Minimize2,
  Maximize2,
  Check,
  LayoutGrid,
  List,
  Plus,
  Film,
  Image as ImageIcon,
  Edit,
  Radiation,
  Calendar,
  Activity,
  CheckSquare,
  AlertCircle
} from "lucide-react";
import { toast } from "react-toastify";
import { getSocket } from "../../utils/socket";
// ── Backend Base URL (used to bypass CRA historyApiFallback for iframes) ──
const BACKEND_URL = 'http://localhost:5000';

// ── Resolves any file object to a usable URL for <iframe> and <img> ──
const resolveFileUrl = (file) => {
  if (file.previewUrl) return file.previewUrl;
  if (file.url) return file.url.startsWith('http') ? file.url : `${BACKEND_URL}${file.url}`;
  return file.base64 || null;
};

// ── Shared Result Preview Modal ──────────────────────────────────────
const SharedResultPreviewModal = ({ file, onClose }) => {
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  if (!file) return null;

  return (
    <div className="fixed inset-0 z-[100008] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" dir="rtl">
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
          ) : (file.type === "application/pdf" || ((file.base64 && file.base64.startsWith("data:application/pdf")) || (file.url && file.url.endsWith(".pdf")))) ? (
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


// ── Radiology Result Details Modal ──────────────────────────────────────
const RadiologyResultDetailsModal = ({ request, onClose }) => {
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
    <div className="fixed inset-0 z-[100005] flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-full max-w-4xl h-auto max-h-[85vh] rounded-[2.5rem] border border-white/60">
        
        <div className="px-6 py-5 flex items-center justify-between bg-white border-b border-slate-100 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center shadow-sm border border-blue-100">
              <CheckCircle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">التقرير الإشعاعي والنتائج</h2>
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
              <FileText size={18} className="text-blue-500" />
              الملاحظات والنتائج النصية
            </label>
            <div className="w-full h-auto bg-white border-2 border-slate-100 rounded-2xl p-5 text-slate-700 font-semibold leading-loose shadow-sm text-[14px]">
              {request.result_notes ? (
                <div className="whitespace-pre-wrap break-words">{request.result_notes}</div>
              ) : (
                <div className="py-6 flex items-center justify-center text-slate-400 italic">لا توجد ملاحظات نصية مسجلة.</div>
              )}
            </div>
          </div>
          
          <div className="w-full flex flex-col gap-3">
            <label className="text-base font-black text-slate-700 flex items-center gap-2">
              <UploadCloud size={18} className="text-blue-500" />
              الصور والمرفقات الرقمية
            </label>
            <div className="flex flex-col gap-3">
              {files.length === 0 && (
                <div className="w-full min-h-[120px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold">
                  لا توجد صور أو مرفقات
                </div>
              )}
              {files.map((file, idx) => (
                <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group" onClick={() => setPreviewFile(file)}>
                  <div className="flex items-center gap-5 overflow-hidden">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:bg-blue-50 transition-colors">
                      {(file.type && file.type.startsWith("image/")) || (file.base64 && file.base64.startsWith("data:image/")) || (file.url && (file.url.endsWith(".jpg") || file.url.endsWith(".png") || file.url.endsWith(".jpeg") || file.url.endsWith(".webp"))) ? (
                        <img src={resolveFileUrl(file)} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <FileText size={22} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                      )}
                    </div>
                    <span className="text-sm font-bold text-slate-700 break-all line-clamp-2 group-hover:text-blue-700 transition-colors leading-snug">{file.name || 'ملف مرفق'}</span>
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-100 transition-colors">
                    <Eye size={22} />
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

// ── Upload Result Modal ───────────────────────────────────────────
const UploadResultModal = ({ endpoint, initialNotes = "", initialFiles, token, onClose, onUploaded }) => {
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
    // Cleanup generated object URLs on unmount to prevent memory leaks
    return () => {
      filesRef.current.forEach(f => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (initialFiles) {
      try {
        const parsed = JSON.parse(initialFiles);
        setFiles(parsed);
      } catch (e) {
        // Silently ignore invalid JSON
      }
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
      if (newFiles[idx].previewUrl) {
        URL.revokeObjectURL(newFiles[idx].previewUrl);
      }
      newFiles.splice(idx, 1);
      return newFiles;
    });
  };

  const handlePreview = (f) => {
    setPreviewFile(f);
  };

  const convertToBase64 = (file) => {
    if (file.base64) return Promise.resolve(file);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve({
        name: file.name,
        base64: reader.result,
        type: file.type
      });
      reader.onerror = (error) => reject(error);
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
          formData.append("files", f);
        } else {
          existingFiles.push(f);
        }
      });
      
      if (existingFiles.length > 0) {
        formData.append("existingFiles", JSON.stringify(existingFiles));
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "فشل الحفظ");

      toast.success("تم حفظ النتيجة بنجاح");
      onUploaded();
    } catch (err) {
      toast.error("حدث خطأ أثناء رفع الملفات، يرجى المحاولة لاحقاً");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-full max-w-3xl h-auto max-h-[85vh] sm:max-h-[80vh] rounded-[2.5rem] border border-white/60">
        
        {/* Fixed Header */}
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0 bg-white border-b border-slate-100 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black shadow-inner border border-blue-100">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="font-black text-slate-800 text-xl tracking-tight">إرفاق النتيجة والتقرير</h2>
              <p className="text-slate-500 font-medium text-xs mt-1">قم بكتابة التقرير الإشعاعي وإرفاق الصور الرقمية لدراسة الحالة.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl transition-all border border-slate-200">
            <X size={18}/>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-slate-50/50 flex flex-col lg:flex-row gap-6">
          
          {/* Right Area: Medical Notepad */}
          <div className="w-full lg:w-1/2 flex flex-col gap-3">
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <FileText size={16} className="text-blue-500" />
              كتابة التقرير الإشعاعي
            </label>
            <div className="relative w-full">
              <textarea
                ref={textareaRef}
                autoFocus
                className="w-full bg-white shadow-inner rounded-xl p-5 text-slate-700 font-medium leading-relaxed focus:ring-2 focus:ring-blue-500 border border-slate-200 transition-all resize-none placeholder-slate-300 overflow-hidden"
                style={{ minHeight: '60px' }}
                placeholder="اكتب التقرير الطبي والتشخيص هنا..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Left Area: Immersive Drop-Zone */}
          <div className="w-full lg:w-1/2 flex flex-col gap-3">
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <UploadCloud size={16} className="text-blue-500" />
              إرفاق الصور والمرفقات الرقمية
            </label>
            
            <input
              type="file"
              multiple
              accept="image/jpeg, image/png, image/jpg, image/webp, application/pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <div 
              onClick={() => fileInputRef.current.click()} 
              className="w-full flex-1 min-h-[120px] border-dashed border-2 border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors p-4 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:border-blue-200 transition-all duration-300 group-hover:scale-110">
                <UploadCloud size={24} />
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700 text-sm group-hover:text-blue-600 transition-colors">اسحب وأفلت الملفات هنا أو انقر للاستعراض</p>
                <p className="font-bold text-slate-400 text-xs mt-1">يدعم صيغ الصور (JPG, PNG) وملفات PDF</p>
              </div>
            </div>

            {/* Attached Files List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                <h4 className="text-[11px] font-black text-slate-500 mb-2">الملفات المرفقة ({files.length})</h4>
                {files.map((f, idx) => {
                  const isImage = (f.type && f.type.startsWith("image/")) || (f.url && !f.url.endsWith(".pdf")) || (f.base64 && f.base64.startsWith("data:image"));
                  return (
                  <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 p-1.5 rounded-xl shadow-sm hover:border-blue-200 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      {isImage ? (
                        <img src={resolveFileUrl(f)} alt={f.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200 shadow-sm flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-red-50 text-red-500 flex items-center justify-center rounded-lg border border-red-100 shadow-sm flex-shrink-0">
                          <FileText size={20} />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-xs text-slate-700 break-all line-clamp-2 leading-tight" title={f.name}>{f.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">{f.size ? (f.size / 1024 / 1024).toFixed(2) + " MB" : "مرفق محفوظ"}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 ml-2">
                      <button onClick={(e) => { e.stopPropagation(); handlePreview(f); }} className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 p-2.5 rounded-xl transition-all" title="معاينة المرفق">
                        <Eye size={16} />
                      </button>
                      <button onClick={(e) => removeFile(e, idx)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-xl transition-all" title="حذف المرفق">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>

        </div>

        {/* Fixed Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-between items-center z-20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
           <div className="text-xs font-bold text-slate-400 hidden sm:block">
             تأكد من مطابقة التقرير مع الفحص قبل الاعتماد
           </div>
           <div className="flex gap-3 w-full sm:w-auto">
             <button onClick={onClose} disabled={saving} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-black text-sm transition-colors border border-slate-200 bg-white">
               إلغاء
             </button>
             <button onClick={handleSave} disabled={saving || (files.length === 0 && !notes)} className="flex-1 sm:flex-none px-8 py-2.5 rounded-xl bg-blue-700 text-white font-black text-sm hover:bg-blue-800 transition-all shadow-md shadow-blue-700/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2">
               {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <CheckCircle size={16} />}
               حفظ النتيجة
             </button>
           </div>
        </div>
      </div>
      
      {/* File Preview Sub-Modal */}
      <SharedResultPreviewModal 
        file={previewFile} 
        onClose={() => setPreviewFile(null)} 
      />
    </div>,
    document.body
  );
};

// ── Film Grouping Modal ───────────────────────────────────────────
const FilmGroupingModal = ({ visitId, requests, token, onClose, onGrouped, initialFilm }) => {
  const [filmSize, setFilmSize] = useState(initialFilm ? initialFilm.film_size : "large");
  
  const currentLinkedReqs = initialFilm ? requests.filter(r => r.radiology_film_id === initialFilm.id) : [];
  const [selectedReqs, setSelectedReqs] = useState(currentLinkedReqs.map(r => r.id));
  const [saving, setSaving] = useState(false);

  const unassigned = requests.filter((r) => r.status !== "paid" && r.with_film === 1 && (!r.radiology_film_id || (initialFilm && r.radiology_film_id === initialFilm.id)));
  const maxSlots = filmSize === "large" ? 6 : 2;

  const handleSave = async () => {
    if (selectedReqs.length === 0) return toast.error("يجب تحديد دراسة إشعاعية واحدة على الأقل");
    if (selectedReqs.length > maxSlots) return toast.error(`الحد الأقصى لحجم الفيلم هو ${maxSlots}`);

    setSaving(true);
    try {
      if (initialFilm) {
        await fetch(`/api/radiology/films/${initialFilm.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      const res = await fetch(`/api/radiology/visit/${visitId}/films`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ filmSize, requestIds: selectedReqs }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        onGrouped();
        onClose();
      } else toast.error(d.message);
    } catch {
      toast.error("خطأ في الاتصال الخادم");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = (id) => {
    if (selectedReqs.includes(id)) {
      setSelectedReqs(selectedReqs.filter((r) => r !== id));
    } else {
      if (selectedReqs.length >= maxSlots) {
         toast.info(`الفيلم ممتلئ! (الحد الأقصى ${maxSlots})`);
         return;
      }
      setSelectedReqs([...selectedReqs, id]);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-full max-w-5xl h-[80vh] rounded-[2.5rem] border border-white/60">
        
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0 bg-white border-b border-slate-100 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black shadow-inner border border-blue-100">
              <LayoutGrid size={24} />
            </div>
            <div>
              <h2 className="font-black text-slate-800 text-xl tracking-tight">أستوديو تحضير الأفلام الطبية</h2>
              <p className="text-slate-500 font-medium text-xs mt-1">قم بتحديد حجم الفيلم وتوزيع الدراسات الإشعاعية عليه بدقة.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-xl transition-all border border-slate-200">
            <X size={18}/>
          </button>
        </div>

        {/* Dual-Pane Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Pane: Available Scans */}
          <div className="w-full md:w-1/2 flex flex-col bg-white border-l border-slate-100 relative z-10 h-full">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-black text-slate-700 text-sm flex items-center gap-2">
                <List size={16} className="text-slate-400" />
                الدراسات المتاحة للتجميع
              </h3>
              <span className="bg-white border border-slate-200 text-slate-600 font-black text-[10px] px-2 py-0.5 rounded-lg">
                {unassigned.length} متاح
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-slate-50/50">
              {unassigned.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-blue-600 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                  <CheckCircle size={32} className="mb-3 opacity-80" />
                  <p className="font-black text-sm">جميع الدراسات مكتملة الإدراج</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unassigned.map((r) => {
                    const isSelected = selectedReqs.includes(r.id);
                    return (
                      <div 
                        key={r.id} 
                        onClick={() => toggleSelection(r.id)} 
                        className={`group cursor-pointer flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 ${isSelected ? "border-blue-500 bg-blue-50/30 shadow-sm" : "border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors ${isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-200 bg-slate-50 group-hover:border-blue-300"}`}>
                            {isSelected && <Check size={14} strokeWidth={3} />}
                          </div>
                          <span className={`font-bold text-sm ${isSelected ? "text-blue-900" : "text-slate-700"}`}>
                            {r.name}
                          </span>
                        </div>
                        {!isSelected && (
                           <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-blue-50 text-blue-600 p-1.5 rounded-lg">
                             <Plus size={16} />
                           </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Pane: Visual Canvas */}
          <div className="w-full md:w-1/2 flex flex-col bg-slate-100 relative h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-100 pointer-events-none"></div>
            
            <div className="px-6 py-4 bg-white/60 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between z-10">
              <div className="flex flex-col">
                <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                  <Film size={16} className="text-blue-500" />
                  محتوى الفيلم الحالي
                </h3>
                <span className="text-xs font-bold text-slate-500 mt-1">
                  عدد الدراسات المدرجة: <span className="text-blue-600 font-black">{selectedReqs.length}</span> / {maxSlots}
                </span>
              </div>
              
              <div className="flex bg-slate-200/50 p-1 rounded-xl">
                <button onClick={() => { setFilmSize("small"); setSelectedReqs([]); }} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filmSize === "small" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  فيلم S
                </button>
                <button onClick={() => { setFilmSize("large"); setSelectedReqs([]); }} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filmSize === "large" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  فيلم L
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 sm:p-10 flex items-center justify-center relative z-10 overflow-y-auto custom-scrollbar">
              {/* Film Visualizer */}
              <div className="w-full max-w-xs bg-slate-800 rounded-lg p-2 shadow-2xl flex flex-col gap-2 transition-all duration-300 min-h-[280px] h-auto">
                <div className="flex justify-between items-center px-2 py-1 mb-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => <div key={i} className="w-2 h-2 rounded-sm bg-white/20"></div>)}
                  </div>
                  <span className="text-white/40 font-black text-[10px] tracking-widest">{filmSize === "large" ? "LARGE FILM" : "SMALL FILM"}</span>
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => <div key={i} className="w-2 h-2 rounded-sm bg-white/20"></div>)}
                  </div>
                </div>

                {/* Slots */}
                <div className={filmSize === "large" ? "flex-1 grid grid-cols-2 gap-2" : "flex-1 flex flex-col gap-2"}>
                  {Array.from({ length: maxSlots }).map((_, idx) => {
                  const reqId = selectedReqs[idx];
                  const req = reqId ? unassigned.find(r => r.id === reqId) : null;
                  
                  return (
                    <div key={idx} onClick={() => reqId && toggleSelection(reqId)} className={`flex-1 rounded border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-2 ${req ? "border-transparent bg-slate-900/80 cursor-pointer hover:bg-red-500/20 group relative overflow-hidden" : "border-slate-600 bg-slate-800/50"}`}>
                       {req ? (
                         <>
                           <ImageIcon size={24} className="text-slate-400 group-hover:text-red-400 transition-colors" />
                           <span className="font-bold text-white text-xs px-4 text-center">{req.name}</span>
                           <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                             <Trash2 size={24} className="text-red-500" />
                           </div>
                         </>
                       ) : (
                         <>
                           <Plus size={20} className="text-slate-600" />
                           <span className="font-bold text-slate-500 text-[10px]">فتحة فارغة</span>
                         </>
                       )}
                    </div>
                  );
                })}
                </div>
                
                <div className="flex justify-between items-center px-2 py-1 mt-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => <div key={i} className="w-2 h-2 rounded-sm bg-white/20"></div>)}
                  </div>
                  <div className="flex gap-1">
                    {[1,2,3,4].map(i => <div key={i} className="w-2 h-2 rounded-sm bg-white/20"></div>)}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-between items-center z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
               <div className="text-xs font-bold text-slate-400 hidden sm:block">
                 تم تحديد <span className="text-blue-600 font-black">{selectedReqs.length}</span> من أصل <span className="text-slate-600 font-black">{maxSlots}</span>
               </div>
               <div className="flex gap-3 w-full sm:w-auto">
                 <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 font-black text-sm transition-colors border border-slate-200 bg-white">
                   إلغاء
                 </button>
                 <button onClick={handleSave} disabled={saving || selectedReqs.length === 0} className="flex-1 sm:flex-none px-8 py-2.5 rounded-xl bg-blue-700 text-white font-black text-sm hover:bg-blue-800 transition-all shadow-md shadow-blue-700/20 disabled:opacity-50 disabled:shadow-none">
                   {saving ? "جاري الحفظ..." : "اعتماد الفيلم المطبوع"}
                 </button>
               </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── Patient Detail Panel (Centered Modal) ──────────────────────────
const PatientDetailPanel = ({ visitId, token, onClose, onCompleted, onStartAll, activeTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingItem, setUploadingItem] = useState(null);
  const [viewResultItem, setViewResultItem] = useState(null);
  const [groupingMode, setGroupingMode] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => localStorage.getItem("radiologyFullscreen") === "true");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("radiologyViewMode") || "grid");
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, filmId: null });

  const isMountedRef = useRef(true);
  const initialWorkspaceLength = useRef(-1);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    localStorage.setItem("radiologyFullscreen", isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    localStorage.setItem("radiologyViewMode", viewMode);
  }, [viewMode]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/radiology/visit/${visitId}`, { headers: { Authorization: `Bearer ${token}` } });
      setData(await res.json());
    } catch {
      toast.error("فشل تحميل التفاصيل");
    } finally {
      setLoading(false);
    }
  }, [visitId, token]);

  useEffect(() => { load(); }, [load]);

  const handleDeleteFilm = async (filmId) => {
    setDeleteConfirm({ isOpen: true, filmId });
  };

  const confirmDeleteFilm = async () => {
    const filmId = deleteConfirm.filmId;
    if (!filmId) return;
    try {
      await fetch(`/api/radiology/films/${filmId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      toast.success("تم حذف الفيلم وفك ارتباط الفحوصات");
      const socket = getSocket();
      socket.emit("radiology:updated", { visitId });
      load();
    } catch {
      toast.error("فشل الحذف");
    } finally {
      setDeleteConfirm({ isOpen: false, filmId: null });
    }
  };

  const handleSafeClose = () => {
    onClose();
  };

  const handleFinishPatient = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/radiology/visit/${visitId}/complete`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        onCompleted?.();
        onClose();
        return;
      } else toast.error(d.message);
    } catch {
      toast.error("تعذر الاتصال");
    } finally {
      if (isMountedRef.current) {
        setCompleting(false);
      }
    }
  };

  const handleStartIndividualRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/radiology/request/${requestId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "in_progress" }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success("تم تحويل الفحص لغرفة التصوير بنجاح");
        const socket = getSocket();
        socket.emit("radiology:updated", { visitId });
        load();
      } else toast.error(d.message);
    } catch {
      toast.error("فشل التنفيذ");
    }
  };

  const handleDeliverRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/radiology/request/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'completed' }),
      });
      const d = await res.json();
      if (res.ok) {
        toast.success('تم تسليم النتيجة بنجاح');
        const socket = getSocket();
        socket.emit('radiology:updated', { visitId });
        load();
      } else toast.error(d.message);
    } catch {
      toast.error('فشل التنفيذ');
    }
  };

  const handleDeliverFilm = async (filmId) => {
    const filmReqs = requests.filter(r => r.radiology_film_id === filmId);
    
    try {
      await Promise.all(filmReqs.map(req =>
        fetch(`/api/radiology/request/${req.id}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: 'completed' }),
        })
      ));
      
      toast.success('تم تسليم نتيجة الفيلم بنجاح');
      const socket = getSocket();
      socket.emit('radiology:updated', { visitId });
      load();
    } catch {
      toast.error('فشل التنفيذ');
    }
  };

  const requests = useMemo(() => data?.requests || [], [data?.requests]);
  const films = useMemo(() => data?.films || [], [data?.films]);
  
  const workspaceRequests = useMemo(() => {
    let list = [...requests];
    if (activeTab === "pending") {
      list = list.filter(r => r.status === "paid");
    } else if (activeTab === "in_progress") {
      list = list.filter(r => r.status === "in_progress");
    } else if (activeTab === "completed") {
      list = list.filter(r => r.status === "completed");
    }

    // Phase 2: Smart Sorting for the workspace
    return list.sort((a, b) => {
      // 1. Orphaned Scans (needs film but not grouped)
      const aIsOrphaned = a.with_film === 1 && !a.radiology_film_id;
      const bIsOrphaned = b.with_film === 1 && !b.radiology_film_id;
      
      if (aIsOrphaned && !bIsOrphaned) return -1;
      if (!aIsOrphaned && bIsOrphaned) return 1;

      // 2. Ready for Delivery Scans (result uploaded but not delivered)
      const aIsReady = (a.result_file || a.result_notes) && a.status !== "completed";
      const bIsReady = (b.result_file || b.result_notes) && b.status !== "completed";
      
      if (aIsReady && !bIsReady) return -1;
      if (!aIsReady && bIsReady) return 1;

      // 3. Default fallback (by ID) to keep list stable
      return a.id - b.id;
    });
  }, [requests, activeTab]);

  const { unassignedFilmsCount, isAllDone, hasPending } = useMemo(() => ({
    unassignedFilmsCount: requests.filter((r) => r.status === "in_progress" && r.with_film === 1 && !r.radiology_film_id).length,
    isAllDone: requests.length > 0 && requests.every((r) => r.status === "completed"),
    hasPending: requests.some((r) => r.status === "paid")
  }), [requests]);

  useEffect(() => {
    if (!loading && data) {
      if (initialWorkspaceLength.current === -1) {
        initialWorkspaceLength.current = workspaceRequests.length;
      }
    }
  }, [loading, data, workspaceRequests.length]);

  // Phase 3: Auto-Close Safety Check
  useEffect(() => {
    if (!loading && data && initialWorkspaceLength.current > 0 && workspaceRequests.length === 0) {
      toast.info("تم نقل الفحص للتبويب التالي بنجاح");
      onCompleted?.();
    }
  }, [loading, data, workspaceRequests.length, onCompleted]);

  const handleUploadClose = useCallback(() => setUploadingItem(null), []);
  
  const handleUploaded = useCallback(() => {
    setUploadingItem(null);
    load();
  }, [load]);

  const handleGroupingClose = useCallback(() => setGroupingMode(false), []);
  const handleGrouped = useCallback(() => { setGroupingMode(false); load(); }, [load]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={handleSafeClose} />

      <div className={`relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] ${isFullscreen ? 'w-[98vw] h-[98vh] rounded-[2.5rem] border border-white' : 'w-full max-w-6xl h-[88vh] rounded-[2.5rem] border border-white/60'}`}>
        
        {/* Out of the Box Premium Header - Restored Colors */}
        <div className="relative px-6 py-5 flex items-center justify-between flex-shrink-0 bg-gradient-to-br from-blue-700 to-blue-500 shadow-lg shadow-blue-500/20">
          {/* Subtle overlay texture */}
          <div className="absolute inset-0 bg-white/10 mix-blend-overlay"></div>
          
          <div className="flex items-center gap-5 relative z-10">
            {/* Avatar block */}
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-white/20 shadow-inner flex items-center justify-center text-white font-black text-2xl border border-white/20">
                {data?.visit?.full_name?.charAt(0) || <Radiation size={24} />}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-blue-600 rounded-full"></div>
            </div>

            <div className="flex flex-col">
              <h2 className="font-black text-white text-xl tracking-tight">
                {data?.visit?.full_name || "جاري تحميل البيانات..."}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="bg-white/15 text-blue-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-inner backdrop-blur-sm border border-white/20">
                  #{data?.visit?.visit_number}
                </span>
                <span className="bg-white/15 text-blue-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-inner backdrop-blur-sm border border-white/20 flex items-center gap-1">
                  <Calendar size={12}/> {data?.visit?.age} سنة
                </span>
                <span className="bg-white/15 text-blue-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-inner backdrop-blur-sm border border-white/20">
                  {data?.visit?.gender === 'male' ? 'ذكر' : 'أنثى'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            {/* Quick Actions in Header */}
            {activeTab === "pending" && hasPending && (
              <button onClick={() => { onStartAll(visitId); onClose(); }} className="mr-4 hidden sm:flex text-xs font-black items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all shadow-sm bg-white text-sky-700 hover:bg-sky-50 border border-transparent active:scale-95">
                <Activity size={14} /> تنفيذ كافة الدراسات الإشعاعية
              </button>
            )}
            
            <div className="w-px h-8 bg-white/20 mx-2 hidden sm:block"></div>

            <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-xl transition-all backdrop-blur-sm border border-white/20 shadow-inner" title={isFullscreen ? "تصغير" : "ملء الشاشة"}>
              {isFullscreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
            </button>
            <button onClick={handleSafeClose} className="w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-red-500 hover:text-white text-white rounded-xl transition-all backdrop-blur-sm border border-white/20 shadow-inner">
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Super Premium Body */}
        <div className="flex-1 flex overflow-hidden relative">
          
          {loading ? (
            <div className="p-8 w-full h-full flex items-center justify-center">
              <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-700 rounded-full"></div>
            </div>
          ) : (
            <div className="flex flex-1 w-full h-full">
              {/* Main Content Area */}
              <div className={`flex flex-col h-full bg-white transition-all duration-300 ${activeTab === "pending" ? "w-full" : "w-full lg:w-3/5 xl:w-2/3 border-l border-slate-100"}`}>
                
                {/* Workspace Toolbar */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white z-10">
                  <div className="flex flex-col">
                    <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                      <LayoutGrid size={18} className="text-blue-500" />
                      مساحة عمل الدراسات الإشعاعية
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-black">{requests.length}</span>
                    </h3>
                  </div>
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>
                      <List size={14} />
                    </button>
                    <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>
                      <LayoutGrid size={14} />
                    </button>
                  </div>
                </div>

                {/* Workspace Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/30">
                  {workspaceRequests.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 opacity-80 transition-opacity duration-300">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <LayoutGrid size={32} className="text-slate-300" />
                      </div>
                      <p className="font-bold text-sm text-slate-500">لا توجد دراسات في هذا القسم</p>
                    </div>
                  ) : (
                    <div className={`${viewMode === "grid" ? `grid grid-cols-1 sm:grid-cols-2 ${activeTab === "pending" ? "lg:grid-cols-3" : "xl:grid-cols-2"} gap-6` : "flex flex-col gap-3 max-w-4xl mx-auto"}`}>
                      {workspaceRequests.map((req) => {
                      const isGrouped = req.with_film === 1 && req.radiology_film_id;
                      const isCompleted = req.status === "completed";
                      const isInProgress = req.status === "in_progress";
                      const isResultUploaded = req.result_file || req.result_notes;
                      const isReadyForDelivery = isResultUploaded && !isCompleted;

                      // Phase 2: Business Rule A & B
                      // Rule A: Scan requires a film → can ONLY be delivered if already linked to one.
                      // Rule B: Digital Save (with_film !== 1) → can always be delivered individually.
                      const canDeliverIndividually = req.with_film !== 1 || (req.with_film === 1 && req.radiology_film_id);
                      
                      return (
                        <div key={req.id} className={`group relative bg-white rounded-[1.25rem] p-4 transition-all duration-300 hover:shadow-lg border ${isCompleted || isReadyForDelivery ? "border-emerald-200" : isInProgress ? "border-violet-200 hover:border-violet-300" : "border-slate-100 hover:border-sky-200"} ${viewMode === "list" ? "flex flex-row items-center gap-4" : "flex flex-col min-h-[170px]"}`}>
                          
                          {/* Left-side accent line for list, Top for grid */}
                          {viewMode === "grid" && (
                            <div className={`absolute top-0 right-0 w-full h-1.5 rounded-t-[1.25rem] ${isCompleted || isReadyForDelivery ? "bg-emerald-500" : isInProgress ? "bg-gradient-to-r from-violet-400 to-violet-500" : "bg-gradient-to-r from-sky-400 to-sky-500"}`}></div>
                          )}
                          {viewMode === "list" && (
                            <div className={`absolute top-0 right-0 w-1.5 h-full rounded-r-[1.25rem] ${isCompleted || isReadyForDelivery ? "bg-emerald-500" : isInProgress ? "bg-gradient-to-b from-violet-400 to-violet-500" : "bg-gradient-to-b from-sky-400 to-sky-500"}`}></div>
                          )}

                          <div className={`flex-1 flex ${viewMode === "list" ? "items-center justify-between pl-2 pr-4" : "flex-col justify-start pt-1"}`}>
                            
                            <div className={`flex ${viewMode === "list" ? "items-center gap-5 flex-1" : "justify-between items-start mb-3"}`}>
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isCompleted || isReadyForDelivery ? "bg-emerald-50 text-emerald-600" : isInProgress ? "bg-violet-50 text-violet-600" : "bg-sky-50 text-sky-600"}`}>
                                  <Activity size={16} />
                                </div>
                                <h4 className="font-black text-slate-800 text-[13px] sm:text-sm leading-relaxed line-clamp-2" title={req.name}>
                                  {req.name}
                                </h4>
                              </div>
                              
                              <div className={`shrink-0 ${viewMode === "list" ? "mr-4" : ""}`}>
                                <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm border ${isCompleted || isReadyForDelivery ? "text-emerald-700 bg-emerald-50 border-emerald-100" : isInProgress ? "text-violet-700 bg-violet-50 border-violet-100" : "text-sky-700 bg-sky-50 border-sky-100"}`}>
                                  {isCompleted && <CheckCircle size={12} />}
                                  {isCompleted ? "مكتمل" : isReadyForDelivery ? "جاهز للتسليم" : isInProgress ? "قيد الإجراء" : "قيد الانتظار"}
                                </span>
                              </div>
                            </div>
                            
                            <div className={`flex items-center gap-2 mt-auto ${viewMode === "list" ? "shrink-0 mr-4" : "mb-3"}`}>
                              {req.with_film === 1 ? (
                                <span className={`text-[10.5px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${req.radiology_film_id ? "bg-slate-100 text-slate-600 border border-slate-200" : "bg-rose-50 text-rose-600 border border-rose-100"}`}>
                                  <Film size={12} className={req.radiology_film_id ? "text-slate-400" : "text-rose-500"} /> 
                                  {req.radiology_film_id ? "مُدرج بفيلم" : "يحتاج فيلم للطباعة"}
                                </span>
                              ) : (
                                <span className="text-[10.5px] bg-slate-50 text-slate-500 px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold flex items-center gap-1.5">
                                  <ImageIcon size={12} className="text-slate-400" /> 
                                  حفظ رقمي (بدون طباعة)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Beautiful Action Buttons */}
                          <div className={`flex gap-2 ${viewMode === "list" ? "shrink-0" : "mt-2 pt-3 border-t border-slate-100"}`}>
                            {req.status === "paid" && (
                                <button onClick={() => handleStartIndividualRequest(req.id)} className="w-full text-xs font-black text-sky-600 bg-sky-50 hover:bg-sky-600 hover:text-white ring-1 ring-sky-200 hover:ring-transparent py-2.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm hover:shadow-sky-500/20">
                                  <Activity size={14} /> تنفيذ الدراسة
                                </button>
                            )}
                            
                            {req.status !== "paid" && !isGrouped && (
                              <div className="flex w-full gap-2">
                                {req.with_film !== 1 && (
                                  <button onClick={() => setUploadingItem({ type: "request", item: req })} className={`flex-1 text-[11px] font-bold py-2 rounded-xl transition-all flex justify-center items-center gap-1.5 ${isResultUploaded ? "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-slate-800 text-white hover:bg-slate-900 border-2 border-slate-800 hover:shadow-md"}`}>
                                    {isCompleted || isResultUploaded ? <><Edit size={14} /> تعديل النتيجة</> : <><UploadCloud size={14} /> إرفاق النتيجة</>}
                                  </button>
                                )}
                                {req.with_film !== 1 && (isCompleted || isResultUploaded) && (
                                  <button onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setViewResultItem(req);
                                  }} className="w-10 shrink-0 rounded-xl flex items-center justify-center text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors" title="عرض التقرير الإشعاعي">
                                    <FileText size={16} />
                                  </button>
                                )}
                                
                                {isReadyForDelivery && canDeliverIndividually && (
                                  <button
                                    onClick={() => handleDeliverRequest(req.id)}
                                    className="text-[11px] font-black bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg px-3 py-2 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap"
                                  >
                                    تسليم <CheckCircle size={14} />
                                  </button>
                                )}
                                
                                {req.with_film === 1 && !canDeliverIndividually && (
                                  <div
                                    title="يجب إدراج هذه الدراسة في فيلم أولاً، وسيتم رفع النتيجة للفيلم."
                                    className="flex-1 text-[11px] font-bold bg-slate-50 text-slate-400 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 border-dashed"
                                  >
                                    <AlertCircle size={14} /> بانتظار إدراجها بفيلم
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {req.status !== "paid" && isGrouped && (
                               <div className="w-full text-[11px] font-bold text-slate-500 bg-slate-50 py-2.5 rounded-xl text-center border border-slate-200 border-dashed flex items-center justify-center gap-1.5">
                                 <Film size={14} className="text-slate-400" /> مرتبط ومُدرج ضمن فيلم
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

              {/* Right Column: Films Studio (Visible if not pending) */}
              {activeTab !== "pending" && (
                <div className="hidden lg:flex w-2/5 xl:w-1/3 flex-col bg-slate-50 relative overflow-hidden">
                  
                  {/* Studio Header */}
                  <div className="px-6 py-4 flex items-center justify-between border-b border-slate-200/60 bg-slate-100/50 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                        <Film size={16} />
                      </div>
                      <span className="font-black text-sm text-slate-800">أستوديو الأفلام</span>
                    </div>
                    {activeTab === "in_progress" && unassignedFilmsCount > 0 && (
                      <button onClick={() => setGroupingMode(true)} className="text-xs font-black bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-600/20">
                        <Plus size={14} /> فيلم جديد
                      </button>
                    )}
                  </div>

                  {/* Studio Content */}
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4 relative z-10">
                    {films.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                          <Film size={32} className="text-slate-300" />
                        </div>
                        <p className="font-bold text-sm text-slate-500">لا توجد أفلام مجمعة</p>
                        <p className="text-xs text-slate-400 mt-1 text-center max-w-[200px]">قم بإضافة فيلم لتجميع الفحوصات ذات الصلة وطباعتها معاً.</p>
                      </div>
                    ) : (
                      films.map((f) => {
                        const filmRequests = requests.filter(r => r.radiology_film_id === f.id);
                        const isFilmCompleted = filmRequests.length > 0 && filmRequests.every(r => r.status === "completed");
                        const isFilmResultUploaded = filmRequests.length > 0 && (
                          filmRequests.some(r => r.result_file || r.result_notes)
                        );
                        const isFilmReadyForDelivery = isFilmResultUploaded && !isFilmCompleted;
                        
                        return (
                        <div key={f.id} className={`bg-white p-4 rounded-[1.5rem] border ${isFilmReadyForDelivery ? 'border-blue-200' : 'border-slate-200'} shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between`}>
                          {/* Top accent */}
                          <div className={`absolute top-0 right-0 w-full h-1 ${isFilmReadyForDelivery ? 'bg-amber-700' : 'bg-slate-800'}`}></div>

                          <div>
                            <div className="flex justify-between items-start mb-4 gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-xl ${f.film_size === "large" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-slate-50 text-slate-700 border border-slate-200"} flex items-center justify-center font-black text-sm shadow-sm shrink-0`}>
                                  {f.film_size === "large" ? "L" : "S"}
                                </div>
                                <div className="min-w-0 flex flex-col justify-center">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-extrabold text-slate-800 text-sm truncate">
                                      فيلم {f.film_size === "large" ? "كبير" : "صغير"}
                                    </p>
                                    {isFilmReadyForDelivery && (
                                      <span className="flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded text-blue-700 bg-blue-50 border border-blue-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] whitespace-nowrap">
                                        <span className="w-1 h-1 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                                        جاهز
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                                    <CheckSquare size={10} /> {filmRequests.length} دراسات
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => setGroupingMode(f)} className="text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-blue-100" title="تحديث وتعديل محتوى الفيلم">
                                  <Edit size={14} />
                                </button>
                                <button onClick={() => handleDeleteFilm(f.id)} className="text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-red-100" title="فك ارتباط الفيلم وحذف التجميع">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            
                            <div className="space-y-1.5 mb-4 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                              {filmRequests.map((fr, idx) => (
                                <p key={idx} className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5 truncate">
                                  <span className="w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" /> {fr.name}
                                </p>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button onClick={() => setUploadingItem({ type: "film", item: f })} className={`flex-1 text-[11px] font-bold py-2 rounded-xl transition-all flex justify-center items-center gap-1.5 ${isFilmResultUploaded ? "bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50" : "bg-slate-800 text-white hover:bg-slate-900 border-2 border-slate-800 hover:shadow-md"}`}>
                              {isFilmCompleted ? (
                                <><Edit size={14} /> تعديل النتيجة</>
                              ) : isFilmResultUploaded ? (
                                <><Edit size={14} /> تعديل النتيجة</>
                              ) : (
                                <><UploadCloud size={14} /> إرفاق النتيجة</>
                              )}
                            </button>
                            {isFilmResultUploaded && (
                               <button onClick={(e) => { 
                                 e.stopPropagation(); 
                                 setViewResultItem({ 
                                   name: `تقرير فيلم ${f.film_size === 'large' ? 'كبير' : 'صغير'}`, 
                                   result_notes: filmRequests.find(r => r.radiology_film_id === f.id)?.result_notes, 
                                   result_file: filmRequests.find(r => r.radiology_film_id === f.id)?.result_file 
                                 });
                               }} className="w-10 shrink-0 rounded-xl flex items-center justify-center text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors" title="عرض التقرير الإشعاعي">
                                 <FileText size={16} />
                               </button>
                            )}
                            {isFilmReadyForDelivery && (
                              <button onClick={() => handleDeliverFilm(f.id)} className="text-[11px] font-black bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg px-3 py-2 rounded-xl transition-all flex items-center gap-1 whitespace-nowrap">
                                تسليم <CheckCircle size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )})
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Action Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-between items-center z-20">
          <div className="text-xs font-bold text-slate-400 hidden sm:block">
            {isAllDone ? "🎉 جميع الفحوصات مكتملة" : "يرجى استكمال جميع الفحوصات لإنهاء الملف"}
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-black py-2.5 px-6 rounded-xl transition-all">
              إغلاق
            </button>
            
            {activeTab !== "completed" && !hasPending && (
              <button onClick={handleFinishPatient} disabled={completing || !isAllDone} className={`flex-1 sm:flex-none font-black py-2.5 px-8 rounded-xl transition-all flex items-center justify-center gap-2 ${isAllDone ? "bg-slate-800 hover:bg-slate-900 text-white shadow-lg shadow-slate-800/20" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}>
                {completing ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" /> : <CheckCircle size={16} />}
                إنهاء وتسليم الملف
              </button>
            )}
          </div>
        </div>

      </div>

      {uploadingItem && (
        <UploadResultModal
          endpoint={
            uploadingItem.type === "film"
              ? `/api/radiology/films/${uploadingItem.item.id}/result`
              : `/api/radiology/request/${uploadingItem.item.id}/result`
          }
          initialNotes={
            uploadingItem.type === "film"
              ? requests.find(r => r.radiology_film_id === uploadingItem.item.id)?.result_notes ?? ""
              : uploadingItem.item.result_notes ?? ""
          }
          initialFiles={
            uploadingItem.type === "film"
              ? requests.find(r => r.radiology_film_id === uploadingItem.item.id)?.result_file ?? null
              : uploadingItem.item.result_file ?? null
          }
          token={token}
          onClose={handleUploadClose}
          onUploaded={handleUploaded}
        />
      )}
      {groupingMode && (
        <FilmGroupingModal
          visitId={visitId}
          requests={requests}
          token={token}
          initialFilm={typeof groupingMode === "object" ? groupingMode : null}
          onClose={handleGroupingClose}
          onGrouped={handleGrouped}
        />
      )}
      {viewResultItem && (
        <RadiologyResultDetailsModal 
          request={viewResultItem} 
          onClose={() => setViewResultItem(null)} 
        />
      )}
      
      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[100008] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white rounded-3xl shadow-luxury overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 transition-all duration-300 w-full max-w-md" dir="rtl">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={32} />
              </div>
              <h3 className="font-extrabold text-lg text-slate-800">تأكيد الحذف</h3>
              <p className="text-slate-500 text-sm font-semibold leading-relaxed">
                هل أنت متأكد من فك ارتباط هذا الفيلم وحذفه؟
              </p>
              <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-xs font-bold border border-blue-100 flex items-start gap-2 text-right mt-2 shadow-sm">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                حذف الفيلم سيؤدي إلى إرجاع جميع الفحوصات المنجزة المرتبطة به لحالة "قيد الإجراء" وإلغاء تسليمها.
              </div>
            </div>
            <div className="flex gap-3 p-4 bg-slate-50/50 border-t border-slate-150">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, filmId: null })}
                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmDeleteFilm}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl text-sm shadow-md transition-colors"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

    </div>,
    document.body
  );
};

// ── Record Detail Modal ─────────────────────────────────────────────
const RecordDetailModal = ({ record, onClose }) => {
  const [isMaximized, setIsMaximized] = useState(() => localStorage.getItem("radiologyFullscreen") === "true");
  const [previewFile, setPreviewFile] = useState(null);
  const [viewResultItem, setViewResultItem] = useState(null);

  useEffect(() => {
    localStorage.setItem("radiologyFullscreen", isMaximized);
  }, [isMaximized]);
  return (
    <div className="fixed inset-0 z-[100005] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] ${isMaximized ? 'w-[98vw] h-[98vh] rounded-[2.5rem] border border-white' : 'w-full max-w-6xl h-[88vh] rounded-[2.5rem] border border-white/60'}`}>
        {/* Header */}
        <div className="relative px-6 py-6 flex justify-between items-start flex-shrink-0 bg-gradient-to-br from-blue-700 to-blue-500 shadow-lg shadow-blue-500/20">
          <div className="absolute inset-0 bg-white/10 mix-blend-overlay"></div>
          <div className="relative z-10 flex gap-4 items-center">
            <div className="w-16 h-16 rounded-[1.25rem] bg-white/20 shadow-inner flex items-center justify-center border border-white/20 text-white font-black text-2xl flex-shrink-0">
              {record.patient_name?.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{record.patient_name}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="bg-white/15 text-blue-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-inner backdrop-blur-sm border border-white/20">#{record.visit_number}</span>
                <span className="bg-white/15 text-blue-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-inner backdrop-blur-sm border border-white/20 flex items-center gap-1.5"><Calendar size={12}/> {record.age ?? '—'} سنة</span>
                <span className="bg-white/15 text-blue-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-inner backdrop-blur-sm border border-white/20">{record.gender === 'male' ? 'ذكر' : record.gender === 'female' ? 'أنثى' : '—'}</span>
                <span className="bg-white/15 text-blue-50 px-2.5 py-1 rounded-lg text-xs font-bold shadow-inner backdrop-blur-sm border border-white/20">{new Date(record.date).toLocaleDateString('ar-EG')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button onClick={() => setIsMaximized(v => !v)} className="w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-xl transition-all backdrop-blur-sm border border-white/20 shadow-inner">
              {isMaximized ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/15 hover:bg-red-500 hover:border-red-500 text-white rounded-xl transition-all backdrop-blur-sm border border-white/20 shadow-inner">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 bg-slate-50/50 flex-shrink-0 border-b border-slate-200/60">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center hover:shadow-md transition-shadow hover:border-slate-300 group">
              <div className="text-[11px] font-bold text-slate-400 mb-1 group-hover:text-slate-600 transition-colors">إجمالي الأشعة</div>
              <div className="font-black text-slate-800 text-2xl">{record.total_scans}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center hover:shadow-md transition-shadow hover:border-blue-200 group">
              <div className="text-[11px] font-bold text-slate-400 mb-1 group-hover:text-blue-500 transition-colors">أفلام كبيرة</div>
              <div className="font-black text-blue-600 text-2xl">{record.large_films}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center hover:shadow-md transition-shadow hover:border-slate-300 group">
              <div className="text-[11px] font-bold text-slate-400 mb-1 group-hover:text-slate-500 transition-colors">أفلام صغيرة</div>
              <div className="font-black text-slate-600 text-2xl">{record.small_films}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center hover:shadow-md transition-shadow hover:border-slate-300 group">
              <div className="text-[11px] font-bold text-slate-400 mb-1 group-hover:text-slate-500 transition-colors">حفظ رقمي</div>
              <div className="font-black text-slate-600 text-2xl">{record.without_films}</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 bg-slate-50/30">
          <div className="p-6">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4">النوع (الفيلم)</th>
                  <th className="px-5 py-4 text-center">عدد الأشعة</th>
                  <th className="px-5 py-4">الأشعة المنفذة</th>
                  <th className="px-5 py-4 text-center">النتائج</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {record?.details?.map((detail, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1.5 shadow-sm border ${
                        detail.film_size === "large" ? "bg-blue-50 text-blue-700 border-blue-100" :
                        detail.film_size === "small" ? "bg-slate-50 text-slate-700 border-slate-200" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {detail.film_size !== "none" && <Film size={12} />}
                        {detail.film_size === "large" ? "فيلم كبير" :
                         detail.film_size === "small" ? "فيلم صغير" : "بدون فيلم (رقمي)"}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-black text-slate-700 text-center text-sm">
                      {detail.scans_in_film}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {detail.scan_names?.split(" - ").map((name, nIdx) => (
                          <span key={nIdx} className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 shadow-sm group-hover:border-blue-200 transition-colors">
                            {name.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {(detail.result_file || detail.result_notes) ? (
                        <button 
                          onClick={() => {
                             const reqMock = {
                                name: detail.scan_names,
                                result_notes: detail.result_notes,
                                result_file: detail.result_file
                             };
                             setViewResultItem(reqMock);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all font-black text-[11px] border border-blue-100 hover:border-blue-200 shadow-sm"
                        >
                          <FileText size={14} /> عرض التقرير
                        </button>
                      ) : (
                        <span className="text-slate-300 font-bold">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>

      <SharedResultPreviewModal 
        file={previewFile} 
        onClose={() => setPreviewFile(null)} 
      />
      {viewResultItem && (
        <RadiologyResultDetailsModal 
          request={viewResultItem} 
          onClose={() => setViewResultItem(null)} 
        />
      )}
    </div>
  );
};
export { UploadResultModal, FilmGroupingModal, PatientDetailPanel, RecordDetailModal, SharedResultPreviewModal, RadiologyResultDetailsModal };

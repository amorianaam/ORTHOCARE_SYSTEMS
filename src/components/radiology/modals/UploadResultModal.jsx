import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileText, X, UploadCloud, Eye, Trash2, CheckCircle, Minimize2, Maximize2,
  Check, LayoutGrid, List, Plus, Film, Image as ImageIcon, Edit, Radiation,
  Calendar, Activity, CheckSquare, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { getSocket } from '../../utils/socket';
import SharedResultPreviewModal from './SharedResultPreviewModal';
// ── Upload Result Modal ───────────────────────────────────────────
const UploadResultModal = ({ endpoint, initialNotes = "", initialFiles, token, onClose, onUploaded }) => {
  const [files, setFiles] = useState([]);
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Cleanup generated object URLs on unmount to prevent memory leaks
    return () => {
      files.forEach(f => {
        if (f.previewUrl) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
    };
  }, [files]);

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
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`الملف ${file.name} يتجاوز الحجم المسموح (10MB)`);
        } else {
          if (file.type.startsWith("image/")) {
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
      const base64Files = await Promise.all(files.map(f => convertToBase64(f)));
      const filePayload = base64Files.length > 0 ? JSON.stringify(base64Files) : null;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resultNotes: notes, resultFile: filePayload }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "فشل الحفظ");

      toast.success("تم حفظ النتيجة بنجاح");
      onUploaded();
    } catch (err) {
      toast.error("حدث خطأ أثناء معالجة الملفات، يرجى المحاولة لاحقاً");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] w-full max-w-3xl h-auto max-h-[85vh] sm:max-h-[80vh] rounded-[2.5rem] border border-white/60">
        
        {/* Fixed Header */}
        <div className="px-6 py-5 flex items-center justify-between flex-shrink-0 bg-white border-b border-slate-100 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shadow-inner border border-emerald-100">
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
              <FileText size={16} className="text-emerald-500" />
              كتابة التقرير الإشعاعي
            </label>
            <div className="relative flex-1 min-h-[160px]">
              <textarea
                autoFocus
                className="w-full h-full bg-white shadow-inner rounded-xl p-5 text-slate-700 font-medium leading-relaxed focus:ring-2 focus:ring-emerald-500 border border-slate-200 transition-all resize-none placeholder-slate-300 custom-scrollbar"
                placeholder="اكتب التقرير الطبي والتشخيص هنا..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="absolute bottom-4 left-4 text-[10px] font-bold text-slate-400">
                مساحة كتابة آمنة
              </div>
            </div>
          </div>

          {/* Left Area: Immersive Drop-Zone */}
          <div className="w-full lg:w-1/2 flex flex-col gap-3">
            <label className="text-sm font-black text-slate-700 flex items-center gap-2">
              <UploadCloud size={16} className="text-orange-500" />
              إرفاق الصور والمرفقات الرقمية
            </label>
            
            <input
              type="file"
              multiple
              accept="image/jpeg, image/png, image/jpg, application/pdf"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            
            <div 
              onClick={() => fileInputRef.current.click()} 
              className="w-full flex-1 min-h-[160px] border-dashed border-2 border-slate-300 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 transition-colors p-6 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-orange-500 group-hover:border-orange-200 transition-all duration-300 group-hover:scale-110">
                <UploadCloud size={32} />
              </div>
              <div className="text-center">
                <p className="font-black text-slate-700 text-sm group-hover:text-orange-600 transition-colors">اسحب وأفلت الملفات هنا أو انقر للاستعراض</p>
                <p className="font-bold text-slate-400 text-xs mt-1">يدعم صيغ الصور (JPG, PNG) وملفات PDF</p>
              </div>
            </div>

            {/* Attached Files List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                <h4 className="text-[11px] font-black text-slate-500 mb-2">الملفات المرفقة ({files.length})</h4>
                {files.map((f, idx) => {
                  const isImage = f.previewUrl || (f.base64 && f.base64.startsWith("data:image"));
                  return (
                  <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-xl shadow-sm hover:border-orange-200 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      {isImage ? (
                        <img src={f.previewUrl || f.base64} alt={f.name} className="w-14 h-14 rounded-lg object-cover border border-slate-200 shadow-sm flex-shrink-0" />
                      ) : (
                        <div className="w-14 h-14 bg-red-50 text-red-500 flex items-center justify-center rounded-lg border border-red-100 shadow-sm flex-shrink-0">
                          <FileText size={24} />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="truncate max-w-[150px] sm:max-w-[200px] font-bold text-xs text-slate-700" title={f.name}>{f.name}</span>
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
             <button onClick={handleSave} disabled={saving || (files.length === 0 && !notes)} className="flex-1 sm:flex-none px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2">
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


export default UploadResultModal;
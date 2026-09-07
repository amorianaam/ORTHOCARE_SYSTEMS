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
// ── Record Detail Modal ─────────────────────────────────────────────
const RecordDetailModal = ({ record, onClose }) => {
  const [isMaximized, setIsMaximized] = useState(() => localStorage.getItem("radiologyFullscreen") === "true");
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    localStorage.setItem("radiologyFullscreen", isMaximized);
  }, [isMaximized]);
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] ${isMaximized ? 'w-[98vw] h-[98vh] rounded-[2.5rem] border border-white' : 'w-full max-w-6xl h-[88vh] rounded-[2.5rem] border border-white/60'}`}>
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 px-6 py-6 flex justify-between items-start relative overflow-hidden text-slate-800 flex-shrink-0 border-b border-orange-100/50">
          <div className="absolute inset-0 bg-white/40 mix-blend-overlay"></div>
          <div className="relative z-10 flex gap-4 items-center">
            <div className="w-16 h-16 rounded-[1.25rem] bg-white shadow-sm flex items-center justify-center border border-orange-100/60 text-orange-600 font-black text-2xl flex-shrink-0">
              {record.patient_name?.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">{record.patient_name}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="bg-white/80 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white">#{record.visit_number}</span>
                <span className="bg-white/80 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white flex items-center gap-1.5"><Calendar size={12}/> {record.age ?? '—'} سنة</span>
                <span className="bg-white/80 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white">{record.gender === 'male' ? 'ذكر' : record.gender === 'female' ? 'أنثى' : '—'}</span>
                <span className="bg-white/80 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm backdrop-blur-sm border border-white">{new Date(record.date).toLocaleDateString('ar-EG')}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button onClick={() => setIsMaximized(v => !v)} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-500 hover:text-orange-600 rounded-xl transition-all shadow-sm border border-slate-100">
              {isMaximized ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
            </button>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl transition-all shadow-sm border border-slate-100">
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
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center hover:shadow-md transition-shadow hover:border-orange-200 group">
              <div className="text-[11px] font-bold text-slate-400 mb-1 group-hover:text-orange-500 transition-colors">أفلام كبيرة</div>
              <div className="font-black text-orange-600 text-2xl">{record.large_films}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center hover:shadow-md transition-shadow hover:border-blue-200 group">
              <div className="text-[11px] font-bold text-slate-400 mb-1 group-hover:text-blue-500 transition-colors">أفلام صغيرة</div>
              <div className="font-black text-blue-600 text-2xl">{record.small_films}</div>
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
                  <tr key={idx} className="hover:bg-orange-50/30 transition-colors group">
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1.5 shadow-sm border ${
                        detail.film_size === "large" ? "bg-orange-50 text-orange-700 border-orange-100" :
                        detail.film_size === "small" ? "bg-blue-50 text-blue-700 border-blue-100" :
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
                          <span key={nIdx} className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 shadow-sm group-hover:border-orange-200 transition-colors">
                            {name.trim()}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {detail.result_file ? (() => {
                        let parsedFiles = [];
                        try { parsedFiles = JSON.parse(detail.result_file); } catch(e) {}
                        const firstFile = Array.isArray(parsedFiles) && parsedFiles.length > 0 ? parsedFiles[0] : null;
                        if (!firstFile) return <span className="text-slate-300 font-bold">—</span>;
                        return (
                          <button 
                            onClick={() => setPreviewFile({
                              name: firstFile.name || 'result',
                              base64: firstFile.base64,
                              type: firstFile.type || 'image/jpeg'
                            })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-xl transition-all font-black text-[11px] border border-orange-100 hover:border-orange-200 shadow-sm"
                          >
                            <FileText size={14} /> عرض
                          </button>
                        );
                      })() : (
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
    </div>
  );
};
export default RecordDetailModal;
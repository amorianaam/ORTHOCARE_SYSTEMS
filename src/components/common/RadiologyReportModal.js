import React from 'react';
import { X, Film, AlertCircle } from 'lucide-react';

export default function RadiologyReportModal({ isOpen, onClose, group }) {
  if (!isOpen || !group) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-lg font-black text-gray-800">تفاصيل استهلاك الأشعة</h3>
            <p className="text-xs font-bold text-gray-500 mt-1">المريض: {group.patient_name} | المرجع: #{group.visit_number}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="bg-white rounded-2xl border border-gray-150 p-1 shadow-sm">
            <table className="w-full text-xs text-right">
              <thead className="bg-gray-50 text-gray-500 rounded-t-xl font-bold border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 rounded-tr-xl">النوع (الفيلم)</th>
                  <th className="px-4 py-3">عدد الأشعة</th>
                  <th className="px-4 py-3 rounded-tl-xl">الأشعة المنفذة</th>
                </tr>
              </thead>
              <tbody>
                {group.details?.length > 0 ? (
                  group.details.map((detail, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black inline-flex items-center gap-1 border ${
                          detail.film_size === "large"
                            ? "bg-orange-50 text-orange-600 border-orange-100"
                            : detail.film_size === "small"
                            ? "bg-blue-50 text-blue-600 border-blue-100"
                            : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}>
                          {detail.film_size !== "none" && <Film size={12} />}
                          {detail.film_size === "large"
                            ? "فيلم كبير"
                            : detail.film_size === "small"
                            ? "فيلم صغير"
                            : "بدون فيلم (رقمي)"}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-black text-gray-700 text-sm">
                        {detail.scans_in_film}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {detail.scan_names?.split(" - ").map((name, nIdx) => (
                            <span
                              key={nIdx}
                              className="bg-white border border-gray-200 px-2.5 py-1 rounded-lg text-[10px] font-bold text-gray-600 shadow-sm"
                            >
                              {name.trim()}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="p-8 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <AlertCircle size={32} className="mb-2 opacity-50" />
                        <span className="font-bold text-xs">لا توجد تفاصيل متاحة</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

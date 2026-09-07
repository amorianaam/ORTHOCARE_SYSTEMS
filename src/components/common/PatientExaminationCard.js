import React from 'react';
import { User, Phone, ChevronLeft, Crown } from 'lucide-react';

export default function PatientExaminationCard({ 
  patient, 
  isSelected, 
  onClick, 
  isVIP, 
  isFollowUp,
  actionText,
  onActionClick,
  showDate, 
  dateValue,
  dateLabel = "تاريخ التسجيل:"
}) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-3xl border transition-all cursor-pointer shadow-sm hover-lift ${
        isSelected
          ? "bg-indigo-50/50 border-indigo-300 ring-1 ring-indigo-200"
          : "bg-white border-gray-100 hover:border-indigo-200 hover:shadow-md"
      }`}
      dir="rtl"
    >
      {/* Top Header: File Number & Badges */}
      <div className="flex justify-between items-center mb-4">
        <div className="bg-indigo-50 text-indigo-700 font-black text-[11px] px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
          #{patient.id || patient.patient_id}
        </div>
        <div className="flex gap-1.5 items-center">
          {(isVIP || patient?.is_exempt || patient?.latest_visit?.is_exempt) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
              <Crown size={11} /> إعفاء
            </span>
          )}
          {(isFollowUp || patient?.is_follow_up || patient?.latest_visit?.is_follow_up) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
              مراجعة
            </span>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 flex items-center justify-center font-black text-lg border border-slate-200 shadow-sm flex-shrink-0">
          {patient.full_name?.charAt(0)}
        </div>
        <div className="min-w-0">
          <span className="font-extrabold text-sm text-gray-800 line-clamp-1 mb-1.5 leading-tight">
            {patient.full_name}
          </span>
          <div className="text-[10px] text-gray-500 font-bold flex flex-wrap gap-2">
            <span className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg"><User size={10} /> {patient.age ? `${patient.age} سنة` : '—'} · {patient.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
            {patient.phone && (
              <span className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg" dir="ltr"><Phone size={10} /> {patient.phone}</span>
            )}
          </div>
        </div>
      </div>

      {(showDate || actionText) && (
        <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-4 text-[10px] font-black text-slate-500">
          {showDate && dateValue && <span>{dateLabel} <span className="text-slate-700">{dateValue}</span></span>}
          {actionText && (
            <span 
              onClick={(e) => {
                if (onActionClick) {
                  e.stopPropagation();
                  onActionClick(e);
                }
              }}
              className="flex items-center gap-0.5 mr-auto text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors z-10 relative">
              {actionText}
              <ChevronLeft size={14} className="transition-transform" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

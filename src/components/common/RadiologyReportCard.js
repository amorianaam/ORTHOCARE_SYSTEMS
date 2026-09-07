import React from 'react';
import { ChevronLeft, Film, Image as ImageIcon, BarChart3, Clock } from 'lucide-react';

export default function RadiologyReportCard({ group, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-3xl border transition-all cursor-pointer shadow-sm hover-lift ${
        isSelected
          ? "bg-orange-50/50 border-orange-300 ring-1 ring-orange-200"
          : "bg-white border-gray-100 hover:border-orange-200 hover:shadow-md"
      }`}
      dir="rtl"
    >
      {/* Top Header: File Number & Badges */}
      <div className="flex justify-between items-center mb-4">
        <div className="bg-orange-50 text-orange-700 font-black text-[11px] px-3 py-1.5 rounded-xl border border-orange-100 shadow-sm">
          #{group.visit_number}
        </div>
        <div className="flex gap-1.5 items-center">
          {group.large_films > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-orange-100 text-orange-700 border border-orange-200 shadow-sm">
              <Film size={11} /> {group.large_films} كبير
            </span>
          )}
          {group.small_films > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
              <Film size={11} /> {group.small_films} صغير
            </span>
          )}
          {group.without_films > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black bg-gray-50 text-gray-700 border border-gray-200 shadow-sm">
              <ImageIcon size={11} /> {group.without_films} رقمي
            </span>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 flex items-center justify-center font-black text-lg border border-slate-200 shadow-sm flex-shrink-0">
          {group.patient_name?.charAt(0)}
        </div>
        <div className="min-w-0">
          <span className="font-extrabold text-sm text-gray-800 line-clamp-1 mb-1.5 leading-tight">
            {group.patient_name}
          </span>
          <div className="text-[10px] text-gray-500 font-bold flex flex-wrap gap-2">
            <span className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg">
              <BarChart3 size={10} /> {group.total_scans} أشعة
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center border-t border-gray-100 pt-3 mt-4 text-[10px] font-black text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={12} />
          <span className="text-slate-700">
            {new Date(group.date).toLocaleString("ar-EG", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        </span>
        <span className="flex items-center gap-0.5 mr-auto text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-100 hover:bg-orange-100 transition-colors z-10 relative">
          التفاصيل
          <ChevronLeft size={14} className="transition-transform" />
        </span>
      </div>
    </div>
  );
}

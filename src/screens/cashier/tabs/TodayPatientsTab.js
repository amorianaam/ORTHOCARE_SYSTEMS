import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../../store/useAuthStore';
import useSocketStore from '../../../store/useSocketStore';

// ── Main Screen ────────────────────────────────────────────────────
const STATUS_LABELS = {
    pending_payment: 'بانتظار الدفع (رسوم كشف)',
    paid: 'مدفوع',
    in_progress: 'قيد المعاينة',
    completed: 'مكتمل',
    awaiting_service_payment: 'بانتظار الدفع (خدمات)',
    completed_admin_pending_services: 'مكتمل إدارياً (خدمات)',
    waiting: 'في قائمة الانتظار',
    cancelled: 'ملغي'
  };

const STATUS_COLORS = {
    pending_payment: 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm',
    awaiting_service_payment: 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm',
    paid: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm',
    in_progress: 'bg-sky-50 text-sky-600 border-sky-100 shadow-sm',
    completed: 'bg-gray-100 text-gray-600 border-gray-200 shadow-sm',
    completed_admin_pending_services: 'bg-amber-50 text-amber-600 border-amber-100 shadow-sm',
    waiting: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm',
    cancelled: 'bg-gray-100 text-gray-400 border-gray-200'
  };

const TodayPatientsTab = ({ onPatientClick }) => {
  const { token } = useAuthStore();
  const { latestSilentUpdate } = useSocketStore();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setError(false);
      const res = await fetch('/api/patients/visits/today', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setVisits(Array.isArray(data) ? data : []);
    } catch (e) { setError(true); toast.error('فشل تحميل بيانات مراجعو اليوم'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (latestSilentUpdate?.type === 'cashier') {
      fetchData();
    }
  }, [latestSilentUpdate, fetchData]);

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><span className="w-1.5 h-6 bg-sky-500 rounded-full"></span> قائمة المرضى لليوم</h2>
          <p className="text-sm text-gray-500 mt-0.5">إجمالي {visits.length} زيارة اليوم</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {error ? (
          <div className="flex flex-col justify-center items-center h-64 text-gray-400 bg-white rounded-3xl border border-rose-100 shadow-sm gap-4">
            <AlertCircle className="text-rose-400" size={48} />
            <p className="text-lg font-bold text-gray-600">تعذر تحميل البيانات</p>
            <button onClick={() => fetchData()} className="px-6 py-2 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors">
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">المراجع</th>
                    <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">رقم الزيارة</th>
                    <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">تاريخ الزيارة</th>
                    <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="p-12 text-center text-gray-400 font-bold">
                         <div className="flex justify-center items-center h-16">
                           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                         </div>
                      </td>
                    </tr>
                  ) : visits.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-12 text-center text-gray-400 font-bold">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Users size={40} className="mb-3 opacity-20" />
                          <p className="text-sm font-bold">لا يوجد مرضى مسجلين لهذا اليوم</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visits.map((v) => {
                      const colorClass = STATUS_COLORS[v.status] || STATUS_COLORS.waiting;
                      return (
                        <tr key={v.id} onClick={() => onPatientClick && onPatientClick(v.patient_id)} className="cursor-pointer hover:bg-gray-50/80 transition-colors border-b border-gray-50 last:border-0">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs border shadow-sm ${colorClass}`}>
                                {v.full_name?.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                  <span className="font-extrabold text-gray-800 hover:text-sky-700">{v.full_name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-gray-700">
                            <span className="font-mono text-[10px] bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">#{v.visit_number || v.id}</span>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-gray-700">
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock size={14} className="text-sky-500" />
                              <span dir="ltr">{new Date(v.created_at).toLocaleString('en-GB')}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl shadow-sm border inline-block ${colorClass}`}>
                              {STATUS_LABELS[v.status] || 'غير محدد'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayPatientsTab;

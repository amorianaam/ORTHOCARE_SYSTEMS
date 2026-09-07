import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, Activity, Calendar } from 'lucide-react';
import useAuthStore from '../../../store/useAuthStore';
import useSocketStore from '../../../store/useSocketStore';

// ─── Color coding per status ──────────────────────────────────────
const STATUS_STYLE = {
  waiting:                          { border: 'border-l-4 border-l-emerald-400', badge: 'bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm', label: 'جاهز - لا خدمات' },
  awaiting_service_payment:         { border: 'border-l-4 border-l-rose-500', badge: 'bg-rose-50 text-rose-600 border border-rose-100 shadow-sm', label: 'خدمات غير مدفوعة' },
  completed_admin_pending_services: { border: 'border-l-4 border-l-amber-400',   badge: 'bg-amber-50 text-amber-600 border border-amber-100 shadow-sm',   label: 'دفع جزئي - خدمات معلقة' },
};

// ─── Refund Reason Modal ──────────────────────────────────────────
const RefundModal = ({ title, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <div className="p-4">
          <label className="block text-sm font-bold mb-2">سبب الإسترجاع</label>
          <input type="text" className="w-full border rounded-lg p-2" value={reason} onChange={e => setReason(e.target.value)} />
        </div>
        <div className="p-4 bg-gray-50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg font-bold">إلغاء</button>
          <button onClick={() => onConfirm(reason)} className="px-4 py-2 bg-rose-500 text-white rounded-lg font-bold">تأكيد الإسترجاع</button>
        </div>
      </div>
    </div>
  );
};

const ServicesTab = ({ onPatientClick, onCheckout }) => {
  const { token } = useAuthStore();
  const { latestSilentUpdate } = useSocketStore();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
    const [filter, setFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/cashier/waiting', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setServices(await res.json());
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (latestSilentUpdate?.type === 'cashier') {
      fetchData();
    }
  }, [latestSilentUpdate, fetchData]);

  const filtered = services?.filter(s => {
    if (filter === 'all') return true;
    return s.status === filter;
  }) || [];

  return (
    <>
      <div className="flex flex-col gap-4 min-h-[400px] flex-1" dir="rtl">
        {/* List */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div>
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><span className="w-1.5 h-6 bg-sky-500 rounded-full"></span> الخدمات المتبقية (مختبر، أشعة)</h2>
              <p className="text-sm text-gray-500 mt-0.5">{filtered.length} مريض بانتظار السداد للخدمات</p>
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
                        <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">حالة الدفع</th>
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
                      ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="p-12 text-center text-gray-400 font-bold">
                            <div className="flex flex-col items-center justify-center text-gray-400">
                              <Activity size={40} className="mb-3 opacity-20" />
                              <p className="text-sm font-bold">لا توجد خدمات معلقة</p>
                              <p className="text-xs text-gray-400 mt-1">جميع الخدمات مسددة حالياً</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filtered.map((v) => {
                          const cfg = STATUS_STYLE[v.status] || STATUS_STYLE['waiting'];
                          const isActive = false;
                          return (
                            <tr key={v.visit_id} 
                                onClick={() => onCheckout(v)} 
                                className={`cursor-pointer transition-colors border-b border-gray-50 last:border-0 ${isActive ? 'bg-sky-50/50' : 'hover:bg-gray-50/80'}`}>
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-black text-xs border border-sky-100" onClick={(e) => { e.stopPropagation(); onPatientClick && onPatientClick(v.patient_id); }} title="عرض الملف المالي">
                                    {v.full_name?.charAt(0)}
                                  </div>
                                  <div className="flex flex-col">
                                      <span className="font-extrabold text-gray-800 hover:text-sky-700" onClick={(e) => { e.stopPropagation(); onPatientClick && onPatientClick(v.patient_id); }}>{v.full_name}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 font-bold text-gray-700">
                                <span className="font-mono text-[10px] bg-gray-100 px-2 py-0.5 rounded-md text-gray-600">#{v.visit_number}</span>
                              </td>
                              <td className="px-4 py-3.5 font-bold text-gray-700">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                  <Calendar size={14} className="text-sky-500" /> 
                                  <span dir="ltr">{v.created_at ? new Date(v.created_at).toLocaleString('en-GB') : '--'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl bg-white shadow-sm border ${cfg.badge.replace('bg-', 'border-').replace('100', '200')}`}>
                                  {cfg.label}
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
      </div>
      
    </>
  );
};
export default ServicesTab;

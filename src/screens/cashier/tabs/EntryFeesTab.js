import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Check, X,
  Clock, AlertCircle, Grid, List
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../../store/useAuthStore';

const EntryFeesTab = ({ onPatientClick, onCheckout }) => {
  const { token } = useAuthStore();
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [cancelModal, setCancelModal] = useState(null);
  
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setError(false);
      const res = await fetch('/api/cashier/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setVisits(Array.isArray(data) ? data : []);
    } catch (e) { setError(true); toast.error('فشل تحميل البيانات'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchData();
    window.addEventListener('cashier_update', fetchData);
    return () => window.removeEventListener('cashier_update', fetchData);
  }, [fetchData]);

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><span className="w-1.5 h-6 bg-sky-500 rounded-full"></span> رسوم الدخول المعلقة</h2>
          <p className="text-sm text-gray-500 mt-0.5">{visits.length} مريض بانتظار السداد</p>
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
                    <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">تاريخ الزيارة</th>
                    <th className="px-4 py-3.5 text-center font-black whitespace-nowrap w-32">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="p-12 text-center text-gray-400 font-bold">
                         <div className="flex justify-center items-center h-16">
                           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                         </div>
                      </td>
                    </tr>
                  ) : visits.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="p-12 text-center text-gray-400 font-bold">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Clock size={40} className="mb-3 opacity-20" />
                          <p className="text-sm font-bold">لا توجد رسوم دخول معلقة حالياً</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visits.map((v) => (
                      <tr key={v.visit_id} onClick={() => onPatientClick && onPatientClick(v.patient_id)} className="cursor-pointer hover:bg-gray-50/80 transition-colors border-b border-gray-50 last:border-0">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-black text-xs border border-amber-100">
                              {v.full_name?.charAt(0)}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-extrabold text-gray-800">{v.full_name}</span>
                                <span className="text-[10px] font-mono font-bold text-gray-400">#{v.visit_number || v.id}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-bold text-gray-700">
                          <span dir="ltr">{new Date(v.created_at).toLocaleDateString('en-GB')} - {new Date(v.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); onCheckout(v); }} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold text-[10px] hover:bg-amber-600 transition-colors flex items-center gap-1 shadow-sm">
                              <CreditCard size={12} /> تحصيل الرسوم
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setCancelModal(v); }} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors" title="إلغاء">
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {cancelModal && (
          <CancelModal visit={cancelModal} token={token}
            onClose={() => setCancelModal(null)} onCancelled={fetchData} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default EntryFeesTab;

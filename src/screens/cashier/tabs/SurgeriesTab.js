import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors, Plus, X, Check,
  ChevronDown, TrendingUp, Clock, AlertCircle, Printer
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../../store/useAuthStore';
import InvoiceTemplate from '../../../components/InvoiceTemplate';

// ── Progress Bar ───────────────────────────────────────────────────
const ProgressBar = ({ paid, total }) => {
  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
  const color = pct >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : pct >= 50 ? 'bg-gradient-to-r from-blue-400 to-blue-500' : 'bg-gradient-to-r from-amber-400 to-amber-500';
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400">
        <span>المدفوع {pct.toFixed(0)}%</span>
        <span>المتبقي {(100 - pct).toFixed(0)}%</span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
};

// ── Add Payment Modal ──────────────────────────────────────────────
const PayModal = ({ surgery, token, onClose, onPaid }) => {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPay, setLoadingPay] = useState(true);
  const [suppliesCost, setSuppliesCost] = useState(0);

  useEffect(() => {
    fetch(`/api/cashier/surgery/${surgery.surgery_id}/or-supplies`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setSuppliesCost(parseFloat(data.suppliesCost || 0)))
      .catch(() => setSuppliesCost(0));
  }, [surgery.surgery_id, token]);

  const remaining = parseFloat(surgery.full_price || 0)
    + suppliesCost
    - parseFloat(surgery.discount_amount || 0)
    - parseFloat(surgery.paid_amount || 0);

  useEffect(() => {
    fetch(`/api/cashier/surgery/${surgery.surgery_id}/payments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setPayments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingPay(false));
  }, [surgery.surgery_id, token]);

  const handlePay = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
      return toast.error('أدخل مبلغاً صحيحاً');
    
    let equivalentAmount = parseFloat(amount);

    if (equivalentAmount > remaining + 1)
      return toast.error(`المبلغ يعادل (${equivalentAmount.toFixed(2)}) وهو يتجاوز المتبقي (${remaining.toFixed(2)} YER)`);

    setSaving(true);
    try {
      const res = await fetch(`/api/cashier/surgery/${surgery.surgery_id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          amount: parseFloat(amount)
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        onPaid({
          receiptNumber: data.receiptNumber,
          patientName: surgery.full_name,
          visitNumber: surgery.visit_number,
          items: [
            { description: 'رسوم عملية جراحية (' + surgery.surgery_type + ')', total: (surgery.full_price - (surgery.discount_amount || 0)) },
            ...(suppliesCost > 0 ? [{ description: 'مستهلكات العمليات', total: suppliesCost }] : [])
          ],
          subtotal: (surgery.full_price - (surgery.discount_amount || 0)) + suppliesCost,
          totalPaid: parseFloat(amount),
          currency: 'YER'
        }); 
        onClose(); 
      }
      else toast.error(data.message);
    } catch (e) { toast.error('تعذر الاتصال'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        className="relative z-10 bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50"
          style={{background:'linear-gradient(135deg, #FAF5FF, #F3E8FF)'}}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-200/50 flex items-center justify-center">
              <Plus size={20} className="text-sky-700" />
            </div>
            <h3 className="font-black text-sky-900 text-lg">إضافة دفعة عملية</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        <div className="p-6">
          {/* Surgery Summary */}
          <div className="bg-slate-900 rounded-2xl p-5 mb-5 shadow-inner">
            <p className="font-bold text-white mb-1">{surgery.full_name}</p>
            <p className="text-xs text-sky-300 mb-4">{surgery.surgery_type}</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'العملية', value: (surgery.full_price - (surgery.discount_amount || 0)).toFixed(2) },
                { label: 'مستهلكات', value: suppliesCost.toFixed(2), color: 'text-amber-400' },
                { label: 'المدفوع', value: parseFloat(surgery.paid_amount || 0).toFixed(2), color: 'text-emerald-400' },
                { label: 'المتبقي', value: remaining.toFixed(2), color: remaining > 0 ? 'text-red-400' : 'text-emerald-400' },
              ].map(item => (
                <div key={item.label} className="bg-white/10 rounded-xl p-2.5 backdrop-blur-sm">
                  <p className="text-[11px] text-gray-300 mb-1">{item.label}</p>
                  <p className={"font-black tracking-tight " + (item.color || "text-white")}>{item.value} <span className="text-[9px] text-gray-400 tracking-normal uppercase">YER</span></p>
                </div>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">مبلغ الدفعة (ريال يمني)</label>
              <div className="relative">
                <input type="number" min="0" step="0.01" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input-base text-lg font-bold text-center w-full p-3 border rounded-xl"
                  placeholder="المبلغ"
                />
                <button
                  type="button"
                  onClick={() => setAmount(remaining.toFixed(2))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 font-bold hover:text-blue-800"
                >
                  تغطية المتبقي
                </button>
              </div>
            </div>
          </div>

          {/* Previous Payments */}
          {!loadingPay && payments.length > 0 && (
            <div className="mb-4 border border-gray-100 rounded-xl overflow-hidden">
              <p className="text-xs font-bold text-gray-500 px-3 py-2 bg-gray-50 border-b border-gray-100">
                الدفعات السابقة ({payments.length})
              </p>
              <div className="divide-y divide-gray-50 max-h-36 overflow-y-auto">
                {payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center px-3 py-2">
                    <span className="text-xs text-gray-500">
                      {new Date(p.payment_date || p.created_at).toLocaleDateString('ar')}
                    </span>
                    <span className="text-sm font-bold text-sky-700">{p.amount} YER</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-50 mt-2">
            <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-[11px] font-bold hover:bg-gray-200 transition-colors">إلغاء</button>
            <button onClick={handlePay} disabled={saving || !amount}
              className="flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-l from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white text-[11px] font-bold transition-all shadow-sm">
              {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Check size={14} />}
              {saving ? 'جاري الحفظ...' : 'تأكيد الدفعة'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Screen ────────────────────────────────────────────────────
const FILTERS = [
    { key: 'all',        label: 'الكل' },
    { key: 'partial',    label: 'دفع جزئي' },
  ];

const SurgeriesTab = ({ onPatientClick }) => {
  const { token } = useAuthStore();
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [payModal, setPayModal]   = useState(null);
  const [filter, setFilter]       = useState('all');
  const [invoiceData, setInvoiceData] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      setError(false);
      const res = await fetch('/api/cashier/surgeries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSurgeries(Array.isArray(data) ? data : []);
    } catch (e) { setError(true); toast.error('فشل تحميل بيانات العمليات'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchData();
    window.addEventListener('cashier_update', fetchData);
    return () => window.removeEventListener('cashier_update', fetchData);
  }, [fetchData]);

  const handlePaymentSuccess = (invData) => {
    setInvoiceData({ ...invData, cashierName: 'القسم المالي' });
    fetchData();
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const filtered = filter === 'all' ? surgeries
    : surgeries.filter(s => parseFloat(s.remaining_amount) > 0 && parseFloat(s.paid_amount) > 0);

  return (
    <div className="w-full flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div>
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><span className="w-1.5 h-6 bg-sky-500 rounded-full"></span> العمليات الجراحية</h2>
          <p className="text-sm text-gray-500 mt-0.5">{surgeries.length} عملية</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              filter === f.key
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {f.label}
          </button>
        ))}
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
                    <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">نوع العملية</th>
                    <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">المدفوع</th>
                    <th className="px-4 py-3.5 text-right font-black whitespace-nowrap">المتبقي</th>
                    <th className="px-4 py-3.5 text-center font-black whitespace-nowrap w-32">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-gray-400 font-bold">
                         <div className="flex justify-center items-center h-16">
                           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
                         </div>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-12 text-center text-gray-400 font-bold">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Scissors size={40} className="mb-3 opacity-20" />
                          <p className="text-sm font-bold">لا توجد عمليات جراحية مطابقة</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => {
                      const rem = parseFloat(s.remaining_amount || 0);
                      const paid = parseFloat(s.paid_amount || 0);
                      
                      return (
                        <tr key={s.surgery_id} onClick={() => onPatientClick && onPatientClick(s.patient_id)} className="cursor-pointer hover:bg-gray-50/80 transition-colors border-b border-gray-50 last:border-0">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center font-black text-xs border border-sky-100">
                                {s.full_name?.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                  <span className="font-extrabold text-gray-800 hover:text-sky-700">{s.full_name}</span>
                                  <span className="text-[10px] font-mono font-bold text-gray-400">#{s.id || s.visit_id || s.surgery_id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-gray-700">
                            <span className="bg-sky-50 text-sky-600 px-2 py-1 rounded-md text-xs">{s.surgery_type || '--'}</span>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-emerald-600">
                            {paid.toFixed(2)} YER
                          </td>
                          <td className="px-4 py-3.5 font-bold">
                            {rem > 0 ? (
                              <span className="text-red-500">{rem.toFixed(2)} YER</span>
                            ) : (
                              <span className="text-emerald-500">مكتمل السداد</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {rem > 0 ? (
                              <button onClick={(e) => { e.stopPropagation(); setPayModal(s); }} className="px-3 py-1.5 rounded-lg bg-sky-600 text-white font-bold text-xs hover:bg-sky-700 transition-colors flex items-center gap-1.5 shadow-sm mx-auto">
                                <Plus size={14} /> إضافة دفعة
                              </button>
                            ) : (
                              <span className="font-bold text-emerald-600 text-[10px] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 inline-block">✓ مكتمل</span>
                            )}
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

      <AnimatePresence>
        {payModal && (
          <PayModal surgery={payModal} token={token}
            onClose={() => setPayModal(null)} onPaid={handlePaymentSuccess} />
        )}
      </AnimatePresence>

      <div className="hidden print:block">
        <InvoiceTemplate data={invoiceData} />
      </div>
    </div>
  );
};

export default SurgeriesTab;

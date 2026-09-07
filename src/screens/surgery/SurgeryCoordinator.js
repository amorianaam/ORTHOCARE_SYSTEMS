import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Search, Plus, Calendar, DollarSign,
  Package, Stethoscope, CheckCircle, Clock,
  ChevronLeft, X, Pill, Save, AlertCircle, Syringe,
  Check, RefreshCcw
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import { getSocket } from '../../utils/socket';

const TABS = [
  { id: 'planned',   label: 'محول جديد',     color: 'border-blue-500',   bg: 'bg-blue-50 text-blue-700' },
  { id: 'scheduled', label: 'بانتظار الدفع', color: 'border-amber-500',  bg: 'bg-amber-50 text-amber-700' },
  { id: 'ready',     label: 'جاهزة للعملية', color: 'border-emerald-500',bg: 'bg-emerald-50 text-emerald-700' },
  { id: 'post_op',   label: 'ما بعد العملية', color: 'border-purple-500',bg: 'bg-purple-50 text-purple-700' },
  { id: 'completed', label: 'مكتملة',        color: 'border-gray-400',   bg: 'bg-gray-100 text-gray-700' }
];

// ── Surgery Detail Modal ───────────────────────────────────────────
const SurgeryDetailModal = ({ surgeryRow, token, onClose, onRefresh }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Pricing State
  const [price, setPrice] = useState(surgeryRow.full_price || '');
  const [scheduledDate, setScheduledDate] = useState(surgeryRow.scheduled_date ? surgeryRow.scheduled_date.slice(0, 16) : '');
  const [surgeryType, setSurgeryType] = useState(surgeryRow.surgery_type || '');

  // Materials State
  const [inventory, setInventory] = useState([]);
  const [searchInv, setSearchInv] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState('');
  
  // Expenses State
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  // Diagnostics State
  const [showDiagMenu, setShowDiagMenu] = useState(false);
  const [diagType, setDiagType] = useState('lab'); // lab or rad
  const [testId, setTestId] = useState('');

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/surgery/${surgeryRow.id}`, { headers: { Authorization: `Bearer ${token}` }});
      const d = await res.json();
      setData(d);
      setPrice(d.surgery.full_price);
      setSurgeryType(d.surgery.surgery_type);
      setScheduledDate(d.surgery.scheduled_date ? d.surgery.scheduled_date.slice(0,16) : '');
    } catch {
      toast.error('فشل تحميل تفاصيل العملية');
    } finally {
      setLoading(false);
    }
  }, [surgeryRow.id, token]);

  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/surgery/inventory/items', { headers: { Authorization: `Bearer ${token}` }});
      const d = await res.json();
      setInventory(d);
    } catch {}
  }, [token]);

  useEffect(() => {
    loadDetails();
    if (surgeryRow.status === 'ready' || surgeryRow.status === 'post_op') {
      loadInventory();
    }
  }, [loadDetails, loadInventory, surgeryRow.status]);

  // Actions
  const handlePriceSurgery = async () => {
    if (!surgeryType || !price) return toast.error('الرجاء إدخال نوع وسعر العملية');
    try {
      const res = await fetch(`/api/surgery/${surgeryRow.id}/price`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ surgery_type: surgeryType, full_price: price, scheduled_date: scheduledDate })
      });
      if (res.ok) {
        toast.success('تم تسعير العملية وإرسالها للصندوق');
        onRefresh();
        onClose();
      }
    } catch { toast.error('خطأ في الاتصال'); }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      const res = await fetch(`/api/surgery/${surgeryRow.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toast.success('تم تحديث الحالة');
        onRefresh();
        onClose();
      }
    } catch { toast.error('خطأ في الاتصال'); }
  };

  const handleComplete = async () => {
    try {
      const res = await fetch(`/api/surgery/${surgeryRow.id}/complete`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('تم إنهاء العملية وإغلاقها');
        onRefresh();
        onClose();
      }
    } catch { toast.error('خطأ في الاتصال'); }
  };

  const handleAddMaterial = async () => {
    if (!selectedItem || !qty || qty <= 0) return toast.error('الرجاء اختيار مادة وكمية صحيحة');
    try {
      const res = await fetch(`/api/surgery/${surgeryRow.id}/material`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ inventory_item_id: selectedItem.id, quantity: qty })
      });
      if (res.ok) {
        toast.success('تم استهلاك المادة وخصمها من المخزن');
        setSearchInv('');
        setSelectedItem(null);
        setQty('');
        loadDetails();
        loadInventory();
      } else {
        const err = await res.json();
        toast.error(err.message || 'فشل الإضافة');
      }
    } catch { toast.error('خطأ في الاتصال'); }
  };

  const handleAddExpense = async () => {
    if (!expenseDesc || !expenseAmount || expenseAmount <= 0) return toast.error('الرجاء إدخال وصف ومبلغ صحيح');
    try {
      const res = await fetch(`/api/surgery/${surgeryRow.id}/expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ description: expenseDesc, amount: expenseAmount })
      });
      if (res.ok) {
        toast.success('تم إضافة التكلفة');
        setExpenseDesc('');
        setExpenseAmount('');
        loadDetails();
      }
    } catch { toast.error('خطأ في الاتصال'); }
  };

  const filteredInv = inventory.filter(i => i.name.toLowerCase().includes(searchInv.toLowerCase()));

  // Financials
  const materialsCost = data?.materials?.reduce((acc, m) => acc + parseFloat(m.total_cost || 0), 0) || 0;
  const expensesCost = data?.expenses?.reduce((acc, e) => acc + parseFloat(e.amount || 0), 0) || 0;
  const totalPaidYer = data?.payments?.reduce((acc, p) => acc + (parseFloat(p.amount) * parseFloat(p.exchange_rate)), 0) || 0;
  const netProfit = totalPaidYer - (materialsCost + expensesCost);

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const status = data.surgery.status;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" dir="rtl">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="relative w-full max-w-3xl bg-gray-50 h-full shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="text-rose-600" /> إدارة العملية: {data.surgery.full_name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{data.surgery.visit_number} · العمر: {data.surgery.age}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Medical info block */}
          {(data.surgery.allergies || data.surgery.chronic_diseases) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
              <h4 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2"><AlertCircle size={16}/> تنبيهات طبية</h4>
              {data.surgery.allergies && <p className="text-sm text-amber-900"><strong>حساسية:</strong> {data.surgery.allergies}</p>}
              {data.surgery.chronic_diseases && <p className="text-sm text-amber-900"><strong>أمراض مزمنة:</strong> {data.surgery.chronic_diseases}</p>}
            </div>
          )}

          {/* Phase 1: Planning & Pricing (Visible if planned or scheduled) */}
          {(status === 'planned' || status === 'scheduled') && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-blue-50 px-5 py-3 border-b border-blue-100">
                <h3 className="font-bold text-blue-900 flex items-center gap-2"><Calendar size={18}/> مرحلة التسعير والجدولة</h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">نوع واسم العملية</label>
                  <input type="text" value={surgeryType} onChange={e => setSurgeryType(e.target.value)} className="input-base" placeholder="مثال: تثبيت كسر مع شريحة" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">السعر الشامل</label>
                    <div className="flex">
                      <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="input-base rounded-l-none flex-1 border-l-0" placeholder="0.00" />
                      <div className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-r-xl px-4 py-2 font-bold flex items-center">
                        YER
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">تاريخ ووقت العملية (اختياري)</label>
                    <input type="datetime-local" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="input-base" />
                  </div>
                </div>

                {status === 'planned' && (
                  <button onClick={handlePriceSurgery} className="btn-primary w-full bg-blue-600 hover:bg-blue-700 mt-2 flex justify-center items-center gap-2">
                    <Save size={18} /> حفظ التعديلات وإرسال للصندوق
                  </button>
                )}
                {status === 'scheduled' && (
                  <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-200 mt-2 flex items-center gap-2">
                    <Clock size={16}/> بانتظار إتمام الدفع من قبل الصندوق...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Phase 2: Post-Op & Material Usage (Visible if ready or post_op) */}
          {(status === 'ready' || status === 'post_op' || status === 'completed') && (
            <div className="space-y-6">
              
              {/* Materials */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-purple-50 px-5 py-3 border-b border-purple-100 flex justify-between items-center">
                  <h3 className="font-bold text-purple-900 flex items-center gap-2"><Package size={18}/> المواد المستهلكة (من المخزن)</h3>
                  <span className="text-sm font-bold text-purple-700">التكلفة: {materialsCost.toLocaleString()} YER</span>
                </div>
                
                {status !== 'completed' && (
                  <div className="p-5 border-b border-gray-100 bg-gray-50">
                    <label className="block text-sm font-bold text-gray-700 mb-2">إضافة مادة</label>
                    <div className="flex gap-2 relative">
                      <div className="relative flex-1">
                        <input type="text" value={selectedItem ? selectedItem.name : searchInv} 
                          onChange={e => { setSearchInv(e.target.value); setSelectedItem(null); }}
                          placeholder="ابحث عن مادة..." className="input-base" />
                        
                        {searchInv && !selectedItem && (
                          <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 shadow-xl rounded-xl z-20 max-h-48 overflow-y-auto">
                            {filteredInv.map(inv => (
                              <div key={inv.id} onClick={() => { setSelectedItem(inv); setSearchInv(''); }}
                                className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 flex justify-between">
                                <span className="font-semibold text-sm">{inv.name}</span>
                                <span className="text-xs text-gray-500">المتاح: {inv.quantity} {inv.unit}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="الكمية" className="input-base w-24 text-center" />
                      <button onClick={handleAddMaterial} className="bg-purple-600 hover:bg-purple-700 text-white px-4 rounded-xl font-bold flex items-center gap-1 transition-colors">
                        <Plus size={16}/> إضافة
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-0">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="px-5 py-3 font-semibold">المادة</th>
                        <th className="px-5 py-3 font-semibold">الكمية</th>
                        <th className="px-5 py-3 font-semibold">سعر التكلفة</th>
                        <th className="px-5 py-3 font-semibold">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.materials.length === 0 ? (
                        <tr><td colSpan="4" className="text-center py-6 text-gray-400">لم يتم إضافة مواد</td></tr>
                      ) : (
                        data.materials.map(m => (
                          <tr key={m.id} className="border-b border-gray-50">
                            <td className="px-5 py-3 font-semibold text-gray-800">{m.name}</td>
                            <td className="px-5 py-3 text-gray-600">{m.quantity} {m.unit}</td>
                            <td className="px-5 py-3 text-gray-600">{parseFloat(m.cost_price).toLocaleString()} YER</td>
                            <td className="px-5 py-3 font-bold text-gray-900">{parseFloat(m.total_cost).toLocaleString()} YER</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expenses */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-rose-50 px-5 py-3 border-b border-rose-100 flex justify-between items-center">
                  <h3 className="font-bold text-rose-900 flex items-center gap-2"><DollarSign size={18}/> التكاليف الإضافية (أجور وغيرها)</h3>
                  <span className="text-sm font-bold text-rose-700">التكلفة: {expensesCost.toLocaleString()} YER</span>
                </div>
                
                {status !== 'completed' && (
                  <div className="p-5 border-b border-gray-100 bg-gray-50 flex gap-2">
                    <input type="text" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="وصف التكلفة (مثل: أجر مساعد)" className="input-base flex-1" />
                    <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="المبلغ (YER)" className="input-base w-32" />
                    <button onClick={handleAddExpense} className="bg-rose-600 hover:bg-rose-700 text-white px-4 rounded-xl font-bold flex items-center gap-1 transition-colors">
                      <Plus size={16}/> إضافة
                    </button>
                  </div>
                )}

                <div className="p-0">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                      <tr>
                        <th className="px-5 py-3 font-semibold">الوصف</th>
                        <th className="px-5 py-3 font-semibold w-40">المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expenses.length === 0 ? (
                        <tr><td colSpan="2" className="text-center py-6 text-gray-400">لا توجد تكاليف إضافية</td></tr>
                      ) : (
                        data.expenses.map(e => (
                          <tr key={e.id} className="border-b border-gray-50">
                            <td className="px-5 py-3 font-semibold text-gray-800">{e.description}</td>
                            <td className="px-5 py-3 font-bold text-gray-900">{parseFloat(e.amount).toLocaleString()} YER</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer: Financial Summary & Actions */}
        <div className="bg-white border-t border-gray-200 p-6 flex-shrink-0">
          <div className="flex flex-wrap gap-6 mb-4 justify-between items-end">
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-bold uppercase">إجمالي المدفوعات (محول لليمني)</p>
              <p className="text-xl font-black text-gray-900">{totalPaidYer.toLocaleString()} YER</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-bold uppercase">إجمالي التكاليف (مواد + أجور)</p>
              <p className="text-xl font-black text-rose-600">{(materialsCost + expensesCost).toLocaleString()} YER</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-bold uppercase">صافي العملية</p>
              <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {netProfit >= 0 ? '+' : ''}{netProfit.toLocaleString()} YER
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            {status === 'ready' && (
              <button onClick={() => handleUpdateStatus('post_op')} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                <CheckCircle size={18}/> بدء العملية (تغيير الحالة لـ ما بعد العملية)
              </button>
            )}
            {status === 'post_op' && (
              <button onClick={handleComplete} className="flex-1 py-3 bg-gray-900 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                <Check size={18}/> إنهاء العملية وإغلاق الملف
              </button>
            )}
            {status === 'completed' && (
              <div className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold flex items-center justify-center gap-2">
                <CheckCircle size={18}/> تم إنهاء العملية
              </div>
            )}
            <button onClick={onClose} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors">
              إغلاق
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Screen ───────────────────────────────────────────────────
const SurgeryCoordinator = () => {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState('planned');
  const [surgeries, setSurgeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSurgery, setSelectedSurgery] = useState(null);

  const fetchSurgeries = useCallback(async () => {
    try {
      const res = await fetch('/api/surgery/dashboard', { headers: { Authorization: `Bearer ${token}` }});
      const data = await res.json();
      setSurgeries(Array.isArray(data) ? data : []);
    } catch { toast.error('فشل تحميل العمليات'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    fetchSurgeries();
    const socket = getSocket();
    socket.on('surgery:new_referral', () => fetchSurgeries());
    socket.on('surgery:payment_received', () => fetchSurgeries());
    return () => {
      socket.off('surgery:new_referral');
      socket.off('surgery:payment_received');
    };
  }, [fetchSurgeries]);

  const filtered = useMemo(() => {
    return surgeries.filter(s => {
      const matchTab = s.status === activeTab;
      const matchSearch = s.full_name?.includes(search) || s.visit_number?.includes(search);
      return matchTab && matchSearch;
    });
  }, [surgeries, activeTab, search]);

  const tabCounts = surgeries.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-gray-50/50" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Activity className="text-rose-600" size={28} /> منسق العمليات
          </h1>
          <p className="text-sm text-gray-500 mt-1">إدارة كاملة لدورة حياة العمليات الجراحية والتكاليف</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input-base pr-10 w-64 text-sm" placeholder="بحث برقم الزيارة أو اسم المريض..." />
          </div>
          <button onClick={fetchSurgeries} className="btn-secondary flex items-center gap-2 bg-white"><RefreshCcw size={16}/> تحديث</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar flex-shrink-0">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id] || 0;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-5 py-3 rounded-2xl font-bold transition-all whitespace-nowrap border-2 ${
                isActive ? `${tab.bg} ${tab.color} shadow-sm ring-2 ring-offset-1 ring-${tab.color.split('-')[1]}-100` : 'bg-white border-transparent text-gray-500 hover:bg-gray-100'
              }`}>
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-white/50 text-inherit' : 'bg-gray-200 text-gray-600'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-40 bg-white rounded-2xl border border-gray-100 shadow-sm animate-pulse"/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Activity size={48} className="mb-4 opacity-20" />
            <p className="text-lg font-bold">لا توجد عمليات في هذه القائمة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((s, i) => (
                <motion.div key={s.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedSurgery(s)}
                  className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-100 to-rose-200 text-rose-700 flex items-center justify-center font-black text-xl shadow-inner">
                          {s.full_name?.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 group-hover:text-rose-700 transition-colors">{s.full_name}</h3>
                          <p className="text-xs text-gray-500">{s.visit_number} · {s.age} سنة</p>
                        </div>
                      </div>
                    </div>
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-gray-700 bg-gray-50 px-3 py-2 rounded-lg inline-block w-full">
                        {s.surgery_type || 'لم يتم تحديد العملية بعد'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-2">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">التسعيرة</p>
                      <p className="font-black text-rose-600 text-sm">{s.full_price ? `${s.full_price} YER` : 'غير مسعر'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">المدفوعات</p>
                      <p className="font-bold text-gray-800 text-sm">{s.total_paid?.toLocaleString()} YER</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedSurgery && (
          <SurgeryDetailModal surgeryRow={selectedSurgery} token={token} onClose={() => setSelectedSurgery(null)} onRefresh={fetchSurgeries} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default SurgeryCoordinator;

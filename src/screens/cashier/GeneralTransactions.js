import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeftRight, Plus, RefreshCcw, Calendar, ArrowUpRight, ArrowDownRight, ArrowDownLeft,
  X, Check, Wallet, Search, Filter, LayoutGrid, List, FileText, User, Maximize2, Minimize2
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';
import FinancialRecordModal from '../../components/common/FinancialRecordModal';
import { useNavigate } from 'react-router-dom';

const INCOME_TYPES = [
  { value:'external_lab',      label:'تحاليل خارجية' },
  { value:'external_radiology',label:'أشعة خارجية' },
  { value:'treasury_deposit',  label:'إيداع خزينة' },
  { value:'external_surgery',  label:'عملية خارجية' },
  { value:'general_income',    label:'إيراد متنوع' },
];
const EXPENSE_TYPES = [
  { value:'general_expense',    label:'مصروف عام' },
  { value:'emergency_expense',  label:'صرف طارئ' },
  { value:'emergency_purchase', label:'مشتريات طارئة' },
  { value:'refund',             label:'استرداد / مسترجع' },
];

const CAT_LABEL = {};
[...INCOME_TYPES,...EXPENSE_TYPES].forEach(t=>{ CAT_LABEL[t.value]=t.label; });

const PERIODS = [
  {key:'today',label:'اليوم'},{key:'week',label:'أسبوع'},
  {key:'month',label:'شهر'},{key:'year',label:'سنة'},{key:'custom',label:'مخصص'},
];

const GeneralTransactions = () => {
  const { token } = useAuthStore();
  const { latestSilentUpdate } = useSocketStore();
  const navigate = useNavigate();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  
  // Filters
  const [period, setPeriod]   = useState('today');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, income, expense, refunds
  const [layoutMode, setLayoutMode] = useState(() => localStorage.getItem('cashier_general_layout') || 'list');


  useEffect(() => {
    localStorage.setItem('cashier_general_layout', layoutMode);
  }, [layoutMode]);

  // Form state
  const [txType, setTxType]     = useState('income');  // income | expense
  const [category, setCategory] = useState('');
  const [amount, setAmount]     = useState('');
  const [desc, setDesc]         = useState('');
  
  // Refund Patient Search State
  const [patientsList, setPatientsList] = useState([]);
  const [searchPatientText, setSearchPatientText] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [refundService, setRefundService] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  // Patient Record Modal
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);

  const catOptions = txType === 'income' ? INCOME_TYPES : EXPENSE_TYPES;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/cashier/general-transactions?period=${period}`;
      if (period === 'custom' && from && to) url += `&from=${from}&to=${to}`;
      const res = await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch { toast.error('فشل تحميل البيانات'); }
    finally { setLoading(false); }
  },[token,period,from,to]);

  useEffect(() => {
    if (period !== 'custom' || (period === 'custom' && from && to)) {
      fetchData();
    }
    
  }, [fetchData, token, period, from, to]);

  useEffect(() => {
    if (category === 'refund' && patientsList.length === 0) {
      fetch(`/api/cashier/archive/patients`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setPatientsList(Array.isArray(data) ? data : []))
        .catch(() => toast.error('فشل في جلب قائمة المرضى'));
    }
  }, [category, token, patientsList.length]);

  const handleAdd = async e => {
    e.preventDefault();
    if (!category || !amount) return toast.warning('الفئة والمبلغ مطلوبان');
    setSaving(true);
    
    let finalDesc = desc;
    if (category === 'refund') {
      if (!selectedPatient) {
        setSaving(false);
        return toast.warning('يرجى تحديد مريض مسجل من القائمة للمسترجع');
      }
      finalDesc = `استرداد للمريض: ${selectedPatient.full_name}`;
      if (refundService) finalDesc += ` - الخدمة: ${refundService}`;
      if (desc) finalDesc += ` - الملاحظات: ${desc}`;
    }

    try {
      const res = await fetch('/api/cashier/general-transactions',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({
          type: txType,
          category,
          amount: parseFloat(amount),
          description: finalDesc,
          patient_id: category === 'refund' && selectedPatient ? selectedPatient.id : null
        }),
      });
      const data = await res.json();
      if (res.ok) { 
        toast.success(data.message); 
        setAmount(''); setDesc(''); setCategory(''); setSelectedPatient(null); setSearchPatientText(''); setRefundService('');
        setShowAddModal(false);
        fetchData(); 
      }
      else toast.error(data.message || 'حدث خطأ');
    } catch { toast.error('تعذر الاتصال بالخادم'); }
    finally { setSaving(false); }
  };

  const openPatientRecord = async (visitId) => {
    if (!visitId) return toast.info('لا يوجد سجل مريض مرتبط بهذه الحركة (تمت يدوياً)');
    // Since GeneralTransactions might not have patientId directly, we assume if visitId exists, we can fetch patient.
    // Let's assume the API handles visitId or we fetch the visit to get patient. 
    // Actually, archive API uses patient ID. GeneralTransactions may only return visit_id.
    // If we have visit_id, we can fetch it, but here we might not have it for manual refunds.
    toast.info('سجل المريض مرتبط بالأرشيف الرئيسي');
  };

  const totalIncome  = rows.filter(r => r.type === 'income' && !r.is_refund).reduce((a,r) => a + parseFloat(r.amount), 0);
  const totalExpense = rows.filter(r => r.type === 'expense' && r.category !== 'refund').reduce((a,r) => a + parseFloat(r.amount), 0);
  const totalRefunds = rows.filter(r => r.is_refund === 1 || r.category === 'refund').reduce((a,r) => a + parseFloat(r.amount), 0);
  const netBalance   = totalIncome - totalExpense - totalRefunds;

  const filteredRows = useMemo(() => {
    if (activeTab === 'income') return rows.filter(r => r.type === 'income' && !r.is_refund);
    if (activeTab === 'expense') return rows.filter(r => r.type === 'expense' && r.category !== 'refund');
    if (activeTab === 'refunds') return rows.filter(r => r.is_refund === 1 || r.category === 'refund');
    return rows;
  }, [rows, activeTab]);

  useEffect(() => {
    if (latestSilentUpdate?.type === "cashier") {
      if (typeof fetchData === "function") fetchData();
      if (typeof fetchSummary === "function") fetchSummary();
      if (typeof fetchDetail === "function") fetchDetail();
      if (typeof fetchPatients === "function") fetchPatients();
      if (typeof fetchReports === "function") fetchReports();
      if (typeof fetchSurgeries === "function") fetchSurgeries();
    }
  }, [latestSilentUpdate]);

  return (
    <div dir="rtl" className="pb-10 space-y-6">
      {/* Header Area */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-3xl shadow-xl text-white border border-slate-700 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-700/80 flex items-center justify-center shadow-lg text-indigo-400">
              <Wallet size={24}/>
            </div>
            <div>
              <h1 className="text-xl font-black text-white">الإيرادات والمصروفات العامة</h1>
              <p className="text-slate-400 text-xs mt-1">تسجيل وإدارة الحركات المالية العامة للعيادة والمرتجعات</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="bg-sky-700 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-lg shadow-indigo-600/30 px-5 py-2.5 rounded-xl text-sm font-bold transition-all">
              <Plus size={16}/> <span>إجراء جديد</span>
            </button>
            <button onClick={fetchData} disabled={loading} className="bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-sm transition-all text-sm font-bold">
              <RefreshCcw size={16} className={loading?'animate-spin':''}/>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft size={20} />
            </div>
            <span className="font-bold text-slate-500 text-xs">إجمالي الإيرادات</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800">{totalIncome.toLocaleString('ar')} <span className="text-xs text-slate-400">YER</span></h3>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight size={20} />
            </div>
            <span className="font-bold text-slate-500 text-xs">المصروفات</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800">{totalExpense.toLocaleString('ar')} <span className="text-xs text-slate-400">YER</span></h3>
        </div>

        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden group">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <RefreshCcw size={20} />
            </div>
            <span className="font-bold text-slate-500 text-xs">المرتجعات</span>
          </div>
          <h3 className="text-2xl font-black text-slate-800">{totalRefunds.toLocaleString('ar')} <span className="text-xs text-slate-400">YER</span></h3>
        </div>

        <div className="bg-slate-900 rounded-3xl p-5 shadow-xl shadow-slate-900/10 text-white relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-24 h-24 bg-sky-600/20 rounded-full blur-2xl -ml-8 -mt-8 pointer-events-none"></div>
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-indigo-300 flex items-center justify-center border border-white/10">
              <Wallet size={20} />
            </div>
            <span className="font-bold text-slate-300 text-xs">الصافي للفترة</span>
          </div>
          <h3 className={`text-2xl font-black relative z-10 ${netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netBalance > 0 ? '+' : ''}{netBalance.toLocaleString('ar')} <span className="text-xs text-slate-400">YER</span>
          </h3>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-6 flex gap-1.5 bg-slate-50 p-1.5 rounded-2xl overflow-x-auto text-xs font-bold text-slate-500 border border-slate-100">
            {[
              { id: 'all', label: 'كافة الحركات' },
              { id: 'income', label: 'الإيرادات' },
              { id: 'expense', label: 'المصروفات' },
              { id: 'refunds', label: 'المرتجعات' }
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 min-w-[80px] px-3 py-2 rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-sky-700 shadow-sm border border-slate-100' : 'hover:bg-slate-200/50'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="md:col-span-6 flex gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100 overflow-x-auto text-xs font-bold text-slate-500">
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${period === p.key ? 'bg-white text-slate-800 shadow-sm border border-slate-100' : 'hover:bg-slate-200/50'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">من:</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">إلى:</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700" />
            </div>
          </motion.div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-slate-50 text-xs font-semibold text-slate-500">
          <span>تم العثور على {filteredRows.length} سجل</span>
          <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button onClick={() => setLayoutMode('grid')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'grid' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
              <LayoutGrid size={15} />
            </button>
            <button onClick={() => setLayoutMode('list')} className={`p-1.5 rounded-lg transition-colors ${layoutMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Display */}
      <div className="relative min-h-[300px]">
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-3xl">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        )}

        {filteredRows.length === 0 && !loading ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-100 flex flex-col justify-center items-center">
            <Filter size={40} className="text-slate-200 mb-3" />
            <p className="font-extrabold text-slate-700 text-sm">لا توجد حركات مالية</p>
            <p className="text-xs text-slate-400 mt-1">لم يتم العثور على أي سجلات في الفترة المحددة بهذه الفلاتر.</p>
          </div>
        ) : layoutMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRows.map((r, i) => {
              const isRefund = r.is_refund || r.category === 'refund';
              const isIncome = r.type === 'income' && !isRefund;
              return (
                <motion.div 
                  key={r.id || i} 
                  onClick={() => setSelectedTx(r)}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
                  className={`bg-white rounded-3xl p-5 border cursor-pointer ${isRefund ? 'border-orange-100 hover:border-orange-300' : isIncome ? 'border-sky-100 hover:border-emerald-300' : 'border-rose-100 hover:border-rose-300'} shadow-sm transition-colors flex flex-col justify-between h-44`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className={`px-2 py-1 rounded-lg text-[10px] font-black ${isRefund ? 'bg-orange-50 text-orange-600' : isIncome ? 'bg-sky-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {isRefund ? 'استرداد' : isIncome ? 'إيراد' : 'مصروف'}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{CAT_LABEL[r.category] || r.category}</h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2" title={r.description}>{r.description || 'بدون ملاحظات'}</p>
                    </div>
                  </div>
                  <div className={`text-lg font-black mt-2 ${isRefund ? 'text-orange-600' : isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isIncome ? '+' : '-'}{parseFloat(r.amount).toLocaleString('ar')} <span className="text-[10px]">YER</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="text-right px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider w-16">#</th>
                    <th className="text-right px-6 py-4 text-xs font-black text-slate-500 uppercase">النوع</th>
                    <th className="text-right px-6 py-4 text-xs font-black text-slate-500 uppercase">الفئة</th>
                    <th className="text-right px-6 py-4 text-xs font-black text-slate-500 uppercase">الوصف / الملاحظات</th>
                    <th className="text-right px-6 py-4 text-xs font-black text-slate-500 uppercase">المبلغ</th>
                    <th className="text-right px-6 py-4 text-xs font-black text-slate-500 uppercase">التاريخ والوقت</th>
                    <th className="text-right px-6 py-4 text-xs font-black text-slate-500 uppercase">المنفذ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRows.map((r, i) => {
                    const isRefund = r.is_refund || r.category === 'refund';
                    const isIncome = r.type === 'income' && !isRefund;
                    return (
                      <tr 
                        key={r.id || i} 
                        onClick={() => setSelectedTx(r)}
                        className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isRefund ? 'bg-orange-50/20' : ''}`}
                      >
                        <td className="px-6 py-4 text-slate-400 font-mono text-xs">{String(i + 1).padStart(2, '0')}</td>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${
                            isRefund ? 'bg-orange-50 text-orange-700 border-orange-100' :
                            isIncome ? 'bg-sky-50 text-sky-700 border-sky-100' : 
                            'bg-rose-50 text-rose-700 border-rose-100'
                          }`}>
                            {isRefund ? <RefreshCcw size={14}/> : isIncome ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                            {isRefund ? 'استرداد' : isIncome ? 'إيداع (إيراد)' : 'مصروف'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-700 font-bold text-sm">
                          {CAT_LABEL[r.category] || r.category}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 font-medium max-w-xs truncate" title={r.description}>
                          {r.description || <span className="text-slate-400 italic font-normal">بدون ملاحظات</span>}
                        </td>
                        <td className="px-6 py-4">
                          <div className={`text-base font-black tracking-tight flex items-center gap-1 ${isRefund ? 'text-orange-600' : isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                            <span>{isIncome ? '+' : '-'}</span>
                            {parseFloat(r.amount).toLocaleString('ar')}
                            <span className="text-[10px] uppercase font-bold opacity-70 mt-1">YER</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500">
                          <div className="flex flex-col">
                            <span className="text-slate-700">{new Date(r.created_at).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            <span className="text-slate-400 font-mono mt-0.5">{new Date(r.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-black text-xs">
                              {r.cashier_name ? r.cashier_name.charAt(0) : '?'}
                            </div>
                            <span className="text-xs font-bold text-slate-600">{r.cashier_name || 'غير معروف'}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center print:hidden" dir="rtl">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
            
            <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:20, opacity:0}} 
              className="relative bg-slate-50 shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-300 border border-gray-100 rounded-3xl max-w-2xl max-h-[90vh]">
              
              <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-700 shadow-sm border border-slate-100">
                    <Wallet size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">إجراء معاملة</h3>
                    <p className="text-xs font-bold text-slate-500">إضافة إيراد، مصروف أو مسترجع</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-400 hover:text-rose-500">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 md:p-5 overflow-y-auto">
                <form onSubmit={handleAdd} className="space-y-4">
                  
                  {/* Group 1: Type and Category */}
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">نوع العملية</label>
                      <div className="flex bg-slate-50 p-1 rounded-xl relative border border-slate-100">
                        {[{v:'income',l:'إيداع (إيراد)',c:'text-sky-700'},{v:'expense',l:'مصروف / استرداد',c:'text-rose-700'}].map(t=>(
                          <button key={t.v} type="button" onClick={()=>{setTxType(t.v);setCategory('');}} className={`flex-1 py-2 text-[11px] font-black rounded-lg transition-all relative z-10 ${txType===t.v ? `${t.c}` : `text-slate-400 hover:text-slate-600`}`}>
                            {t.l}
                          </button>
                        ))}
                        <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out ${txType==='income' ? 'right-1' : 'left-1'}`}></div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">الفئة التصنيفية <span className="text-rose-500">*</span></label>
                      <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-sky-500 block p-2.5 font-bold outline-none transition-all" required>
                        <option value="" disabled>-- اختر الفئة --</option>
                        {catOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Group 2: Refund Details */}
                  {category === 'refund' && (
                    <div className="p-4 bg-orange-50/40 border border-orange-100 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <label className="block text-[11px] font-bold text-orange-800/70 mb-2">اسم المريض <span className="text-rose-500">*</span></label>
                        <div 
                          className="w-full bg-white border border-orange-200 text-slate-700 text-xs rounded-xl focus-within:ring-2 focus-within:ring-orange-500/20 p-2.5 font-bold cursor-pointer flex justify-between items-center transition-all hover:border-orange-300"
                          onClick={() => setShowPatientDropdown(!showPatientDropdown)}
                        >
                          <span className="truncate">{selectedPatient ? selectedPatient.full_name : '-- اضغط لاختيار المريض --'}</span>
                          {selectedPatient && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedPatient(null); }} className="text-rose-500 hover:text-rose-700 bg-rose-50 p-1 rounded-md ml-1 shrink-0">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        {showPatientDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                            <div className="p-2 border-b border-slate-100 bg-slate-50">
                              <input 
                                type="text" 
                                autoFocus
                                value={searchPatientText}
                                onChange={e => setSearchPatientText(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-xs rounded-lg p-2 outline-none focus:border-sky-400 focus:ring-2 focus:ring-indigo-400/20"
                                placeholder="ابحث باسم المريض أو رقمه..."
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {patientsList.length === 0 ? (
                                <div className="p-4 text-center text-[11px] text-slate-500 font-bold">جاري التحميل...</div>
                              ) : (
                                patientsList.filter(p => p.full_name?.includes(searchPatientText) || String(p.id).includes(searchPatientText)).slice(0, 50).map(p => (
                                  <div 
                                    key={p.id}
                                    onClick={() => { setSelectedPatient(p); setShowPatientDropdown(false); setSearchPatientText(''); }}
                                    className="p-2 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                                  >
                                    <span className="font-bold text-[11px] text-slate-700">{p.full_name}</span>
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md font-bold">ID: {p.id}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-orange-800/70 mb-2">اسم الخدمة المسترجعة</label>
                        <input type="text" value={refundService} onChange={e=>setRefundService(e.target.value)} className="w-full bg-white border border-orange-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-orange-500/20 block p-2.5 font-bold outline-none transition-all hover:border-orange-300" placeholder="مثال: أشعة، كشف..."/>
                      </div>
                    </div>
                  )}

                  {/* Group 3: Amount & Notes */}
                  <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4">
                    <div className="md:w-1/3">
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">المبلغ المالي <span className="text-rose-500">*</span></label>
                      <div className="relative h-[calc(100%-24px)]">
                        <input type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className={`w-full h-full min-h-[64px] bg-slate-50 border border-slate-200 text-2xl font-black rounded-xl focus:ring-2 block p-3 text-center transition-all outline-none ${txType==='income'?'text-emerald-600 focus:border-sky-500 focus:ring-sky-500/20':'text-rose-600 focus:border-rose-500 focus:ring-rose-500/20'}`} placeholder="0" required/>
                        <span className="absolute left-3 top-3 font-bold text-slate-400 text-[10px]">YER</span>
                      </div>
                    </div>

                    <div className="md:w-2/3">
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">الوصف والملاحظات</label>
                      <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows="3" className="w-full h-[calc(100%-24px)] min-h-[64px] bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-sky-500 block p-3 font-medium resize-none outline-none transition-all" placeholder="أضف أي تفاصيل أو ملاحظات إضافية هنا..."/>
                    </div>
                  </div>

                  <button type="submit" disabled={saving} className={`w-full py-3 rounded-xl font-black text-white text-sm shadow-sm transition-all flex items-center justify-center gap-2 mt-2 ${txType==='income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <Check size={16} /> حفظ وتأكيد
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transaction Details Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center print:hidden" dir="rtl">
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedTx(null)} />
            <motion.div initial={{y:20, opacity:0}} animate={{y:0, opacity:1}} exit={{y:20, opacity:0}} 
              className="relative bg-white shadow-2xl w-full flex flex-col overflow-hidden transition-all duration-300 border border-slate-100 rounded-3xl max-w-md">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-sky-600 shadow-sm border border-slate-100">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">تفاصيل العملية</h3>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">#{selectedTx.id}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedTx(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-rose-500">
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 md:p-5 space-y-4 overflow-y-auto">
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl p-4 md:p-5 text-center shadow-inner">
                  <span className="text-xs font-bold text-slate-500 mb-1">المبلغ الإجمالي</span>
                  <div className={`text-2xl md:text-3xl font-black tracking-tight flex items-center justify-center gap-2 ${selectedTx.is_refund || selectedTx.category === 'refund' ? 'text-orange-600' : selectedTx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <span>{selectedTx.type === 'income' && !(selectedTx.is_refund || selectedTx.category === 'refund') ? '+' : '-'}</span>
                    {parseFloat(selectedTx.amount).toLocaleString('ar')} 
                    <span className="text-xs font-bold opacity-70 mt-1.5">YER</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shrink-0 ${selectedTx.is_refund || selectedTx.category === 'refund' ? 'bg-orange-50 text-orange-600' : selectedTx.type === 'income' ? 'bg-sky-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {selectedTx.is_refund || selectedTx.category === 'refund' ? <RefreshCcw size={18}/> : selectedTx.type === 'income' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-0.5">نوع العملية</span>
                      <span className="text-xs font-black text-slate-700">{selectedTx.is_refund || selectedTx.category === 'refund' ? 'استرداد نقدي' : selectedTx.type === 'income' ? 'إيراد (إيداع)' : 'مصروفات'}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 text-sky-600 shrink-0">
                      <LayoutGrid size={18}/>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-0.5">الفئة التصنيفية</span>
                      <span className="text-xs font-black text-slate-700">{CAT_LABEL[selectedTx.category] || selectedTx.category}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 text-slate-600 shrink-0">
                      <Calendar size={18}/>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-0.5">التاريخ والوقت</span>
                      <span className="text-xs font-black text-slate-700 font-mono" dir="ltr">{new Date(selectedTx.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600 shrink-0">
                      <User size={18}/>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 mb-0.5">الموظف المنفذ</span>
                      <span className="text-xs font-black text-slate-700">{selectedTx.cashier_name || 'غير معروف'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2 text-slate-600">
                    <FileText size={16}/>
                    <span className="font-bold text-xs">الوصف والملاحظات</span>
                  </div>
                  <p className="text-xs font-medium text-slate-700 leading-relaxed">{selectedTx.description || 'لا توجد ملاحظات إضافية.'}</p>
                </div>
              </div>
              <div className="p-4 border-t border-slate-50 bg-slate-50/50 flex justify-between items-center">
                <div>
                  {(selectedTx.is_refund || selectedTx.category === 'refund') && selectedTx.patient_id && (
                    <button onClick={() => navigate(`/cashier/archive?patientId=${selectedTx.patient_id}`)} className="px-4 py-2 bg-slate-100 hover:bg-indigo-200 text-sky-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2">
                      <User size={14}/> عرض ملف المريض
                    </button>
                  )}
                </div>
                <button onClick={() => setSelectedTx(null)} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all">
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shared Record Modal Integration (If Needed in General Transactions) */}
      {selectedPatientId && (
        <FinancialRecordModal token={localStorage.getItem('token')} 
          recordData={recordData}
          recordLoading={recordLoading}
          onClose={() => setSelectedPatientId(null)}
        />
      )}
    </div>
  );
};

export default GeneralTransactions;




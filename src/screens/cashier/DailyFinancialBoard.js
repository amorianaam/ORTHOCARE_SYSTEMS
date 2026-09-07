import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Wallet, TrendingUp, TrendingDown,
  RotateCcw, CreditCard, Activity, Scissors, Users
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';

import FinancialRecordModal from '../../components/common/FinancialRecordModal';
import UnifiedPaymentModal from '../../components/cashier/UnifiedPaymentModal';
import EntryFeesTab from './tabs/EntryFeesTab';
import ServicesTab from './tabs/ServicesTab';
import SurgeriesTab from './tabs/SurgeriesTab';
import TodayPatientsTab from './tabs/TodayPatientsTab';

const DailyFinancialBoard = () => {
  const { token } = useAuthStore();
  const { latestSilentUpdate, setSilentUpdate } = useSocketStore();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  
  const [activeTab, setActiveTab] = useState('entry_fees');
  
  // Unified Checkout Modal State
  const [checkoutVisitId, setCheckoutVisitId] = useState(null);
  const [checkoutVisitData, setCheckoutVisitData] = useState(null);
  const [checkoutMode, setCheckoutMode] = useState('both');
  
  // Patient Financial Record Modal State
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [recordData, setRecordData] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);

  const fetchPatientRecord = useCallback(async (id) => {
    setSelectedPatientId(id);
    setRecordLoading(true);
    try {
      const res = await fetch(`/api/cashier/archive/patient/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRecordData(await res.json());
      } else {
        toast.error('تعذر جلب السجل المالي للمريض');
      }
    } catch (err) {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setRecordLoading(false);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const statsRes = await fetch('/api/cashier/stats/summary', { headers: { Authorization: `Bearer ${token}` } });
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (err) {
      toast.error('تعذر جلب الإحصائيات');
    } finally {
      setLoadingStats(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (latestSilentUpdate?.type === 'cashier') {
      fetchStats();
    }
  }, [latestSilentUpdate, fetchStats]);

  const TABS = [
    { id: 'entry_fees', label: 'رسوم الكشف', icon: CreditCard, color: 'text-sky-600', bg: 'bg-sky-100', activeBg: 'bg-sky-600', badge: stats?.pendingEntryFeesCount },
    { id: 'services', label: 'الخدمات الطبية', icon: Activity, color: 'text-sky-600', bg: 'bg-sky-100', activeBg: 'bg-sky-600', badge: stats?.waitingServicesCount },
    { id: 'surgeries', label: 'العمليات الجراحية', icon: Scissors, color: 'text-sky-600', bg: 'bg-sky-100', activeBg: 'bg-sky-600', badge: stats?.pendingSurgeriesCount },
    { id: 'today_patients', label: 'مراجعو اليوم', icon: Users, color: 'text-sky-600', bg: 'bg-sky-100', activeBg: 'bg-sky-600', badge: stats?.activePatientsCount },
  ];

  return (
    <div className="p-4 md:p-6 min-h-full flex flex-col space-y-6 bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 to-sky-800 text-white flex items-center justify-center shadow-lg shadow-sky-600/30">
            <LayoutDashboard size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              لوحة العمليات اليومية
              <span className="relative flex h-3 w-3" title="متصل بالشبكة المحلية">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </h1>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/60 backdrop-blur-md border border-gray-200/60 shadow-sm mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              <p className="text-xs font-bold text-gray-600">مراقبة حية للمركز المالي وحالة الخدمات</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: 'إجمالي الدخل', value: stats?.todayIncome || 0, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' },
          { label: 'المرتجعات', value: stats?.todayRefunds || 0, icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-100', border: 'border-rose-200' },
          { label: 'المصروفات', value: stats?.todayExpenses || 0, icon: TrendingDown, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
          { label: 'صافي الصندوق', value: stats?.todayAvailable || 0, icon: Wallet, color: 'text-sky-600', bg: 'bg-sky-100', border: 'border-sky-200' },
        ].map((s, i) => (
          <div key={i} className={`p-4 rounded-2xl border ${s.border} bg-white shadow-sm relative overflow-hidden flex flex-col justify-between isolate`}>
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${s.bg} to-transparent opacity-50 rounded-bl-full z-[-1]`} />
            <div className="flex justify-between items-start mb-4">
              <div className={`w-8 h-8 rounded-xl ${s.bg} flex items-center justify-center shadow-sm`}>
                <s.icon size={16} className={s.color} />
              </div>
              <span className={`text-[11px] font-bold ${s.color} px-2.5 py-1 bg-white/80 backdrop-blur rounded-lg shadow-sm border border-white/50`}>{s.label}</span>
            </div>
            <div>
              {loadingStats ? (
                 <div className="h-8 bg-gray-100 rounded-lg animate-pulse w-24"></div>
              ) : (
                 <p className="text-xl font-black text-gray-800" style={{ direction: 'ltr', textAlign: 'right' }}>
                    {Number(s.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-gray-400 ml-1 uppercase">YER</span>
                 </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Menu */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5 flex-shrink-0 overflow-x-auto no-scrollbar mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-max flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300 whitespace-nowrap ${
              activeTab === tab.id 
                ? `${tab.activeBg} text-white shadow-md transform scale-[1.02]` 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeTab === tab.id ? 'bg-white/20 text-white' : tab.bg + ' ' + tab.color}`}>
              <tab.icon size={16} strokeWidth={2.5} />
            </div>
            {tab.label}
            {tab.badge > 0 && (
              <span className={`mr-1 px-2 py-0.5 rounded-full text-xs font-black ${
                activeTab === tab.id ? 'bg-white text-sky-800' : 'bg-red-500 text-white shadow-sm animate-pulse'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-gray-50 rounded-3xl p-4 min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full flex flex-col"
          >
            {activeTab === 'entry_fees' && <EntryFeesTab onPatientClick={fetchPatientRecord} onCheckout={(v) => { setCheckoutVisitId(v.visit_id); setCheckoutVisitData(v); setCheckoutMode('entry'); }} />}
            {activeTab === 'services' && <ServicesTab onPatientClick={fetchPatientRecord} onCheckout={(v) => { setCheckoutVisitId(v.visit_id); setCheckoutVisitData(v); setCheckoutMode('services'); }} />}
            {activeTab === 'surgeries' && <SurgeriesTab onPatientClick={fetchPatientRecord} />}
            {activeTab === 'today_patients' && <TodayPatientsTab onPatientClick={fetchPatientRecord} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Unified Payment Modal */}
      {checkoutVisitId && (
        <UnifiedPaymentModal 
          visitId={checkoutVisitId}
          visitData={checkoutVisitData}
          token={token}
          mode={checkoutMode}
          onClose={() => { setCheckoutVisitId(null); setCheckoutVisitData(null); }}
          onOpenLedger={(patientId) => { fetchPatientRecord(patientId); setCheckoutVisitId(null); setCheckoutVisitData(null); }}
          onPaid={() => fetchStats()}
        />
      )}

      {/* Patient Financial Record Modal */}
      {selectedPatientId && (
        <FinancialRecordModal token={localStorage.getItem('token')} onRefresh={() => fetchPatientRecord(selectedPatientId)} onOpenCheckout={(visit) => { if (visit) { const enrichedVisit = { ...visit, full_name: recordData?.patient?.full_name || visit.full_name, phone: recordData?.patient?.phone || visit.phone, patient_id: recordData?.patient?.id || visit.patient_id }; setCheckoutVisitId(visit.id || visit.visit_id || visit.surgery_id); setCheckoutVisitData(enrichedVisit); if (visit.is_surgery) { setCheckoutMode('surgery'); } else { setCheckoutMode('services'); } setSelectedPatientId(null); } }} 
          recordData={recordData}
          recordLoading={recordLoading}
          onClose={() => setSelectedPatientId(null)}
        />
      )}
    </div>
  );
};

export default DailyFinancialBoard;


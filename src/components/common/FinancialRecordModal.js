import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Printer, Maximize2, Minimize2, X, History, ArrowUpRight, ArrowDownLeft, FileText, User, Phone, Hash, Layers, Calendar, Scissors } from 'lucide-react';
import { createPortal } from 'react-dom';
import UnifiedTimelineNavigator from './UnifiedTimelineNavigator';
import taffyot from '../../utils/taffyot';

const CATEGORY_MAP = {
  entry_fee: 'رسم كشف',
  lab: 'مختبر',
  radiology: 'أشعة',
  surgery_payment: 'عملية',
  emergency: 'طوارئ',
  dental: 'أسنان',
  other: 'أخرى'
};

const STATUS_BADGE = {
  'paid':            { label: 'بانتظار التنفيذ', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'in_progress':     { label: 'قيد التنفيذ',     color: 'bg-amber-50 text-amber-700 border-amber-200', pulse: true },
  'result_uploaded': { label: 'النتائج جاهزة',   color: 'bg-purple-50 text-purple-700 border-purple-200' },
  'completed':       { label: 'مكتملة',           color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'refunded':        { label: 'مُسترد',           color: 'bg-red-50 text-red-600 border-red-200' },
  'cancelled':       { label: 'ملغاة',            color: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const parseServiceDescription = (desc, amount) => {
  let text = 'بدون بيان';
  let isFree = parseFloat(amount) === 0;
  
  if (desc) {
    // 1. Remove any internal curly brace JSON/metadata
    text = desc.replace(/\{.*?\}/g, '').trim();
    
    // 2. Detect the verbose backend free-service pattern
    // e.g., "تحليل مجاني بواسطة الدكتور (السعر الأصلي: 2000.00) - RBS"
    const freeServiceRegex = /^.+?\(السعر الأصلي:\s*[\d.]+\)\s*-\s*(.+)$/;
    const match = text.match(freeServiceRegex);
    
    if (match && match[1]) {
      text = match[1].trim(); // Extract purely the service name
      isFree = true; // Safety override
    }
  }
  
  return {
    serviceName: text || 'عام',
    isFree: isFree
  };
};

const FinancialRecordModal = ({ recordData, recordLoading, onClose, token, onRefresh, onOpenCheckout }) => {
  const [refundTarget, setRefundTarget] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);
  const [showGeneralRefundModal, setShowGeneralRefundModal] = useState(false);
  const [generalAmount, setGeneralAmount] = useState('');
  const [generalReason, setGeneralReason] = useState('');
  const [isRefundingGeneral, setIsRefundingGeneral] = useState(false);

  const handleGeneralRefund = async () => {
    if (!generalAmount || parseFloat(generalAmount) <= 0 || !generalReason.trim()) return;
    setIsRefundingGeneral(true);
    try {
      await axios.post(`/api/cashier/patient/${recordData?.patient?.id}/general-refund`,
        { amount: parseFloat(generalAmount), reason: generalReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('تم الاسترداد العام بنجاح');
      setShowGeneralRefundModal(false);
      setGeneralAmount('');
      setGeneralReason('');
      if (typeof onRefresh === 'function') { onRefresh(); } else { window.location.reload(); }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'خطأ أثناء الاسترداد المالي العام');
    } finally {
      setIsRefundingGeneral(false);
    }
  };


  const handleItemRefund = async () => {
    if (!refundTarget || !refundReason.trim()) return;
    setIsRefunding(true);
    try {
      await axios.put(`/api/cashier/service-${refundTarget.type}/${refundTarget.id}/refund`, 
        { reason: refundReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('تم استرداد الخدمة بنجاح');
      setRefundTarget(null);
      setRefundReason('');
      if (typeof onRefresh === 'function') { onRefresh(); } else { window.location.reload(); }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'خطأ أثناء الاسترداد');
    } finally {
      setIsRefunding(false);
    }
  };

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);

  useEffect(() => {
    if (recordData?.visits && recordData.visits.length > 0) {
      setSelectedVisit(recordData.visits[0]);
    } else {
      setSelectedVisit(null);
    }
  }, [recordData]);

  if (!recordData && !recordLoading) return null;

  const filteredTransactions = selectedVisit 
    ? recordData.transactions.filter(t => {
        const tDate = new Date(t.created_at).toLocaleDateString('en-GB');
        const vDate = new Date(selectedVisit.created_at).toLocaleDateString('en-GB');
        return tDate === vDate;
      })
    : recordData?.transactions || [];

  const filteredPending = selectedVisit
    ? (recordData.pendingServices || []).filter(s => s.visit_id === selectedVisit.id)
    : recordData?.pendingServices || [];

  const filteredHistory = selectedVisit
    ? (recordData.serviceHistory || []).filter(s => s.visit_id === selectedVisit.id)
    : recordData?.serviceHistory || [];

  // Determine Archive Status
  const latestVisit = recordData?.visits?.[0];
  
  const hasPaidTransactions = recordData?.transactions?.some(t => t.type === 'income') || false;

  const isArchived = latestVisit && 
    (latestVisit.status === 'completed' || latestVisit.status === 'cancelled') && 
    (Date.now() - new Date(latestVisit.created_at).getTime()) > 86400000;

  const modalTitle = `السجل المالي للمريض (${recordData?.patient?.full_name || '...'}) ${isArchived ? '— للقراءة فقط' : ''}`;
  const displayDate = selectedVisit?.created_at || latestVisit?.created_at || Date.now();

  const modalContent = (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300 print:static print:inset-auto print:flex-col print:bg-white print:z-auto" dir="rtl">
      {/* Background Overlay */}
      <div className="absolute inset-0 print:hidden" onClick={onClose} />
      
      {/* Modal Container */}
      <div className={`relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] print:shadow-none print:w-full print:max-w-none print:max-h-none print:rounded-none print:border-none border border-white/60 ${isFullscreen ? 'w-[98vw] h-[98vh] rounded-[2.5rem]' : 'w-full max-w-5xl h-full max-h-[90vh] rounded-[2rem]'}`}>
        
        {/* Top Title Bar & Controls */}
        <div className="px-5 py-2.5 flex items-center justify-between flex-shrink-0 shadow-md text-white transition-colors duration-300 bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-700 print:hidden z-30">
          <div className="flex items-center gap-2">
            <Layers size={16} />
            <span className="text-xs font-black tracking-wide drop-shadow-sm">
              {modalTitle}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => window.print()} className="w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all shadow-sm" title="طباعة الكشف">
              <Printer size={15} />
            </button>
            <div className="w-px h-5 bg-white/30 mx-1 hidden sm:block"></div>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all shadow-sm hidden sm:flex" title={isFullscreen ? 'تصغير' : 'تكبير'}>
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white hover:text-red-100 rounded-lg transition-all shadow-sm">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* HEADER */}
        <div className="bg-white px-6 sm:px-8 py-5 flex items-start justify-between border-b border-slate-100 shrink-0 print:hidden z-20">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.5rem] bg-gradient-to-br from-slate-50 to-sky-100 flex items-center justify-center text-sky-600 shadow-inner border border-sky-100/50 shrink-0">
              <User size={32} strokeWidth={1.5} className="sm:hidden" />
              <User size={36} strokeWidth={1.5} className="hidden sm:block" />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <h2 className="text-xl sm:text-3xl font-black text-slate-800 tracking-tight leading-none">
                {recordData?.patient?.full_name || '...'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-slate-500 bg-slate-100/80 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-200/60" dir="ltr">
                  <User size={12}/> {recordData?.patient?.id || '...'}
                </span>
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-sky-600 bg-sky-50 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-sky-100/60">
                  <Phone size={12}/> {recordData?.patient?.phone || 'بدون هاتف'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Plain Text Date & Visit ID under the Window Controls side */}
          <div className="flex flex-col items-end pt-1 gap-1.5">
            <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs sm:text-sm">
              <Calendar size={14} className="text-sky-600 opacity-80" />
              <span dir="ltr">{new Date(displayDate).toLocaleDateString('en-GB')}</span>
              <span className="text-slate-300 mx-0.5">•</span>
              <span dir="ltr">{new Date(displayDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
            </div>
            {(() => {
              const activeVisit = selectedVisit || latestVisit;
              if (!activeVisit) return null;
              return (
                <div className="flex items-center gap-1 text-[11px] font-black text-slate-400">
                  <span>معرف الزيارة:</span>
                  <span className="text-slate-600" dir="ltr">{activeVisit.visit_number || activeVisit.id}</span>
                </div>
              );
            })()}
            {hasPaidTransactions && (
              <button 
                onClick={() => setShowGeneralRefundModal(true)} 
                className="mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-slate-700 hover:text-red-600 hover:border-red-200 rounded-lg text-[11px] font-bold transition-all shadow-sm border border-slate-200"
              >
                استرداد مالي عام
              </button>
            )}
          </div>
        </div>

        {/* Timeline Navigator Bar */}
        {!recordLoading && recordData && (
          <div className="bg-white border-b border-slate-100 z-10 flex-shrink-0">
             <UnifiedTimelineNavigator 
               patientHistory={recordData.visits || []} 
               selectedVisit={selectedVisit} 
               onSelectVisit={setSelectedVisit} 
               theme="sky"
             />
          </div>
        )}

        {/* Printable Header (Visible only in print) */}
        <div className="hidden print:block text-center mb-8 border-b-2 border-slate-800 pb-4 mt-8">
          <h1 className="text-2xl font-black mb-2 text-slate-800">ORTHOCARE SYSTEM - السجل المالي</h1>
          {recordData?.patient && (
            <div className="flex justify-between text-sm font-bold mt-4 text-slate-700">
              <span>اسم المريض: {recordData.patient.full_name}</span>
              <span>رقم المريض: {recordData.patient.id}</span>
              <span>الهاتف: {recordData.patient.phone || '—'}</span>
            </div>
          )}
          {selectedVisit && (
             <div className="text-center mt-2 text-sm font-bold text-slate-600">
               تاريخ الزيارة: {new Date(selectedVisit.created_at).toLocaleDateString('en-GB')}
             </div>
          )}
          <p className="text-xs text-slate-500 mt-2">تاريخ الطباعة: {new Date().toLocaleString('en-GB')}</p>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar flex flex-col items-center print:bg-white print:overflow-visible print:p-0">
          {recordLoading ? (
             <div className="flex items-center justify-center h-48 w-full">
               <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
             </div>
          ) : (
            <div className="w-full space-y-8 pb-8 print:pb-0">
              
              
              {/* --- Section 0: Pending Dues --- */}
              {filteredPending.length > 0 && (
                <div className="space-y-2 mb-8">
                  {/* Floating Header */}
                  <div className="flex items-center justify-between px-1 print:hidden">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-amber-100/80 rounded-lg text-amber-600 shadow-sm"><Layers size={16} /></div>
                      <h3 className="text-sm font-black text-slate-700">مستحقات معلقة</h3>
                      <span className="text-xs font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{filteredPending.length}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-right text-sm whitespace-nowrap table-fixed">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[5%] text-center">#</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[38%] text-right">اسم الخدمة</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[12%] text-right">الجهة</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[15%] text-right">الحالة</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[15%] text-right">المبلغ المطلوب</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[15%] text-center">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {filteredPending.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-3 font-black text-slate-400 text-center text-xs align-middle">{idx + 1}</td>
                              <td className="px-5 py-3 font-semibold text-slate-800 whitespace-pre-wrap break-words max-w-[250px] align-middle">{item.name}</td>
                              <td className="px-5 py-3 font-semibold text-slate-600 text-xs align-middle">{CATEGORY_MAP[item.type] || item.type}</td>
                              <td className="px-5 py-3 align-middle">
                                <span className="text-[11px] font-bold text-amber-600">
                                  بانتظار الدفع
                                </span>
                              </td>
                              <td className="px-5 py-3 align-middle">
                                <div className="flex items-center gap-1 text-slate-800">
                                  <span className="text-base font-black tracking-tight" dir="ltr">
                                    {parseFloat(item.price).toLocaleString('en-US')}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">YER</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 align-middle text-center">
                                <button 
                                  onClick={() => {
                                    if (typeof onOpenCheckout === 'function') {
                                      const visit = recordData?.visits?.find(v => v.id === item.visit_id);
                                      onOpenCheckout(visit || item);
                                    }
                                  }}
                                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-1 w-max"
                                >
                                  دفع وتحصيل
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* --- Section 1: Financial Transactions --- */}
              {filteredTransactions.length > 0 && (
              <div className="space-y-2">
                {/* Floating Header */}
                <div className="flex items-center gap-2 px-1 print:hidden">
                  <div className="p-1.5 bg-teal-100/80 rounded-lg text-teal-600 shadow-sm"><FileText size={16} /></div>
                  <h3 className="text-sm font-black text-slate-700">الحركات المالية والتسديدات</h3>
                </div>
                
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col print:border-none print:shadow-none print:rounded-none">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-right text-sm whitespace-nowrap table-fixed">
                      <thead className="bg-slate-50 border-b border-slate-200 print:bg-transparent print:border-slate-800">
                        <tr>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[5%] text-center">#</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[35%] text-right">اسم الخدمة</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[12%] text-right">الجهة</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[15%] text-right">نوع الحركة</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[18%] text-right">التاريخ والوقت</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-[15%] text-right">المبلغ</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100 print:divide-slate-200">
              {filteredTransactions.length === 0 && (
                          <tr><td colSpan="6" className="px-5 py-6 text-center text-slate-400 font-bold text-sm">لا توجد حركات مالية</td></tr>
                        )}
                        {filteredTransactions.map((t, index) => (
                          <tr key={t.id} className={`hover:bg-slate-50/50 transition-colors ${t.is_refund ? 'bg-red-50/20 print:bg-transparent' : ''}`}>
                            {/* 0. الرقم (Index) */}
                            <td className="px-5 py-3 font-black text-slate-400 text-center text-xs align-middle">
                              {index + 1}
                            </td>
                            {/* 1. اسم الخدمة */}
                            <td className="px-5 py-3 font-semibold text-slate-800 align-middle whitespace-pre-wrap break-words max-w-[250px]">
                              {(() => {
                                const parsed = parseServiceDescription(t.description, t.amount);
                                return (
                                  <div className="flex items-center flex-wrap gap-2">
                                    <span>{parsed.serviceName}</span>
                                    {parsed.isFree && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-200/60 shadow-sm shrink-0">
                                        مجاني
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                              {!!t.is_refund && <div className="text-red-500 text-[10px] font-bold mt-1 bg-red-50 px-2 py-0.5 rounded border border-red-100 w-fit">سبب المرتجع: {t.refund_reason}</div>}
                            </td>
                            {/* 2. الجهة (Normal Text) */}
                            <td className="px-5 py-3 align-middle">
                              <span className="font-semibold text-slate-600 text-xs">
                                {CATEGORY_MAP[t.category] || t.category || 'عام'}
                              </span>
                            </td>
                            {/* 3. نوع الحركة (Normal Text with subtle icon) */}
                            <td className="px-5 py-3 align-middle">
                              <div className={`flex items-center gap-1.5 font-bold text-xs ${t.is_refund ? 'text-red-600' : 'text-emerald-600'}`}>
                                {t.is_refund ? <ArrowUpRight size={14}/> : <ArrowDownLeft size={14}/>}
                                <span>{t.is_refund ? 'استرداد' : 'تحصيل'}</span>
                              </div>
                            </td>
                            {/* 4. التاريخ */}
                            <td className="px-5 py-3 align-middle">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-slate-700" dir="ltr">{new Date(t.created_at).toLocaleDateString('en-GB')}</span>
                                <span className="text-[10px] font-bold text-slate-400" dir="ltr">{new Date(t.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit', hour12: true })}</span>
                              </div>
                            </td>
                            {/* 5. المبلغ */}
                            <td className="px-5 py-3 align-middle">
                              <div className="flex items-center gap-1">
                                <span className={`text-base font-black tracking-tight ${t.is_refund ? 'text-red-600' : 'text-slate-800'}`}>
                                  {parseFloat(t.amount).toLocaleString('en-US')}
                                </span>
                                <span className={`text-[10px] font-bold ${t.is_refund ? 'text-red-400' : 'text-slate-400'}`}>
                                  YER
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* TransactionDetailsModal Style Footer with Taffyot */}
                  {(() => {
                    const grandTotal = filteredTransactions.reduce((acc, t) => t.is_refund ? acc - parseFloat(t.amount) : acc + parseFloat(t.amount), 0);
                    
                    const bgClass = 'bg-emerald-50/50 border-emerald-100/60';
                    const textClass = 'text-emerald-800';
                    const numberClass = 'text-emerald-700';
                    const currencyClass = 'text-emerald-600';
                    const taffyotClass = 'text-emerald-700/70 border-emerald-200/60';

                    return (
                      <div className={`flex items-center justify-between px-6 py-4 border-t mt-auto print:bg-transparent print:border-slate-800 print:border-t-2 ${bgClass}`}>
                        <span className={`text-xs font-bold ${textClass}`}>الإجمالي النهائي:</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-base font-black tracking-tight ${numberClass}`}>{grandTotal.toLocaleString('en-US')}</span>
                          <span className={`text-[10px] font-bold ${currencyClass}`}>YER</span>
                          {grandTotal > 0 && <span className={`text-xs font-bold mr-1.5 pr-2 border-r ${taffyotClass}`}>{taffyot(grandTotal).replace(/(ريالاً يمنياً|ريال يمني|فقط|لا غير|-)/g, '').trim()} ريال يمني.</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              )}

              {/* --- Section 2: Service History --- */}
              {filteredHistory.length > 0 && (
                <div className="space-y-2 mt-8">
                  <div className="flex items-center gap-2 px-1 print:hidden">
                    <div className="p-1.5 bg-sky-100/80 rounded-lg text-sky-600 shadow-sm"><History size={16} /></div>
                    <h3 className="text-sm font-black text-slate-700">سجل الخدمات السريرية</h3>
                  </div>
                  
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col print:border-none print:shadow-none print:rounded-none">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full text-right text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-12 text-center">#</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 min-w-[250px]">الخدمة</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-32">الجهة</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-48">الحالة السريرية</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-48">تاريخ الطلب</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-36">المبلغ النهائي</th>
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500 w-32">إجراء</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {filteredHistory.map((s, index) => {
                            const badge = STATUS_BADGE[s.status] || STATUS_BADGE['paid'];
                            return (
                            <tr key={'hist_'+index} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-5 py-4 font-black text-slate-400 text-center text-xs">{index + 1}</td>
                              <td className="px-5 py-4 font-semibold text-slate-800 whitespace-pre-wrap break-words max-w-[250px]">{s.name}</td>
                              <td className="px-5 py-4 font-semibold text-slate-600 text-xs">{CATEGORY_MAP[s.type] || s.type}</td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.color}`}>
                                  {badge.pulse && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-700" dir="ltr">{new Date(s.created_at).toLocaleDateString('en-GB')}</span>
                                  <span className="text-[10px] font-bold text-slate-400" dir="ltr">{new Date(s.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit', hour12: true })}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span className="text-base font-black tracking-tight text-slate-800" dir="ltr">
                                  {parseFloat(s.final_price || s.price).toLocaleString('en-US')} <span className="text-[10px] text-slate-400 font-bold">YER</span>
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                {s.status === 'paid' ? (
                                  <button onClick={() => setRefundTarget(s)} className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs px-3 py-1.5 rounded-lg border border-red-200 transition-colors">
                                    استرداد
                                  </button>
                                ) : (s.status === 'in_progress' || s.status === 'completed' || s.status === 'result_uploaded') ? (
                                  <button disabled className="bg-slate-50 text-slate-400 font-bold text-[10px] px-2 py-1.5 rounded-lg border border-slate-200 cursor-not-allowed">
                                    لا يمكن الاسترداد - الخدمة قيد التنفيذ أو مكتملة
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* --- Section 3: Surgeries Record --- */}
              {recordData?.surgeries?.length > 0 && (
                <div className="space-y-3 mt-8">
                  <div className="flex items-center gap-2 px-1 print:hidden">
                    <div className="p-1.5 bg-indigo-100/80 rounded-lg text-indigo-600 shadow-sm"><Scissors size={16} /></div>
                    <h3 className="text-sm font-black text-slate-700">سجل العمليات الجراحية</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {recordData.surgeries.map(surgery => {
                      const netPrice = parseFloat(surgery.full_price || 0) - parseFloat(surgery.discount_amount || 0);
                      const paid = parseFloat(surgery.paid_amount || 0);
                      const remaining = netPrice - paid;
                      const progressPct = netPrice > 0 ? Math.min(100, Math.max(0, (paid / netPrice) * 100)) : 0;
                      
                      return (
                        <div key={surgery.surgery_id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-base">{surgery.surgery_type}</h4>
                              <p className="text-xs font-bold text-slate-500 mt-1" dir="ltr">
                                {new Date(surgery.created_at).toLocaleDateString('en-GB')} - {new Date(surgery.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' })}
                              </p>
                            </div>
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              {surgery.status === 'planned' ? 'مخطط لها' : surgery.status === 'scheduled' ? 'مجدولة' : surgery.status}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-600">نسبة السداد</span>
                              <span className="text-emerald-600">{progressPct.toFixed(0)}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                            </div>
                          </div>

                          {/* Financials & Action */}
                          <div className="flex items-end justify-between pt-2 mt-auto">
                            <div className="flex gap-4">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold">الإجمالي (بعد الخصم)</span>
                                <span className="text-sm font-black text-slate-700">{netPrice.toLocaleString('en-US')} <span className="text-[9px]">YER</span></span>
                              </div>
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-slate-400 font-bold">المتبقي</span>
                                <span className="text-sm font-black text-rose-600">{remaining.toLocaleString('en-US')} <span className="text-[9px]">YER</span></span>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => {
                                if (typeof onOpenCheckout === 'function') {
                                  onOpenCheckout({ ...surgery, id: surgery.surgery_id, is_surgery: true });
                                }
                              }}
                              disabled={remaining <= 0}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-black px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                              {remaining <= 0 ? 'مكتمل الدفع' : 'دفع دفعة'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


            </div>
          )}
        </div>
      </div>
    </div>
  );

  

  return createPortal(
    <>
      {modalContent}
      {refundTarget && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="bg-red-500 px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-black text-lg">تأكيد الاسترداد</h3>
          <button onClick={() => { setRefundTarget(null); setRefundReason(''); }} className="text-red-100 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-sm font-bold text-slate-800">{refundTarget.name}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs font-bold text-slate-500">{CATEGORY_MAP[refundTarget.type] || refundTarget.type}</span>
              <span className="text-sm font-black text-slate-700" dir="ltr">{parseFloat(refundTarget.final_price || refundTarget.price).toLocaleString('en-US')} <span className="text-[10px]">YER</span></span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">سبب الاسترداد (إلزامي)</label>
            <textarea 
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all h-24 resize-none"
              placeholder="اكتب سبب إلغاء واسترداد الخدمة..."
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button 
              onClick={() => { setRefundTarget(null); setRefundReason(''); }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
            >
              تراجع
            </button>
            <button 
              onClick={handleItemRefund}
              disabled={isRefunding || !refundReason.trim()}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isRefunding ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'تأكيد الاسترداد'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}

  
  {showGeneralRefundModal && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-black text-lg">استرداد مالي عام</h3>
          <button onClick={() => { setShowGeneralRefundModal(false); setGeneralAmount(''); setGeneralReason(''); }} className="text-red-100 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-2">
            <p className="text-xs font-bold text-red-700 leading-relaxed text-center">
              تحذير: هذا الاسترداد سيتم خصمه من إجمالي مدفوعات المريض. تأكد من أن المبلغ المدخل صحيح.
            </p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">المبلغ (YER)</label>
            <input 
              type="number"
              value={generalAmount}
              onChange={(e) => setGeneralAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all font-bold"
              placeholder="0"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">سبب الاسترداد (إلزامي)</label>
            <textarea 
              value={generalReason}
              onChange={(e) => setGeneralReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all h-24 resize-none"
              placeholder="اكتب سبب الاسترداد العام..."
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button 
              onClick={() => { setShowGeneralRefundModal(false); setGeneralAmount(''); setGeneralReason(''); }}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
            >
              تراجع
            </button>
            <button 
              onClick={handleGeneralRefund}
              disabled={isRefundingGeneral || !generalReason.trim() || !generalAmount || parseFloat(generalAmount) <= 0}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isRefundingGeneral ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'تأكيد الاسترداد'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )}
    </>,
    document.body
  );

};

export default FinancialRecordModal;

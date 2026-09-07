import React, { useState, useEffect, useMemo } from 'react';
import { Printer, Maximize2, Minimize2, X, Layers, Calendar, User, Phone, CheckSquare, Square, Wallet, CreditCard, Check, Trash2, AlertCircle, History, Scissors, CheckCircle2, Clock, Receipt, TrendingUp, Sparkles, Activity, Plus, Minus } from 'lucide-react';
import { createPortal } from 'react-dom';
import taffyot from '../../utils/taffyot';
import { toast } from 'react-toastify';

const UnifiedPaymentModal = ({ visitId, visitData, token, onClose, onPaid, onOpenLedger, mode = 'both' }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lineItems, setLineItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'transfer'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [surgeryInstallment, setSurgeryInstallment] = useState('');
  const [surgeryPayments, setSurgeryPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const displayDate = visitData?.created_at || Date.now();
  const modalTitle = `فاتورة الدفع - (${visitData?.full_name || '...'})`;

  useEffect(() => {
    let isMounted = true;
    
    if (mode === 'surgery') {
      setLoading(false);
      setLoadingPayments(true);
      fetch(`/api/cashier/surgery/${visitId}/payments`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (isMounted) {
          setSurgeryPayments(Array.isArray(data) ? data : []);
          setLoadingPayments(false);
        }
      })
      .catch(err => {
        console.error('Failed to fetch surgery payments', err);
        if (isMounted) setLoadingPayments(false);
      });

      return () => { isMounted = false; };
    }

    setLoading(true);
    
    Promise.all([
      fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : {}),
      fetch(`/api/cashier/visit/${visitId}/invoice`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.ok ? r.json() : null)
    ])
    .then(([settings, invoice]) => {
      if (!isMounted) return;
      if (!invoice) {
        setError(true);
        setLoading(false);
        return;
      }
      
      const items = [];
      const defaultSelected = new Set();
      
      // 1. Entry Fee
      const isEntryUnpaid = invoice.visit && (
        invoice.visit.status === 'registered' || 
        !invoice.visit.entry_fee || 
        parseFloat(invoice.visit.entry_fee) === 0
      );

      if (invoice.visit && isEntryUnpaid && mode !== 'services') {
        const entryFeeAmount = parseFloat(settings.entry_fee || 0);
        if (entryFeeAmount > 0) {
          items.push({
            id: 'entry_fee',
            type: 'entry_fee',
            name: 'رسم كشف طبي',
            department: 'الاستقبال',
            amount: entryFeeAmount,
            status: 'pending'
          });
          defaultSelected.add('entry_fee');
        }
      }
      
      // 2. Labs
      if (invoice.labRequests && mode !== 'entry') {
        invoice.labRequests.forEach(r => {
          if (r.status === 'pending_payment') {
            items.push({
              id: `lab_${r.id}`,
              realId: r.id,
              type: 'lab',
              name: r.name,
              department: 'المختبر',
              amount: parseFloat(r.final_price || r.price || 0),
              basePrice: parseFloat(r.price || 0),
              discountAmount: parseFloat(r.discount_amount || 0),
              discountPct: parseFloat(r.discount_percentage || 0),
              isFree: r.is_free == 1,
              hasDiscount: parseFloat(r.discount_amount || 0) > 0 || parseFloat(r.discount_percentage || 0) > 0,
              status: 'pending'
            });
            defaultSelected.add(`lab_${r.id}`);
          }
        });
      }
      
      // 3. Radiology
      if (invoice.radiologyRequests && mode !== 'entry') {
        invoice.radiologyRequests.forEach(r => {
          if (r.status === 'pending_payment') {
            const priceWith = parseFloat(r.price_with_film || 0);
            const priceWithout = parseFloat(r.price_without_film || 0);
            // Default to without film, unless otherwise specified by backend (r.with_film could be 1)
            const withFilm = r.with_film == 1 || r.with_film === true;
            
            const baseAmt = withFilm ? priceWith : priceWithout;
            const finalAmt = parseFloat(r.final_price || baseAmt || 0);
            
            items.push({
              id: `rad_${r.id}`,
              realId: r.id,
              type: 'radiology',
              name: r.name,
              department: 'الأشعة',
              withFilm: withFilm,
              price_with_film: priceWith,
              price_without_film: priceWithout,
              amount: finalAmt,
              basePrice: parseFloat(r.price || baseAmt || 0),
              discountAmount: parseFloat(r.discount_amount || 0),
              discountPct: parseFloat(r.discount_percentage || 0),
              isFree: r.is_free == 1,
              hasDiscount: parseFloat(r.discount_amount || 0) > 0 || parseFloat(r.discount_percentage || 0) > 0,
              status: 'pending'
            });
            defaultSelected.add(`rad_${r.id}`);
          }
        });
      }
      
      setLineItems(items);
      setSelectedItems(defaultSelected);
      setLoading(false);
    })
    .catch(() => {
      if (isMounted) {
        setError(true);
        setLoading(false);
      }
    });
    
    return () => { isMounted = false; };
  }, [visitId, token, mode]);

  const toggleItem = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFilm = (e, itemId) => {
    e.stopPropagation();
    setLineItems(prev => prev.map(item => {
      if (item.id === itemId && item.type === 'radiology') {
        const newWithFilm = !item.withFilm;
        return {
          ...item,
          withFilm: newWithFilm,
          amount: newWithFilm ? item.price_with_film : item.price_without_film
        };
      }
      return item;
    }));
  };
  
  

  const handleCancelService = async (item) => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/cashier/service/${item.type}/${item.realId}/cancel`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      
      setLineItems(prev => prev.filter(i => i.id !== item.id));
      setSelectedItems(prev => {
        const s = new Set(prev);
        s.delete(item.id);
        return s;
      });
      setCancelConfirmId(null);
      toast.success('تم إلغاء الخدمة بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء إلغاء الخدمة');
    } finally {
      setIsCancelling(false);
    }
  };
  
  const toggleAll = () => {
    if (selectedItems.size === lineItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(lineItems.map(i => i.id)));
    }
  };

  const subtotal = useMemo(() => {
    if (mode === 'surgery') return parseFloat(surgeryInstallment) || 0;
    return lineItems.reduce((sum, item) => {
      if (selectedItems.has(item.id)) return sum + item.amount;
      return sum;
    }, 0);
  }, [lineItems, selectedItems, mode, surgeryInstallment]);

  const handleUnifiedPayment = async () => {
    if (mode === 'surgery') {
      if (!surgeryInstallment || isNaN(surgeryInstallment) || surgeryInstallment <= 0) {
        toast.warning('يرجى إدخال مبلغ الدفعة بشكل صحيح');
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/cashier/surgery/${visitId}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ amount: surgeryInstallment })
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.message || 'فشل تسديد الدفعة');
        toast.success('تم تسديد الدفعة الجراحية بنجاح');
        if (onPaid) onPaid();
        if (onClose) onClose();
      } catch (err) {
        toast.error(err.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (selectedItems.size === 0) {
      toast.warning('يرجى تحديد بند واحد على الأقل للدفع');
      return;
    }
    
    setIsSubmitting(true);
    const apiCalls = [];
    const callNames = [];

    // 1. Entry Fee Check
    const entryItem = lineItems.find(i => i.type === 'entry_fee' && selectedItems.has(i.id));
    if (entryItem) {
      apiCalls.push(
        fetch(`/api/cashier/visit/${visitId}/pay-entry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ amount: entryItem.amount, discountAmount: 0, discountReason: '' })
        }).then(async r => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.message || 'فشل تحصيل الكشف');
          return d;
        })
      );
      callNames.push('رسم الكشف');
    }

    // 2. Services Check
    const labIds = lineItems.filter(i => i.type === 'lab' && selectedItems.has(i.id)).map(i => i.realId);
    const radItems = lineItems.filter(i => i.type === 'radiology' && selectedItems.has(i.id)).map(i => ({ id: i.realId, withFilm: i.withFilm || false }));
    
    if (labIds.length > 0 || radItems.length > 0) {
      apiCalls.push(
        fetch(`/api/cashier/visit/${visitId}/pay-services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ labIds, radiologyItems: radItems, discount: { amount: 0, reason: '' } })
        }).then(async r => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.message || 'فشل تحصيل الخدمات');
          return d;
        })
      );
      callNames.push('الخدمات الطبية');
    }

    if (apiCalls.length === 0) {
      setIsSubmitting(false);
      return;
    }

    try {
      const results = await Promise.allSettled(apiCalls);
      const errors = [];
      const successes = [];

      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          errors.push(`${callNames[idx]}: ${res.reason.message || res.reason}`);
        } else {
          successes.push(callNames[idx]);
        }
      });

      if (errors.length > 0) {
        if (successes.length > 0) {
          toast.warning(`تم تحصيل ${successes.join(' و ')}، لكن فشل: ${errors.join('، ')}`);
          onPaid && onPaid();
          window.dispatchEvent(new Event('cashier_update'));
        } else {
          toast.error(`فشلت عملية الدفع: ${errors.join('، ')}`);
        }
      } else {
        toast.success('تم تحصيل جميع المستحقات بنجاح');
        onPaid && onPaid();
        window.dispatchEvent(new Event('cashier_update'));
        onClose();
      }
    } catch (e) {
      toast.error('حدث خطأ أثناء معالجة الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Surgery calculations & helpers
  const fullPrice = parseFloat(visitData?.full_price || 0);
  const discountAmount = parseFloat(visitData?.discount_amount || 0);
  const netPrice = Math.max(0, fullPrice - discountAmount);
  const paymentsSum = surgeryPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const paidAmount = surgeryPayments.length > 0 ? paymentsSum : parseFloat(visitData?.paid_amount || 0);
  const remainingAmount = Math.max(0, netPrice - paidAmount);
  const progressPercent = netPrice > 0 ? Math.min(100, Math.round((paidAmount / netPrice) * 100)) : 0;
  const hasPartialPayment = paidAmount > 0;
  const latestPayment = surgeryPayments && surgeryPayments.length > 0 ? surgeryPayments[0] : null;

  const formatDateTime = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const dateFormatted = d.toLocaleDateString('en-GB');
    const timeFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${dateFormatted} - ${timeFormatted}`;
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
      {/* Background Overlay */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Modal Container */}
      <div className={`relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/60 ${isFullscreen ? 'w-[98vw] h-[98vh] rounded-[2.5rem]' : 'w-full max-w-5xl h-[85vh] rounded-[2rem]'}`}>
        
        {/* Top Title Bar & Controls (Emerald DNA) */}
        <div className="px-5 py-2.5 flex items-center justify-between flex-shrink-0 shadow-md text-white transition-colors duration-300 bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-700 z-30">
          <div className="flex items-center gap-2">
            <Layers size={16} />
            <span className="text-xs font-black tracking-wide drop-shadow-sm">
              {modalTitle}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => window.print()} className="w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all shadow-sm" title="طباعة الفاتورة">
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

        {/* Sticky Identity Header (Emerald Avatar) */}
        <div className="bg-white px-6 sm:px-8 py-5 flex items-start justify-between border-b border-slate-100 shrink-0 z-20">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[1.5rem] bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center text-emerald-600 shadow-inner border border-emerald-100/50 shrink-0">
              <User size={32} strokeWidth={1.5} className="sm:hidden" />
              <User size={36} strokeWidth={1.5} className="hidden sm:block" />
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <h2 className="text-xl sm:text-3xl font-black text-slate-800 tracking-tight leading-none">
                {visitData?.full_name || '...'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-slate-500 bg-slate-100/80 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-200/60" dir="ltr">
                  <User size={12}/> {visitData?.patient_id || '...'}
                </span>
                <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-emerald-600 bg-emerald-50 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border border-emerald-100/60">
                  <Phone size={12}/> {visitData?.phone || 'بدون هاتف'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end pt-1 gap-2">
            <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs sm:text-sm">
              <Calendar size={14} className="text-emerald-600 opacity-80" />
              <span dir="ltr">{new Date(displayDate).toLocaleDateString('en-GB')}</span>
              <span className="text-slate-300 mx-0.5">•</span>
              <span dir="ltr">{new Date(displayDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
            </div>
            {visitData && (
              <div className="flex flex-col items-end gap-2 w-full mt-0.5">
                <div className="flex items-center gap-1 text-[11px] font-black text-slate-400">
                  <span>معرف الزيارة:</span>
                  <span className="text-slate-600" dir="ltr">{visitData.visit_number || visitData.visit_id || visitData.id}</span>
                </div>
                <button
                  onClick={() => {
                    if (onOpenLedger) onOpenLedger(visitData?.patient_id);
                  }}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-gradient-to-l from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 px-4 py-2 rounded-lg transition-all shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_12px_rgba(16,185,129,0.35)]"
                >
                  <History size={14} strokeWidth={2.5} />
                  السجل المالي للمريض
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Surgery Mode Content */}
        {mode === 'surgery' ? (
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 custom-scrollbar space-y-4">
            
            {/* 1. شريط بيانات العملية (Surgery Details Strip) */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center shrink-0">
                  <Scissors size={18} strokeWidth={2.2} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                      {visitData?.surgery_type || visitData?.name || 'عملية جراحية'}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/60">
                      {visitData?.status === 'planned' ? 'مخطط لها' : visitData?.status === 'scheduled' ? 'مجدولة' : visitData?.status === 'ready' ? 'جاهزة للعمليات' : visitData?.status || 'عملية جراحية'}
                    </span>
                  </div>
                  {visitData?.scheduled_date && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                      <Calendar size={12} className="text-teal-600" />
                      <span>الموعد المجدول:</span>
                      <span dir="ltr" className="font-bold text-slate-700">{new Date(visitData.scheduled_date).toLocaleDateString('en-GB')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* رسوم العملية بنفس الصف مع اسم العملية */}
              <div className="flex items-center gap-2 flex-wrap bg-emerald-50/70 border border-emerald-100/80 px-3.5 py-2 rounded-xl shrink-0 self-start sm:self-auto">
                <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">رسوم العملية:</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base sm:text-lg font-black tracking-tight text-emerald-700" dir="ltr">
                    {netPrice.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">ر.ي</span>
                </div>
                {netPrice > 0 && (
                  <span className="text-xs font-bold text-emerald-700/80 pr-2 border-r border-emerald-200/70">
                    {taffyot(netPrice).replace(/(ريالاً يمنياً|ريال يمني|فقط|لا غير|-)/g, '').trim()} ريال يمني.
                  </span>
                )}
                {discountAmount > 0 && (
                  <span className="text-[10px] font-bold text-amber-600 pr-1.5 border-r border-emerald-200/70">
                    (خصم {discountAmount.toLocaleString('en-US')} ر.ي)
                  </span>
                )}
              </div>
            </div>

            {/* 2. في حال وجود دفعات سابقة: عرض المبالغ بطريقة محاسبية احترافية + جدول سجل الدفعات */}
            {hasPartialPayment && (
              <>
                {/* شريط الإحصائيات والمبالغ المحاسبي الموحد (بدون بطاقات منفصلة) */}
                <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden">
                  <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-100">
                    {/* عمود 1: المبلغ المدفوع */}
                    <div className="p-3.5 sm:p-4 flex flex-col justify-between bg-emerald-50/20">
                      <div className="flex items-center justify-between text-emerald-600 mb-1">
                        <span className="text-[11px] font-bold text-emerald-800">المبلغ المدفوع</span>
                        <CheckCircle2 size={14} className="text-emerald-600" />
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-emerald-700 tracking-tight" dir="ltr">
                          {paidAmount.toLocaleString('en-US')}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-600/70">ر.ي</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 mt-1 block">
                        تم سداد ({progressPercent}%)
                      </span>
                    </div>

                    {/* عمود 2: المبلغ المتبقي */}
                    <div className="p-3.5 sm:p-4 flex flex-col justify-between bg-rose-50/20">
                      <div className="flex items-center justify-between text-rose-500 mb-1">
                        <span className="text-[11px] font-bold text-rose-800">المبلغ المتبقي</span>
                        <Clock size={14} className="text-rose-500" />
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-rose-600 tracking-tight" dir="ltr">
                          {remainingAmount.toLocaleString('en-US')}
                        </span>
                        <span className="text-[10px] font-bold text-rose-500/70">ر.ي</span>
                      </div>
                      <span className="text-[10px] font-bold text-rose-600 mt-1 block">
                        {remainingAmount <= 0 ? 'مكتمل بالكامل' : `متبقي سداده (${100 - progressPercent}%)`}
                      </span>
                    </div>
                  </div>

                  {/* شريط تقدم السداد الرفيع والمدمج */}
                  <div className="h-1.5 w-full bg-slate-100 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* سجل الدفعات السابقة المسددة */}
                {surgeryPayments.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200/60 shadow-xs overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/60 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <History size={14} className="text-teal-600" />
                        <h4 className="text-xs font-bold text-slate-700">سجل الدفعات السابقة المسددة</h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-md">
                        {surgeryPayments.length} دفعات
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs whitespace-nowrap">
                        <thead className="bg-slate-50/40 border-b border-slate-100 text-slate-400 font-bold text-[11px]">
                          <tr>
                            <th className="px-4 py-2 w-10 text-center">#</th>
                            <th className="px-4 py-2">مبلغ الدفعة</th>
                            <th className="px-4 py-2">المبلغ كتابة</th>
                            <th className="px-4 py-2">تاريخ ووقت السداد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {surgeryPayments.map((p, pIdx) => (
                            <tr key={p.id || pIdx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-2 text-center font-bold text-slate-400 text-[11px]">
                                {surgeryPayments.length - pIdx}
                              </td>
                              <td className="px-4 py-2">
                                <span className="font-bold text-emerald-600" dir="ltr">
                                  {parseFloat(p.amount || 0).toLocaleString('en-US')}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold mr-1">ر.ي</span>
                              </td>
                              <td className="px-4 py-2 text-[10px] font-bold text-slate-500 whitespace-normal">
                                {taffyot(parseFloat(p.amount || 0)).replace(/(ريالاً يمنياً|ريال يمني|فقط|لا غير|-)/g, '').trim()} ريال يمني.
                              </td>
                              <td className="px-4 py-2 text-slate-600 font-medium text-[11px]" dir="ltr">
                                {formatDateTime(p.payment_date)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 3. قسم بيانات العملية المالية */}
            <div className="bg-white rounded-xl border border-slate-200/60 p-4 sm:p-5 shadow-xs space-y-4">
              {/* حقل إدخال المبلغ وطريقة الدفع وزر السداد */}
              {remainingAmount > 0 ? (
                <div className="space-y-4 pt-1">
                  {/* صف حقل المبلغ المراد سداده مع تفقيط المبلغ نصاً بنفس الصف */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/60">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <label htmlFor="surgery_installment" className="text-xs font-bold text-slate-700 whitespace-nowrap">
                        المبلغ المراد سداده:
                      </label>

                      {/* تصميم مطابق تماماً لحقل سعر الوحدة في المخزن (مدمج، أزرار بالأطراف، ر.ي بجوار النص، أرقام إنجليزية) */}
                      <div className="relative flex items-center h-[38px] w-48 sm:w-52 bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all shadow-2xs group shrink-0">
                        {/* زر الإنقاص (-) في الطرف الأيمن */}
                        <button
                          type="button"
                          tabIndex="-1"
                          onClick={() => {
                            const current = parseFloat(surgeryInstallment) || 0;
                            const step = current > 10000 ? 5000 : 1000;
                            const nextVal = Math.max(0, current - step);
                            setSurgeryInstallment(nextVal > 0 ? nextVal.toString() : '');
                          }}
                          disabled={!surgeryInstallment || parseFloat(surgeryInstallment) <= 0}
                          className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors shrink-0 cursor-pointer"
                          title="إنقاص المبلغ"
                        >
                          <Minus size={14} strokeWidth={3} />
                        </button>

                        {/* حقل الإدخال مع اختصار ر.ي قريب جداً من النص في المنتصف */}
                        <div className="flex-1 flex items-center justify-center gap-1 h-full px-1" dir="ltr">
                          <span className="text-[10px] font-bold text-slate-400 pointer-events-none select-none">
                            ر.ي
                          </span>
                          <input
                            id="surgery_installment"
                            type="text"
                            inputMode="numeric"
                            value={surgeryInstallment ? Number(surgeryInstallment).toLocaleString('en-US') : ''}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/[^0-9]/g, '');
                              if (!clean) setSurgeryInstallment('');
                              else setSurgeryInstallment(Math.min(Number(clean), remainingAmount).toString());
                            }}
                            placeholder="0"
                            className="w-24 sm:w-28 text-center bg-transparent text-xs font-black text-slate-800 focus:outline-none"
                          />
                        </div>

                        {/* زر الزيادة (+) في الطرف الأيسر */}
                        <button
                          type="button"
                          tabIndex="-1"
                          onClick={() => {
                            const current = parseFloat(surgeryInstallment) || 0;
                            const step = current >= 10000 ? 5000 : 1000;
                            const nextVal = Math.min(remainingAmount, current + step);
                            setSurgeryInstallment(nextVal.toString());
                          }}
                          disabled={parseFloat(surgeryInstallment || 0) >= remainingAmount}
                          className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors shrink-0 cursor-pointer"
                          title="زيادة المبلغ"
                        >
                          <Plus size={14} strokeWidth={3} />
                        </button>
                      </div>

                      {/* عرض المبلغ كتابة بجوار الحقل مباشرة بدون كلمة (كتابةً:) أو التلميح في حال عدم الإدخال */}
                      {parseFloat(surgeryInstallment || 0) > 0 ? (
                        <div className="text-xs font-bold text-emerald-700 bg-emerald-50/80 border border-emerald-100/80 px-3 py-1.5 rounded-lg shrink-0">
                          <span>{taffyot(parseFloat(surgeryInstallment)).replace(/(ريالاً يمنياً|ريال يمني|فقط|لا غير|-)/g, '').trim()} ريال يمني.</span>
                        </div>
                      ) : (
                        <div className="text-[11px] font-medium text-slate-400 shrink-0 select-none">
                          أدخل المبلغ أو اضغط على تغطية المبلغ
                        </div>
                      )}
                    </div>

                    {/* زر تغطية المبلغ في الطرف الآخر (مكان المبلغ كتابة سابقاً) */}
                    <button
                      type="button"
                      onClick={() => setSurgeryInstallment(remainingAmount.toString())}
                      className="px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0 shadow-2xs self-start sm:self-auto"
                      title="تغطية كامل المبلغ المستحق"
                    >
                      <Sparkles size={13} className="text-teal-600" />
                      <span>تغطية المبلغ</span>
                    </button>
                  </div>

                  {/* قسم طريقة الدفع وزر تأكيد السداد أسفل خياراتها مباشرة */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50/70 border border-slate-200/60 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                          <Wallet size={15} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-700">طريقة الدفع</h4>
                          <p className="text-[10px] text-slate-400 font-medium">اختر وسيلة تحصيل الرسوم</p>
                        </div>
                      </div>

                      {/* خيارات طريقة الدفع (نقداً - حوالة) */}
                      <div className="grid grid-cols-2 gap-2 w-full sm:w-64">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cash')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            paymentMethod === 'cash' 
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs font-black' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Wallet size={13} />
                          <span>نقداً (كاش)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('transfer')}
                          className={`flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            paymentMethod === 'transfer' 
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-2xs font-black' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <CreditCard size={13} />
                          <span>حوالة / بنكي</span>
                        </button>
                      </div>
                    </div>

                    {/* زر تأكيد السداد أسفل خيارات طريقة الدفع مباشرة */}
                    <div className="flex justify-end pt-2 border-t border-slate-200/60">
                      <button
                        onClick={handleUnifiedPayment}
                        disabled={isSubmitting || !surgeryInstallment || parseFloat(surgeryInstallment) <= 0}
                        className="w-full sm:w-64 py-2.5 px-4 rounded-xl bg-gradient-to-l from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white font-bold text-xs sm:text-sm transition-all shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_12px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        {isSubmitting ? (
                          <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                          <>
                            <Check size={15} strokeWidth={2.5} />
                            <span>
                              {parseFloat(surgeryInstallment || 0) > 0
                                ? `تأكيد السداد (${parseFloat(surgeryInstallment).toLocaleString('en-US')} ر.ي)`
                                : 'تأكيد السداد'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                  <CheckCircle2 size={24} className="text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-emerald-800 text-sm">تم سداد تكلفة العملية بالكامل</h4>
                  <p className="text-xs text-emerald-600 font-medium">
                    لا توجد أي مستحقات متبقية لهذه العملية.
                  </p>
                </div>
              )}
            </div>

          </div>
        ) : (
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row-reverse bg-[#f8fafc]">
          {/* Cart Pane (Now on the Left in RTL due to flex-row-reverse) */}
          <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-white rounded-xl shadow-sm animate-pulse" />)}
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-400 font-bold text-sm">حدث خطأ أثناء جلب البيانات</div>
            ) : lineItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mb-4">
                  <Layers size={32} />
                </div>
                <h3 className="text-slate-600 font-bold text-lg mb-1">لا توجد خدمات معلقة</h3>
                <p className="text-slate-400 font-medium text-sm">تم إلغاء جميع الطلبات أو لا توجد خدمات تحتاج للدفع حالياً.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <h3 className="font-bold text-slate-700 text-base">بنود الفاتورة</h3>
                  <button onClick={toggleAll} className="text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 px-3 py-1.5 rounded-lg transition-colors">
                    {selectedItems.size === lineItems.length ? 'إلغاء التحديد' : 'تحديد الكل'}
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden shadow-sm">
                  {lineItems.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    return (
                      <div key={item.id} className="flex flex-col border-b border-gray-100/80 last:border-0">
                        <div 
                          onClick={() => toggleItem(item.id)}
                          className={`group flex items-center p-4 cursor-pointer transition-all hover:bg-slate-50 relative ${isSelected ? 'bg-emerald-50/40' : ''}`}
                        >
                          {isSelected && <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-r-md"></div>}
                          
                          <div className="mr-2 ml-4 shrink-0 transition-colors duration-200">
                            {isSelected ? (
                              <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-white shadow-sm">
                                <Check size={14} strokeWidth={3} />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded border-2 border-slate-300 group-hover:border-emerald-400 bg-white"></div>
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className={`font-bold truncate text-sm transition-colors duration-200 ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                              {item.name}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-xs text-slate-500 font-medium">{item.department}</p>
                              {item.type === 'radiology' && (
                                <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                                  <label className="flex items-center gap-1.5 cursor-pointer px-1 transition-opacity hover:opacity-80">
                                    <div className="relative flex items-center">
                                      <input type="checkbox" className="sr-only" checked={item.withFilm} onChange={(e) => toggleFilm(e, item.id)} />
                                      <div className={`block w-7 h-4 rounded-full transition-colors ${item.withFilm ? 'bg-teal-500' : 'bg-slate-300'}`}></div>
                                      <div className={`absolute top-[2px] bg-white w-3 h-3 rounded-full transition-all shadow-sm`} style={{ right: item.withFilm ? '1rem' : '2px' }}></div>
                                    </div>
                                    <span className={`text-[11px] font-bold transition-colors ${item.withFilm ? 'text-slate-900' : 'text-slate-400'}`}>مع طباعة فيلم</span>
                                  </label>
                                </div>
                              )}
                            </div>
                            
                            {/* Discount Details Moved Here */}
                            {item.hasDiscount && !item.isFree && (
                              <div className="mt-0.5 flex items-center gap-0.5 text-[8px] text-slate-400 whitespace-nowrap overflow-hidden tracking-tighter">
                                <span className="w-1 h-1 rounded-full bg-emerald-400/80 shrink-0 mr-0.5"></span>
                                <span className="shrink-0">يشمل خصم</span>
                                {item.discountPct > 0 && <span className="font-bold text-emerald-600/90 shrink-0">({item.discountPct}%)</span>}
                                <span className="shrink-0">بقيمة</span>
                                <span className="font-bold text-emerald-600/90 shrink-0">{item.discountAmount.toLocaleString('ar')} <span className="text-[7px] uppercase font-bold text-emerald-500/70">ر.ي</span></span>
                                <span className="shrink-0 mx-0.5 text-slate-300">من الأصل</span>
                                <span className="font-bold text-slate-400/80 line-through shrink-0">{item.basePrice.toLocaleString('ar')} <span className="text-[7px] uppercase font-bold">ر.ي</span></span>
                              </div>
                            )}
                          </div>
                          
                          <div className="shrink-0 text-left flex flex-col items-end justify-center">
                            <div className="flex items-baseline gap-1">
                              <span className={`font-black text-base transition-colors duration-200 ${isSelected ? (item.isFree ? 'text-emerald-600' : 'text-slate-800') : (item.isFree ? 'text-emerald-500/80' : 'text-slate-500')}`}>
                                {item.isFree ? 'مجاني' : item.amount.toLocaleString('ar')}
                              </span>
                              {!item.isFree && <span className="text-[10px] text-slate-400 font-bold">ر.ي</span>}
                            </div>
                          </div>
                          
                          {/* Trash Icon */}
                          {item.type !== 'entry_fee' ? (
                            <div className="mr-8 pr-6 border-r border-slate-200/60 flex items-center justify-center">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelConfirmId(cancelConfirmId === item.id ? null : item.id);
                                }}
                                className={`p-2 rounded-lg transition-all ${cancelConfirmId === item.id ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'}`}
                                title="إلغاء الخدمة"
                              >
                                <Trash2 size={18} strokeWidth={2.5} />
                              </button>
                            </div>
                          ) : (
                            <div className="w-[4.5rem]"></div>
                          )}
                        </div>

                        {/* Inline Warning Banner */}
                        {cancelConfirmId === item.id && (
                          <div className="bg-red-50 border-t border-red-100 px-4 py-3 flex items-center justify-between animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2 text-red-600">
                              <AlertCircle size={16} />
                              <span className="text-sm font-semibold">هل تريد إلغاء هذه الخدمة؟</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setCancelConfirmId(null)}
                                disabled={isCancelling}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                              >
                                تراجع
                              </button>
                              <button 
                                onClick={() => handleCancelService(item)}
                                disabled={isCancelling}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors flex items-center gap-1.5"
                              >
                                {isCancelling ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : null}
                                تأكيد الإلغاء
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Summary Pane (Now on the Right in RTL due to flex-row-reverse) */}
          <div className="w-full lg:w-[22rem] shrink-0 bg-white lg:border-l border-t lg:border-t-0 border-slate-200/60 p-5 lg:p-7 flex flex-col justify-between z-10 shadow-[4px_0_15px_rgba(0,0,0,0.02)]">
            <div>
              <h3 className="font-bold text-slate-700 text-base mb-5">ملخص الدفع</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 mb-5 relative overflow-hidden">
                <div className="absolute -left-4 -top-4 w-16 h-16 bg-emerald-100 rounded-full blur-2xl opacity-50"></div>
                <div className="flex items-center justify-between relative z-10 mb-2">
                  <p className="text-sm font-bold text-slate-600">الإجمالي المطلوب</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-emerald-600 tracking-tight">{subtotal.toLocaleString('ar')}</span>
                    <span className="text-[10px] font-bold text-emerald-600/70">ر.ي</span>
                  </div>
                </div>
                {subtotal > 0 && (
                  <div className="relative z-10 pt-3 border-t border-slate-200/60">
                    <p className="text-[11.5px] font-bold text-slate-500 leading-relaxed text-center">
                      {taffyot(subtotal).replace(/(ريالاً يمنياً|ريال يمني|فقط|لا غير|-)/g, '').trim()} ريال يمني.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600 font-medium px-1">
                  <span>البنود المحددة للدفع</span>
                  <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{selectedItems.size} من {lineItems.length}</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
               <div className="mb-4">
                 <p className="text-[11px] font-bold text-slate-500 mb-2 px-1">طريقة الدفع</p>
                 <div className="flex bg-slate-100/80 p-1 rounded-lg">
                   <button 
                     onClick={() => setPaymentMethod('cash')}
                     className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-all ${paymentMethod === 'cash' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     <Wallet size={14} /> نقداً
                   </button>
                   <button 
                     onClick={() => setPaymentMethod('transfer')}
                     className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-all ${paymentMethod === 'transfer' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     <CreditCard size={14} /> تحويل بنكي
                   </button>
                 </div>
               </div>

               <button 
                 onClick={handleUnifiedPayment} 
                 disabled={isSubmitting || subtotal === 0}
                 className="w-full py-3.5 rounded-xl bg-gradient-to-l from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white font-black transition-all shadow-[0_4px_15px_rgba(16,185,129,0.25)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-base"
               >
                 {isSubmitting ? (
                   <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                 ) : (
                   <>دفع {subtotal.toLocaleString('ar')} ريال</>
                 )}
               </button>
            </div>
          </div>
        </div>
        )}

      </div>


    </div>
  );

  return createPortal(modalContent, document.body);
};

export default UnifiedPaymentModal;

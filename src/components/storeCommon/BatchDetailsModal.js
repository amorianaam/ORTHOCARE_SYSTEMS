import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowDownToLine, Package, FileText, Eye, Maximize2, Minimize2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { DocumentPreviewOverlay } from './TransactionDetailsModal';
import taffyot from '../../utils/taffyot';
import { formatArabicItemsCount } from '../../utils/arabicFormatters';

const BatchDetailsModal = ({ 
  isOpen,
  onClose, 
  batch, 
  mode = 'inbound', // 'inbound' | 'outbound'
  themeColor = 'amber',
  
  // Handlers
  onAccept, 
  onReject, 
  onRevoke,

  // States
  isProcessing = false, 
  rejectingBatch, 
  setRejectingBatch, 
  rejectionReason, 
  setRejectionReason
}) => {
  const [isFullscreen, setIsFullscreen] = useState(() => {
    return localStorage.getItem("storeModalFullscreen") === "true";
  });
  const [showFilePreview, setShowFilePreview] = useState(false);

  useEffect(() => {
    localStorage.setItem("storeModalFullscreen", isFullscreen);
  }, [isFullscreen]);

  if (!isOpen || !batch) return null;

  const texts = mode === 'inbound' 
    ? {
        title: "تفاصيل الشحنة الواردة",
        subtitle: "بانتظار إجراءات الاستلام",
        itemsLabel: "بيانات الأصناف الواردة",
        senderLabel: "المصدر/المرسل",
        quantityLabel: "الكمية الواردة"
      }
    : {
        title: "تفاصيل الشحنة الصادرة",
        subtitle: "بانتظار تأكيد الاستلام من الجهة الأخرى",
        itemsLabel: "بيانات الأصناف الصادرة",
        senderLabel: "الوجهة المستفيدة",
        quantityLabel: "الكمية المُرسلة"
      };

  
  const themes = {
    amber: {
      bg50: '${theme.bg50}',
      bg100: '${theme.bg100}',
      bg200: '${theme.bg200}',
      text600: '${theme.text600}',
      text700: '${theme.text700}',
      border100: '${theme.border100}',
      border200: '${theme.border200}'
    },
    emerald: {
      bg50: 'bg-emerald-50',
      bg100: 'bg-emerald-100',
      bg200: 'bg-emerald-200',
      text600: 'text-emerald-600',
      text700: 'text-emerald-700',
      border100: 'border-emerald-100/50',
      border200: 'border-emerald-200/50'
    }
  };
  const theme = themes[themeColor] || themes.amber;

  if (!isOpen || !batch) return null;

  const extractInvoiceUrl = (notes) => {
    if (!notes) return null;
    const match = notes.match(/\/uploads\/(generalStore|orStore)\/[^\s|]+/);
    return match ? match[0] : null;
  };

  const invoiceUrl = extractInvoiceUrl(batch.batch_notes);

  let cleanNotes = batch.batch_notes || '';
  if (cleanNotes.includes('مرفق الفاتورة:')) {
    cleanNotes = cleanNotes.split('مرفق الفاتورة:')[0].trim();
  } else if (cleanNotes.includes('مرفق المستند:')) {
    cleanNotes = cleanNotes.split('مرفق المستند:')[0].trim();
  }
  cleanNotes = cleanNotes.replace(/\|\s*$/, '').trim();

  const grandTotal = batch.items?.reduce((sum, item) => sum + (parseFloat(item.cost_price || 0) * parseInt(item.sent_quantity || 0, 10)), 0) || 0;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
        <div className="absolute inset-0" onClick={() => {
          if (!isProcessing) {
            setRejectingBatch?.(null);
            setRejectionReason?.('');
            onClose();
          }
        }} />
        <div className={`relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] ${isFullscreen ? 'w-[98vw] h-[98vh] rounded-[2.5rem] border border-white' : 'w-full max-w-4xl h-auto max-h-[90vh] rounded-[2rem] border border-white/60'}`}>
          
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-slate-100 z-20 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner bg-gradient-to-br from-amber-50 to-amber-100 ${theme.text600} border ${theme.border200}`}>
                <ArrowDownToLine size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">{texts.title}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                   <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${theme.bg100} ${theme.text700}`}>
                     قيد الانتظار
                   </span>
                   <p className="text-[11px] font-bold text-slate-500">{texts.subtitle}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-all border border-slate-200 shadow-sm">
                {isFullscreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
              </button>
              <button 
                onClick={() => {
                  if (!isProcessing) {
                    setRejectingBatch?.(null);
setRejectionReason?.('');
                    onClose();
                  }
                }}
                disabled={!!isProcessing}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 rounded-lg transition-all border border-slate-200 shadow-sm disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50/50 flex flex-col items-center">
            <div className="w-full max-w-4xl space-y-6 pb-8">
              
              {/* --- Section 1: Item Data --- */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="p-1.5 bg-indigo-100/80 rounded-lg text-indigo-600 shadow-sm"><Package size={16} /></div>
                  <h3 className="text-sm font-black text-slate-700">
                    {texts.itemsLabel}
                    <span className="mr-2 bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200">
                      {formatArabicItemsCount(batch.items?.length || batch.item_count || 0)}
                    </span>
                  </h3>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-right text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500">اسم الصنف</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500">نوع الصنف</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500">{texts.quantityLabel}</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500">سعر الوحدة</th>
                          {batch.items && batch.items.some(i => i.expiry_date) && (
                            <th className="px-5 py-3.5 text-xs font-bold text-slate-500">تاريخ الانتهاء</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {batch.items?.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3.5 font-black text-slate-800">{item.item_name}</td>
                            <td className="px-5 py-3.5 font-bold text-slate-600">{item.unit || '-'}</td>
                            <td className="px-5 py-3.5 font-black text-lg text-emerald-600" dir="ltr">
                              +{parseInt(item.sent_quantity, 10).toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-700">
                              {parseFloat(item.cost_price || 0).toLocaleString()}
                              <span className="text-[10px] text-slate-400 mr-1">ر.ي</span>
                            </td>
                            {batch.items && batch.items.some(i => i.expiry_date) && (
                              <td className="px-5 py-3.5 font-semibold text-slate-600" dir="ltr">
                                {item.expiry_date
                                  ? new Date(item.expiry_date).toLocaleDateString('en-GB')
                                  : <span className="text-slate-300">—</span>
                                }
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Horizontal Footer for Total */}
                  <div className="flex items-center justify-between px-6 py-4 border-t mt-auto bg-emerald-50/50 border-emerald-100/60">
                    <span className="text-xs font-bold text-emerald-800">إجمالي القيمة:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-black tracking-tight text-emerald-700">{grandTotal.toLocaleString()}</span>
                      <span className="text-xs font-bold text-emerald-600">ر.ي</span>
                      {grandTotal > 0 && <span className="text-xs font-bold mr-1.5 pr-2 border-r text-emerald-700/70 border-emerald-200/60">{taffyot(grandTotal)}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Section 2: Movement Details --- */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <div className="p-1.5 bg-blue-100/80 rounded-lg text-blue-600 shadow-sm"><FileText size={16} /></div>
                  <h3 className="text-sm font-black text-slate-700">تفاصيل الحركة</h3>
                </div>
                
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-right text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500">{texts.senderLabel}</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500">التاريخ والوقت</th>
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500">الملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        <tr className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 font-semibold text-slate-800 align-top">{batch.sender_name || 'المخزن العام'}</td>
                          <td className="px-5 py-4 align-top">
                            <span className="text-sm font-bold text-slate-700">
                              <span dir="ltr">
                                {new Date(batch.sent_at).toLocaleDateString('en-GB')} - {new Date(batch.sent_at).toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit', hour12: false })}
                              </span>
                            </span>
                          </td>
                          <td className="px-5 py-4 font-semibold text-slate-600 max-w-[200px] whitespace-pre-wrap break-words align-top" title={cleanNotes}>
                            {cleanNotes || 'لا توجد ملاحظات إضافية مرفقة'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* --- Section 3: Attachments --- */}
              {invoiceUrl && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 bg-violet-100/80 rounded-lg text-violet-600 shadow-sm"><FileText size={16} /></div>
                    <h3 className="text-sm font-black text-slate-700">المرفقات المستندية</h3>
                  </div>
                  
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm p-4">
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 group hover:border-violet-300 transition-colors cursor-pointer shadow-sm" onClick={() => setShowFilePreview(true)}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400 group-hover:text-violet-500 group-hover:bg-violet-50 transition-colors">
                          <FileText size={18} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-xs line-clamp-1">فاتورة / مستند مرفق</h4>
                          <p className="text-[10px] font-medium text-slate-400 mt-0.5">انقر لعرض الملف</p>
                        </div>
                      </div>
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-violet-600 hover:bg-violet-100 transition-colors shrink-0">
                        <Eye size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
            {mode === 'outbound' ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => onRevoke(batch.batch_ref_key)}
                  disabled={isProcessing}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(220,38,38,0.2)]"
                >
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <XCircle size={18} />}
                  سحب وإلغاء الشحنة
                </button>
                <button 
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-6 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  إغلاق
                </button>
              </div>
            ) : rejectingBatch === batch.batch_ref_key ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none transition-all"
                  rows="2"
                  placeholder="اكتب سبب رفض هذه الشحنة بالكامل هنا..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button 
                    onClick={() => onReject(batch.batch_ref_key)}
                    disabled={isProcessing || !rejectionReason.trim()}
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(220,38,38,0.2)]"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                    تأكيد الرفض والإرجاع
                  </button>
                  <button 
                    onClick={() => { setRejectingBatch?.(null); setRejectionReason?.(''); }}
                    disabled={isProcessing}
                    className="w-auto px-6 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center font-bold text-sm transition-all"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => onAccept(batch.batch_ref_key)}
                  disabled={isProcessing}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-600 hover:to-emerald-500 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(16,185,129,0.2)]"
                >
                  {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                  استلام الدفعة بالكامل
                </button>
                <button 
                  onClick={() => setRejectingBatch(batch.batch_ref_key)}
                  disabled={isProcessing}
                  className="px-6 bg-white border border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-50 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <XCircle size={16} />
                  رفض الدفعة
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {showFilePreview && invoiceUrl && (
        <DocumentPreviewOverlay 
          fileUrl={invoiceUrl} 
          onClose={() => setShowFilePreview(false)} 
        />
      )}
    </>,
    document.body
  );
};

export default BatchDetailsModal;

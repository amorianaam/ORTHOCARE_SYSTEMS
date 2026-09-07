import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowDownToLine, ArrowUpFromLine, FileText, User, Calendar, ExternalLink, Package, Maximize2, Minimize2, Eye, Clock } from 'lucide-react';
import taffyot from '../../utils/taffyot';
import { formatArabicItemsCount } from '../../utils/arabicFormatters';
import useAuthStore from '../../store/useAuthStore';
const TransactionDetailsModal = ({ isOpen, onClose, transaction, storeType = 'general' }) => {
  const [isFullscreen, setIsFullscreen] = useState(() => {
    return localStorage.getItem("storeModalFullscreen") === "true";
  });
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [batchItems, setBatchItems] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const { token } = useAuthStore();

  useEffect(() => {
    localStorage.setItem("storeModalFullscreen", isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    if (isOpen && transaction) {
      const fetchDetails = async () => {
        setBatchLoading(true);
        setBatchItems(null);
        try {
          const base = storeType === 'or' ? '/api/inventory/or' : '/api/inventory/general';
          const isMfg = transaction.reference_id && (String(transaction.reference_id).startsWith('MFG-') || String(transaction.reference_id).startsWith('REV-MFG-'));
          const useBatch = transaction.reference_id && !String(transaction.reference_id).startsWith('_') && !transaction.is_single_view && !isMfg;

          let url = useBatch
            ? `${base}/batch/${transaction.reference_id}`
            : `${base}/transaction/${transaction.id}`;

          if (useBatch && transaction.notes !== undefined) {
            url += `?notes=${encodeURIComponent(transaction.notes || '')}`;
          }

          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          setBatchItems(Array.isArray(data) ? data : []);
        } catch (err) {
          console.error('Failed to fetch batch items:', err);
          setBatchItems([]);
        } finally {
          setBatchLoading(false);
        }
      };
      fetchDetails();
    } else {
      setBatchItems(null);
    }
  }, [isOpen, transaction, token, storeType]);

  if (!isOpen || !transaction) return null;

  const isReceive = transaction.transaction_type === 'in';
  
  let invoiceUrl = null;
  let cleanNotes = transaction.notes || '';
  if (cleanNotes.includes('مرفق الفاتورة:')) {
    const parts = cleanNotes.split('مرفق الفاتورة:');
    cleanNotes = parts[0].trim();
    invoiceUrl = parts[1]?.trim();
  } else if (cleanNotes.includes('مرفق المستند:')) {
    const parts = cleanNotes.split('مرفق المستند:');
    cleanNotes = parts[0].trim();
    invoiceUrl = parts[1]?.trim();
  }
  cleanNotes = cleanNotes.replace(/\|\s*$/, '').trim();

  let extractedStocktakingId = null;
  if (cleanNotes.includes('تسوية جرد') && cleanNotes.includes('رقم الجلسة:')) {
    const parts = cleanNotes.split('| رقم الجلسة:');
    const rightSide = parts[1] || '';
    if (rightSide.includes('| ملاحظة:')) {
      const subParts = rightSide.split('| ملاحظة:');
      extractedStocktakingId = subParts[0].trim();
      cleanNotes = subParts[1].trim();
    } else {
      extractedStocktakingId = rightSide.trim();
      cleanNotes = '';
    }
  }
  
  let sourceOrDest = isReceive ? (transaction.source_entity || 'جهة غير محددة') : (transaction.destination_entity || 'جهة غير محددة');
  if (extractedStocktakingId && !sourceOrDest.includes('(رقم')) {
    sourceOrDest = `${sourceOrDest} (رقم ${extractedStocktakingId})`;
  }

  // Clean up trailing pipes
  if (cleanNotes.endsWith('|')) {
    cleanNotes = cleanNotes.slice(0, -1).trim();
  }

  // Formatting for Receive notes (Handles both old and new formats)
  if (isReceive && cleanNotes) {
    // Check for old format with note: "استلام فاتورة YYYY-MM-DD | note"
    const oldFormatWithNote = cleanNotes.match(/^استلام فاتورة \d{4}-\d{2}-\d{2} \| (.*)$/);
    // Check for old format without note: "استلام فاتورة YYYY-MM-DD"
    const oldFormatWithoutNote = cleanNotes.match(/^استلام فاتورة \d{4}-\d{2}-\d{2}$/);
    
    if (oldFormatWithNote) {
      cleanNotes = oldFormatWithNote[1].trim();
    } else if (oldFormatWithoutNote) {
      cleanNotes = 'استلام فاتورة';
    }
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300" dir="rtl">
        <div className="absolute inset-0" onClick={onClose} />
        <div className={`relative z-10 bg-[#f8fafc] flex flex-col overflow-hidden transition-all duration-500 animate-in zoom-in-95 shadow-[0_20px_50px_rgba(0,0,0,0.1)] ${isFullscreen ? 'w-[98vw] h-[98vh] rounded-[2.5rem] border border-white' : 'w-full max-w-4xl h-auto max-h-[90vh] rounded-[2rem] border border-white/60'}`}>
          
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-slate-100 z-20 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${
                isReceive ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 border border-emerald-200/50' : 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 border border-amber-200/50'
              }`}>
                {isReceive ? <ArrowDownToLine size={20} /> : <ArrowUpFromLine size={20} />}
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight">تفاصيل الحركة المخزنية</h2>
                <div className="flex items-center gap-2 mt-0.5">
                   <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${isReceive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                     {isReceive ? 'إستلام' : 'صرف'}
                   </span>
                   <p className="text-[11px] font-bold text-slate-500">سجل الإجراءات المركزية</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition-all border border-slate-200 shadow-sm">
                {isFullscreen ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
              </button>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 rounded-lg transition-all border border-slate-200 shadow-sm"
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
                  بيانات الصنف {batchItems && batchItems.length > 1 && (
                    <span className="mr-1 bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200">
                      {formatArabicItemsCount(batchItems.length)}
                    </span>
                  )}
                </h3>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-right text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-500">اسم الصنف</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-500">نوع الصنف</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-500">الكمية</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-500">سعر الوحدة</th>
                        {batchItems && batchItems.length > 1 && (
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500">الإجمالي</th>
                        )}
                        {batchItems && batchItems.some(item => item.expiry_date) && (
                          <th className="px-5 py-3.5 text-xs font-bold text-slate-500">تاريخ الانتهاء</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {batchLoading ? (
                        <tr><td colSpan="5" className="px-5 py-6 text-center text-slate-400 font-bold text-sm">جاري التحميل...</td></tr>
                      ) : batchItems && batchItems.length > 0 ? (
                        batchItems.map(item => {
                          const itemIsReceive = item.transaction_type ? item.transaction_type === 'in' : isReceive;
                          return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3.5 font-black text-slate-800">{item.item_name}</td>
                            <td className="px-5 py-3.5 font-bold text-slate-600">{item.item_unit || '-'}</td>
                            <td className={`px-5 py-3.5 font-black text-lg ${itemIsReceive ? 'text-emerald-600' : 'text-amber-600'}`} dir="ltr">
                              {itemIsReceive ? '+' : '-'}{parseInt(item.quantity, 10).toLocaleString()}
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-700">
                              {parseFloat(item.unit_price || 0).toLocaleString()}
                              <span className="text-[10px] text-slate-400 mr-1">ر.ي</span>
                            </td>
                            {batchItems && batchItems.length > 1 && (
                              <td className="px-5 py-3.5 font-bold text-slate-800">
                                {(parseFloat(item.unit_price || 0) * parseInt(item.quantity || 0, 10)).toLocaleString()}
                                <span className="text-[10px] text-slate-400 mr-1">ر.ي</span>
                              </td>
                            )}
                            {batchItems && batchItems.some(i => i.expiry_date) && (
                              <td className="px-5 py-3.5 font-semibold text-slate-600" dir="ltr">
                                {item.expiry_date
                                  ? new Date(item.expiry_date).toLocaleDateString('en-GB')
                                  : <span className="text-slate-300">—</span>
                                }
                              </td>
                            )}
                          </tr>
                        )})
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {/* Horizontal Footer for Total */}
                {batchItems && (() => {
                  const grandTotal = batchItems.reduce((sum, item) => sum + (parseFloat(item.unit_price || 0) * parseInt(item.quantity || 0, 10)), 0);
                  const bgClass = isReceive ? 'bg-emerald-50/50 border-emerald-100/60' : 'bg-amber-50/50 border-amber-100/60';
                  const textClass = isReceive ? 'text-emerald-800' : 'text-amber-800';
                  const numberClass = isReceive ? 'text-emerald-700' : 'text-amber-700';
                  const currencyClass = isReceive ? 'text-emerald-600' : 'text-amber-600';
                  const taffyotClass = isReceive ? 'text-emerald-700/70 border-emerald-200/60' : 'text-amber-700/70 border-amber-200/60';
                  
                  return (
                    <div className={`flex items-center justify-between px-6 py-4 border-t mt-auto ${bgClass}`}>
                      <span className={`text-xs font-bold ${textClass}`}>إجمالي القيمة:</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-base font-black tracking-tight ${numberClass}`}>{grandTotal.toLocaleString()}</span>
                        <span className={`text-xs font-bold ${currencyClass}`}>ر.ي</span>
                        {grandTotal > 0 && <span className={`text-xs font-bold mr-1.5 pr-2 border-r ${taffyotClass}`}>{taffyot(grandTotal)}</span>}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* --- Section 2: Movement Details --- */}
            <div className="space-y-2">
              {/* Floating Header */}
              <div className="flex items-center gap-2 px-1">
                <div className="p-1.5 bg-blue-100/80 rounded-lg text-blue-600 shadow-sm"><FileText size={16} /></div>
                <h3 className="text-sm font-black text-slate-700">تفاصيل الحركة</h3>
              </div>
              
              {/* Card Container (Native HTML Table) */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-right text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-500">{isReceive ? 'جهة التسليم (المصدر)' : 'الجهة المستلمة (الوجهة)'}</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-500">التاريخ والوقت</th>
                        <th className="px-5 py-3.5 text-xs font-bold text-slate-500">الملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4 font-semibold text-slate-800 align-top">{sourceOrDest}</td>
                        <td className="px-5 py-4 align-top">
                          <span className="text-sm font-bold text-slate-700">
                            <span dir="ltr">{new Date(transaction.created_at).toLocaleDateString('en-GB')} - {new Date(transaction.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit', hour12: false })}</span>
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

            {/* --- Attachments (Compact File Card) --- */}
            {invoiceUrl && (
              <div className="space-y-2">
                {/* Floating Header */}
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

// --- المكون الفرعي لعارض المستندات ---
export const DocumentPreviewOverlay = ({ fileUrl, fileType, onClose }) => {
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  
  if (!fileUrl) return null;

  const isPdf = fileType ? fileType.includes('pdf') : fileUrl.toLowerCase().endsWith('.pdf');
  // Determine API base url to bypass CRA Dev server html fallback for uploads (only for relative paths)
  const API_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : '';
  const fullUrl = (fileUrl.startsWith('http') || fileUrl.startsWith('blob:')) ? fileUrl : `${API_URL}${fileUrl}`;

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" dir="rtl">
      <div className={`bg-white rounded-3xl shadow-luxury flex flex-col overflow-hidden transition-all duration-300 ${isPreviewMaximized ? 'w-[98vw] h-[98vh]' : 'w-full max-w-4xl h-[80vh]'}`}>
        <div className="flex justify-between items-center p-4 border-b bg-slate-50 flex-shrink-0">
          <h3 className="font-black text-slate-800">عرض المرفق</h3>
          <div className="flex items-center gap-2">
            <a 
              href={fullUrl} 
              target="_blank" 
              rel="noreferrer"
              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors text-xs font-bold flex items-center gap-1.5"
            >
              <ExternalLink size={14} /> فتح في نافذة مستقلة
            </a>
            <button onClick={() => setIsPreviewMaximized(!isPreviewMaximized)} className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
              {isPreviewMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden p-4 relative">
          {isPdf ? (
            <iframe
              src={fullUrl}
              className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-inner"
              title="Document Preview"
            />
          ) : (
            <div className="w-full h-full overflow-auto flex items-center justify-center custom-scrollbar">
              <img
                src={fullUrl}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-md bg-white p-2"
                alt="Medical Result"
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TransactionDetailsModal;

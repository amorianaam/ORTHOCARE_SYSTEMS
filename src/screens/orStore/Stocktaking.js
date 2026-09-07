import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { createPortal } from 'react-dom';
import {
  ClipboardCheck, Plus, Check, Clock, Search, AlertTriangle,
  TrendingUp, TrendingDown, Minus as MinusIcon, Save, ChevronRight,
  X, Eye, Package, CheckCircle2, FileText, Printer, RefreshCw,
  ShieldAlert, ArrowRightLeft, Trash2, Edit, Download, History, Filter, ChevronDown
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import ConfirmFinalizeModal from '../../components/storeCommon/modals/ConfirmFinalizeModal';
import useSocketStore from '../../store/useSocketStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const VarianceBadge = ({ diff }) => {
  if (diff === 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black">
      <MinusIcon size={10} /> مطابق
    </span>
  );
  if (diff > 0) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-black border border-emerald-100">
      <TrendingUp size={10} /> +{diff} زيادة
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-black border border-red-100">
      <TrendingDown size={10} /> {diff} عجز
    </span>
  );
};

// 🪧 Stale Draft Alert Banner
const StaleDraftAlert = ({ staleItems, sessionId, token, onRefreshed }) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/inventory/or/stocktaking/${sessionId}/refresh-expected`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        onRefreshed();
      } else {
        toast.error(data.message);
      }
    } catch { toast.error('خطأ في الاتصال بالخادم.'); }
    finally { setRefreshing(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-rose-200/60 shadow-[0_4px_20px_-4px_rgba(225,29,72,0.1)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden relative overflow-hidden animate-in fade-in slide-in-from-top-2">
      <div className="absolute top-0 right-0 w-1 h-full bg-rose-500"></div>
      
      <div className="flex items-start md:items-center gap-3.5 z-10 w-full overflow-hidden">
        <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100 shrink-0">
          <ShieldAlert size={20} className="text-rose-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-slate-800 mb-1">تعارض في الجرد الفعلي!</h3>
          <div className="text-xs font-bold text-slate-600 leading-relaxed max-w-3xl space-y-2">
            {staleItems.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-1.5 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                <span className="text-rose-600">للصنف [{item.item_name}]:</span>
                <span>الرصيد وقت الحفظ كان</span>
                <span className="font-black bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-700">{item.snapshot_balance}</span>
                <span>، والرصيد الحالي أصبح</span>
                <span className="font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">{item.live_balance}</span>
                <span>. الجرد الفعلي المدخل هو</span>
                <span className="font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{item.physical_count}</span>
              </div>
            ))}
            {staleItems.length > 3 && (
              <div className="text-rose-500 text-[11px] px-2">+ {staleItems.length - 3} أصناف أخرى متعارضة.</div>
            )}
            <div className="text-slate-500 text-[11px] mt-1 px-1">تم التحديث التلقائي للأصناف التي لم تقم بجردها بعد. يرجى التحديث لمعالجة التعارضات المتبقية.</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 z-10 shrink-0 mt-3 md:mt-0">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-rose-200 disabled:opacity-50 whitespace-nowrap"
        >
          تحديث وحل التعارض
        </button>
      </div>
    </div>
  );
};

// ─── Print Count Sheet ────────────────────────────────────────────────────────
const PrintCountSheet = ({ items, sessionDate }) => (
  <div className="hidden print:block" dir="rtl">
    <style>{`
      @media print {
        @page { size: A4 portrait; margin: 15mm 12mm; }
        body > *:not(.print-sheet) { display: none !important; }
        .print-sheet { display: block !important; }
        .print-sheet table { border-collapse: collapse; width: 100%; }
        .print-sheet th, .print-sheet td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 10px; }
        .print-sheet thead th { background-color: #f1f5f9; font-weight: 900; }
        .print-sheet .blank-col { background-color: #f8fafc; }
        .no-print { display: none !important; }
      }
    `}</style>
    <div className="print-sheet">
      {/* Hospital Header */}
      <div className="text-center mb-6">
        <h1 className="text-lg font-black text-slate-800 mb-1">ورقة جرد المخزون العام</h1>
        <p className="text-xs text-slate-500 font-bold">OrthoVCare Medical System — نظام أورثوكير الطبي</p>
        <div className="flex justify-between mt-3 text-[10px] text-slate-600 font-bold border-t border-b border-slate-200 py-2">
          <span>التاريخ: {sessionDate || new Date().toLocaleDateString('ar-EG')}</span>
          <span className="font-black text-slate-800">جلسة جرد دوري — للاستخدام الداخلي فقط</span>
          <span>اسم المحاسب: _______________</span>
        </div>
      </div>

      {/* Items Table */}
      <table>
        <thead>
          <tr>
            <th style={{width:'5%'}}>#</th>
            <th style={{width:'38%'}}>اسم الصنف</th>
            <th style={{width:'15%'}}>النوع / الوحدة</th>
            <th style={{width:'18%'}}>الرصيد الدفتري</th>
            <th style={{width:'18%', backgroundColor:'#f8fafc'}}>الرصيد الفعلي</th>
            <th style={{width:'6%', backgroundColor:'#f8fafc'}}>✓</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={item.item_id} style={{backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc'}}>
              <td style={{textAlign:'center', color:'#94a3b8'}}>{index + 1}</td>
              <td style={{fontWeight:'700'}}>{item.name}</td>
              <td style={{textAlign:'center', color:'#64748b'}}>{item.unit || '—'}</td>
              <td style={{textAlign:'center', fontWeight:'900'}}>{item.expected_quantity}</td>
              <td style={{textAlign:'center', backgroundColor:'#f8fafc'}}></td>
              <td style={{textAlign:'center', backgroundColor:'#f8fafc'}}></td>
            </tr>
          ))}
          {/* Empty rows for extra items */}
          {Array.from({length: Math.max(0, 5)}).map((_, i) => (
            <tr key={`empty-${i}`}>
              <td style={{textAlign:'center', color:'#cbd5e1'}}>{items.length + i + 1}</td>
              <td></td><td></td><td></td>
              <td style={{backgroundColor:'#f8fafc'}}></td>
              <td style={{backgroundColor:'#f8fafc'}}></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-6 flex justify-between text-[10px] text-slate-500 font-bold border-t border-slate-200 pt-3">
        <span>إجمالي الأصناف: {items.length}</span>
        <span>توقيع المحاسب: _______________</span>
        <span>توقيع المشرف: _______________</span>
      </div>
    </div>
  </div>
);



// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
const ConfirmDeleteModal = ({ deleting, onConfirm, onCancel }) => {
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="absolute inset-0" onClick={!deleting ? onCancel : undefined} />
      <div className="relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 transition-all duration-300 w-full max-w-md">
        
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center border border-red-100/50 shadow-sm">
              <Trash2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">حذف المسودة</h2>
              <p className="text-xs font-bold text-slate-500 mt-0.5">تأكيد عملية الحذف بشكل نهائي</p>
            </div>
          </div>
          <button onClick={onCancel} disabled={deleting} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div className="p-8 text-center space-y-3">
          <h3 className="font-black text-xl text-slate-800">هل أنت متأكد من الحذف؟</h3>
          <p className="text-slate-500 text-sm font-bold leading-relaxed max-w-sm mx-auto">
            سيتم حذف هذه المسودة وكافة البيانات المتعلقة بها من النظام نهائياً. لا يمكن التراجع عن هذا الإجراء بعد التأكيد.
          </p>
        </div>
        
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button 
            onClick={onCancel} 
            disabled={deleting}
            className="px-5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 font-bold rounded-xl text-sm transition-all disabled:opacity-50"
          >
            إلغاء
          </button>
          <button 
            onClick={onConfirm} 
            disabled={deleting}
            className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black rounded-xl text-sm shadow-md shadow-red-200/50 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {deleting ? (
              <><RefreshCw size={16} className="animate-spin" /> جاري الحذف...</>
            ) : (
              <><Trash2 size={16} /> تأكيد الحذف</>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Session Detail Drill-Down ────────────────────────────────────────────────
const SessionDetail = ({ sessionId, token, onBack, onFinalize, onEdit, onDelete }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [staleData, setStaleData] = useState(null);          // null | { stale, items }
  const [staleVisible, setStaleVisible] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/or/stocktaking/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        if (d.session?.status === 'draft') {
          onEdit(d);
        } else {
          setData(d);
        }
      }
      else toast.error(d.message);
    } catch { toast.error('فشل تحميل تفاصيل الجلسة'); }
    finally { setLoading(false); }
  }, [sessionId, token, onEdit]);

  const checkStaleness = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/or/stocktaking/${sessionId}/staleness-check`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        setStaleData(d);
        setStaleVisible(d.stale);
      }
    } catch { /* silent */ }
  }, [sessionId, token]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Check staleness after session loads — only for drafts
  useEffect(() => {
    if (data?.session?.status === 'draft') {
      checkStaleness();
    }
  }, [data, checkStaleness]);

  const handleRefreshed = async () => {
    await loadSession();
    await checkStaleness();
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/inventory/or/stocktaking/${sessionId}/finalize`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        setShowConfirm(false);
        onFinalize();
      } else if (d.stale) {
        // Backend staleness guard triggered — re-check and show alert
        toast.error('تم رفض الاعتماد: يوجد تعارض في البيانات. يرجى تحديث الكميات المرجعية.');
        setShowConfirm(false);
        await checkStaleness();
        setStaleVisible(true);
      } else {
        toast.error(d.message);
      }
    } catch { toast.error('خطأ في الاتصال بالخادم'); }
    finally { setFinalizing(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/inventory/or/stocktaking/${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        setShowDeleteConfirm(false);
        onDelete();
      } else {
        toast.error(d.message);
      }
    } catch { toast.error('خطأ في الاتصال بالخادم'); }
    finally { setDeleting(false); }
  };

  const handleExportExcel = () => {
    if (!data) return;
    const exportData = items.map((item, idx) => ({
      'م': idx + 1,
      'الصنف': item.item_name,
      'النوع / الوحدة': item.unit || '—',
      'الرصيد الدفتري': item.expected_quantity,
      'الرصيد الفعلي': item.actual_quantity,
      'الفرق': item.actual_quantity - item.expected_quantity,
      'ملاحظات': item.notes || '—'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!dir'] = 'rtl'; // Enable RTL for the worksheet

    const colWidths = [
      { wch: 5 },  // #
      { wch: 40 }, // Name
      { wch: 15 }, // Unit
      { wch: 15 }, // Expected
      { wch: 15 }, // Actual
      { wch: 15 }, // Diff
      { wch: 30 }  // Notes
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `جرد ${String(session.status === "draft" ? "Draft" : session.id).padStart(4,"0")}`);
    
    XLSX.writeFile(wb, `Stocktaking_${session.id}.xlsx`);
  };

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="h-16 bg-white rounded-3xl border border-slate-100" />
      <div className="h-48 bg-white rounded-3xl border border-slate-100" />
    </div>
  );
  if (!data) return null;

  const { session, items, transactions } = data;
  const isDraft = session.status === 'draft';

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${isDraft ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
            <ClipboardCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-black text-gray-800">تفاصيل جلسة الجرد</h1>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm border ${isDraft ? 'bg-amber-50 text-amber-700 border-amber-100/50' : 'bg-emerald-50 text-emerald-700 border-emerald-100/50'}`}>
                {isDraft ? <><Clock size={10}/> مسودة</> : <><CheckCircle2 size={10}/> معتمد</>}
              </span>
            </div>
            <p className="text-xs font-bold text-gray-500">
              {isDraft ? 'معاينة مسودة الجرد الحالية قبل الاعتماد النهائي' : 'معاينة نتائج وكميات جلسة الجرد المحفوظة'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isDraft && (
            <button onClick={handleExportExcel}
              className="bg-white text-emerald-600 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-50 transition-all border border-emerald-200/50 shadow-sm">
              <Download size={15}/> تصدير إكسيل
            </button>
          )}
          {isDraft && (
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(data)}
                className="bg-white text-slate-600 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-50 transition-all border border-slate-200 shadow-sm">
                <Edit size={14}/> تعديل المسودة
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="bg-white text-red-500 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-red-50 hover:text-red-600 transition-all border border-red-100 shadow-sm">
                <Trash2 size={14}/> حذف
              </button>
              <button onClick={() => {
                const missingNotes = session.items.some(i => {
                  const expected = parseInt(i.expected_quantity, 10) || 0;
                  const actual = parseInt(i.actual_quantity, 10) || 0;
                  return (actual - expected !== 0) && (!i.notes || i.notes.trim() === '');
                });
                if (missingNotes) {
                  return toast.error('يجب كتابة ملاحظة لكل صنف يوجد به عجز أو زيادة قبل الاعتماد. يرجى تعديل المسودة وإضافة الملاحظات أولاً.');
                }
                setShowConfirm(true);
              }}
                disabled={staleData?.stale}
                title={staleData?.stale ? 'يجب تحديث الكميات المرجعية أولاً' : ''}
                className="bg-gradient-to-l from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
                <Check size={14}/> اعتماد نهائي
              </button>
            </div>
          )}
          <button onClick={onBack}
            className="flex items-center justify-center w-10 h-10 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all border border-slate-200 shadow-sm">
            <X size={18}/>
          </button>
        </div>
      </div>

      {/* Info Bar */}
      <div className={`flex flex-wrap items-center gap-3 rounded-2xl p-3 border print:hidden ${isDraft ? 'bg-amber-50/30 border-amber-100/50' : 'bg-emerald-50/30 border-emerald-100/50'}`}>
        <div className={`flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border shadow-sm ${isDraft ? 'border-amber-100/60' : 'border-emerald-100/60'}`}>
          <span className="text-xs font-bold text-slate-400">رقم الجرد:</span>
          <span className="text-sm font-black text-slate-700">{session.status === "draft" ? "مسودة" : session.id}</span>
        </div>
        {(() => {
          const detailItemsWithVariance = items.filter(i => parseInt(i.actual_quantity, 10) !== parseInt(i.expected_quantity, 10));
          const detailSurplusCount = detailItemsWithVariance.filter(i => parseInt(i.actual_quantity, 10) > parseInt(i.expected_quantity, 10)).length;
          const detailDeficitCount = detailItemsWithVariance.filter(i => parseInt(i.actual_quantity, 10) < parseInt(i.expected_quantity, 10)).length;
          return (
            <>
              {detailSurplusCount > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm">
                  <span className="text-xs font-bold text-emerald-500">فائض:</span>
                  <span className="text-xs font-black text-emerald-600">{detailSurplusCount}</span>
                </div>
              )}
              {detailDeficitCount > 0 && (
                <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100 shadow-sm">
                  <span className="text-xs font-bold text-red-500">عجز:</span>
                  <span className="text-xs font-black text-red-600">{detailDeficitCount}</span>
                </div>
              )}
            </>
          );
        })()}
        <div className={`flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border shadow-sm ${isDraft ? 'border-amber-100/60' : 'border-emerald-100/60'}`}>
          <span className="text-xs font-bold text-slate-400">تاريخ الإنشاء:</span>
          <span className="text-xs font-black text-slate-700" dir="ltr">{formatDate(session.created_at)}</span>
        </div>
        {session.notes && (
          <div className={`flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border shadow-sm ${isDraft ? 'border-amber-100/60' : 'border-emerald-100/60'}`}>
            <span className="text-xs font-bold text-slate-400">ملاحظات:</span>
            <span className="text-xs font-black text-slate-700">{session.notes}</span>
          </div>
        )}
      </div>

      {/* Stale Draft Alert */}
      {isDraft && staleVisible && staleData?.stale && (
        <StaleDraftAlert
          staleItems={staleData.items}
          sessionId={sessionId}
          token={token}
          onRefreshed={handleRefreshed}
          onDismiss={() => setStaleVisible(false)}
        />
      )}

      {/* Items table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-50 print:hidden">
          <div className="w-7 h-7 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
            <Package size={14}/>
          </div>
          <h3 className="text-xs font-black text-slate-700">أصناف الجرد ({items.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-4 py-3 text-right font-black text-slate-500 w-[25%]">الصنف — النوع</th>
                <th className="px-4 py-3 text-center font-black text-slate-500 w-[13%]">الرصيد الدفتري</th>
                <th className="px-4 py-3 text-center font-black text-slate-500 w-[13%]">الرصيد الفعلي</th>
                <th className="px-4 py-3 text-center font-black text-slate-500 w-[11%]">الفرق</th>
                <th className="px-4 py-3 text-right font-black text-slate-500 w-[38%]">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => {
                const diff = parseInt(item.actual_quantity,10) - parseInt(item.expected_quantity,10);
                return (
                  <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${diff!==0?'bg-amber-50/30':''}`}>
                    <td className="px-4 py-3">
                      <span className="font-black text-slate-800">{item.item_name}</span>
                      {item.unit && <span className="text-slate-400 font-bold"> — {item.unit}</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-black text-slate-600" dir="ltr">{parseInt(item.expected_quantity,10)}</td>
                    <td className="px-4 py-3 text-center font-black text-slate-800" dir="ltr">{parseInt(item.actual_quantity,10)}</td>
                    <td className="px-4 py-3 text-center"><VarianceBadge diff={diff}/></td>
                    <td className="px-4 py-3 text-slate-500 font-bold max-w-[200px] whitespace-pre-wrap break-words">{item.notes||'—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settlement transactions */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden print:hidden">
          <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-50">
            <div className="w-7 h-7 bg-violet-50 rounded-xl flex items-center justify-center text-violet-500">
              <ArrowRightLeft size={14}/>
            </div>
            <h3 className="text-xs font-black text-slate-700">معاملات التسوية ({transactions.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-4 py-3 text-right font-black text-slate-500 w-[35%]">الصنف</th>
                  <th className="px-4 py-3 text-center font-black text-slate-500 w-[25%]">نوع التسوية</th>
                  <th className="px-4 py-3 text-center font-black text-slate-500 w-[15%]">الكمية</th>
                  <th className="px-4 py-3 text-right font-black text-slate-500 w-[25%]">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="font-black text-slate-800">{tx.item_name}</span>
                      {tx.item_unit && <span className="text-slate-400 font-bold"> — {tx.item_unit}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {tx.transaction_type==='in'
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg font-black border border-emerald-100"><TrendingUp size={10}/> إستلام تسوية</span>
                        : <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-lg font-black border border-red-100"><TrendingDown size={10}/> صرف تسوية</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-black text-slate-700" dir="ltr">{parseInt(tx.quantity,10)}</td>
                    <td className="px-4 py-3 text-slate-500 font-bold" dir="ltr">{formatDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Finalize confirm modal */}
      {showConfirm && (
        <ConfirmFinalizeModal
          items={items.map(i => ({ ...i, actual_quantity: i.actual_quantity, expected_quantity: i.expected_quantity }))}
          saving={finalizing}
          onConfirm={handleFinalize}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          deleting={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const Stocktaking = () => {
  const { token } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [items, setItems] = useState([]);
  const [view, setView] = useState('list');           // 'list' | 'create' | 'detail'
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSessionData, setActiveSessionData] = useState(null);
  const [stocktakingItems, setStocktakingItems] = useState([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [sessionDateFilter, setSessionDateFilter] = useState('all');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('all');
  const [openStatusDropdown, setOpenStatusDropdown] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [staleData, setStaleData] = useState(null);
  const [staleVisible, setStaleVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lastFetchRef = useRef(0);
  const latestSilentUpdate = useSocketStore(s => s.latestSilentUpdate);

  useEffect(() => {
    const highlightSessionId = location.state?.highlightSessionId;
    if (highlightSessionId && sessions.length > 0) {
      const session = sessions.find(s => s.id && s.id.toString() === highlightSessionId.toString());
      if (session) {
        setActiveSessionId(highlightSessionId);
        setView('detail');
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state?.highlightSessionId, sessions, navigate, location.pathname]);

  const fetchData = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;
    setLoading(true);
    try {
      const [sessRes, itemsRes] = await Promise.all([
        fetch('/api/inventory/or/stocktaking', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/inventory/or/items', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const sessData = await sessRes.json();
      const itemsData = await itemsRes.json();
      setSessions(Array.isArray(sessData) ? sessData : []);
      setItems(Array.isArray(itemsData) ? itemsData : []);
    } catch { toast.error('فشل تحميل البيانات'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);
  const checkStaleness = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/inventory/or/stocktaking/${activeSessionId}/staleness-check`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        if (d.auto_synced_items?.length > 0) {
          setStocktakingItems(prev => prev.map(item => {
            const synced = d.auto_synced_items.find(s => s.item_id === item.item_id);
            if (synced && !item.is_counted) {
              return { ...item, expected_quantity: synced.live_balance, actual_quantity: synced.live_balance };
            }
            return item;
          }));
        }
        setStaleData(d);
        setStaleVisible(d.stale);
      }
    } catch { /* silent */ }
  }, [activeSessionId, token]);

  useEffect(() => {
    if (latestSilentUpdate?.type === 'inventory') {
      fetchData();
      if (view === 'create' && activeSessionData?.status === 'draft') {
        checkStaleness();
      }
    }
  }, [latestSilentUpdate, fetchData, view, activeSessionData, checkStaleness]);

  useEffect(() => {
    if (view === 'create' && activeSessionData?.status === 'draft') {
      checkStaleness();
    } else {
      setStaleVisible(false);
      setStaleData(null);
    }
  }, [view, activeSessionData, checkStaleness]);
  const handleRefreshed = async () => {
    if (!activeSessionId) return;
    try {
      const res = await fetch(`/api/inventory/or/stocktaking/${activeSessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        setStocktakingItems(d.items.map(i => ({

          item_id: i.item_id,
          name: i.item_name,
          unit: i.unit || '',
          expected_quantity: parseInt(i.expected_quantity, 10) || 0,
          actual_quantity: parseInt(i.actual_quantity, 10) || 0,
          notes: i.notes || ''
        ,
            is_counted: Boolean(i.is_counted)
          })));
        setStaleVisible(false);
        setStaleData(null);
        toast.success("تم تحديث الكميات المرجعية بنجاح!");
      }
    } catch {}
  };

  const handleDeleteDraft = async () => {
    if (!activeSessionId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inventory/or/stocktaking/${activeSessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await res.json();
      if (res.ok) {
        toast.success(d.message);
        setShowDeleteConfirm(false);
        setView('list');
        setActiveSessionId(null);
        setActiveSessionData(null);
        fetchData();
      } else {
        toast.error(d.message);
      }
    } catch { toast.error('خطأ في الاتصال بالخادم'); }
    finally { setDeleting(false); }
  };

  const handleStartStocktaking = () => {
    if (items.length === 0) return toast.error('لا توجد أصناف في المخزن لجردها حالياً');
    setActiveSessionData(null);
    const initItems = items.map(item => ({

      item_id: item.id,
      name: item.name,
      unit: item.unit || '',
      expected_quantity: parseInt(item.quantity, 10) || 0,
      actual_quantity: parseInt(item.quantity, 10) || 0,
      notes: ''
    ,
        is_counted: false
      }));
    setStocktakingItems(initItems);
    setSessionNotes('');
    setSearchQuery('');
    setView('create');
  };

  const handleQuantityChange = (id, value) => {
    const val = value.replace(/[^0-9]/g, '');
    setStocktakingItems(prev => prev.map(i =>
      i.item_id === id ? { ...i, actual_quantity: val === '' ? '' : parseInt(val, 10), is_counted: true } : i
    ));
  };

  const handleNotesChange = (id, value) => {
    setStocktakingItems(prev => prev.map(i =>
      i.item_id === id ? { ...i, notes: value, is_counted: true } : i
    ));
  };

  const handleSave = async (isDraft) => {
    const invalid = stocktakingItems.some(i => i.actual_quantity === '' || isNaN(i.actual_quantity) || i.actual_quantity < 0);
    if (invalid) return toast.error('الرجاء التأكد من إدخال كميات فعلية صحيحة لجميع الأصناف');

    if (!isDraft) {
      const missingNotes = stocktakingItems.some(i => {
        const expected = parseInt(i.expected_quantity, 10) || 0;
        const actual = parseInt(i.actual_quantity, 10) || 0;
        return (actual - expected !== 0) && (!i.notes || i.notes.trim() === '');
      });
      
      if (missingNotes) {
        return toast.error('يجب كتابة ملاحظة توضح السبب لكل صنف يوجد به عجز أو زيادة قبل الاعتماد');
      }
      
      setShowConfirm(true);
    } else {
      await submitStocktaking(true);
    }
  };

  const submitStocktaking = async (isDraft) => {
    setShowConfirm(false);
    setSaving(true);
    try {
      const isUpdate = activeSessionId && activeSessionId !== null;
      const endpoint = isUpdate ? `/api/inventory/or/stocktaking/${activeSessionId}` : '/api/inventory/or/stocktaking';
      const method = isUpdate ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          isDraft,
          notes: sessionNotes,
          items: stocktakingItems.map(i => ({

            item_id: i.item_id,
            unit: i.unit,
            expected_quantity: i.expected_quantity,
            actual_quantity: parseInt(i.actual_quantity, 10) || 0,
            notes: i.notes || ''
          ,
              is_counted: i.is_counted
            }))
        })
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.message);

      // If updating a draft and user requested finalize, we must call finalize right after PUT
      if (isUpdate && !isDraft) {
        const finRes = await fetch(`/api/inventory/or/stocktaking/${activeSessionId}/finalize`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` }
        });
        const finData = await finRes.json();
        if (!finRes.ok) return toast.error(finData.message);
        toast.success(finData.message);
      } else {
        toast.success(data.message);
      }

      setView('list');
      setActiveSessionId(null);
      fetchData();
    } catch { toast.error('خطأ في الاتصال بالخادم'); }
    finally { setSaving(false); }
  };

  const handlePrint = () => window.print();

  // Live summary stats
  const filteredItems = stocktakingItems.filter(i =>
    !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()) || (i.unit || '').includes(searchQuery)
  );
  const itemsWithVariance = stocktakingItems.filter(i => parseInt(i.actual_quantity,10) !== i.expected_quantity);
  const surplusCount = itemsWithVariance.filter(i => parseInt(i.actual_quantity,10) > i.expected_quantity).length;
  const deficitCount = itemsWithVariance.filter(i => parseInt(i.actual_quantity,10) < i.expected_quantity).length;

  const filteredSessions = sessions.filter(sess => {
    // Search Filter (ID)
    const matchesSearch = !sessionSearchQuery || (sess.id && sess.id.toString().toLowerCase().includes(sessionSearchQuery.toLowerCase().trim()));
    
    // Status Filter
    const matchesStatus = sessionStatusFilter === 'all' 
      ? true 
      : sess.status === sessionStatusFilter;

    // Date Filter
    let matchesDate = true;
    const sessionDate = new Date(sess.created_at);
    const today = new Date();
    today.setHours(0,0,0,0);

    if (sessionDateFilter === 'today') {
      matchesDate = sessionDate >= today;
    } else if (sessionDateFilter === '7days') {
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 7);
      matchesDate = sessionDate >= lastWeek;
    } else if (sessionDateFilter === '30days') {
      const lastMonth = new Date(today);
      lastMonth.setDate(today.getDate() - 30);
      matchesDate = sessionDate >= lastMonth;
    } else if (sessionDateFilter === 'custom' && startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0,0,0,0);
      const end = new Date(endDate);
      end.setHours(23,59,59,999);
      matchesDate = sessionDate >= start && sessionDate <= end;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading && view === 'list') return (
    <div className="space-y-4 animate-pulse">
      <div className="h-14 bg-white rounded-3xl border border-slate-100"/>
      <div className="h-64 bg-white rounded-3xl border border-slate-100"/>
    </div>
  );

  // ── Session Detail View ───────────────────────────────────────────────────
  if (view === 'detail') return (
    <div dir="rtl">
      <SessionDetail
        sessionId={activeSessionId}
        token={token}
        onBack={() => { setView('list'); setActiveSessionId(null); }}
        onFinalize={() => { setView('list'); fetchData(); }}
        onDelete={() => { setView('list'); setActiveSessionId(null); fetchData(); }}
        onEdit={(sessionData) => {
          setStocktakingItems(sessionData.items.map(i => ({

            item_id: i.item_id,
            name: i.item_name,
            unit: i.unit || '',
            expected_quantity: parseInt(i.expected_quantity, 10) || 0,
            actual_quantity: parseInt(i.actual_quantity, 10) || 0,
            notes: i.notes || ''
          ,
              is_counted: Boolean(i.is_counted)
            })));
          setSessionNotes(sessionData.session.notes || '');
          setActiveSessionData(sessionData.session);
          setView('create');
        }}
      />
    </div>
  );

  // ── Create / Audit Session View ───────────────────────────────────────────
  if (view === 'create') return (
    <div dir="rtl" className="space-y-5">
      {/* Print-only count sheet */}
      <PrintCountSheet items={stocktakingItems} sessionDate={formatDate(new Date().toISOString())} />

      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 flex-shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-800 text-white flex items-center justify-center shadow-lg">
            <ClipboardCheck size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">
              {activeSessionData ? 'مسودة جلسة جرد' : 'جلسة جرد جديدة'}
            </h1>
            <p className="text-sm font-bold text-gray-500 mt-0.5">
              {activeSessionData 
                ? 'استكمال تسجيل ومطابقة الكميات للجلسة المحفوظة مسبقاً' 
                : 'تسجيل ومطابقة الكميات الفعلية المتوفرة في المخزن'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {(itemsWithVariance.length > 0 || sessionNotes.trim() !== (activeSessionData?.notes?.trim() || '')) && (
            <button onClick={() => handleSave(true)} disabled={saving}
              className="flex items-center justify-center gap-2 bg-white hover:bg-amber-50 text-amber-600 border border-amber-200/50 font-black text-sm py-2 px-4 rounded-xl transition-all shadow-sm">
              <Save size={16}/> حفظ كمسودة
            </button>
          )}
          {activeSessionData && (
            <button onClick={() => setShowDeleteConfirm(true)} disabled={saving || deleting}
              className="flex items-center justify-center gap-2 bg-white hover:bg-red-50 text-red-500 hover:text-red-600 border border-red-100 font-black text-sm py-2 px-4 rounded-xl transition-all shadow-sm">
              <Trash2 size={16}/> حذف
            </button>
          )}
          <button onClick={() => handleSave(false)} disabled={saving || (activeSessionData && staleData?.stale)}
            title={activeSessionData && staleData?.stale ? 'يجب تحديث الكميات المرجعية أولاً' : ''}
            className="flex items-center justify-center gap-2 bg-gradient-to-l from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black text-sm py-2 px-4 rounded-xl transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Check size={16}/>}
            اعتماد نهائي
          </button>
          <button onClick={() => { setView('list'); setActiveSessionId(null); setActiveSessionData(null); }}
            className="flex items-center justify-center w-10 h-10 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-slate-200 shadow-sm">
            <X size={18}/>
          </button>
        </div>
      </div>

      {activeSessionData && (
        <div className="flex flex-col gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-3 bg-amber-50/50 border border-amber-100 rounded-2xl p-3">
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-100/60 shadow-sm">
              <span className="text-xs font-bold text-slate-400">رقم الجرد:</span>
              <span className="text-sm font-black text-slate-700">{activeSessionData.status === "draft" ? "مسودة" : activeSessionData.id}</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-100/60 shadow-sm">
              <Clock size={14} className="text-amber-500"/>
              <span className="text-xs font-black text-amber-600">مسودة جرد غير مكتملة</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-100/60 shadow-sm">
              <span className="text-xs font-bold text-slate-400">تاريخ الإنشاء:</span>
              <span className="text-xs font-black text-slate-700" dir="ltr">{formatDate(activeSessionData.created_at)}</span>
            </div>
          </div>
          {/* Stale Draft Alert */}
          {staleVisible && staleData?.stale && (
            <StaleDraftAlert
              staleItems={staleData.items}
              sessionId={activeSessionId}
              token={token}
              onRefreshed={handleRefreshed}
              onDismiss={() => setStaleVisible(false)}
            />
          )}
        </div>
      )}

      {/* Live Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 text-center">
          <span className="block text-2xl font-black text-slate-700">{stocktakingItems.length}</span>
          <span className="block text-[10px] font-bold text-slate-400 mt-0.5">إجمالي الأصناف</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 text-center">
          <span className="block text-2xl font-black text-slate-500">{stocktakingItems.length - itemsWithVariance.length}</span>
          <span className="block text-[10px] font-bold text-slate-400 mt-0.5">أصناف مطابقة</span>
        </div>
        <div className={`rounded-2xl border shadow-sm p-3.5 text-center transition-colors ${surplusCount>0?'bg-emerald-50 border-emerald-100':'bg-white border-slate-100'}`}>
          <span className={`block text-2xl font-black ${surplusCount>0?'text-emerald-600':'text-slate-400'}`}>{surplusCount}</span>
          <span className={`block text-[10px] font-bold mt-0.5 ${surplusCount>0?'text-emerald-500':'text-slate-400'}`}>أصناف فائض</span>
        </div>
        <div className={`rounded-2xl border shadow-sm p-3.5 text-center transition-colors ${deficitCount>0?'bg-red-50 border-red-100':'bg-white border-slate-100'}`}>
          <span className={`block text-2xl font-black ${deficitCount>0?'text-red-600':'text-slate-400'}`}>{deficitCount}</span>
          <span className={`block text-[10px] font-bold mt-0.5 ${deficitCount>0?'text-red-500':'text-slate-400'}`}>أصناف عجز</span>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-right font-black text-slate-500 w-[5%]">#</th>
                <th className="px-4 py-3 text-right font-black text-slate-500 w-[30%]">الصنف — النوع</th>
                <th className="px-4 py-3 text-center font-black text-slate-500 w-[11%]">الرصيد الدفتري</th>
                <th className="px-4 py-3 text-center font-black text-slate-500 w-[12%]">الرصيد الفعلي</th>
                <th className="px-4 py-3 text-center font-black text-slate-500 w-[10%]">الفرق</th>
                <th className="px-4 py-3 text-right font-black text-slate-500 w-[32%]">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-400 text-[11px] font-bold">لا توجد أصناف تطابق البحث</td></tr>
              ) : filteredItems.map((item, index) => {
                const diff = (parseInt(item.actual_quantity,10)||0) - item.expected_quantity;
                const hasVariance = diff !== 0;
                return (
                  <tr key={item.item_id} className={`transition-colors ${hasVariance?'bg-amber-50/40 hover:bg-amber-50/70':'hover:bg-slate-50/50'}`}>
                    <td className="px-4 py-2.5 text-slate-400 font-black">{index+1}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-black text-slate-800">{item.name}</span>
                      {item.unit && <span className="text-slate-400 font-bold"> — {item.unit}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center font-black text-slate-500" dir="ltr">{item.expected_quantity}</td>
                    <td className="px-4 py-2">
                      <div className={`relative flex items-center max-w-[110px] mx-auto h-[34px] bg-white border rounded-xl overflow-hidden transition-all ${hasVariance?'border-amber-300 ring-1 ring-amber-200':'border-slate-200'} focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500`}>
                        <button type="button" tabIndex="-1"
                          onClick={() => handleQuantityChange(item.item_id, String(Math.max(0,(parseInt(item.actual_quantity,10)||0)-1)))}
                          className="w-7 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0">
                          <MinusIcon size={12} strokeWidth={3}/>
                        </button>
                        <input type="text" inputMode="numeric" dir="ltr" value={item.actual_quantity}
                          onChange={e => handleQuantityChange(item.item_id, e.target.value)}
                          className="flex-1 min-w-0 bg-transparent text-[11px] font-black text-slate-800 text-center focus:outline-none"/>
                        <button type="button" tabIndex="-1"
                          onClick={() => handleQuantityChange(item.item_id, String((parseInt(item.actual_quantity,10)||0)+1))}
                          className="w-7 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0">
                          <Plus size={12} strokeWidth={3}/>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center"><VarianceBadge diff={diff}/></td>
                    <td className="px-4 py-2">
                      <textarea 
                        ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                        value={item.notes} 
                        onChange={e => {
                          e.target.style.height = 'auto';
                          e.target.style.height = e.target.scrollHeight + 'px';
                          handleNotesChange(item.item_id, e.target.value);
                        }}
                        className="w-full bg-white border border-slate-100 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-slate-600 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-colors placeholder:text-slate-300 overflow-hidden resize-none min-h-[36px]"
                        rows="1"
                        placeholder="سبب الفرق..."/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          deleting={deleting}
          onConfirm={handleDeleteDraft}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Finalize Confirm Modal */}
      {showConfirm && (
        <ConfirmFinalizeModal
          items={stocktakingItems}
          saving={saving}
          onConfirm={() => submitStocktaking(false)}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );

  // ── Session List View ─────────────────────────────────────────────────────
  return (
    <div dir="rtl" className="space-y-6 pb-12">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-800 text-white flex items-center justify-center shadow-lg">
            <ClipboardCheck size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">الجرد الدوري</h1>
            <p className="text-sm font-bold text-gray-500 mt-0.5">سجل جلسات مطابقة المخزون وتحليل الفروقات</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleStartStocktaking}
            className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-black py-2.5 px-6 rounded-xl text-sm shadow-md shadow-indigo-200/50 flex items-center justify-center gap-2 transition-all w-full md:w-auto">
            <Plus size={16} strokeWidth={2.5}/> جلسة جرد جديدة
          </button>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-slate-200">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-200 shadow-sm">
                <History size={20} />
              </div>
              <h2 className="text-lg font-black text-slate-800">
                سجل جلسات الجرد
                {filteredSessions.length > 0 && <span className="mr-2 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">(تم العثور على {filteredSessions.length} جلسة)</span>}
              </h2>
            </div>
          </div>

          {/* --- FILTER BAR --- */}
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col md:flex-row gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 justify-between items-start">
              
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <div className="w-full md:w-64 relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="بحث برقم الجرد (مثال: 102)..."
                    value={sessionSearchQuery}
                    onChange={(e) => setSessionSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="w-full md:w-48 relative z-20">
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                  <div 
                    onClick={() => setOpenStatusDropdown(!openStatusDropdown)}
                    className={`w-full bg-white border ${openStatusDropdown ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-indigo-300'} rounded-xl pr-10 pl-4 py-2 text-sm font-bold text-slate-700 transition-all cursor-pointer flex items-center justify-between group`}
                  >
                    <span className="truncate">
                      {sessionStatusFilter === 'all' ? 'كل الحالات' : sessionStatusFilter === 'completed' ? 'معتمدة' : 'مسودات'}
                    </span>
                    <ChevronDown size={16} className={`text-slate-400 group-hover:text-indigo-500 transition-transform duration-200 ${openStatusDropdown ? 'rotate-180 text-indigo-500' : ''}`} />
                  </div>
                  
                  {openStatusDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenStatusDropdown(false)}></div>
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in origin-top">
                        <div className="p-1.5 space-y-0.5">
                          {[
                            { value: 'all', label: 'كل الحالات' },
                            { value: 'completed', label: 'معتمدة' },
                            { value: 'draft', label: 'مسودات' }
                          ].map((opt) => (
                            <div 
                              key={opt.value}
                              onClick={() => {
                                setSessionStatusFilter(opt.value);
                                setOpenStatusDropdown(false);
                              }}
                              className={`px-3 py-2 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center justify-between border ${sessionStatusFilter === opt.value ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' : 'text-slate-600 border-transparent hover:bg-indigo-50/40 hover:text-indigo-600 hover:border-indigo-200/40'}`}
                            >
                              <span className="truncate">{opt.label}</span>
                              {sessionStatusFilter === opt.value && <Check size={14} />}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                <div className="flex gap-1.5 bg-gray-100 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500 w-full md:w-auto overflow-x-auto">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'today', label: 'اليوم' },
                    { id: '7days', label: 'هذا الأسبوع' },
                    { id: '30days', label: 'هذا الشهر' },
                    { id: 'custom', label: 'تاريخ مخصص' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setSessionDateFilter(f.id)}
                      className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        sessionDateFilter === f.id ? 'bg-white text-indigo-700 shadow-sm font-black' : 'hover:bg-white/40'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {sessionDateFilter === 'custom' && (
              <div className="p-4 bg-gray-50 rounded-2xl border border-slate-100 flex flex-wrap gap-4 items-center animate-fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">من:</span>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)} 
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">إلى:</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)} 
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none text-slate-700"
                  />
                </div>
                <div className="flex items-center gap-2 mr-auto">
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); setSessionDateFilter('all'); }}
                    className="px-4 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-colors"
                  >
                    إعادة تعيين
                  </button>
                </div>
              </div>
            )}
          </div>

        {filteredSessions.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 border border-slate-100">
              <ClipboardCheck size={28}/>
            </div>
            <p className="text-xs font-black text-slate-400">لا توجد جلسات تطابق البحث</p>
            {sessions.length === 0 && (
              <button onClick={handleStartStocktaking}
                className="mt-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black text-xs py-2 px-4 rounded-xl flex items-center gap-2 transition-all border border-indigo-100">
                <Plus size={13}/> بدء الجرد الأول
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="px-5 py-4 text-right font-black text-slate-500 w-[15%]">رقم الجرد</th>
                  <th className="px-5 py-4 text-center font-black text-slate-500 w-[15%]">الحالة</th>
                  <th className="px-5 py-4 text-center font-black text-slate-500 w-[15%]">الأصناف</th>
                  <th className="px-5 py-4 text-center font-black text-slate-500 w-[15%]">فائض</th>
                  <th className="px-5 py-4 text-center font-black text-slate-500 w-[15%]">عجز</th>
                  <th className="px-5 py-4 text-right font-black text-slate-500 w-[20%]">تاريخ الإنشاء</th>
                  <th className="px-5 py-4 w-[5%]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSessions.map(sess => {
                  const isDraft = sess.status === 'draft';
                  return (
                    <tr key={sess.id}
                      onClick={() => { setActiveSessionId(sess.id); setView('detail'); }}
                      className="hover:bg-indigo-50/30 cursor-pointer transition-colors group">
                      <td className="px-5 py-4 font-black text-slate-700 text-[13px]">
                          {sess.status === "draft" ? "مسودة" : sess.id}
                        </td>
                      <td className="px-5 py-4 text-center">
                        {isDraft
                          ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-black border border-amber-200/50 text-[10px]"><Clock size={11} strokeWidth={3}/> مسودة</span>
                          : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-black border border-emerald-200/50 text-[10px]"><CheckCircle2 size={11} strokeWidth={3}/> معتمد</span>}
                      </td>
                      <td className="px-5 py-4 text-center font-black text-slate-600">{sess.item_count||0}</td>
                      <td className="px-5 py-4 text-center">
                        {sess.surplus_count>0
                          ? <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">+{sess.surplus_count}</span>
                          : <span className="text-slate-300 font-bold">—</span>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {sess.deficit_count>0
                          ? <span className="font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-lg border border-red-100">-{sess.deficit_count}</span>
                          : <span className="text-slate-300 font-bold">—</span>}
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-bold text-[11px] text-right" dir="ltr">{formatDate(sess.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="w-8 h-8 bg-white group-hover:bg-indigo-600 text-slate-400 group-hover:text-white rounded-xl flex items-center justify-center transition-all border border-slate-200 group-hover:border-transparent shadow-sm">
                          <Eye size={14}/>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default Stocktaking;

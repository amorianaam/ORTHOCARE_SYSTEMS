import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import BatchDetailsModal from '../../components/storeCommon/BatchDetailsModal';
import { Send, Plus, Minus, Trash2, Check, Package, Info, MapPin, FileText, X, History, Eye, Search, Filter, ChevronRight, ChevronLeft, ChevronDown, AlertTriangle, Layers, Truck, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import { getSmartItemText } from '../../utils/arabicFormatters';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';
import TransactionDetailsModal, { DocumentPreviewOverlay } from '../../components/storeCommon/TransactionDetailsModal';
import LimitExceededModal from '../../components/storeCommon/modals/LimitExceededModal';


  const DESTINATIONS = [
    { id: 'العيادة (الطبيب)' },
    { id: 'الاستقبال' },
    { id: 'المحاسب (الصندوق)' },
    { id: 'قسم المختبر' },
    { id: 'قسم الاشعة' },
    { id: 'منسق العمليات' },
    { id: 'المخزن العام' },
    { id: 'مخزن العمليات' },
    { id: 'تالف' },
    { id: 'أخرى' }
  ];

const IssueStock = () => {
  const { token } = useAuthStore();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ destination: '', notes: '', document: null });
  const [issuedItems, setIssuedItems] = useState([{ id: Date.now(), item_id: '', search_name: '', selected_unit: '', available_units: [], quantity: '' }]);
  const [openUnitDropdownIndex, setOpenUnitDropdownIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const lastFetchRef = useRef(0);
  const fileInputRef = useRef(null);
  const destRef = useRef(null);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [isDestOpen, setIsDestOpen] = useState(false);
  const [quantityWarning, setQuantityWarning] = useState(null);
  const latestSilentUpdate = useSocketStore(s => s.latestSilentUpdate);

  // --- LEDGER STATE ---
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerData, setLedgerData] = useState([]);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [ledgerTotalItems, setLedgerTotalItems] = useState(0);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  // --- PENDING OUTBOUND STATE ---
  const [pendingOutbound, setPendingOutbound] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [processingRevoke, setProcessingRevoke] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);

  const fetchPendingOutbound = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/general/transfers/pending-outbound', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPendingOutbound(data || []);
      }
    } catch (error) {
      console.error('Error fetching pending outbound transfers:', error);
    } finally {
      setPendingLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPendingOutbound();
  }, [fetchPendingOutbound]);

  useEffect(() => {
    if (['transfer', 'revoke', 'inventory'].includes(latestSilentUpdate?.type)) {
      fetchPendingOutbound();
    }
  }, [latestSilentUpdate, fetchPendingOutbound]);

  const handleRevokeBatch = async (batchRefKey) => {
    setProcessingRevoke(batchRefKey);
    try {
      const res = await fetch(`/api/inventory/general/transfers/batch/${batchRefKey}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'حدث خطأ أثناء الإلغاء');
      
      toast.success('تم إلغاء وسحب الشحنة بنجاح');
      setSelectedBatch(null);
      fetchPendingOutbound();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessingRevoke(null);
    }
  };

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itemSearchText, setItemSearchText] = useState('');

  const abortControllerRef = useRef(null);

  const fetchLedger = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLedgerLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: ledgerPage,
        limit: 10,
        typeFilter: 'out',
        search: searchQuery,
        itemId: itemFilter,
        dateFilter: dateFilter !== 'all' ? dateFilter : ''
      });
      if (dateFilter === 'custom') {
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);
      }
      const res = await fetch(`/api/inventory/general/dashboard/transactions?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal
      });
      const data = await res.json();
      if (res.ok) {
        setLedgerData(data.transactions || []);
        setLedgerTotalPages(data.pagination?.totalPages || 1);
        setLedgerTotalItems(data.pagination?.totalItems || 0);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('فشل تحميل سجل الصرف');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        setLedgerLoading(false);
      }
    }
  }, [ledgerPage, searchQuery, itemFilter, dateFilter, startDate, endDate, token]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  useEffect(() => {
    setLedgerPage(1);
  }, [searchQuery, itemFilter, dateFilter]);

  const fetchItems = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return;
    lastFetchRef.current = now;
    try {
      const res = await fetch('/api/inventory/general/items', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setItems(Array.isArray(data) ? data.filter(i => i.quantity > 0) : []);
    } catch {
      toast.error('فشل تحميل الأصناف');
    }
  }, [token]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (latestSilentUpdate?.type === 'inventory') {
      fetchItems();
      fetchLedger();
    }
  }, [latestSilentUpdate, fetchItems, fetchLedger]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (destRef.current && !destRef.current.contains(event.target)) {
        setIsDestOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddItem = () => {
    setIssuedItems([...issuedItems, { id: Date.now() + Math.random(), item_id: '', search_name: '', selected_unit: '', available_units: [], quantity: '' }]);
  };

  const handleRemoveItem = (index) => {
    if (issuedItems.length === 1) {
      // If it's the only item, just clear it instead of removing it completely
      const newItems = [...issuedItems];
      newItems[0] = { id: Date.now() + Math.random(), item_id: '', search_name: '', selected_unit: '', available_units: [], quantity: '' };
      setIssuedItems(newItems);
    } else {
      setIssuedItems(issuedItems.filter((_, i) => i !== index));
    }
  };

  const handleChange = (index, field, value) => {
    const newItems = [...issuedItems];
    newItems[index][field] = value;
    setIssuedItems(newItems);
  };

  const handleItemSearchChange = (index, value) => {
    const newItems = [...issuedItems];
    const item = newItems[index];
    item.search_name = value;
    
    const matchedItems = items.filter(i => i.name.trim().toLowerCase() === value.trim().toLowerCase());
    
    if (matchedItems.length === 0) {
      item.item_id = '';
      item.selected_unit = '';
      item.available_units = [];
    } else if (matchedItems.length === 1) {
      item.item_id = matchedItems[0].id;
      item.selected_unit = matchedItems[0].unit || 'بدون نوع';
      item.available_units = [{ unit: matchedItems[0].unit || 'بدون نوع', quantity: matchedItems[0].quantity }];
    } else {
      item.item_id = ''; 
      item.selected_unit = '';
      item.available_units = matchedItems.map(i => ({ unit: i.unit || 'بدون نوع', quantity: i.quantity }));
    }
    
    setIssuedItems(newItems);
  };

  const handleUnitChange = (index, unitValue) => {
    const newItems = [...issuedItems];
    const item = newItems[index];
    item.selected_unit = unitValue;
    
    const exactMatch = items.find(i => 
      i.name.trim().toLowerCase() === item.search_name.trim().toLowerCase() && 
      (i.unit || 'بدون نوع').trim().toLowerCase() === unitValue.trim().toLowerCase()
    );
    item.item_id = exactMatch ? exactMatch.id : '';
    
    setIssuedItems(newItems);
  };

  const handleSubmit = async () => {
    if (!form.destination) return toast.error('الرجاء اختيار الجهة المستفيدة');
    
    if ((form.destination === 'تالف' || form.destination === 'أخرى') && !form.notes.trim()) {
      return toast.error(`يجب كتابة الملاحظات أو سبب الصرف عند اختيار "${form.destination}"`);
    }

    const validItems = issuedItems
      .filter(i => i.item_id && parseFloat(i.quantity) > 0)
      .map(i => ({ ...i, quantity: parseFloat(i.quantity) || 0 }));
    if (validItems.length === 0) return toast.error('الرجاء إدخال صنف واحد على الأقل بكمية صحيحة');

    // Check quantities
    for (let it of validItems) {
      const dbItem = items.find(i => i.id == it.item_id);
      if (dbItem && parseFloat(it.quantity) > parseFloat(dbItem.quantity)) {
        setQuantityWarning({
          itemName: dbItem.name,
          requested: it.quantity,
          available: dbItem.quantity
        });
        return;
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('destination', form.destination);
      if (form.notes) formData.append('notes', form.notes);
      formData.append('items', JSON.stringify(validItems));
      if (form.document) {
        formData.append('document', form.document);
      }

      const res = await fetch('/api/inventory/general/issue', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setIssuedItems([{ id: Date.now(), item_id: '', search_name: '', selected_unit: '', available_units: [], quantity: '' }]);
        setForm({ destination: '', notes: '', document: null });
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchItems();
        fetchLedger();
        fetchPendingOutbound();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };


  return (
    <div dir="rtl" className="space-y-6 pb-12">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-800 text-white flex items-center justify-center shadow-lg">
            <Send size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">صرف مواد للأقسام</h1>
            <p className="text-sm font-bold text-gray-500 mt-0.5">توزيع وصرف المواد من المخزن العام للجهات المستفيدة</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-gray-200 px-4 py-1.5 rounded-xl text-center flex items-center gap-3 shadow-sm min-w-[160px]">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Package size={16} />
            </div>
            <div className="text-right">
              <span className="text-[10px] block font-black text-gray-500">الأصناف المحددة</span>
              <span className="text-sm font-black text-amber-600">{issuedItems.filter(i => i.item_id).length} أصناف</span>
            </div>
          </div>
        </div>
      </div>

      
      {/* --- PENDING OUTBOUND TRANSFERS SECTION --- */}
      {!pendingLoading && pendingOutbound && pendingOutbound.length > 0 && (
      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200/80 mb-6 relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500"></div>
          
          <div className="p-5 border-b border-slate-100 bg-amber-50/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-inner">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">الشحنات الصادرة المعلقة (إلى مخزن العمليات)</h2>
                <p className="text-xs font-bold text-slate-500 mt-1">بانتظار تأكيد الاستلام من الجهات المستفيدة</p>
              </div>
            </div>
            <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm border border-amber-200/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              {pendingOutbound.length} شحنات معلقة
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-5 py-3 text-xs font-black text-slate-500">الوجهة المستفيدة</th>
                  <th className="px-5 py-3 text-xs font-black text-slate-500">المحتوى</th>
                  <th className="px-5 py-3 text-xs font-black text-slate-500">تاريخ الإرسال</th>
                  <th className="px-5 py-3 text-xs font-black text-slate-500">إجمالي القيمة</th>
                  <th className="px-5 py-3 text-xs font-black text-slate-500 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingOutbound.map((batch) => {
                  const grandTotal = batch.items.reduce((sum, item) => sum + ((parseFloat(item.sent_quantity) || 0) * (parseFloat(item.cost_price) || 0)), 0);
                  
                  return (
                    <tr key={batch.batch_ref_key} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-5 py-4">
                        <span className="font-bold text-slate-700 text-sm">{batch.destination_name || 'جهة غير محددة'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200">
                          <Package size={14} />
                          {getSmartItemText(batch.item_count, batch.items?.[0]?.item_name || batch.items?.[0]?.name)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-700 text-sm">
                          {new Date(batch.sent_at).toLocaleDateString('en-GB')}
                        </div>
                        <div className="text-xs text-slate-400 font-semibold mt-0.5" dir="ltr">
                          {new Date(batch.sent_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-emerald-600 text-sm">{grandTotal.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-bold mr-1">ر.ي</span>
                      </td>
                      <td className="px-5 py-4 text-left">
                        <button
                          onClick={() => setSelectedBatch(batch)}
                          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors"
                        >
                          <Eye size={14} className="text-slate-400" />
                          عرض التفاصيل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

      </div>
      )}

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-50">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100/50">
            <MapPin size={15} />
          </div>
          <h2 className="font-black text-sm text-slate-800">وجهة الصرف</h2>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
          
          <div className="w-full md:w-64 shrink-0 relative" ref={destRef}>
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">الجهة المستفيدة <span className="text-red-500">*</span></label>
            <div 
              onClick={() => setIsDestOpen(!isDestOpen)}
              className={`w-full bg-white border ${isDestOpen ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-200 hover:border-amber-300'} rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition-all h-[38px] cursor-pointer flex items-center justify-between group`}
            >
              <div className="flex items-center gap-2">
                {form.destination ? (
                  <span className="text-slate-800">{form.destination}</span>
                ) : (
                  <span className="text-slate-400">-- اختر الجهة المستفيدة --</span>
                )}
              </div>
              <ChevronDown size={14} className={`text-slate-400 group-hover:text-amber-500 transition-transform duration-300 ${isDestOpen ? 'rotate-180' : ''}`} />
            </div>
            
            {isDestOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in origin-top">
                <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                  {DESTINATIONS.map((d) => (
                    <div 
                      key={d.id}
                      onClick={() => {
                        setForm({...form, destination: d.id});
                        setIsDestOpen(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        form.destination === d.id 
                          ? 'bg-amber-50 text-amber-700' 
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{d.id}</span>
                      {form.destination === d.id && <Check size={14} className="mr-auto text-amber-500" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 w-full">
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">ملاحظات أو سبب الصرف {(form.destination === 'تالف' || form.destination === 'أخرى') && <span className="text-red-500">*</span>}</label>
            <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all h-[38px]" 
              placeholder="مثال: صرف دوري لشهر كذا..." />
          </div>

          <div className="flex-1 w-full">
            <label className="block text-[11px] font-bold text-slate-500 mb-1.5">مستند الصرف (صورة أو PDF)</label>
            <input 
              type="file" 
              accept="image/*,.pdf" 
              ref={fileInputRef}
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  setForm({...form, document: e.target.files[0]});
                }
              }}
              className="hidden" 
            />
            {form.document ? (
              <div className="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-2 shadow-sm transition-all h-[38px]">
                <div 
                  className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer group"
                  onClick={() => setShowFilePreview(true)}
                  title="انقر لمعاينة الملف"
                >
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 overflow-hidden">
                    {form.document.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(form.document)} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="Preview" />
                    ) : (
                      <FileText size={14} />
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 truncate group-hover:text-amber-600 transition-colors" dir="ltr">{form.document.name}</span>
                </div>
                <button 
                  onClick={() => {
                    setForm({...form, document: null});
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-[38px] flex items-center justify-center gap-2 bg-slate-50 hover:bg-amber-50 border border-dashed border-slate-300 hover:border-amber-300 rounded-xl text-xs font-bold text-slate-500 hover:text-amber-700 transition-all shadow-sm"
              >
                <Plus size={14} /> إرفاق ملف
              </button>
            )}
          </div>
        </div>

        {form.destination === 'مخزن العمليات' && (
          <div className="mt-4 p-3 bg-amber-50/80 border border-amber-200 text-amber-700 rounded-xl flex items-start gap-2 text-xs font-semibold">
            <Info size={16} className="mt-0.5 shrink-0" />
            <p>عند الصرف لمخزن العمليات، سيتم إنشاء <strong>"إشعار إستلام إلكتروني"</strong> ولن تضاف للمخزن لديهم حتى يؤكد أمين مخزن العمليات استلامها.</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mt-6">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100/50">
              <Package size={15} />
            </div>
            <h2 className="font-black text-sm text-slate-800">الأصناف المنصرفة</h2>
          </div>
          <button onClick={handleAddItem} className="bg-amber-50 text-amber-700 border-none hover:bg-amber-100 flex items-center gap-2 text-[11px] font-black py-2 px-4 rounded-xl transition-all shadow-sm">
            <Plus size={14} /> إضافة صنف
          </button>
        </div>

        <datalist id="items-datalist">
          {[...new Set(items.map(i => i.name))].map((name, idx) => <option key={idx} value={name} />)}
        </datalist>

        <div className="space-y-4">
          {issuedItems.map((item, index) => {
            const selectedItem = items.find(i => i.id == item.item_id);
            const available = selectedItem ? parseInt(selectedItem.quantity, 10) : 0;
            const unit = selectedItem ? selectedItem.unit : '';

            return (
              <div key={item.id} className="flex flex-col md:flex-row items-end gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-colors shadow-sm">
                
                <div className="w-full md:w-[35%] shrink-0">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <label className="block text-[11px] font-bold text-slate-500">بحث واختيار الصنف</label>
                    {item.item_id ? (
                      <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100/50">
                        <Check size={12} /> متوفر
                      </span>
                    ) : item.search_name && item.available_units?.length > 1 ? (
                      <span className="text-[10px] font-bold text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100/50">
                        <Info size={12} /> اختر النوع
                      </span>
                    ) : item.search_name ? (
                      <span className="text-[10px] font-bold text-red-500 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-md border border-red-100/50">
                        <X size={12} /> غير موجود
                      </span>
                    ) : null}
                  </div>
                  <input 
                    list="items-datalist" 
                    value={item.search_name || ''} 
                    onChange={e => handleItemSearchChange(index, e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all h-[38px]" 
                    placeholder="اكتب للبحث عن الصنف..."
                  />
                </div>

                <div className="w-full md:w-32 shrink-0 relative">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 px-1">نوع الصنف</label>
                  {(!item.available_units || item.available_units.length <= 1) ? (
                    <input
                      type="text"
                      disabled
                      value={item.selected_unit || ''}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 cursor-not-allowed transition-all h-[38px]"
                      placeholder="-"
                    />
                  ) : (
                    <div className="relative">
                      <div 
                        onClick={() => setOpenUnitDropdownIndex(openUnitDropdownIndex === index ? null : index)}
                        className={`w-full bg-white border ${openUnitDropdownIndex === index ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-200 hover:border-amber-300'} rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 transition-all h-[38px] cursor-pointer flex items-center justify-between group`}
                      >
                        <span className="truncate">{item.selected_unit || 'اختر...'}</span>
                        <ChevronDown size={14} className={`text-slate-400 group-hover:text-amber-500 transition-transform duration-200 ${openUnitDropdownIndex === index ? 'rotate-180 text-amber-500' : ''}`} />
                      </div>
                      
                      {openUnitDropdownIndex === index && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenUnitDropdownIndex(null)}></div>
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in origin-top">
                            <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                              {item.available_units.map((u, i) => (
                                <div 
                                  key={i} 
                                  onClick={() => {
                                    handleUnitChange(index, u.unit);
                                    setOpenUnitDropdownIndex(null);
                                  }}
                                  className={`px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer transition-all flex items-center justify-between border ${item.selected_unit === u.unit ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 'text-slate-600 border-transparent hover:bg-amber-50/40 hover:text-amber-600 hover:border-amber-200/40'}`}
                                >
                                  <span className="truncate">{u.unit}</span>
                                  {item.selected_unit === u.unit && <Check size={14} />}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-full md:w-32 shrink-0">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5 px-1">الكمية</label>
                  <div className="relative flex items-center h-[38px] bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-all shadow-sm group">
                    <button 
                      type="button"
                      tabIndex="-1"
                      onClick={() => handleChange(index, 'quantity', Math.max(1, (parseInt(item.quantity || 0) - 1)))}
                      className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <Minus size={14} strokeWidth={3} />
                    </button>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      dir="ltr"
                      value={item.quantity} 
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        handleChange(index, 'quantity', val);
                      }}
                      className="flex-1 w-full min-w-0 bg-transparent text-xs font-black text-slate-700 text-center focus:outline-none" 
                      placeholder="0" 
                    />
                    <button 
                      type="button"
                      tabIndex="-1"
                      onClick={() => handleChange(index, 'quantity', (parseInt(item.quantity || 0) + 1))}
                      className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-2.5 w-full md:w-auto shrink-0 md:mr-2">
                  <div className={`h-[38px] flex items-center justify-center gap-1.5 px-4 rounded-xl border-none shrink-0 w-full md:w-auto transition-colors ${available < item.quantity ? 'bg-red-50' : 'bg-amber-50'}`}>
                    <span className={`text-[11px] font-bold ${available < item.quantity ? 'text-red-600/80' : 'text-amber-600/80'}`}>المتوفر:</span>
                    <span className={`font-black text-[13px] ${available < item.quantity ? 'text-red-700' : 'text-amber-700'}`} dir="ltr">
                      {available}
                    </span>
                  </div>
                </div>

                <div className="flex items-center w-full md:w-auto flex-1 justify-end shrink-0">
                  <button onClick={() => handleRemoveItem(index)} disabled={issuedItems.length === 1 && !item.search_name && !item.quantity}
                    title="حذف الصنف"
                    className="w-full md:w-10 h-[38px] flex items-center justify-center rounded-xl bg-white border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 transition-all shrink-0 shadow-sm mt-4 md:mt-0">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-end">
          <button onClick={handleSubmit} disabled={saving}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black py-2.5 px-8 rounded-xl text-sm shadow-md shadow-amber-200/50 flex items-center justify-center gap-2 transition-all w-full md:w-auto">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={16} />}
            اعتماد وصرف
          </button>
        </div>
      </div>

      {/* ========================================= */}
      {/* 2. BOTTOM SECTION: HISTORICAL LEDGER      */}
      {/* ========================================= */}
      <div className="mt-8 pt-8 border-t border-slate-200">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-200 shadow-sm">
                <History size={20} />
              </div>
              <h2 className="text-lg font-black text-slate-800">
                سجل الصرف
                {ledgerTotalItems > 0 && <span className="mr-2 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">(تم العثور على {ledgerTotalItems} عملية صرف)</span>}
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
                    placeholder="بحث برقم الإيصال، الموظف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>

                <div className="w-full md:w-64 relative group">
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    list="item-filter-list"
                    placeholder="جميع الأصناف..."
                    value={itemSearchText}
                    onChange={(e) => {
                      setItemSearchText(e.target.value);
                      const matched = items.find(i => i.name === e.target.value);
                      setItemFilter(matched ? matched.id : '');
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-8 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                  {itemSearchText && (
                    <button
                      onClick={() => { setItemSearchText(''); setItemFilter(''); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                      title="مسح الصنف"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <datalist id="item-filter-list">
                    {items.map(item => (
                      <option key={item.id} value={item.name} />
                    ))}
                  </datalist>
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
                      onClick={() => { setDateFilter(f.id); setLedgerPage(1); }}
                      className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                        dateFilter === f.id ? 'bg-white text-amber-700 shadow-sm' : 'hover:bg-white/40'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {dateFilter === 'custom' && (
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
                    onClick={() => { setStartDate(''); setEndDate(''); setDateFilter('all'); setLedgerPage(1); }}
                    className="px-4 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-colors"
                  >
                    إعادة تعيين
                  </button>
                  <button 
                    onClick={() => { setLedgerPage(1); fetchLedger(); }} 
                    disabled={!startDate || !endDate}
                    className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-xl font-bold text-xs hover:bg-amber-100 disabled:opacity-50 transition-colors"
                  >
                    تطبيق الفلتر
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto min-h-[300px] rounded-2xl border border-slate-200">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-4 text-right font-black w-[30%]">الصنف</th>
                  <th className="px-5 py-4 text-right font-black w-[12%]">نوع الصنف</th>
                  <th className="px-5 py-4 text-right font-black w-[15%]">الكمية</th>
                  <th className="px-5 py-4 text-right font-black w-[20%]">الجهة / القسم</th>
                  <th className="px-5 py-4 text-right font-black w-[18%]">التاريخ</th>
                  <th className="px-5 py-4 text-center font-black w-[5%]">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {ledgerLoading && ledgerData.length === 0 ? (
                  <tr><td colSpan="6" className="p-12 text-center text-slate-400 font-bold">جاري التحميل...</td></tr>
                ) : ledgerData.length === 0 ? (
                  <tr><td colSpan="6" className="p-12 text-center text-slate-400 font-bold">لا يوجد عمليات صرف حديثة</td></tr>
                ) : (
                  ledgerData.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-black text-slate-800 truncate max-w-[250px]" title={tx.item_name}>
                        {tx.items_count > 1 ? (
                          <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs font-black">
                            <Layers size={12} /> {getSmartItemText(tx.items_count)}
                          </span>
                        ) : (
                          tx.item_name
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-bold text-xs">{tx.items_count > 1 ? '-' : (tx.item_unit || '-')}</td>
                      <td className="px-5 py-4 text-right">
                        <span dir="ltr" className="font-black text-amber-600 text-base">
                          -{parseInt(tx.total_quantity || tx.quantity, 10).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-bold max-w-[180px] truncate" title={tx.destination_entity || 'غير محدد'}>
                        {tx.destination_entity || 'غير محدد'}
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-bold">
                        <span dir="ltr">{new Date(tx.created_at).toLocaleDateString('en-GB')} - {new Date(tx.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button 
                          className="p-2 text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-xl transition-all border border-indigo-100 shadow-sm"
                          title="عرض التفاصيل"
                          onClick={() => setSelectedTransaction(tx)}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {!ledgerLoading && ledgerTotalPages > 1 && (
            <div className="mt-4 p-4 border-t border-slate-100 bg-slate-50 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">
                صفحة {ledgerPage} من {ledgerTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={ledgerPage === 1}
                  onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                  className="p-2 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  disabled={ledgerPage === ledgerTotalPages}
                  onClick={() => setLedgerPage(p => Math.min(ledgerTotalPages, p + 1))}
                  className="p-2 rounded-lg bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      
      <TransactionDetailsModal
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        transaction={selectedTransaction}
      />
      {showFilePreview && form.document && (
        <DocumentPreviewOverlay 
          fileUrl={URL.createObjectURL(form.document)} 
          fileType={form.document.type}
          onClose={() => setShowFilePreview(false)} 
        />
      )}

      {/* Modal for Quantity Warning */}
      <LimitExceededModal 
        quantityWarning={quantityWarning} 
        onClose={() => setQuantityWarning(null)} 
      />
    
      {selectedBatch && (
        <BatchDetailsModal mode="outbound" themeColor="amber"
          isOpen={!!selectedBatch}
          onClose={() => setSelectedBatch(null)}
          batch={selectedBatch}
          onRevoke={handleRevokeBatch}
          isProcessing={!!processingRevoke}
        />
      )}

    </div>
  );
};

export default IssueStock;

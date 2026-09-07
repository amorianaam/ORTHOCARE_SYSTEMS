import React, { useState, useEffect } from 'react';
import { Beaker, ArrowLeftRight, Check, Package, Layers, Plus, X, ChevronDown, Info, Minus, Search, Filter, History, Calendar, RotateCcw } from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';

const Manufacturing = () => {
  const { token } = useAuthStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSearchText, setItemSearchText] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [ledger, setLedger] = useState([]);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reversing, setReversing] = useState(false);

  const [source, setSource] = useState({
    item_id: '',
    search_name: '',
    selected_unit: '',
    available_units: [],
    quantity: ''
  });

  const [destination, setDestination] = useState({
    item_id: '',
    search_name: '',
    selected_unit: '',
    available_units: [],
    quantity: '',
    manual_cost: ''
  });

  const [openSourceUnitDropdown, setOpenSourceUnitDropdown] = useState(false);
  const [openDestUnitDropdown, setOpenDestUnitDropdown] = useState(false);

  
  const fetchLedger = async () => {
    try {
      const res = await fetch('/api/inventory/or/manufacturing', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setLedger(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [token]);

  const handleReverse = (order) => {
    setReverseTarget(order);
  };

  const handleConfirmReverse = async () => {
    if (!reverseTarget) return;
    setReversing(true);
    try {
      const res = await fetch(`/api/inventory/or/manufacturing/${reverseTarget.id}/reverse`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchLedger();
        setReverseTarget(null);
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('حدث خطأ في الاتصال بالخادم');
    } finally {
      setReversing(false);
    }
  };


  useEffect(() => {
    fetch('/api/inventory/or/items', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setItems(Array.isArray(data) ? data : []))
      .catch(() => toast.error('فشل جلب الأصناف'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSourceSearchChange = (value) => {
    const newSource = { ...source, search_name: value };
    const matchedItems = items.filter(i => 
      i.name.trim().toLowerCase() === value.trim().toLowerCase() && !i.is_manufactured
    );
    
    if (matchedItems.length === 0) {
      newSource.item_id = '';
      newSource.selected_unit = '';
      newSource.available_units = [];
    } else if (matchedItems.length === 1) {
      newSource.item_id = matchedItems[0].id;
      newSource.selected_unit = matchedItems[0].unit || 'علبة لتر';
      newSource.available_units = [matchedItems[0].unit || 'علبة لتر'];
    } else {
      newSource.item_id = ''; 
      newSource.selected_unit = '';
      newSource.available_units = matchedItems.map(i => i.unit || 'علبة لتر');
    }
    
    setSource(newSource);
  };

  const handleSourceUnitChange = (unitValue) => {
    const newSource = { ...source, selected_unit: unitValue };
    const exactMatch = items.find(i => 
      i.name.trim().toLowerCase() === newSource.search_name.trim().toLowerCase() && 
      (i.unit || 'علبة لتر').trim().toLowerCase() === unitValue.trim().toLowerCase() && !i.is_manufactured
    );
    newSource.item_id = exactMatch ? exactMatch.id : '';
    setSource(newSource);
  };

  const handleDestSearchChange = (value) => {
    const newDest = { ...destination, search_name: value };
    const matchedItems = items.filter(i => 
      i.name.trim().toLowerCase() === value.trim().toLowerCase() && i.is_manufactured
    );
    
    if (matchedItems.length === 0) {
      newDest.item_id = '';
      newDest.selected_unit = '';
      newDest.available_units = [];
      newDest.manual_cost = '';
    } else if (matchedItems.length === 1) {
      newDest.item_id = matchedItems[0].id;
      newDest.selected_unit = matchedItems[0].unit || 'علبة لتر';
      newDest.available_units = [matchedItems[0].unit || 'علبة لتر'];
      newDest.manual_cost = matchedItems[0].cost_price || '';
    } else {
      newDest.item_id = ''; 
      newDest.selected_unit = '';
      newDest.available_units = matchedItems.map(i => i.unit || 'علبة لتر');
      newDest.manual_cost = '';
    }
    
    setDestination(newDest);
  };

  const handleDestUnitChange = (unitValue) => {
    const newDest = { ...destination, selected_unit: unitValue };
    const exactMatch = items.find(i => 
      i.name.trim().toLowerCase() === newDest.search_name.trim().toLowerCase() && 
      (i.unit || 'علبة لتر').trim().toLowerCase() === unitValue.trim().toLowerCase()
    );
    newDest.item_id = exactMatch ? exactMatch.id : '';
    newDest.manual_cost = exactMatch ? (exactMatch.cost_price || '') : destination.manual_cost;
    setDestination(newDest);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!source.item_id) return toast.error('يرجى تحديد المادة الخام بشكل صحيح.');
    if (!destination.item_id && !destination.search_name) return toast.error('يرجى تحديد المادة المنتجة بشكل صحيح.');
    if (source.item_id && source.item_id === destination.item_id) {
      return toast.error('لا يمكن أن يكون الصنف الخام هو نفسه الصنف المنتج');
    }
    
    // Convert to integers since we use parseInt for inputs now
    const destCost = parseInt(destination.manual_cost || 0);
    const destQty = parseInt(destination.quantity || 0);
    const sourceQty = parseInt(source.quantity || 0);

    if (destCost < 0) {
      return toast.error('يرجى تحديد التكلفة اليدوية للمادة المنتجة.');
    }
    if (destQty <= 0 || sourceQty <= 0) {
      return toast.error('يجب أن تكون الكميات المدخلة أكبر من الصفر.');
    }

    const rawItem = items.find(i => i.id == source.item_id);
    if (rawItem && sourceQty > parseInt(rawItem.quantity)) {
      return toast.error(`الكمية المطلوبة من ${rawItem.name} تتجاوز المتوفر (${rawItem.quantity})`);
    }

    setSaving(true);
    try {
      const payload = {
        raw_item_id: source.item_id,
        raw_quantity: sourceQty,
        produced_item_id: destination.item_id || undefined,
          produced_item_name: destination.item_id ? undefined : destination.search_name,
          produced_item_unit: destination.item_id ? undefined : destination.selected_unit,
        produced_quantity: destQty,
        waste_percentage: 0,
        manual_cost: destCost
      };

      const res = await fetch('/api/inventory/or/manufacturing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setSource({ item_id: '', search_name: '', selected_unit: '', available_units: [], quantity: '' });
        setDestination({ item_id: '', search_name: '', selected_unit: '', available_units: [], quantity: '', manual_cost: '' });
        const itemsRes = await fetch('/api/inventory/or/items', { headers: { Authorization: `Bearer ${token}` } });
        const itemsData = await itemsRes.json();
        setItems(Array.isArray(itemsData) ? itemsData : []);
        fetchLedger();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم.');
    } finally {
      setSaving(false);
    }
  };

  const selectedSourceItem = items.find(i => i.id == source.item_id);
  const sourceAvailable = selectedSourceItem ? parseInt(selectedSourceItem.quantity, 10) : 0;

  const rawMaterialsDatalist = items.filter(i => !i.is_manufactured && i.quantity > 0);
  const manufacturedItemsDatalist = items.filter(i => i.is_manufactured);

  
  const filteredLedger = ledger.filter(order => {
    let match = true;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!order.raw_item_name?.toLowerCase().includes(q) &&
          !order.produced_item_name?.toLowerCase().includes(q)) {
        match = false;
      }
    }

    if (dateFilter !== 'all' && match) {
      const orderDate = new Date(order.created_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        if (orderDate < today) match = false;
      } else if (dateFilter === '7days') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        if (orderDate < sevenDaysAgo) match = false;
      } else if (dateFilter === '30days') {
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        if (orderDate < thirtyDaysAgo) match = false;
      } else if (dateFilter === 'custom') {
        if (dateRange.start) {
          const start = new Date(dateRange.start);
          start.setHours(0, 0, 0, 0);
          if (orderDate < start) match = false;
        }
        if (dateRange.end) {
          const end = new Date(dateRange.end);
          end.setHours(23, 59, 59, 999);
          if (orderDate > end) match = false;
        }
      }
    }

    return match;
  });

  return (
    <div dir="rtl" className="space-y-6 pb-4">
      {/* ─── HEADER ─── */}
<div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-800 text-white flex items-center justify-center shadow-lg">
            <Beaker size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-800">التصنيع والتحويل الداخلي</h1>
            <p className="text-sm font-bold text-gray-500 mt-0.5">تحويل المواد الخام أو المستهلكات إلى مواد منتجة للاستخدام في العمليات</p>
          </div>
        </div>
      </div>

      <div className="hidden">
        <datalist id="raw-items-datalist">
          {[...new Set(rawMaterialsDatalist.map(i => i.name))].map((name, idx) => <option key={idx} value={name} />)}
        </datalist>

        <datalist id="all-items-datalist">
          {[...new Set(manufacturedItemsDatalist.map(i => i.name))].map((name, idx) => <option key={idx} value={name} />)}
        </datalist>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* 1. SOURCE BLOCK */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-50">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100/50">
              <Package size={15} />
            </div>
            <h2 className="font-black text-sm text-slate-800">تحديد المادة الخام (المصدر)</h2>
          </div>

          <div className="flex flex-col md:flex-row items-end gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-amber-200 transition-colors shadow-sm">
            <div className="w-full md:w-[30%] shrink-0">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <label className="block text-[11px] font-bold text-slate-500">بحث أو اختيار الصنف</label>
                {source.item_id ? (
                  <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100/50">
                    <Check size={12} /> متوفر ({sourceAvailable})
                  </span>
                ) : source.search_name && source.available_units?.length > 1 ? (
                  <span className="text-[10px] font-bold text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100/50">
                    <Info size={12} /> الرجاء تحديد النوع
                  </span>
                ) : source.search_name ? (
                  <span className="text-[10px] font-bold text-red-500 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-md border border-red-100/50">
                    <X size={12} /> غير موجود
                  </span>
                ) : null}
              </div>
              <input 
                required
                list="raw-items-datalist" 
                value={source.search_name || ''} 
                onChange={e => handleSourceSearchChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all h-[38px]" 
                placeholder="بحث أو اختيار الصنف..."
              />
            </div>

            <div className="w-full md:w-36 shrink-0 relative">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 px-1">نوع الصنف</label>
              {(!source.available_units || source.available_units.length <= 1) ? (
                <input
                  type="text"
                  disabled
                  value={source.selected_unit || ''}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 cursor-not-allowed transition-all h-[38px]"
                  placeholder="-"
                />
              ) : (
                <div className="relative">
                  <div 
                    onClick={() => setOpenSourceUnitDropdown(!openSourceUnitDropdown)}
                    className={`w-full bg-white border ${openSourceUnitDropdown ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-200 hover:border-amber-300'} rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 transition-all h-[38px] cursor-pointer flex items-center justify-between group`}
                  >
                    <span className="truncate">{source.selected_unit || 'اختر...'}</span>
                    <ChevronDown size={14} className={`text-slate-400 group-hover:text-amber-500 transition-transform duration-200 ${openSourceUnitDropdown ? 'rotate-180 text-amber-500' : ''}`} />
                  </div>
                  
                  {openSourceUnitDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenSourceUnitDropdown(false)}></div>
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in origin-top">
                        <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                          {source.available_units.map((u, i) => (
                            <div 
                              key={i} 
                              onClick={() => {
                                handleSourceUnitChange(u);
                                setOpenSourceUnitDropdown(false);
                              }}
                              className={`px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer transition-all flex items-center justify-between border ${source.selected_unit === u ? 'bg-amber-50 text-amber-700 border-amber-200/60' : 'text-slate-600 border-transparent hover:bg-amber-50/40 hover:text-amber-600 hover:border-amber-200/40'}`}
                            >
                              <span className="truncate">{u}</span>
                              {source.selected_unit === u && <Check size={14} />}
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
                  onClick={() => setSource({...source, quantity: Math.max(1, (parseInt(source.quantity || 0) - 1))})}
                  className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <input 
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={source.quantity} 
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setSource({...source, quantity: val});
                  }}
                  className="flex-1 w-full min-w-0 bg-transparent text-xs font-black text-slate-700 text-center focus:outline-none" 
                  placeholder="0" 
                />
                <button 
                  type="button"
                  tabIndex="-1"
                  onClick={() => setSource({...source, quantity: (parseInt(source.quantity || 0) + 1)})}
                  className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2. DESTINATION BLOCK */}
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-50">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100/50">
              <Layers size={15} />
            </div>
            <h2 className="font-black text-sm text-slate-800">بيانات المادة المنتجة</h2>
          </div>

          <div className="flex flex-col md:flex-row items-end gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-colors shadow-sm">
            <div className="w-full md:w-[30%] shrink-0">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <label className="block text-[11px] font-bold text-slate-500">بحث أو اختيار الصنف</label>
                {destination.item_id ? (
                  <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/50">
                    <Check size={12} /> تم التحديد
                  </span>
                ) : destination.search_name && destination.available_units?.length > 1 ? (
                  <span className="text-[10px] font-bold text-orange-600 flex items-center gap-1 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100/50">
                    <Info size={12} /> الرجاء تحديد النوع
                  </span>
                ) : destination.search_name ? (
                  <span className="text-[10px] font-bold text-red-500 flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-md border border-red-100/50">
                    <X size={12} /> غير موجود
                  </span>
                ) : null}
              </div>
              <input 
                required
                list="all-items-datalist" 
                value={destination.search_name || ''} 
                onChange={e => handleDestSearchChange(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all h-[38px]" 
                placeholder="بحث أو اختيار الصنف..."
              />
            </div>

            <div className="w-full md:w-36 shrink-0 relative">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 px-1">نوع الصنف</label>
              {(!destination.available_units || destination.available_units.length <= 1) ? (
                <input
                  type="text"
                  disabled
                  value={destination.selected_unit || ''}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 cursor-not-allowed transition-all h-[38px]"
                  placeholder="-"
                />
              ) : (
                <div className="relative">
                  <div 
                    onClick={() => setOpenDestUnitDropdown(!openDestUnitDropdown)}
                    className={`w-full bg-white border ${openDestUnitDropdown ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300'} rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 transition-all h-[38px] cursor-pointer flex items-center justify-between group`}
                  >
                    <span className="truncate">{destination.selected_unit || 'اختر...'}</span>
                    <ChevronDown size={14} className={`text-slate-400 group-hover:text-emerald-500 transition-transform duration-200 ${openDestUnitDropdown ? 'rotate-180 text-emerald-500' : ''}`} />
                  </div>
                  
                  {openDestUnitDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setOpenDestUnitDropdown(false)}></div>
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in origin-top">
                        <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                          {destination.available_units.map((u, i) => (
                            <div 
                              key={i} 
                              onClick={() => {
                                handleDestUnitChange(u);
                                setOpenDestUnitDropdown(false);
                              }}
                              className={`px-3 py-2 text-[11px] font-bold rounded-xl cursor-pointer transition-all flex items-center justify-between border ${destination.selected_unit === u ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' : 'text-slate-600 border-transparent hover:bg-emerald-50/40 hover:text-emerald-600 hover:border-emerald-200/40'}`}
                            >
                              <span className="truncate">{u}</span>
                              {destination.selected_unit === u && <Check size={14} />}
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
              <div className="relative flex items-center h-[38px] bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all shadow-sm group">
                <button 
                  type="button"
                  tabIndex="-1"
                  onClick={() => setDestination({...destination, quantity: Math.max(1, (parseInt(destination.quantity || 0) - 1))})}
                  className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <input 
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={destination.quantity} 
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setDestination({...destination, quantity: val});
                  }}
                  className="flex-1 w-full min-w-0 bg-transparent text-xs font-black text-slate-700 text-center focus:outline-none" 
                  placeholder="0" 
                />
                <button 
                  type="button"
                  tabIndex="-1"
                  onClick={() => setDestination({...destination, quantity: (parseInt(destination.quantity || 0) + 1)})}
                  className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </div>

            <div className="w-full md:w-36 shrink-0">
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 px-1">سعر الوحدة</label>
              <div className="relative flex items-center h-[38px] bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all shadow-sm group">
                <button 
                  type="button"
                  tabIndex="-1"
                  onClick={() => setDestination({...destination, manual_cost: Math.max(0, (parseInt(destination.manual_cost || 0) - 1))})}
                  className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <input 
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  value={destination.manual_cost ? Number(destination.manual_cost).toLocaleString('en-US') : ''} 
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setDestination({...destination, manual_cost: val});
                  }}
                  className="flex-1 w-full min-w-0 bg-transparent text-xs font-black text-slate-700 text-center focus:outline-none" 
                  placeholder="0" 
                />
                <button 
                  type="button"
                  tabIndex="-1"
                  onClick={() => setDestination({...destination, manual_cost: (parseInt(destination.manual_cost || 0) + 1)})}
                  className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center w-full md:w-auto shrink-0 md:mr-2">
              <div className="h-[38px] flex items-center justify-center gap-1.5 px-4 rounded-xl bg-emerald-50 border-none shrink-0 w-full md:w-auto">
                <span className="text-[11px] font-bold text-emerald-600/80">الإجمالي:</span>
                <span className="font-black text-emerald-700 text-[13px]" dir="ltr">
                  {((parseInt(destination.quantity||0) * parseInt(destination.manual_cost||0))).toLocaleString('en-US')}
                </span>
                <span className="text-[10px] font-bold text-emerald-600/70">ر.ي</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving || !source.item_id || !destination.item_id} 
            className="w-full md:w-auto shrink-0 bg-gray-800 hover:bg-gray-900 text-white border-none flex items-center justify-center gap-2 text-[13px] font-black py-2.5 px-8 rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed h-[42px]">
            {saving ? (
               <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"/>
            ) : (
               <Check size={16} />
            )}
            تأكيد وإتمام التصنيع
          </button>
        </div>

      </form>

      {/* ─── LEDGER SECTION ─── */}
      <div className="mt-8 pt-8 border-t border-slate-200">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col">
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-200 shadow-sm">
                <History size={20} />
              </div>
              <h2 className="text-lg font-black text-slate-800">
                سجل التصنيع
                {filteredLedger.length > 0 && <span className="mr-2 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">(تم العثور على {filteredLedger.length} أمر تصنيع)</span>}
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
                    placeholder="بحث باسم الصنف..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-[11px] font-bold text-slate-500 w-full md:w-auto overflow-x-auto">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'today', label: 'اليوم' },
                    { id: '7days', label: 'هذا الأسبوع' },
                    { id: '30days', label: 'هذا الشهر' },
                    { id: 'custom', label: 'تاريخ مخصص' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDateFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${dateFilter === tab.id ? 'bg-white shadow-sm text-emerald-600' : 'hover:bg-white/50 hover:text-slate-700'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                
                {dateFilter === 'custom' && (
                  <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full md:w-auto animate-fade-in origin-top">
                    <div className="relative">
                      <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <input 
                        type="date" 
                        value={dateRange.start}
                        onChange={e => setDateRange({...dateRange, start: e.target.value})}
                        className="bg-white border border-slate-200 rounded-xl pr-7 pl-2 py-1 text-[11px] font-bold text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-8"
                      />
                    </div>
                    <span className="text-slate-300 text-[10px]">-</span>
                    <div className="relative">
                      <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <input 
                        type="date" 
                        value={dateRange.end}
                        onChange={e => setDateRange({...dateRange, end: e.target.value})}
                        className="bg-white border border-slate-200 rounded-xl pr-7 pl-2 py-1 text-[11px] font-bold text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 h-8"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* --- TABLE --- */}
          <div className="overflow-x-auto min-h-[300px] rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm whitespace-nowrap text-right border-collapse">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-4 font-black w-[20%]">المادة الخام</th>
                  <th className="px-5 py-4 font-black w-[15%]">المستهلك</th>
                  <th className="px-5 py-4 font-black w-[20%]">المادة المنتجة</th>
                  <th className="px-5 py-4 font-black w-[15%]">المنتج</th>
                  <th className="px-5 py-4 font-black w-[15%]">التاريخ</th>
                  <th className="px-5 py-4 font-black w-[10%]">الحالة</th>
                  <th className="px-5 py-4 font-black w-[5%] text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Layers size={32} className="mb-3 opacity-20" />
                          <span className="text-sm font-bold">لا يوجد سجلات مطابقة</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLedger.map(order => {
                    const isExpired = (Date.now() - new Date(order.created_at).getTime()) > 24 * 60 * 60 * 1000;
                    return (
                    <tr key={order.id} className={`hover:bg-slate-50/80 transition-colors ${order.is_reversed ? 'opacity-60 bg-red-50/30' : ''}`}>
                      <td className="px-5 py-4 text-slate-800 font-black text-xs">
                        <div className="flex items-center gap-2">
                          <span title={order.raw_item_name} className="truncate max-w-[150px]">{order.raw_item_name}</span>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">{order.raw_item_unit || '-'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-black text-amber-600 text-sm">-{parseInt(order.raw_quantity, 10).toLocaleString('en-US')}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-800 font-black text-xs">
                        <div className="flex items-center gap-2">
                          <span title={order.produced_item_name} className="truncate max-w-[150px]">{order.produced_item_name}</span>
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">{order.produced_item_unit || '-'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-black text-emerald-600 text-sm">+{parseInt(order.produced_quantity, 10).toLocaleString('en-US')}</span>
                      </td>
                      <td className="px-5 py-4 text-slate-500 font-bold text-xs whitespace-nowrap">
                        <span dir="ltr" className="flex items-center justify-end gap-1.5">{new Date(order.created_at).toLocaleDateString('en-GB')} <span className="text-slate-300">•</span> {new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </td>
                      <td className="px-5 py-4">
                        {order.is_reversed ? (
                          <span className="text-[10px] font-black text-red-600 bg-red-100 px-2.5 py-1 rounded-lg border border-red-200/60 shadow-sm whitespace-nowrap">تم التراجع</span>
                        ) : (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200/60 shadow-sm whitespace-nowrap">معتمد</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {!order.is_reversed && !isExpired && (
                          <button
                            type="button"
                            onClick={() => handleReverse(order)}
                            className="p-2 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white border border-red-100 rounded-xl transition-all shadow-sm group mx-auto flex items-center justify-center"
                            title="تراجع عن التصنيع"
                          >
                            <RotateCcw size={16} strokeWidth={2.5} className="group-hover:-rotate-90 transition-transform duration-300" />
                          </button>
                        )}
                        {!order.is_reversed && isExpired && (
                          <span className="flex items-center justify-center text-slate-300" title="انتهت مهلة التراجع (24 ساعة)">
                            <History size={16} strokeWidth={2.5} />
                          </span>
                        )}
                      </td>
                    </tr>
                  )})}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        onConfirm={handleConfirmReverse}
        loading={reversing}
        title="التراجع عن التصنيع"
        subtitle="إلغاء عملية التصنيع واسترجاع الكميات"
        bodyTitle="هل أنت متأكد من التراجع؟"
        bodyDescription={
          <>
            سيتم استرجاع <span className="text-amber-600 font-black px-1">{parseInt(reverseTarget?.raw_quantity || 0, 10).toLocaleString('en-US')} {reverseTarget?.raw_item_unit}</span> من <span className="font-bold">{reverseTarget?.raw_item_name}</span> 
            وخصم <span className="text-emerald-600 font-black px-1">{parseInt(reverseTarget?.produced_quantity || 0, 10).toLocaleString('en-US')} {reverseTarget?.produced_item_unit}</span> من <span className="font-bold">{reverseTarget?.produced_item_name}</span> من المخزن.
          </>
        }
        confirmLabel="تأكيد التراجع"
        loadingLabel="جاري التراجع..."
        icon={RotateCcw}
      />
    </div>
  );
};

export default Manufacturing;

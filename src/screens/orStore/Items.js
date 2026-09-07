import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Minus, Search, Edit2, AlertCircle, Package, Trash2, Check, X, LayoutList, LayoutGrid, Maximize2, Minimize2, CalendarX, Filter, Activity, TrendingDown, Clock, XCircle, Info, PackagePlus, Edit3, Tag, AlertTriangle, CircleDollarSign, Calendar, AlignLeft, Eye } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import useSocketStore from '../../store/useSocketStore';
import ItemDetailsModal, { ItemEditModal } from '../../components/storeCommon/ItemDetailsModal';
import ConfirmDeleteModal from '../../components/ConfirmDeleteModal';
import taffyot from '../../utils/taffyot';

// ── Main Component ────────────────────────────────────────────────
const Items = () => {
  const { token } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [modal, setModal] = useState({ isOpen: false, item: null });
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, item: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null, loading: false });

  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [stockStatus, setStockStatus] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, outOfStock: 0, expiring: 0 });
  
  const [allUnits, setAllUnits] = useState([]);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    const highlightItemId = location.state?.highlightItemId;
    if (highlightItemId) {
      const fetchHighlightedItem = async () => {
        try {
          const res = await fetch(`/api/inventory/or/items/${highlightItemId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const itemData = await res.json();
          if (res.ok && itemData) {
            setDetailsModal({ isOpen: true, item: itemData });
            navigate(location.pathname, { replace: true, state: {} });
          }
        } catch (error) {
          console.error("Error fetching highlighted item", error);
        }
      };
      fetchHighlightedItem();
    }
  }, [location.state?.highlightItemId, token, navigate, location.pathname]);

  const latestSilentUpdate = useSocketStore(s => s.latestSilentUpdate);

  // Fetch unique units once
  useEffect(() => {
    fetch('/api/inventory/or/items', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAllUnits([...new Set(data.map(i => i.unit).filter(Boolean))].sort());
        }
      })
      .catch(() => {});
  }, [token]);

  const fetchItems = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    lastFetchRef.current = now;
    
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page,
        limit: 10000,
        search,
        unit: filterUnit,
        stockStatus: stockStatus !== 'all' ? stockStatus : '',
        dateFilter: dateFilter !== 'all' ? dateFilter : '',
        startDate,
        endDate
      });
      const res = await fetch(`/api/inventory/or/items?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalItems(data.pagination?.totalItems || 0);
        if (data.stats) setStats(data.stats);
      } else {
        toast.error(data.message || 'فشل تحميل الأصناف');
      }
    } catch {
      toast.error('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [token, page, search, filterUnit, stockStatus, dateFilter, startDate, endDate]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (latestSilentUpdate?.type === 'inventory') fetchItems();
  }, [latestSilentUpdate, fetchItems]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterUnit, stockStatus, dateFilter, startDate, endDate]);

  const confirmDelete = async () => {
    if (!deleteModal.item) return;
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/inventory/or/items/${deleteModal.item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        fetchItems();
      } else {
        toast.error(data.message);
      }
    } catch { toast.error('خطأ في الاتصال'); }
    setDeleteModal({ isOpen: false, item: null, loading: false });
  };

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="text-emerald-600" />
            الأصناف العامة
          </h1>
          <p className="text-gray-500 mt-1">إدارة وتعريف الأصناف في مخزن العمليات</p>
        </div>
        <button onClick={() => setModal({ isOpen: true, item: null })}
          className="btn-primary bg-emerald-600 hover:bg-emerald-700 flex items-center gap-2">
          <Plus size={18} /> صنف جديد
        </button>
      </div>

      {/* Dynamic Ledger Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-400 tracking-wider">إجمالي الأصناف</p>
            <h3 className="text-3xl font-black text-indigo-600">{stats.totalItems}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-100 text-indigo-600 flex items-center justify-center shadow-inner">
            <Package size={26} />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-400 tracking-wider">تحت الحد الأدنى</p>
            <h3 className="text-3xl font-black text-amber-600">{stats.lowStock}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-600 flex items-center justify-center shadow-inner">
            <TrendingDown size={26} />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-400 tracking-wider">أصناف وشيكة على الانتهاء أو منتهية</p>
            <h3 className="text-3xl font-black text-rose-500">{stats.expiring}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-50 to-pink-100 text-rose-500 flex items-center justify-center shadow-inner">
            <Clock size={26} />
          </div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-400 tracking-wider">أصناف نفدت</p>
            <h3 className="text-3xl font-black text-red-600">{stats.outOfStock}</h3>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-50 to-red-100 text-red-600 flex items-center justify-center shadow-inner">
            <XCircle size={26} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
          
          {/* Row 1: Search and Type Filter */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between w-full">
            <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto flex-1">
              {/* Search Bar */}
              <div className="w-full md:w-96 relative group">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
                <input
                  type="text"
                  placeholder="بحث باسم أو وصف الصنف..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                />
              </div>

              {/* Filter by Unit (Datalist) */}
              <div className="w-full md:w-64 relative group shrink-0">
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  list="unit-filter-list"
                  placeholder="كل الأنواع..."
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-8 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-500 transition-all"
                />
                {filterUnit && (
                  <button
                    onClick={() => setFilterUnit('')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                    title="مسح الصنف"
                  >
                    <X size={14} />
                  </button>
                )}
                <datalist id="unit-filter-list">
                  {allUnits.map(u => <option key={u} value={u} />)}
                </datalist>
              </div>
            </div>
          </div>

          {/* Row 2: Status and Date Filters */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 w-full border-t border-slate-200/60 pt-4 mt-1">
            
            {/* Stock Status Buttons */}
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="flex flex-wrap gap-1.5 bg-gray-100 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500 flex-1 lg:flex-none">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'low', label: 'قريبة من الحد' },
                  { id: 'out', label: 'نفدت' },
                  { id: 'expiring', label: 'وشيكة أو منتهية' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStockStatus(f.id)}
                    className={`px-4 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                      stockStatus === f.id ? 'bg-white text-emerald-700 shadow-sm' : 'hover:bg-white/40'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Filter Buttons */}
            <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto overflow-hidden">
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
                    onClick={() => setDateFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                      dateFilter === f.id ? 'bg-white text-emerald-700 shadow-sm' : 'hover:bg-white/40'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Custom Date Range Picker */}
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
                  onClick={() => { setStartDate(''); setEndDate(''); setDateFilter('all'); setPage(1); }}
                  className="px-4 py-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold transition-colors"
                >
                  إعادة تعيين
                </button>
                <button 
                  onClick={() => setPage(1)}
                  className="px-4 py-1.5 text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold transition-colors shadow-sm"
                >
                  تطبيق الفلتر
                </button>
              </div>
            </div>
          )}
        </div>

        {(search || filterUnit || stockStatus !== 'all' || dateFilter !== 'all') && (
          <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 text-xs font-bold text-emerald-700">
            تم العثور على {totalItems} صنف
          </div>
        )}

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-5 py-4 text-right font-black w-[5%]">ID</th>
                <th className="px-5 py-4 text-right font-black w-[25%]">الصنف</th>
                <th className="px-5 py-4 text-right font-black w-[10%]">نوع الصنف</th>
                <th className="px-5 py-4 text-right font-black w-[12%]">الكمية المتوفرة</th>
                <th className="px-5 py-4 text-right font-black w-[18%]">القيمة الإجمالية</th>
                <th className="px-5 py-4 text-right font-black w-[10%]">الحد الأدنى</th>
                <th className="px-5 py-4 text-right font-black w-[12%]">تاريخ الإنتهاء</th>
                <th className="px-5 py-4 text-center font-black w-[8%]">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i}><td colSpan="8" className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-gray-400">
                    <Package size={40} className="mx-auto mb-3 opacity-20" />
                    <p>لا توجد أصناف مطابقة للبحث</p>
                  </td>
                </tr>
              ) : items.map((item, index) => {
                const qty = parseInt(item.quantity || 0, 10);
                const minQty = parseInt(item.min_quantity || 0, 10);
                const isLow = qty <= minQty && qty > 0;
                const isOut = qty === 0;
                const totalCost = qty * parseInt(item.cost_price || 0, 10);
                
                return (
                  <tr key={item.id} onClick={() => setDetailsModal({ isOpen: true, item })} className="hover:bg-gray-50 transition-colors cursor-pointer">
                    <td className="px-5 py-4 font-mono text-gray-500 text-xs align-middle">{index + 1}</td>
                    <td className="px-5 py-4 align-middle font-bold text-gray-900 truncate max-w-[200px]" title={item.name}>
                      {item.name}
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-600 align-middle">{item.unit}</td>
                    <td className="px-5 py-4 align-middle">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold ${
                        isOut ? 'bg-red-50 text-red-700 border border-red-100' :
                        isLow ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                        'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {qty}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-gray-900 text-base" dir="ltr">{totalCost.toLocaleString('en-US')}</span>
                          <span className="text-[10px] font-bold text-gray-400">ر.ي</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 leading-tight block whitespace-normal min-w-[150px]">{taffyot(totalCost)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-500 align-middle text-right" dir="ltr">{minQty.toLocaleString('en-US')}</td>
                    <td className="px-5 py-4 text-sm font-medium align-middle">
                      {item.expiry_date ? (
                        <span className="text-gray-700">{new Date(item.expiry_date).toLocaleDateString('en-GB')}</span>
                      ) : (
                        <span className="text-gray-300 font-bold">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="flex gap-2 justify-center">
                        <button onClick={(e) => { e.stopPropagation(); setDetailsModal({ isOpen: true, item }); }}
                          className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white border border-indigo-100 shadow-sm rounded-xl transition-all" title="التفاصيل">
                          <Eye size={16} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setModal({ isOpen: true, item }); }}
                          className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-100 shadow-sm rounded-xl transition-all" title="تعديل">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={(e) => { 
                          e.stopPropagation(); 
                          if (parseFloat(item.quantity) > 0) {
                            toast.error('تعذر الحذف: يتوفر رصيد مخزني حالي لهذا الصنف. يُرجى أولاً تصفير الكمية (عبر شاشة الصرف) لتتمكن من حذفه.');
                          } else {
                            setDeleteModal({ isOpen: true, item: item, loading: false }); 
                          }
                        }}
                          className="p-2 text-red-600 bg-red-50 hover:bg-red-600 hover:text-white border border-red-100 shadow-sm rounded-xl transition-all" title="حذف">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>


      </div>

      {modal.isOpen && (
        <ItemEditModal storeType="or" 
          item={modal.item} 
          items={items} 
          onClose={() => setModal({ isOpen: false, item: null })}
          onSaved={() => {
            setModal({ isOpen: false, item: null });
            fetchItems();
            if (detailsModal.isOpen && detailsModal.item?.id === modal.item?.id) {
              setDetailsModal({ isOpen: false, item: null }); // close details if saved from edit
            }
          }}
          token={token}
        />
      )}

      {detailsModal.isOpen && (
        <ItemDetailsModal storeType="or" 
          item={detailsModal.item}
          token={token}
          onClose={() => setDetailsModal({ isOpen: false, item: null })}
          onEdit={(item) => {
            setModal({ isOpen: true, item });
          }}
          onDelete={(item) => { setDeleteModal({ isOpen: true, item: item, loading: false }); }}
          fetchItems={() => {
            fetchItems();
          }}
        />
      )}

      <ConfirmDeleteModal 
        isOpen={deleteModal.isOpen}
        loading={deleteModal.loading}
        itemName={deleteModal.item?.name}
        onClose={() => setDeleteModal({ isOpen: false, item: null, loading: false })}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default Items;

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Search, Star, Trash2, FlaskConical, Radiation, Layers,
  Stethoscope, Grid, List, Maximize, Minimize, Save, Plus,
  Crown, ChevronLeft, ChevronDown, Filter
} from 'lucide-react';
import { toast } from 'react-toastify';
import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: compute final_price from a service item
// ─────────────────────────────────────────────────────────────────────────────
function calcFinal(svc) {
  if (svc.is_free) {
    return { discount_amount: svc.price, final_price: 0 };
  }
  const pct = parseFloat(svc.discount_percentage) || 0;
  const discount_amount = (svc.price * pct) / 100;
  return { discount_amount, final_price: svc.price - discount_amount };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dept metadata
// ─────────────────────────────────────────────────────────────────────────────
const DEPTS = [
  { id: 'lab',       label: 'التحاليل المخبرية', activeClass: 'bg-blue-600 text-white shadow-blue-200 shadow-md',   Icon: FlaskConical },
  { id: 'radiology', label: 'الأشعة التشخيصية',  activeClass: 'bg-rose-600 text-white shadow-rose-200 shadow-md',   Icon: Radiation     },
  { id: 'clinical',  label: 'الخدمات السريرية',   activeClass: 'bg-emerald-600 text-white shadow-emerald-200 shadow-md', Icon: Layers    },
  { id: 'bundles',   label: 'الباقات الجاهزة',    activeClass: 'bg-violet-600 text-white shadow-violet-200 shadow-md', Icon: Crown       },
  { id: 'favorites', label: 'المفضلة',            activeClass: 'bg-amber-500 text-white shadow-amber-200 shadow-md',  Icon: Star          },
];

// ─────────────────────────────────────────────────────────────────────────────
// Status badge helper
// ─────────────────────────────────────────────────────────────────────────────
function svcTypeBadge(svcType) {
  if (svcType === 'lab')       return 'bg-blue-50 text-blue-700';
  if (svcType === 'radiology') return 'bg-rose-50 text-rose-700';
  return 'bg-emerald-50 text-emerald-700';
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundle Card Component
// ─────────────────────────────────────────────────────────────────────────────
const BundleCard = ({ bundle, catalogs, onImport, isVIP }) => {
  const [expanded, setExpanded] = useState(false);

  const resolvedItems = useMemo(() => {
    return (bundle.items || []).map(bi => {
      const arr = catalogs[bi.test_type] || [];
      const found = arr.find(c => c.id === bi.test_id);
      return found ? { ...found, svcType: bi.test_type } : null;
    }).filter(Boolean);
  }, [bundle.items, catalogs]);

  const totalOriginal = resolvedItems.reduce((acc, curr) => {
    const p = curr.svcType === 'radiology' ? (curr.price_with_film ?? curr.price) : curr.price;
    return acc + p;
  }, 0);

  return (
    <div className="border border-violet-200 bg-white rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
      <div 
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-violet-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
            <Crown size={18} />
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-gray-800">{bundle.name}</h4>
            <div className="flex flex-col mt-1">
              <span className="text-[10px] text-gray-400 font-bold">{resolvedItems.length} خدمات مشمولة</span>
              {totalOriginal > 0 && <span className="text-[11px] font-black text-violet-700 mt-0.5">الإجمالي: {isVIP ? 'مجاني' : totalOriginal + ' ريال'}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onImport(); }}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-black shadow-sm transition-colors hover-lift"
          >
            إضافة الباقة
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-violet-100 bg-violet-50/30 p-2 space-y-1">
          {resolvedItems.map((svc, idx) => {
            const p = svc.svcType === 'radiology' ? (svc.price_with_film ?? svc.price) : svc.price;
            return (
              <div key={idx} className="flex justify-between items-center py-1.5 px-2 bg-white rounded-lg border border-violet-100/50">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${svc.svcType === 'lab' ? 'bg-blue-400' : svc.svcType === 'radiology' ? 'bg-rose-400' : 'bg-emerald-400'}`}></div>
                  <span className="text-[10px] font-black text-gray-700">{svc.name}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-500">
                  {isVIP ? 'مجاني' : `${p} ريال`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SmartFilterDropdown Component
// ─────────────────────────────────────────────────────────────────────────────
const SmartFilterDropdown = ({ options, selectedCat, onSelectCat }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    (opt.name === '' ? 'الكل' : opt.name).toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (name) => {
    onSelectCat(name);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors focus:border-blue-400 focus:ring-1 focus:ring-blue-100 min-w-[140px] justify-between"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Filter size={13} className="text-gray-400 flex-shrink-0" />
          <span className="truncate">{selectedCat === '' ? 'الكل' : selectedCat}</span>
        </div>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-gray-100 shadow-xl rounded-xl z-50 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-50">
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
              <input
                type="text"
                placeholder="ابحث في التصنيفات..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="w-full pl-2 pr-7 py-1.5 text-[11px] font-bold bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-[11px] text-gray-400">لا توجد تصنيفات</div>
            ) : (
              filteredOptions.map(opt => (
                <button
                  key={opt.name}
                  onClick={() => handleSelect(opt.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-right transition-colors text-[11px] font-bold
                    ${selectedCat === opt.name ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="truncate">{opt.name === '' ? 'الكل' : opt.name}</span>
                  {opt.count !== undefined && (
                    <span className={`text-[10px] px-1.5 rounded-md ${selectedCat === opt.name ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {opt.count}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SmartOrderModal
// Props:
//   isOpen, onClose, visit, catalogs, favoriteTests, bundles,
//   onToggleFavorite, onOrderSubmit, token
// ─────────────────────────────────────────────────────────────────────────────
export default function SmartOrderModal({
  isOpen,
  onClose,
  visit,
  catalogs = { lab: [], radiology: [], clinical: [] },
  favoriteTests = [],
  bundles = [],
  onToggleFavorite,
  onOrderSubmit,
  onOrderSuccess,
  token,
}) {
  // ── Guards ──────────────────────────────────────────────────────────────────
  const isVIP = visit?.is_exempt === true || visit?.is_exempt === 1;

  // ── State ───────────────────────────────────────────────────────────────────
  const [basket, setBasket]             = useState([]);
  const [activeDept, setActiveDept]     = useState('lab');
  const [activeCat, setActiveCat]       = useState('');
  const [searchTerm, setSearchTerm]     = useState('');
  const [viewMode, setViewMode]         = useState('grid');   // 'grid' | 'list'
  const [isMaximized, setIsMaximized]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [basketOpen, setBasketOpen]     = useState(true);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setBasket([]);
      setActiveDept('lab');
      setSearchTerm('');
    }
  }, [isOpen]);

  // ── Categorized catalog ──────────────────────────────────────────────────────
  const categorized = useMemo(() => {
    const group = (items, type) => {
      const map = {};
      (items || []).forEach(item => {
        const cat = item.category_name || (type === 'lab' ? 'تحاليل عامة' : type === 'radiology' ? 'أشعة عامة' : 'خدمات عامة');
        if (!map[cat]) map[cat] = { name: cat, items: [] };
        map[cat].items.push({ ...item, svcType: type });
      });
      return Object.values(map);
    };
    return {
      lab:       group(catalogs.lab,      'lab'),
      radiology: group(catalogs.radiology, 'radiology'),
      clinical:  group(catalogs.clinical,  'clinical'),
    };
  }, [catalogs]);

  // Reset activeCat when dept changes
  useEffect(() => {
    setActiveCat('');
  }, [activeDept]);

  // ── Display items ────────────────────────────────────────────────────────────
  const allDeptItems = useMemo(() => {
    if (activeDept === 'bundles') {
      return bundles;
    }
    if (activeDept === 'favorites') {
      return [
        ...catalogs.lab.filter(i => favoriteTests.some(f => f.test_id === i.id && f.test_type === 'lab')).map(i => ({ ...i, svcType: 'lab' })),
        ...catalogs.radiology.filter(i => favoriteTests.some(f => f.test_id === i.id && f.test_type === 'radiology')).map(i => ({ ...i, svcType: 'radiology' })),
        ...catalogs.clinical.filter(i => favoriteTests.some(f => f.test_id === i.id && f.test_type === 'clinical')).map(i => ({ ...i, svcType: 'clinical' })),
      ];
    }
    return (categorized[activeDept] || []).flatMap(c => c.items);
  }, [activeDept, categorized, catalogs, favoriteTests, bundles]);

  const filterOptions = useMemo(() => {
    if (activeDept === 'favorites') {
      return [
        { name: '', count: allDeptItems.length },
        { name: 'التحاليل المخبرية' },
        { name: 'الأشعة التشخيصية' },
        { name: 'الخدمات السريرية' }
      ];
    }
    if (activeDept === 'bundles') {
      return [];
    }
    const cats = categorized[activeDept] || [];
    return [
      { name: '', count: allDeptItems.length },
      ...cats.map(c => ({ name: c.name, count: c.items?.length || 0 }))
    ];
  }, [activeDept, categorized, allDeptItems]);

  const displayItems = useMemo(() => {
    let items = allDeptItems;

    // Filter by category
    if (activeCat !== '') {
      if (activeDept === 'favorites') {
        const typeMap = {
          'التحاليل المخبرية': 'lab',
          'الأشعة التشخيصية': 'radiology',
          'الخدمات السريرية': 'clinical'
        };
        const stype = typeMap[activeCat];
        if (stype) items = items.filter(i => i.svcType === stype);
      } else if (activeDept !== 'bundles') {
        items = items.filter(i => {
          const catName = i.category_name || (i.svcType === 'lab' ? 'تحاليل عامة' : i.svcType === 'radiology' ? 'أشعة عامة' : 'خدمات عامة');
          return catName === activeCat;
        });
      }
    }

    // Filter by search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.category_name?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [searchTerm, activeDept, activeCat, allDeptItems]);

  // ── Basket helpers ───────────────────────────────────────────────────────────
  const buildItem = useCallback((svc) => {
    const basePrice = svc.svcType === 'radiology' ? (svc.price_with_film ?? svc.price) : svc.price;
    const base = {
      ...svc,
      price: basePrice,
      price_with_film: svc.price_with_film,
      price_without_film: svc.price_without_film,
      withFilm: svc.svcType === 'radiology' ? true : undefined,
      discount_percentage: isVIP ? 100 : 0,
      is_free: isVIP ? true : false,
    };
    const { discount_amount, final_price } = calcFinal(base);
    return { ...base, discount_amount, final_price };
  }, [isVIP]);

  const addItem = useCallback((svc) => {
    if (basket.some(s => s.id === svc.id && s.svcType === svc.svcType)) return;
    setBasket(prev => [...prev, buildItem(svc)]);
  }, [basket, buildItem]);

  const removeItem = (idx) => setBasket(prev => prev.filter((_, i) => i !== idx));

  const clearBasket = () => setBasket([]);

  const updateItem = (idx, field, val) => {
    if (isVIP) return; // VIP: no manual overrides
    setBasket(prev => prev.map((s, i) => {
      if (i !== idx) return s;
      let updated = { ...s, [field]: val };

      // Recalc base price if film toggle changes
      if (field === 'withFilm') {
        updated.price = val
          ? (s.price_with_film ?? s.price)
          : (s.price_without_film ?? s.price);
      }

      const { discount_amount, final_price } = calcFinal(updated);
      return { ...updated, discount_amount, final_price };
    }));
  };

  // ── Toggle ALL in current view ───────────────────────────────────────────────
  const allSelected = displayItems.length > 0 && displayItems.every(i =>
    basket.some(s => s.id === i.id && s.svcType === i.svcType)
  );

  const handleToggleAll = () => {
    if (allSelected) {
      setBasket(prev => prev.filter(s => !displayItems.some(d => d.id === s.id && d.svcType === s.svcType)));
    } else {
      const toAdd = displayItems.filter(d => !basket.some(s => s.id === d.id && s.svcType === d.svcType));
      setBasket(prev => [...prev, ...toAdd.map(buildItem)]);
    }
  };

  // ── Bundle import ────────────────────────────────────────────────────────────
  const handleImportBundle = (bundle) => {
    if (!bundle?.items?.length) return;
    bundle.items.forEach(item => {
      const dept = item.test_type;
      const catalogArr = catalogs[dept] || [];
      const found = catalogArr.find(c => c.id === item.test_id);
      if (!found) return;
      const svc = { ...found, svcType: dept };
      if (!basket.some(s => s.id === svc.id && s.svcType === dept)) {
        setBasket(prev => [...prev, buildItem(svc)]);
      }
    });
    toast.success(`تم إدراج باقة "${bundle.name}"`);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!basket.length) return toast.warning('لم تقم بتحديد خدمات');
    setSubmitting(true);
    try {
      const payload = {
        labTests:        basket.filter(s => s.svcType === 'lab'),
        radiologyTests:  basket.filter(s => s.svcType === 'radiology'),
        clinicalServices: basket.filter(s => s.svcType === 'clinical'),
      };
      if (onOrderSubmit) {
        await onOrderSubmit(payload);
      } else {
        const headers = { Authorization: `Bearer ${token}` };
        await axios.post(`/api/doctor/visit/${visit?.visitId}/order-services`, payload, { headers });
        toast.success('تم إرسال الطلبات بنجاح');
        if (onOrderSuccess) onOrderSuccess();
      }
      setBasket([]);
      onClose();
    } catch {
      toast.error('خطأ في إرسال الطلبات');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      dir="rtl"
    >
      {/* Modal container */}
      <div
        className={`bg-white flex flex-col border border-gray-100 shadow-2xl transition-all duration-300 animate-scale-in
          ${isMaximized ? 'w-screen h-screen rounded-none' : 'w-full max-w-7xl h-[90vh] rounded-3xl overflow-hidden'}`}
      >

        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-blue-50/40 via-white to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
              <Stethoscope size={18} />
            </div>
            <div>
              <h3 className="font-black text-base text-gray-800">كتالوج الخدمات والفحوصات</h3>
              <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                {visit?.full_name}
                {isVIP && (
                  <span className="mr-2 inline-flex items-center gap-1 text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg">
                    <Crown size={9} /> إعفاء VIP — كل الخدمات مجانية تلقائياً
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 gap-1">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="شبكي"><Grid size={15} /></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`} title="قائمة"><List size={15} /></button>
            </div>
            <button onClick={() => setIsMaximized(m => !m)} className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all border border-gray-200">
              {isMaximized ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <button onClick={onClose} className="p-2 rounded-xl bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-all border border-red-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── BODY: Two-Pane ──────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT PANE — Dept tabs + Bundles */}
          <div className="w-52 flex-shrink-0 border-l border-gray-100 flex flex-col bg-gray-50/50 overflow-y-auto">
            <div className="p-3 space-y-1.5">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block px-2 mb-2">الأقسام</span>
              {DEPTS.map(dept => {
                const isActive = activeDept === dept.id;
                return (
                  <button
                    key={dept.id}
                    onClick={() => { setActiveDept(dept.id); setSearchTerm(''); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all text-right border
                      ${isActive
                        ? dept.activeClass + ' border-transparent'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'
                      }`}
                  >
                    <dept.Icon size={14} className={isActive ? 'text-white' : 'text-gray-400'} />
                    <span>{dept.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANE — Search + Category tabs + Grid + Basket */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Search and Filter bar */}
            <div className="px-4 py-3 flex-shrink-0 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-2 max-w-3xl">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="بحث سريع بالاسم..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pr-9 pl-8 py-2 text-xs font-bold bg-gray-50 border border-gray-200 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-100 rounded-xl outline-none transition-all"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {filterOptions.length > 0 && (
                  <SmartFilterDropdown 
                    options={filterOptions} 
                    selectedCat={activeCat} 
                    onSelectCat={setActiveCat} 
                  />
                )}

                {(searchTerm || activeCat !== '') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setActiveCat('');
                    }}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-gray-500 hover:text-rose-600 bg-gray-50 hover:bg-rose-50 rounded-xl border border-gray-200 hover:border-rose-200 transition-all flex-shrink-0"
                  >
                    <X size={14} />
                    <span>إعادة تعيين</span>
                  </button>
                )}
              </div>
            </div>

            {/* Toggle ALL + item count bar */}
            {displayItems.length > 0 && (
              <div className="flex justify-between items-center px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex-shrink-0">
                <span className="text-[10px] font-black text-gray-400">
                  {displayItems.length} عنصر متاح
                </span>
                {activeDept !== 'favorites' && !searchTerm && (
                  <button
                    onClick={handleToggleAll}
                    className="text-[10px] font-black text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 px-3 py-1.5 rounded-xl transition-all border border-blue-200 flex items-center gap-1"
                  >
                    {allSelected ? '✕ إلغاء تحديد الكل' : '✓ تحديد وإضافة الكل'}
                  </button>
                )}
              </div>
            )}

            {/* Items grid (top half) */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              {displayItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <Layers size={32} className="mb-2 text-gray-300" />
                  <p className="text-xs font-bold">لا توجد عناصر مطابقة</p>
                </div>
              ) : (
                <div className={`gap-3 ${viewMode === 'grid' ? 'grid grid-cols-2 lg:grid-cols-3 items-start' : 'flex flex-col'}`}>
                  {displayItems.map((item, idx) => {
                    if (activeDept === 'bundles') {
                      return (
                        <BundleCard 
                          key={`bundle_${item.id || idx}`}
                          bundle={item}
                          catalogs={catalogs}
                          onImport={() => handleImportBundle(item)}
                          isVIP={isVIP}
                        />
                      );
                    }

                    const isChecked = basket.some(s => s.id === item.id && s.svcType === item.svcType);
                    const isStarred = favoriteTests.some(f => f.test_id === item.id && f.test_type === item.svcType);
                    const itemPrice = item.svcType === 'radiology' ? (item.price_with_film ?? item.price) : item.price;
                    const ItemIcon = item.svcType === 'lab' ? FlaskConical : item.svcType === 'radiology' ? Radiation : Stethoscope;

                    let checkedCls = 'bg-blue-50/60 border-blue-400 shadow-sm';
                    if (item.svcType === 'radiology') checkedCls = 'bg-rose-50/60 border-rose-400 shadow-sm';
                    if (item.svcType === 'clinical')  checkedCls = 'bg-emerald-50/60 border-emerald-400 shadow-sm';

                    return (
                      <div
                        key={`${item.svcType}_${item.id}`}
                        onClick={() => isChecked ? setBasket(p => p.filter(s => !(s.id === item.id && s.svcType === item.svcType))) : addItem(item)}
                        className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-sm
                          ${isChecked ? checkedCls : 'bg-white border-gray-200 hover:border-blue-300'}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="w-4 h-4 accent-blue-600 rounded flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <ItemIcon size={11} className="text-gray-400 flex-shrink-0" />
                              <p className="font-extrabold text-xs text-gray-800 line-clamp-1">{item.name}</p>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">
                              {item.category_name} ·{' '}
                              <strong className={`font-extrabold font-sans ${isVIP ? 'text-amber-600' : 'text-blue-700'}`}>
                                {isVIP ? 'مجاني' : `${itemPrice} ريال`}
                              </strong>
                            </p>
                          </div>
                        </div>
                        {onToggleFavorite && (
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onToggleFavorite(item, item.svcType); }}
                            className={`p-1.5 rounded-xl flex-shrink-0 transition-all ${isStarred ? 'text-amber-500 bg-amber-50' : 'text-gray-300 hover:text-amber-500 hover:bg-gray-50'}`}
                          >
                            <Star size={13} fill={isStarred ? 'currentColor' : 'none'} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── BASKET TABLE ──────────────────────────────────────────────── */}
            {basket.length > 0 && (
              <div className="flex-shrink-0 border-t border-gray-200 bg-white max-h-64 flex flex-col">
                {/* Basket header */}
                <div className="flex justify-between items-center px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
                  <button
                    onClick={() => setBasketOpen(o => !o)}
                    className="flex items-center gap-2 text-xs font-black text-blue-800"
                  >
                    <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                      {basket.length}
                    </span>
                    🛒 سلة الطلبات المحددة
                    <ChevronLeft size={14} className={`text-gray-400 transition-transform duration-200 ${basketOpen ? '-rotate-90' : ''}`} />
                  </button>
                  <button
                    onClick={clearBasket}
                    className="flex items-center gap-1 text-[10px] font-black text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg border border-transparent hover:border-red-200 transition-all"
                    title="مسح السلة بالكامل"
                  >
                    <Trash2 size={12} />
                    <span>مسح الكل</span>
                  </button>
                </div>

                {basketOpen && (
                  <div className="overflow-y-auto flex-1 scrollbar-thin">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead className="bg-slate-50 text-gray-500 font-black sticky top-0">
                        <tr>
                          <th className="px-4 py-2">اسم الخدمة</th>
                          <th className="px-3 py-2 text-center">النوع</th>
                          <th className="px-3 py-2 text-center">السعر الأصلي</th>
                          {!isVIP && <th className="px-3 py-2 text-center">الخصم %</th>}
                          {!isVIP && <th className="px-3 py-2 text-center">مجاني</th>}
                          {isVIP  && <th className="px-3 py-2 text-center">حالة الإعفاء</th>}
                          <th className="px-3 py-2 text-center font-black text-blue-700">السعر النهائي</th>
                          <th className="px-3 py-2 text-center w-12">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {basket.map((svc, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-2.5">
                              <p className="font-bold text-gray-800 line-clamp-1">{svc.name}</p>
                              {/* Radiology Film toggle — ONLY when is_free */}
                              {svc.svcType === 'radiology' && svc.is_free && !isVIP && (
                                <label className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-rose-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={svc.withFilm ?? true}
                                    onChange={e => updateItem(idx, 'withFilm', e.target.checked)}
                                    className="accent-rose-600 w-3 h-3"
                                  />
                                  {svc.withFilm ? 'مع فيلم' : 'بدون فيلم'}
                                  <span className="text-gray-400 text-[9px]">
                                    ({svc.withFilm ? (svc.price_with_film || 0) : (svc.price_without_film || 0)} ريال أصلي)
                                  </span>
                                </label>
                              )}
                              {/* VIP radiology: film choice (optional) */}
                              {svc.svcType === 'radiology' && isVIP && (
                                <label className="flex items-center gap-1.5 mt-1.5 text-[10px] font-bold text-amber-700 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={svc.withFilm ?? true}
                                    onChange={e => setBasket(prev => prev.map((s, i) => i === idx ? { ...s, withFilm: e.target.checked } : s))}
                                    className="accent-amber-600 w-3 h-3"
                                  />
                                  {svc.withFilm ? 'مع فيلم' : 'بدون فيلم'} (إعفاء)
                                </label>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${svcTypeBadge(svc.svcType)}`}>
                                {svc.svcType === 'lab' ? 'مختبر' : svc.svcType === 'radiology' ? 'أشعة' : 'سريري'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center text-gray-500 font-bold">
                              {svc.price} ريال
                            </td>
                            {/* Discount input — HIDDEN for VIP */}
                            {!isVIP && (
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={svc.discount_percentage}
                                  onChange={e => updateItem(idx, 'discount_percentage', e.target.value)}
                                  disabled={svc.is_free}
                                  className="w-14 text-center text-xs font-bold rounded-lg border border-gray-200 py-1 outline-none focus:border-blue-400 disabled:bg-gray-100 disabled:text-gray-400"
                                />
                              </td>
                            )}
                            {/* Free checkbox — HIDDEN for VIP */}
                            {!isVIP && (
                              <td className="px-3 py-2.5 text-center">
                                <label className="flex items-center justify-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={svc.is_free}
                                    onChange={e => updateItem(idx, 'is_free', e.target.checked)}
                                    className="accent-emerald-600 w-3.5 h-3.5"
                                  />
                                  <span className="text-[10px] font-black text-emerald-700">مجاني</span>
                                </label>
                              </td>
                            )}
                            {/* VIP badge instead */}
                            {isVIP && (
                              <td className="px-3 py-2.5 text-center">
                                <span className="text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
                                  <Crown size={8} /> إعفاء تلقائي
                                </span>
                              </td>
                            )}
                            <td className="px-3 py-2.5 text-center font-black">
                              {svc.is_free
                                ? <span className="text-emerald-600 text-[11px]">مجاني</span>
                                : <span className={`text-[11px] ${svc.final_price < svc.price ? 'text-indigo-700' : 'text-gray-700'}`}>
                                    {svc.final_price} ريال
                                  </span>
                              }
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <button onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-400">إجمالي الخدمات المحددة</p>
            <div className="flex items-center gap-2 mt-0.5">
              <strong className="text-sm font-black text-gray-900">{basket.length} خدمة</strong>
              {basket.length > 0 && (
                <span className="text-xs font-black text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg">
                  إجمالي:{' '}
                  {basket.reduce((sum, s) => sum + (parseFloat(s.final_price) || 0), 0).toFixed(2)} ريال
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl transition-all"
            >
              إلغاء
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || basket.length === 0}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={15} />
              {submitting ? 'جاري الإرسال...' : 'إرسال الطلبات'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

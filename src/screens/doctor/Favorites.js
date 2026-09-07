import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import SearchInput from '../../components/common/SearchInput';
import { createPortal } from 'react-dom';
import {
  Star, Trash2, Plus, Search, FlaskConical, Radiation, Layers,
  Pill, Heart, Award, Check, X, Settings, FolderHeart, Info, Activity, RefreshCcw, Edit2, Maximize2, Minimize2, Grid, LayoutGrid, List, Clock, FileText
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import ComboboxSelect from '../../components/ComboboxSelect';
import MedicationSelect from '../../components/MedicationSelect';

export default function DoctorFavorites() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };

  // Tab State
  const [activeTab, setActiveTab] = useState('meds'); // 'meds' | 'tests' | 'bundles'

  // Data States
  const [favoriteMeds, setFavoriteMeds] = useState([]);
  const [favoriteTests, setFavoriteTests] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [catalogs, setCatalogs] = useState({ lab: [], radiology: [], clinical: [], medications: [] });
  const [loading, setLoading] = useState(true);

  // New Items Forms
  const [isCreatingBundle, setIsCreatingBundle] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState(null);
  const [newBundleName, setNewBundleName] = useState('');
  const [selectedBundleItems, setSelectedBundleItems] = useState([]);
  const [bundleSearchTerm, setBundleSearchTerm] = useState('');

  // Meds & Tests Forms
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [medData, setMedData] = useState({ name: '', dosage: '', frequency: '', duration: '', instructions: '' });
  const [isAddingTest, setIsAddingTest] = useState(false);
  const [testModalTab, setTestModalTab] = useState('lab');
  const [testSearchTerm, setTestSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, item: null, type: '', name: '' });
  const [editingFavTestId, setEditingFavTestId] = useState(null);
  const [selectedFavTestItem, setSelectedFavTestItem] = useState(null);
  
  // Global Modal UX
  const [isMaximized, setIsMaximized] = usePersistentState('doctor_modal_maximized_preference', false);

  // View Mode States
  const [medsViewMode, setMedsViewMode] = usePersistentState('global_layout_preference', 'grid');
  const [testsViewMode, setTestsViewMode] = usePersistentState('global_layout_preference', 'grid');
  const [testsSearchText, setTestsSearchText] = useState('');
  const [bundlesViewMode, setBundlesViewMode] = usePersistentState('global_layout_preference', 'grid');
  const [bundlesSearchText, setBundlesSearchText] = useState('');
  const [bundleModalTab, setBundleModalTab] = useState('lab');
  const [bundleModalViewMode, setBundleModalViewMode] = usePersistentState('global_layout_preference', 'grid');
  const [testModalViewMode, setTestModalViewMode] = usePersistentState('global_layout_preference', 'grid');

  // ─── Fetch All Data ──────────────────────────────────────────────
  const getDisplayPrice = (item) => {
    if (!item) return null;
    return item.price || item.price_with_film || item.cost || item.test_price || null;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [meds, tests, bndls, labCat, radCat, clinCat, medCat] = await Promise.all([
        axios.get('/api/doctor/favorites/medications', { headers }),
        axios.get('/api/doctor/favorites/tests', { headers }),
        axios.get('/api/doctor/favorites/bundles', { headers }),
        axios.get('/api/catalog/lab', { headers }),
        axios.get('/api/catalog/radiology', { headers }),
        axios.get('/api/admin/catalog/clinical-services', { headers }),
        axios.get('/api/admin/catalog/medications', { headers })
      ]);
      setFavoriteMeds(meds.data || []);
      setFavoriteTests(tests.data || []);
      setBundles(bndls.data || []);
      setCatalogs({
        lab: labCat.data || [],
        radiology: radCat.data || [],
        clinical: clinCat.data || [],
        medications: medCat.data || []
      });
    } catch {
      toast.error('فشل في جلب المفضلات والإعدادات');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── CRUD Favorite Medications & Dosages ─────────────────────────
  const confirmDelete = async () => {
    const { item, type } = deleteConfirm;
    if (!item) return;
    try {
      if (type === 'med') {
        await axios.delete(`/api/doctor/favorites/medications/${item}`, { headers });
        toast.success('تمت إزالة الدواء بنجاح');
        setFavoriteMeds(prev => prev.filter(m => m.id !== item));
      } else if (type === 'test') {
        await axios.delete(`/api/doctor/favorites/tests/${item.id}`, { headers });
        toast.success('تم الحذف من المفضلة');
        setFavoriteTests(prev => prev.filter(t => t.id !== item.id));
      } else if (type === 'bundle') {
        await axios.delete(`/api/doctor/favorites/bundles/${item}`, { headers });
        toast.success('تم حذف الحزمة الطبية بنجاح');
        setBundles(prev => prev.filter(b => b.id !== item));
      }
      setDeleteConfirm({ isOpen: false, item: null, type: '', name: '' });
    } catch {
      toast.error('خطأ في الحذف');
    }
  };

  const handleDeleteFavMed = (id) => {
    setDeleteConfirm({ isOpen: true, item: id, type: 'med', name: favoriteMeds.find(m => m.id === id)?.medication_name || 'الدواء' });
  };

  const handleEditFavMed = (item) => {
    setMedData({
      name: item.medication_name,
      dosage: item.dosage || '',
      frequency: item.frequency || '',
      duration: item.duration || '',
      instructions: item.instructions || ''
    });
    setIsAddingMed(true);
  };

  // ─── CRUD Favorite Tests ─────────────────────────────────────────
  const handleDeleteFavTest = (item) => {
    setDeleteConfirm({ isOpen: true, item, type: 'test', name: item.name || 'الفحص' });
  };

  const handleAddFavMedSubmit = async (e) => {
    e.preventDefault();
    if (!medData.name.trim()) return toast.warning('الرجاء إدخال اسم الدواء');
    
    const matchedMed = catalogs.medications.find(m => m.name === medData.name || m.scientific_name === medData.name);
    
    try {
      await axios.post('/api/doctor/favorites/medications', {
        medicationName: medData.name,
        dosage: medData.dosage,
        frequency: medData.frequency,
        duration: medData.duration,
        instructions: medData.instructions
      }, { headers });
      toast.success('تمت حفظ بيانات الدواء بنجاح');
      setIsAddingMed(false);
      setMedData({ name: '', dosage: '', frequency: '', duration: '', instructions: '' });
      const meds = await axios.get('/api/doctor/favorites/medications', { headers });
      setFavoriteMeds(meds.data || []);
    } catch {
      toast.error('خطأ في إضافة الدواء');
    }
  };

  const handleEditFavTest = (item) => {
    setEditingFavTestId(item.id);
    setTestModalTab(item.test_type);
    setTestSearchTerm('');
    const matchedTest = catalogs[item.test_type]?.find(t => t.name === item.name);
    if(matchedTest) {
      setSelectedFavTestItem({ ...matchedTest, test_type: item.test_type, typeLabel: item.test_type === 'lab' ? 'مختبر' : item.test_type === 'radiology' ? 'أشعة' : 'خدمة' });
    }
    setIsAddingTest(true);
  };

  const handleAddFavTestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFavTestItem) return toast.warning('الرجاء اختيار فحص من القائمة المرجعية');
    
    try {
      if (editingFavTestId) {
        await axios.delete(`/api/doctor/favorites/tests/${editingFavTestId}`, { headers });
      }
      await axios.post('/api/doctor/favorites/tests', {
        testId: selectedFavTestItem.id,
        testType: selectedFavTestItem.test_type
      }, { headers });
      toast.success(editingFavTestId ? 'تم تعديل الفحص بنجاح' : 'تمت إضافة الفحص للمفضلة بنجاح');
      setIsAddingTest(false);
      setTestSearchTerm('');
      setSelectedFavTestItem(null);
      setEditingFavTestId(null);
      const tests = await axios.get('/api/doctor/favorites/tests', { headers });
      setFavoriteTests(tests.data || []);
    } catch {
      toast.error('خطأ في حفظ الفحص');
    }
  };

  // ─── CRUD Bundle Packages ────────────────────────────────────────
  const handleToggleBundleSelection = (item, type) => {
    const key = `${type}_${item.id}`;
    const exists = selectedBundleItems.some(s => s.test_id === item.id && s.test_type === type);
    if (exists) {
      setSelectedBundleItems(prev => prev.filter(s => !(s.test_id === item.id && s.test_type === type)));
    } else {
      setSelectedBundleItems(prev => [...prev, { test_id: item.id, test_type: type, name: item.name }]);
    }
  };

  const handleCreateBundleSubmit = async (e) => {
    e.preventDefault();
    if (!newBundleName.trim()) return toast.warning('الرجاء إدخال اسم الحزمة');
    if (selectedBundleItems.length === 0) return toast.warning('الرجاء تحديد فحص واحد على الأقل للحزمة');

    try {
      // If editing, delete the old bundle first
      if (editingBundleId) {
        await axios.delete(`/api/doctor/favorites/bundles/${editingBundleId}`, { headers });
      }

      await axios.post('/api/doctor/favorites/bundles', {
        name: newBundleName,
        items: selectedBundleItems
      }, { headers });
      toast.success('تم حفظ الحزمة المجمّعة المخصصة بنجاح!');
      setIsCreatingBundle(false);
      setEditingBundleId(null);
      setNewBundleName('');
      setSelectedBundleItems([]);
      // Reload bundles
      const bndls = await axios.get('/api/doctor/favorites/bundles', { headers });
      setBundles(bndls.data || []);
    } catch {
      toast.error('خطأ في إنشاء الحزمة');
    }
  };

  const handleDeleteBundle = (id) => {
    setDeleteConfirm({ isOpen: true, item: id, type: 'bundle', name: bundles.find(b => b.id === id)?.name || 'الباقة' });
  };

  const handleEditBundle = (bundle) => {
    setNewBundleName(bundle.name);
    setSelectedBundleItems(bundle.items?.map(i => ({ test_id: i.test_id, test_type: i.test_type, name: i.name })) || []);
    setEditingBundleId(bundle.id);
    setIsCreatingBundle(true);
  };

  // Filter Catalog Items for Bundle Builder
  const filteredCatalogItems = useMemo(() => {
    const all = catalogs[bundleModalTab]?.map(i => ({
      ...i,
      type: bundleModalTab,
      typeLabel: bundleModalTab === 'lab' ? 'مختبر' : bundleModalTab === 'radiology' ? 'أشعة' : 'خدمة سريرية',
      color: bundleModalTab === 'lab' ? 'bg-blue-50 text-blue-700' : bundleModalTab === 'radiology' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
    })) || [];
    if (!bundleSearchTerm.trim()) return all;
    return all.filter(i => i.name?.toLowerCase().includes(bundleSearchTerm.toLowerCase()));
  }, [catalogs, bundleSearchTerm, bundleModalTab]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-6 rounded-3xl shadow-lg text-white border border-indigo-900 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex justify-between items-center">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-700/80 flex items-center justify-center text-amber-400">
              <Star size={24} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-black">إدارة المفضلات والجرعات والقوالب المجمّعة</h1>
              <p className="text-blue-200 text-xs mt-1">تعديل وصيانة مفضلات الأدوية والتحاليل والأشعة وحزم العمل بلمسة واحدة</p>
            </div>
          </div>
          <button onClick={fetchData} className="p-2.5 bg-indigo-900/60 rounded-xl text-blue-100 hover:bg-indigo-800 transition-colors">
            <RefreshCcw size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white p-2 gap-1 text-xs font-bold text-gray-500 rounded-3xl shadow-xs border">
        {[
          { id: 'meds', label: 'مفضلة الأدوية والجرعات', icon: Pill },
          { id: 'tests', label: 'مفضلة الفحوصات الطبية', icon: FlaskConical },
          { id: 'bundles', label: 'الحزم الطبية المجمّعة (Bundles)', icon: FolderHeart }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                : 'hover:bg-gray-50 text-gray-500'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Core content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* TAB A: MEDICATIONS */}
          {activeTab === 'meds' && (
            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-black text-sm text-gray-800 flex items-center justify-between pb-3 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <Pill className="text-indigo-600" size={17} /> الأدوية والتعليمات المحفوظة
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 rounded-lg p-0.5">
                      <button onClick={() => setMedsViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${medsViewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><Grid size={14}/></button>
                      <button onClick={() => setMedsViewMode('list')} className={`p-1.5 rounded-md transition-colors ${medsViewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={14}/></button>
                    </div>
                    <button 
                      onClick={() => setIsAddingMed(true)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus size={14}/> إضافة دواء مفضل
                    </button>
                  </div>
                </h3>
                <div className={`transition-all duration-300 ${medsViewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-2"}`}>
                  {favoriteMeds.length === 0 ? (
                    <div className={`${medsViewMode === 'grid' ? 'col-span-full' : 'w-full'} text-center py-10 text-gray-400 text-xs`}>لا يوجد أدوية محفوظة في المفضلة حالياً.</div>
                  ) : (
                    favoriteMeds.map(item => (
                      medsViewMode === 'grid' ? (
                        <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-150 space-y-2 relative shadow-luxury hover-lift transition-all duration-300">
                          <div className="absolute top-4 left-4 flex items-center gap-1">
                            <button
                              onClick={() => handleEditFavMed(item)}
                              className="p-1.5 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteFavMed(item.id)}
                              className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <h4 className="font-black text-indigo-700 text-xs pl-16 leading-relaxed">{item.medication_name}</h4>
                          <div className="text-[10px] text-gray-500 font-bold space-y-1.5 mt-3 pt-3 border-t border-gray-50">
                            {item.dosage && <p className="flex items-center gap-1.5"><Pill size={12} className="text-indigo-400" /><span className="text-indigo-400">الجرعة:</span> {item.dosage}</p>}
                            {item.frequency && <p className="flex items-center gap-1.5"><RefreshCcw size={12} className="text-indigo-400" /><span className="text-indigo-400">التكرار:</span> {item.frequency}</p>}
                            {item.instructions && <p className="flex items-center gap-1.5"><FileText size={12} className="text-indigo-400" /><span className="text-indigo-400">التعليمات:</span> {item.instructions}</p>}
                            {item.duration && <p className="flex items-center gap-1.5"><Clock size={12} className="text-indigo-400" /><span className="text-indigo-400">المدة:</span> {item.duration}</p>}
                          </div>
                        </div>
                      ) : (
                        <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3.5 rounded-xl border border-gray-150 hover:bg-slate-50 transition-all duration-300 shadow-sm gap-4">
                          <div className="flex-1">
                            <h4 className="font-black text-indigo-700 text-sm mb-2">{item.medication_name}</h4>
                            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                              {item.dosage && <span className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md"><Pill size={12} /> الجرعة: {item.dosage}</span>}
                              {item.frequency && <span className="flex items-center gap-1.5 bg-emerald-50/70 border border-emerald-100 text-emerald-700 px-2.5 py-1 rounded-md"><RefreshCcw size={12} /> التكرار: {item.frequency}</span>}
                              {item.instructions && <span className="flex items-center gap-1.5 bg-rose-50/70 border border-rose-100 text-rose-700 px-2.5 py-1 rounded-md"><FileText size={12} /> ملاحظات: {item.instructions}</span>}
                              {item.duration && <span className="flex items-center gap-1.5 bg-amber-50/70 border border-amber-100 text-amber-700 px-2.5 py-1 rounded-md"><Clock size={12} /> المدة: {item.duration}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleEditFavMed(item)}
                              className="p-2 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteFavMed(item.id)}
                              className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      )
                    ))
                  )}
                </div>
              </div>
          )}

          {/* TAB B: TESTS */}
          {activeTab === 'tests' && (
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h3 className="font-black text-sm text-gray-800 flex items-center justify-between pb-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <FlaskConical className="text-indigo-600" size={17} /> الفحوصات الطبية المفضلة
                </div>
                <div className="flex items-center gap-2">
                  <SearchInput placeholder="بحث في الفحوصات..." value={testsSearchText} onChange={e => setTestsSearchText(e.target.value)} className="hidden md:block w-48" />
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button onClick={() => setTestsViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${testsViewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={18}/></button>
                    <button onClick={() => setTestsViewMode('list')} className={`p-1.5 rounded-md transition-colors ${testsViewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={18}/></button>
                  </div>
                  <button 
                    onClick={() => setIsAddingTest(true)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus size={14}/> إضافة فحص مفضل
                  </button>
                </div>
              </h3>
              <div>
                {favoriteTests.length === 0 ? (
                  <div className={`${testsViewMode === 'grid' ? 'col-span-full' : 'w-full'} text-center py-12 text-gray-400 text-xs`}>لا توجد فحوصات مخبرية أو إشعاعية في المفضلة حالياً.</div>
                ) : (
                  <div className="space-y-8">
                    {/* LAB */}
                    {favoriteTests.filter(t => t.test_type === 'lab').length > 0 && (
                      <div>
                        <h4 className="text-sm font-black text-blue-800 mb-3 flex items-center gap-2"><FlaskConical size={16}/> المختبر</h4>
                        
                    {testsViewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-all duration-300">
                        {favoriteTests.filter(t => t.test_type === 'lab' && (!testsSearchText || t.name.toLowerCase().includes(testsSearchText.toLowerCase()))).map(item => (
                          <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-150 flex flex-col justify-between shadow-luxury hover-lift transition-all duration-300 min-h-[100px] relative group">
                            <div className="absolute top-4 left-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditFavTest(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteFavTest(item)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                            </div>
                            <h4 className="font-black text-slate-800 text-xs leading-relaxed pr-2">{item.name}</h4>
                            <div className="mt-2 pt-2 border-t border-gray-50">
                              <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white shadow-sm">
                        <table className="w-full text-right">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 text-[11px] font-black">
                              <th className="py-3 px-4">المعرف</th>
                              <th className="py-3 px-4">الاسم</th>
                              <th className="py-3 px-4">السعر</th>
                              <th className="py-3 px-4 w-24">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {favoriteTests.filter(t => t.test_type === 'lab' && (!testsSearchText || t.name.toLowerCase().includes(testsSearchText.toLowerCase()))).map(item => (
                              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                <td className="py-3 px-4 text-xs font-bold text-gray-600">#{item?.id || '---'}</td>
                                <td className="py-3 px-4 text-sm font-black text-slate-800">{item?.name || '---'}</td>
                                <td className="py-3 px-4">
                                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                    {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleEditFavTest(item)} className="p-2 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDeleteFavTest(item)} className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                      </div>
                    )}
                    {/* RADIOLOGY */}
                    {favoriteTests.filter(t => t.test_type === 'radiology').length > 0 && (
                      <div>
                        <h4 className="text-sm font-black text-rose-800 mb-3 flex items-center gap-2"><Radiation size={16}/> الأشعة</h4>
                        
                    {testsViewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-all duration-300">
                        {favoriteTests.filter(t => t.test_type === 'radiology' && (!testsSearchText || t.name.toLowerCase().includes(testsSearchText.toLowerCase()))).map(item => (
                          <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-150 flex flex-col justify-between shadow-luxury hover-lift transition-all duration-300 min-h-[100px] relative group">
                            <div className="absolute top-4 left-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditFavTest(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteFavTest(item)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                            </div>
                            <h4 className="font-black text-slate-800 text-xs leading-relaxed pr-2">{item.name}</h4>
                            <div className="mt-2 pt-2 border-t border-gray-50">
                              <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white shadow-sm">
                        <table className="w-full text-right">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 text-[11px] font-black">
                              <th className="py-3 px-4">المعرف</th>
                              <th className="py-3 px-4">الاسم</th>
                              <th className="py-3 px-4">السعر</th>
                              <th className="py-3 px-4 w-24">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {favoriteTests.filter(t => t.test_type === 'radiology' && (!testsSearchText || t.name.toLowerCase().includes(testsSearchText.toLowerCase()))).map(item => (
                              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                <td className="py-3 px-4 text-xs font-bold text-gray-600">#{item?.id || '---'}</td>
                                <td className="py-3 px-4 text-sm font-black text-slate-800">{item?.name || '---'}</td>
                                <td className="py-3 px-4">
                                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                    {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleEditFavTest(item)} className="p-2 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDeleteFavTest(item)} className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                      </div>
                    )}
                    {/* CLINICAL */}
                    {favoriteTests.filter(t => t.test_type === 'clinical').length > 0 && (
                      <div>
                        <h4 className="text-sm font-black text-emerald-800 mb-3 flex items-center gap-2"><Activity size={16}/> الخدمات السريرية</h4>
                        
                    {testsViewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-all duration-300">
                        {favoriteTests.filter(t => t.test_type === 'clinical' && (!testsSearchText || t.name.toLowerCase().includes(testsSearchText.toLowerCase()))).map(item => (
                          <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-150 flex flex-col justify-between shadow-luxury hover-lift transition-all duration-300 min-h-[100px] relative group">
                            <div className="absolute top-4 left-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditFavTest(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"><Edit2 size={14} /></button>
                              <button onClick={() => handleDeleteFavTest(item)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                            </div>
                            <h4 className="font-black text-slate-800 text-xs leading-relaxed pr-2">{item.name}</h4>
                            <div className="mt-2 pt-2 border-t border-gray-50">
                              <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white shadow-sm">
                        <table className="w-full text-right">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 text-[11px] font-black">
                              <th className="py-3 px-4">المعرف</th>
                              <th className="py-3 px-4">الاسم</th>
                              <th className="py-3 px-4">السعر</th>
                              <th className="py-3 px-4 w-24">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody>
                            {favoriteTests.filter(t => t.test_type === 'clinical' && (!testsSearchText || t.name.toLowerCase().includes(testsSearchText.toLowerCase()))).map(item => (
                              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                <td className="py-3 px-4 text-xs font-bold text-gray-600">#{item?.id || '---'}</td>
                                <td className="py-3 px-4 text-sm font-black text-slate-800">{item?.name || '---'}</td>
                                <td className="py-3 px-4">
                                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                    {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => handleEditFavTest(item)} className="p-2 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDeleteFavTest(item)} className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                                  </div>
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
                )}
              </div>
            </div>
          )}

          {/* TAB C: BUNDLES */}
          {activeTab === 'bundles' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
                <p className="text-xs text-gray-400 font-bold">باقات الفحوصات المجمعة لطلب حزمة كاملة بنقرة واحدة</p>
                <div className="flex items-center gap-2">
                  <SearchInput
                    placeholder="بحث في الباقات..."
                    value={bundlesSearchText}
                    onChange={e => setBundlesSearchText(e.target.value)}
                    className="hidden md:block w-48"
                  />
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button onClick={() => setBundlesViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${bundlesViewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={18}/></button>
                    <button onClick={() => setBundlesViewMode('list')} className={`p-1.5 rounded-md transition-colors ${bundlesViewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={18}/></button>
                  </div>
                  <button
                    onClick={() => { setSelectedBundleItems([]); setNewBundleName(''); setEditingBundleId(null); setIsCreatingBundle(true); }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs flex items-center gap-1 shadow-sm"
                  >
                    <Plus size={16} /> إنشاء باقة مجمّعة
                  </button>
                </div>
              </div>

              {/* Bundles list grid */}
              
              {bundlesViewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 transition-all duration-300">
                  {bundles.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-400 text-xs bg-white rounded-3xl border border-gray-100 shadow-sm">لم تقم بإنشاء باقات مجمعة مسبقاً.</div>
                  ) : (
                    bundles.filter(b => (!bundlesSearchText || b.name.toLowerCase().includes(bundlesSearchText.toLowerCase()))).map(bundle => (
                      <div key={bundle.id} className="bg-white rounded-2xl p-5 border border-gray-150 shadow-luxury hover-lift transition-all duration-300 space-y-3 relative group">
                        <div className="absolute top-4 left-4 flex items-center gap-1">
                          <button
                            onClick={() => handleEditBundle(bundle)}
                            className="p-1.5 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteBundle(bundle.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <h4 className="font-black text-indigo-900 text-sm flex items-center gap-1.5 pr-14">
                          <FolderHeart size={16} className="text-indigo-600 flex-shrink-0"/> <span className="truncate">{bundle.name}</span>
                        </h4>
                        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-50">
                          {bundle.items?.map((item, idx) => (
                            <span key={idx} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold border border-gray-200">
                              {item.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white shadow-sm">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-[11px] font-black">
                        <th className="py-3 px-4">المعرف</th>
                        <th className="py-3 px-4">الاسم</th>
                        <th className="py-3 px-4 w-1/2">الفحوصات</th>
                        <th className="py-3 px-4 w-24">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundles.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="text-center py-12 text-gray-400 text-xs">لم تقم بإنشاء باقات مجمعة مسبقاً.</td>
                        </tr>
                      ) : (
                        bundles.filter(b => (!bundlesSearchText || b.name.toLowerCase().includes(bundlesSearchText.toLowerCase()))).map(bundle => (
                          <tr key={bundle.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                            <td className="py-3 px-4 text-xs font-bold text-gray-600">#{bundle?.id || '---'}</td>
                            <td className="py-3 px-4 text-sm font-black text-indigo-900 flex items-center gap-1.5">
                              <FolderHeart size={16} className="text-indigo-600"/> {bundle?.name || '---'}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-1.5">
                                {bundle.items?.map((item, idx) => (
                                  <span key={idx} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-bold border border-gray-200">
                                    {item.name}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleEditBundle(bundle)}
                                  className="p-2 text-indigo-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteBundle(bundle.id)}
                                  className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ─── CREATE BUNDLE MODAL ─── */}
      {isCreatingBundle && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
          <div
            className={`bg-white rounded-3xl shadow-luxury overflow-hidden flex flex-col border border-gray-100 animate-scale-in transition-all duration-300 ${isMaximized ? 'w-[98vw] max-w-[98vw] h-[95vh]' : 'w-[96vw] max-w-6xl mx-auto h-[85vh]'}`}
          >
              {/* Header */}
              <div className="flex justify-between items-center p-5 border-b border-gray-150 flex-shrink-0 bg-gray-50/50">
                <h3 className="font-extrabold text-base text-gray-800 flex items-center gap-2">
                  <FolderHeart size={18} className="text-indigo-600" /> بناء حزمة طبية مجمّعة (Favorite Bundle)
                </h3>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 rounded-xl bg-gray-100 text-gray-500 hover:text-indigo-600">
                    {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button type="button" onClick={() => setIsCreatingBundle(false)} className="p-1.5 rounded-xl bg-gray-100 text-gray-400 hover:text-red-500">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form & List */}
              <form onSubmit={handleCreateBundleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-hidden p-6 ${isMaximized ? 'max-w-full w-full' : ''}`}>
                {/* Catalog list selection (Left) */}
                <div className="md:col-span-8 flex flex-col h-full overflow-hidden">
                  {/* Tab System for Bundle Builder */}
                  <div className="flex gap-2 p-1.5 bg-gray-100/80 rounded-2xl mb-4 flex-shrink-0">
                    {[
                      { id: 'lab', label: 'المختبر', icon: FlaskConical },
                      { id: 'radiology', label: 'الأشعة', icon: Radiation },
                      { id: 'clinical', label: 'الخدمات السريرية', icon: Activity }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => { setBundleModalTab(tab.id); setBundleSearchTerm(''); }}
                        className={`flex-1 py-2.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
                          bundleModalTab === tab.id 
                            ? 'bg-white text-indigo-700 shadow-sm border border-gray-100 scale-[1.02]' 
                            : 'text-gray-500 hover:bg-gray-200/50'
                        }`}
                      >
                        <tab.icon size={14} /> {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                    <SearchInput
                      placeholder={`البحث عن فحص في قائمة ${bundleModalTab === 'lab' ? 'المختبر' : bundleModalTab === 'radiology' ? 'الأشعة' : 'الخدمات'}...`}
                      value={bundleSearchTerm}
                      onChange={e => setBundleSearchTerm(e.target.value)}
                      className="flex-1"
                    />
                    <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                      <button type="button" onClick={() => setBundleModalViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${bundleModalViewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={18}/></button>
                      <button type="button" onClick={() => setBundleModalViewMode('list')} className={`p-1.5 rounded-md transition-colors ${bundleModalViewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={18}/></button>
                    </div>
                  </div>

                                    <div className="flex-1 overflow-y-auto pr-1">
                    {bundleModalViewMode === 'grid' ? (
                      <div className={`grid gap-4 transition-all duration-300 ${isMaximized ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                        {filteredCatalogItems.map(item => {
                          const isChecked = selectedBundleItems.some(s => s.test_id === item.id && s.test_type === item.type);
                          return (
                            <div
                              key={`${item.type}_${item.id}`}
                              onClick={() => handleToggleBundleSelection(item, item.type)}
                              className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-indigo-50/50 border-indigo-300 shadow-sm'
                                  : 'bg-white border-gray-150 hover:border-indigo-150 hover:shadow-md'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                readOnly
                                className="w-4 h-4 mt-1 shrink-0 accent-indigo-600 pointer-events-none"
                              />
                              <div className="flex flex-col flex-1 gap-2 h-full justify-between overflow-hidden">
                                <p className="font-extrabold text-[11px] text-gray-800 line-clamp-2 leading-relaxed" title={item.name}>{item.name}</p>
                                <div className="flex justify-end mt-auto">
                                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                                    {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white shadow-sm">
                        <table className="w-full text-right">
                          <thead>
                            <tr className="bg-gray-50 text-gray-500 text-[11px] font-black">
                              <th className="py-2 px-3">الاسم</th>
                              <th className="py-2 px-3 w-24">السعر</th>
                              <th className="py-2 px-3 w-16 text-center">إضافة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCatalogItems.map(item => {
                              const isChecked = selectedBundleItems.some(s => s.test_id === item.id && s.test_type === item.type);
                              return (
                                <tr key={`${item.type}_${item.id}`} onClick={() => handleToggleBundleSelection(item, item.type)} className={`border-b border-gray-100 transition-colors cursor-pointer ${isChecked ? 'bg-indigo-50/30' : 'hover:bg-gray-50/50'}`}>
                                  <td className="py-2 px-3">
                                    <p className="text-[11px] font-extrabold text-gray-800 line-clamp-1" title={item.name}>{item.name}</p>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap inline-flex items-center">
                                      {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <input type="checkbox" checked={isChecked} readOnly className="w-4 h-4 accent-indigo-600 pointer-events-none" />
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

                {/* Bundle parameters & selected cart (Right) */}
                <div className="md:col-span-4 flex flex-col h-full overflow-hidden bg-slate-50/50 rounded-xl border border-slate-100 p-5 space-y-5">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-2">اسم الباقة الطبية المجمّعة *</label>
                    <input
                      type="text"
                      placeholder="مثال: فحوصات السكري الدورية..."
                      value={newBundleName}
                      onChange={e => setNewBundleName(e.target.value)}
                      className="input-base text-xs font-semibold w-full"
                      required
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2">
                    <span className="text-[10px] font-black text-gray-400 block pb-1 border-b">الفحوصات المحددة للادراج:</span>
                    {selectedBundleItems.length === 0 ? (
                      <div className="text-center py-10">
                        <FolderHeart className="mx-auto text-gray-300 mb-2" size={24} />
                        <p className="text-gray-400 text-[11px] font-bold">لم يتم تحديد فحوصات للحزمة</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 overflow-y-auto max-h-[50vh] pr-1 pb-2">
                        {selectedBundleItems.map((item, idx) => (
                          <div key={idx} className="flex flex-row items-center bg-white p-2.5 rounded-xl border border-gray-150 shadow-sm transition-all group hover:border-red-200">
                            <button
                              type="button"
                              onClick={() => handleToggleBundleSelection({ id: item.test_id }, item.test_type)}
                              className="text-gray-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-colors ml-2 shrink-0"
                            >
                              <Trash2 size={15} />
                            </button>
                            <span className="line-clamp-1 flex-1 font-bold text-gray-800 text-[11px] pl-2" title={item.name}>{item.name}</span>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap inline-flex items-center">
                              {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md"
                  >
                    حفظ وإنشاء الباقة المجمّعة
                  </button>
                </div>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* ─── ADD MEDICATION MODAL ─── */}
      {isAddingMed && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
          <div className={`bg-white rounded-3xl shadow-luxury overflow-hidden flex flex-col border border-gray-100 animate-scale-in transition-all duration-300 ${isMaximized ? 'w-[98vw] h-[98vh]' : 'w-full max-w-2xl'}`}>
            <div className="flex justify-between items-center p-5 border-b border-gray-150 flex-shrink-0 bg-gray-50/50">
              <h3 className="font-extrabold text-base text-gray-800 flex items-center gap-2">
                <Pill size={18} className="text-indigo-600" /> إضافة دواء للمفضلة
              </h3>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 rounded-xl bg-gray-100 text-gray-500 hover:text-indigo-600">
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button type="button" onClick={() => setIsAddingMed(false)} className="p-1.5 rounded-xl bg-gray-100 text-gray-400 hover:text-red-500">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 min-h-0">
              <div className={`${isMaximized ? 'max-w-6xl mx-auto w-full' : ''}`}>
                <form onSubmit={handleAddFavMedSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">اسم الدواء *</label>
                <MedicationSelect
                  value={medData.name}
                  onChange={(val) => setMedData(prev => ({ ...prev, name: val }))}
                  options={catalogs.medications.map(m => m.name || m.scientific_name).filter(Boolean)}
                  placeholder="ابحث عن دواء أو اكتب الاسم مباشرة..."
                  theme="indigo"
                />
              </div>
              <div className={`grid gap-4 transition-all duration-300 ${isMaximized ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">الجرعة (Dosage)</label>
                  <input
                    type="text"
                    list="dosage-suggestions"
                    value={medData.dosage}
                    onChange={e => setMedData(prev => ({ ...prev, dosage: e.target.value }))}
                    placeholder="مثال: 500mg"
                    className="input-base text-xs font-semibold w-full py-2.5"
                  />
                  <datalist id="dosage-suggestions">
                    <option value="125mg" />
                    <option value="250mg" />
                    <option value="500mg" />
                    <option value="1g" />
                    <option value="5ml" />
                    <option value="10ml" />
                    <option value="حبة واحدة" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">التكرار (Frequency)</label>
                  <input
                    type="text"
                    list="frequency-suggestions"
                    value={medData.frequency}
                    onChange={e => setMedData(prev => ({ ...prev, frequency: e.target.value }))}
                    placeholder="مثال: مرتين باليوم"
                    className="input-base text-xs font-semibold w-full py-2.5"
                  />
                  <datalist id="frequency-suggestions">
                    <option value="مرة واحدة يومياً (OD)" />
                    <option value="مرتين يومياً (BID)" />
                    <option value="٣ مرات يومياً (TID)" />
                    <option value="٤ مرات يومياً (QID)" />
                    <option value="عند اللزوم (PRN)" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">ملاحظات/التعليمات</label>
                  <input
                    type="text"
                    list="instructions-suggestions"
                    value={medData.instructions}
                    onChange={e => setMedData(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder="مثال: بعد الأكل"
                    className="input-base text-xs font-semibold w-full py-2.5"
                  />
                  <datalist id="instructions-suggestions">
                    <option value="بعد الأكل" />
                    <option value="قبل الأكل" />
                    <option value="على الريق" />
                    <option value="قبل النوم" />
                    <option value="مع كمية وافرة من الماء" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1.5">المدة (Duration)</label>
                  <input
                    type="text"
                    list="duration-suggestions"
                    value={medData.duration}
                    onChange={e => setMedData(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="مثال: لمدة 5 أيام"
                    className="input-base text-xs font-semibold w-full py-2.5"
                  />
                  <datalist id="duration-suggestions">
                    <option value="لمدة ٣ أيام" />
                    <option value="لمدة ٥ أيام" />
                    <option value="لمدة أسبوع" />
                    <option value="لمدة أسبوعين" />
                    <option value="لمدة شهر" />
                  </datalist>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddingMed(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors">
                  إلغاء
                </button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md">
                  حفظ في المفضلة
                </button>
                </div>
              </form>
            </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── ADD TEST MODAL ─── */}
      {isAddingTest && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
          <div className={`bg-white rounded-3xl shadow-luxury overflow-hidden flex flex-col border border-gray-100 animate-scale-in transition-all duration-300 ${isMaximized ? 'w-[98vw] max-w-[98vw] h-[95vh]' : 'w-[96vw] max-w-6xl mx-auto h-[85vh]'}`}>
            <div className="flex justify-between items-center p-5 border-b border-gray-150 flex-shrink-0 bg-gray-50/50">
              <h3 className="font-extrabold text-base text-gray-800 flex items-center gap-2">
                <FlaskConical size={18} className="text-indigo-600" /> {editingFavTestId ? 'تعديل الفحص' : 'إضافة فحص للمفضلة'}
              </h3>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 rounded-xl bg-gray-100 text-gray-500 hover:text-indigo-600">
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button type="button" onClick={() => { setIsAddingTest(false); setSelectedFavTestItem(null); setEditingFavTestId(null); setTestSearchTerm(''); }} className="p-1.5 rounded-xl bg-gray-100 text-gray-400 hover:text-red-500">
                  <X size={18} />
                </button>
              </div>
            </div>
            <form onSubmit={handleAddFavTestSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0">
               <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-hidden p-6 ${isMaximized ? 'max-w-full w-full' : ''}`}>
                 {/* Left Pane: Catalog */}
                 <div className="md:col-span-8 flex flex-col h-full overflow-hidden">
                    <div className="flex gap-2 p-1.5 bg-gray-100/80 rounded-2xl mb-4 flex-shrink-0">
                      {[
                        { id: 'lab', label: 'المختبر', icon: FlaskConical },
                        { id: 'radiology', label: 'الأشعة', icon: Radiation },
                        { id: 'clinical', label: 'الخدمات السريرية', icon: Activity }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => { setTestModalTab(tab.id); setTestSearchTerm(''); }}
                          className={`flex-1 py-2.5 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
                            testModalTab === tab.id 
                              ? 'bg-white text-indigo-700 shadow-sm border border-gray-100 scale-[1.02]' 
                              : 'text-gray-500 hover:bg-gray-200/50'
                          }`}
                        >
                          <tab.icon size={14} /> {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                      <SearchInput
                        placeholder={`البحث عن فحص في قائمة ${testModalTab === 'lab' ? 'المختبر' : testModalTab === 'radiology' ? 'الأشعة' : 'الخدمات'}...`}
                        value={testSearchTerm}
                        onChange={e => setTestSearchTerm(e.target.value)}
                        className="flex-1"
                      />
                      <div className="flex bg-gray-100 rounded-lg p-0.5 shrink-0">
                        <button type="button" onClick={() => setTestModalViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${testModalViewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={18}/></button>
                        <button type="button" onClick={() => setTestModalViewMode('list')} className={`p-1.5 rounded-md transition-colors ${testModalViewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}><List size={18}/></button>
                      </div>
                    </div>

                                        <div className="flex-1 overflow-y-auto pr-1">
                      {testModalViewMode === 'grid' ? (
                        <div className={`grid gap-4 transition-all duration-300 ${isMaximized ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                          {(catalogs[testModalTab]?.filter(i => !testSearchTerm.trim() || i.name?.toLowerCase().includes(testSearchTerm.toLowerCase())) || []).map(item => {
                            const isSelected = selectedFavTestItem?.id === item.id && selectedFavTestItem?.test_type === testModalTab;
                            return (
                              <div
                                key={item.id}
                                onClick={() => setSelectedFavTestItem({ ...item, test_type: testModalTab, typeLabel: testModalTab === 'lab' ? 'مختبر' : testModalTab === 'radiology' ? 'أشعة' : 'خدمة' })}
                                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-indigo-50/50 border-indigo-300 shadow-sm'
                                    : 'bg-white border-gray-150 hover:border-indigo-150 hover:shadow-md'
                                }`}
                              >
                                <div className={`w-4 h-4 mt-1 shrink-0 rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                                  {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                </div>
                                <div className="flex flex-col flex-1 gap-2 h-full justify-between overflow-hidden">
                                  <p className="font-extrabold text-[11px] text-gray-800 line-clamp-2 leading-relaxed" title={item.name}>{item.name}</p>
                                  <div className="flex justify-end mt-auto">
                                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                                      {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white shadow-sm">
                          <table className="w-full text-right">
                            <thead>
                              <tr className="bg-gray-50 text-gray-500 text-[11px] font-black">
                                <th className="py-2 px-3">الاسم</th>
                                <th className="py-2 px-3 w-24">السعر</th>
                                <th className="py-2 px-3 w-16 text-center">اختيار</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(catalogs[testModalTab]?.filter(i => !testSearchTerm.trim() || i.name?.toLowerCase().includes(testSearchTerm.toLowerCase())) || []).map(item => {
                                const isSelected = selectedFavTestItem?.id === item.id && selectedFavTestItem?.test_type === testModalTab;
                                return (
                                  <tr key={item.id} onClick={() => setSelectedFavTestItem({ ...item, test_type: testModalTab, typeLabel: testModalTab === 'lab' ? 'مختبر' : testModalTab === 'radiology' ? 'أشعة' : 'خدمة' })} className={`border-b border-gray-100 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50/30' : 'hover:bg-gray-50/50'}`}>
                                    <td className="py-2 px-3">
                                      <p className="text-[11px] font-extrabold text-gray-800 line-clamp-1" title={item.name}>{item.name}</p>
                                    </td>
                                    <td className="py-2 px-3">
                                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap inline-flex items-center">
                                        {getDisplayPrice(item) ? `${getDisplayPrice(item)} ريال` : '---'}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                      <div className={`w-4 h-4 mx-auto rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
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

                 {/* Right Pane: Selected Details */}
                 <div className="md:col-span-4 flex flex-col h-full overflow-hidden bg-slate-50/50 rounded-xl border border-slate-100 p-5 space-y-5">
                    <div className="flex-1 overflow-y-auto">
                      <span className="text-[10px] font-black text-gray-400 block pb-1 border-b mb-4">الفحص المحدد:</span>
                      {!selectedFavTestItem ? (
                        <div className="text-center py-10">
                          <FlaskConical className="mx-auto text-gray-300 mb-2" size={24} />
                          <p className="text-gray-400 text-[11px] font-bold">لم يتم تحديد فحص</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 overflow-y-auto max-h-[30vh]">
                          <div className="flex flex-row items-center bg-white p-3 rounded-xl border border-indigo-200 shadow-md transition-all">
                            <div className="flex flex-col gap-1 flex-1 overflow-hidden pr-2">
                              <span className="line-clamp-2 font-black text-indigo-900 text-[12px] leading-relaxed" title={selectedFavTestItem.name}>{selectedFavTestItem.name}</span>
                              <span className={`w-fit px-2 py-0.5 rounded text-[9px] font-black ${selectedFavTestItem.test_type === 'lab' ? 'bg-blue-50 text-blue-700' : selectedFavTestItem.test_type === 'radiology' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {selectedFavTestItem.typeLabel}
                              </span>
                            </div>
                            <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg shrink-0 mr-3">
                              {getDisplayPrice(selectedFavTestItem) ? `${getDisplayPrice(selectedFavTestItem)} ريال` : '---'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 flex justify-end gap-2 border-t border-gray-150">
                      <button type="button" onClick={() => { setIsAddingTest(false); setSelectedFavTestItem(null); setEditingFavTestId(null); setTestSearchTerm(''); }} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors">
                        إلغاء
                      </button>
                      <button type="submit" className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md">
                        {editingFavTestId ? 'حفظ التعديلات' : 'إضافة للمفضلة'}
                      </button>
                    </div>
                 </div>
               </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── CUSTOM DELETE CONFIRMATION MODAL ─── */}
      {deleteConfirm.isOpen && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
          <div className="bg-white rounded-3xl shadow-luxury overflow-hidden flex flex-col border border-gray-100 animate-scale-in transition-all duration-300 w-full max-w-md">
            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                <Trash2 size={32} />
              </div>
              <h3 className="font-extrabold text-lg text-gray-800">تأكيد الحذف</h3>
              <p className="text-gray-500 text-sm font-semibold leading-relaxed">
                هل أنت متأكد من حذف <span className="text-red-500 font-black">{deleteConfirm.name}</span> من المفضلة؟
              </p>
            </div>
            <div className="flex gap-3 p-4 bg-gray-50/50 border-t border-gray-150">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, item: null, type: '', name: '' })}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl text-sm transition-colors"
              >
                إلغاء
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl text-sm shadow-md transition-colors"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

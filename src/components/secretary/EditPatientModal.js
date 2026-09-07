import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Save, X, ChevronDown } from 'lucide-react';
import { toast } from 'react-toastify';

export default function EditPatientModal({ patient, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: patient.full_name || '',
    age: patient.age || '',
    gender: patient.gender || 'male',
    phone: patient.phone || '',
    chronicDiseases: patient.chronic_diseases || '',
    allergies: patient.allergies || '',
    currentMedications: patient.current_medications || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) return toast.error('الاسم مطلوب');
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('تم تحديث بيانات المريض');
        onSaved();
        onClose();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error('تعذر الاتصال بالخادم');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto overflow-hidden max-h-[90vh] flex flex-col transform transition-all">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-l from-teal-50 to-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <Pencil size={17} className="text-teal-600" />
            <h3 className="font-bold text-gray-800">تعديل بيانات المريض</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">الاسم الكامل *</label>
            <input 
              value={form.fullName} 
              onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
              required 
              className="input-base" 
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">العمر *</label>
              <input 
                type="number" min="0" max="150" 
                value={form.age}
                onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                className="input-base" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">الجنس</label>
              <div className="relative">
                <select 
                  value={form.gender} 
                  onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                  className="input-base appearance-none"
                >
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
                <ChevronDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">رقم الهاتف</label>
            <input 
              value={form.phone} 
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              type="tel" className="input-base" placeholder="09XXXXXXXX" 
            />
          </div>

        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button 
            onClick={handleSubmit} 
            disabled={saving}
            className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-black py-2.5 px-8 rounded-xl text-xs transition-all shadow-md shadow-teal-100/50 flex items-center justify-center gap-2 flex-1"
          >
            {saving ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Save size={14} />}
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl text-xs font-black bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

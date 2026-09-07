import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  UserPlus, Shield, ShieldOff, Key, X, Eye, EyeOff,
  User, Users, Check, AlertCircle, ChevronDown, Maximize2, Minimize2
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore';

const ROLE_LABELS = {
  doctor:               { label: 'طبيب',              color: 'bg-blue-50 text-blue-700 border border-blue-200/50' },
  secretary:            { label: 'سكرتير',            color: 'bg-slate-50 text-slate-700 border border-slate-200/50' },
  cashier:              { label: 'محاسب',              color: 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' },
  lab:                  { label: 'مختبر',              color: 'bg-amber-50 text-amber-700 border border-amber-200/50' },
  radiology:            { label: 'أشعة',              color: 'bg-purple-50 text-purple-700 border border-purple-200/50' },
  surgery_coordinator:  { label: 'منسق عمليات',       color: 'bg-orange-50 text-orange-700 border border-orange-200/50' },
  or_store:             { label: 'مخزن العمليات',     color: 'bg-rose-50 text-rose-700 border border-rose-200/50' },
  general_store:        { label: 'المخزن العام',      color: 'bg-teal-50 text-teal-700 border border-teal-200/50' },
  auditor:              { label: 'مدير التقارير',      color: 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' },
};

// ── Add User Modal ─────────────────────────────────────────────────
const AddUserModal = ({ onClose, onSuccess, token, users }) => {
  const [form, setForm] = useState({ fullName: '', username: '', role: 'secretary', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation: prevent adding same role if it already exists
    if (users && users.some(u => u.role === form.role)) {
      return toast.error('هذا الدور الوظيفي مخصص لمستخدم موجود بالفعل ولا يمكن تكراره.');
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('تم إنشاء المستخدم بنجاح');
        onSuccess();
        onClose();
      } else toast.error(data.message);
    } catch { toast.error('فشل الاتصال بالخادم'); }
    finally { setLoading(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir="rtl">
      {/* Modal container */}
      <div className="bg-white flex flex-col border border-gray-100 shadow-2xl transition-all duration-300 animate-scale-in w-full max-w-3xl max-h-[90vh] rounded-3xl overflow-hidden">
        
        {/* ── HEADER ─────────────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/40 via-white to-white flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
              <UserPlus size={24} />
            </div>
            <div>
              <h3 className="font-black text-lg text-gray-800">إضافة مستخدم جديد</h3>
              <p className="text-xs text-gray-500 font-bold mt-1">
                إنشاء حساب جديد وتخصيص صلاحيات الدخول للنظام
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 rounded-xl bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-all border border-red-100 shadow-sm">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── BODY ──────────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-visible p-8 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">الاسم الكامل *</label>
                <input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                  required className="w-full h-12 px-5 bg-white border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all outline-none text-base font-bold shadow-sm" placeholder="الاسم الكامل للمستخدم" />
              </div>
              
              {/* Username */}
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">اسم المستخدم *</label>
                <input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  required autoComplete="username" className="w-full h-12 px-5 bg-white border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all outline-none text-base font-bold shadow-sm" placeholder="username" dir="ltr" />
              </div>

              {/* Role */}
              <div className="relative">
                <label className="block text-sm font-black text-slate-700 mb-2">الدور الوظيفي *</label>
                <div 
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="w-full h-12 px-5 bg-white border border-slate-200 hover:border-blue-300 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-sm"
                >
                  <span className="text-base font-black text-slate-800">
                    {ROLE_LABELS[form.role]?.label}
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${showRoleMenu ? 'rotate-180' : ''}`} />
                </div>
                
                {showRoleMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowRoleMenu(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-100 shadow-xl rounded-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                      <div className="max-h-64 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {Object.entries(ROLE_LABELS).map(([key, val]) => {
                          const isTaken = users && users.some(u => u.role === key);
                          return (
                            <div 
                              key={key} 
                              onClick={() => { 
                                if (isTaken) {
                                  toast.error('هذا الدور محجوز لمستخدم موجود بالفعل');
                                  return;
                                }
                                setForm(p => ({...p, role: key})); 
                                setShowRoleMenu(false); 
                              }}
                              className={`px-4 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-between ${
                                isTaken 
                                  ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-60' 
                                  : form.role === key 
                                    ? 'bg-blue-50 text-blue-700 cursor-pointer' 
                                    : 'text-slate-600 hover:bg-slate-50 cursor-pointer'
                              }`}
                              title={isTaken ? 'مستخدم مسبقاً' : ''}
                            >
                              <span className="flex items-center gap-2">
                                {val.label}
                                {isTaken && <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-1 rounded-md font-black tracking-wide">مستخدم</span>}
                              </span>
                              {form.role === key && <Check size={18} className="text-blue-600" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-black text-slate-700 mb-2">كلمة المرور المؤقتة *</label>
                <div className="relative">
                  <input value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    required autoComplete="new-password" type={showPass ? 'text' : 'password'} className="w-full h-12 px-5 pl-12 bg-white border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 rounded-xl transition-all outline-none text-base font-bold shadow-sm" placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors">
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Alert */}
            <div className="bg-amber-50 border border-amber-200/50 p-4 rounded-xl mt-6 flex items-start gap-3 shadow-sm">
              <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800 font-black leading-relaxed">سيُطلب من المستخدم تغيير كلمة المرور عند أول دخول كإجراء أمني.</p>
            </div>
          </div>

          {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-gray-100 bg-gray-50/50 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-sm rounded-xl transition-all shadow-sm">
              إلغاء
            </button>
            <button type="submit" disabled={loading} className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <Check size={18} />}
              {loading ? 'جاري الحفظ...' : 'إنشاء المستخدم'}
            </button>
          </div>
        </form>

      </div>
    </div>,
    document.body
  );
};

// ── Reset Password Modal ───────────────────────────────────────────
const ResetPasswordModal = ({ user, onClose, token }) => {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); onClose(); }
      else toast.error(data.message);
    } catch { toast.error('فشل الاتصال'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" dir="rtl">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Key size={20} />
            </div>
            <h3 className="font-bold text-slate-800">إعادة تعيين كلمة المرور</h3>
          </div>
          <p className="text-sm text-slate-500 mb-5 mr-12 mt-[-6px]">للمستخدم: <span className="font-semibold text-slate-700">{user.full_name}</span></p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="new-password" type={showPass ? 'text' : 'password'} 
                className="w-full h-11 px-4 pl-10 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-xl transition-all outline-none"
                placeholder="كلمة المرور الجديدة" minLength={6} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
              <button type="submit" disabled={loading} className="flex-1 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                {loading ? 'جاري الحفظ...' : 'تأكيد الحفظ'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ── Main User Management Screen ────────────────────────────────────
const UserManagement = () => {
  const { token } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [resetUser, setResetUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch { toast.error('فشل تحميل المستخدمين'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/toggle`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message); fetchUsers(); }
      else toast.error(data.message);
    } catch { toast.error('فشل التحديث'); }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Banner / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Users className="text-blue-600" />
            إدارة المستخدمين
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-semibold">
            إدارة حسابات المستخدمين وصلاحيات الدخول. إجمالي {users.length} مستخدم مسجل في النظام.
          </p>
        </div>
        
        <button onClick={() => setShowAddModal(true)} className="px-5 py-2.5 bg-blue-600 text-white font-black text-xs rounded-xl hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2">
          <UserPlus size={16} />
          إضافة مستخدم جديد
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[13px] font-bold">
              <tr>
                {['المستخدم', 'اسم الدخول', 'الدور', 'آخر دخول', 'الحالة', 'إجراءات'].map(h => (
                  <th key={h} className="px-6 py-4 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1,2,3].map(i => (
                  <tr key={i} className="border-b border-slate-50">
                    {[1,2,3,4,5,6].map(j => (
                      <td key={j} className="px-6 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.map((u) => {
                const role = ROLE_LABELS[u.role] || { label: u.role, color: 'bg-slate-50 text-slate-600 border border-slate-200/50' };
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50/50 transition-colors border-b border-slate-50 group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
                          {u.full_name?.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-800">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500 text-xs font-semibold">{u.username}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-xl ${role.color}`}>
                        {role.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('ar') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center text-xs font-black px-3 py-1.5 rounded-xl ${
                        u.is_active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50' : 'bg-rose-50 text-rose-600 border border-rose-200/50'
                      }`}>
                        {u.is_active ? 'نشط' : 'موقوف'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggle(u.id)}
                          title={u.is_active ? 'تعطيل' : 'تفعيل'}
                          className={`p-2 rounded-xl border transition-colors shadow-sm ${
                            u.is_active
                              ? 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100 hover:border-rose-200'
                              : 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-200'
                          }`}
                        >
                          {u.is_active ? <ShieldOff size={16} /> : <Shield size={16} />}
                        </button>
                        <button
                          onClick={() => setResetUser(u)}
                          title="إعادة تعيين كلمة المرور"
                          className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm"
                        >
                          <Key size={16} />
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

      {/* Modals Container */}
      {showAddModal && (
        <AddUserModal
          token={token}
          users={users}
          onClose={() => setShowAddModal(false)}
          onSuccess={fetchUsers}
        />
      )}
      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          token={token}
          onClose={() => setResetUser(null)}
        />
      )}
    </div>
  );
};

export default UserManagement;

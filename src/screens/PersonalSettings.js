import React, { useState, useEffect } from 'react';
import {
  User, Lock, Eye, EyeOff, Save, CheckCircle,
  Shield, Bell, Info, Sun, Moon
} from 'lucide-react';
import { toast } from 'react-toastify';
import useAuthStore from '../store/useAuthStore';

// ── Section Card ────────────────────────────────────────────────────
const SectionCard = ({ icon: Icon, title, color, children }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
    <div className={`flex items-center gap-3 px-6 py-4 border-b border-slate-100 ${color}`}>
      <div className="w-10 h-10 rounded-xl bg-white/50 border border-slate-200/50 flex items-center justify-center">
        <Icon size={18} />
      </div>
      <h3 className="font-bold text-slate-800">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ── Password Field ─────────────────────────────────────────────────
const PasswordField = ({ label, value, onChange, placeholder, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full h-11 px-4 pl-10 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-xl transition-all outline-none text-sm font-semibold text-slate-800"
        />
        <button type="button" onClick={() => setShow(!show)}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────
const PersonalSettings = () => {
  const { user, token, login } = useAuthStore();

  // Profile form
  const [profile, setProfile] = useState({ fullName: user?.fullName || user?.full_name || '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [pass, setPass] = useState({ current: '', new: '', confirm: '' });
  const [savingPass, setSavingPass] = useState(false);

  // Theme & Security
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [securityModalText, setSecurityModalText] = useState('');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = (selectedTheme) => {
    setTheme(selectedTheme);
    localStorage.setItem('theme', selectedTheme);
    if (selectedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const ROLE_LABELS = {
    doctor: 'طبيب', secretary: 'سكرتير', cashier: 'محاسب',
    lab: 'مختبر', radiology: 'أشعة', surgery_coordinator: 'منسق عمليات',
    or_store: 'مخزن العمليات', general_store: 'المخزن العام', auditor: 'مدير التقارير',
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profile.fullName.trim()) return toast.error('الاسم مطلوب');
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fullName: profile.fullName }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('تم تحديث بيانات الملف الشخصي');
        login({ ...user, fullName: profile.fullName }, token);
      } else {
        toast.error(data.message || 'فشل التحديث');
      }
    } catch {
      toast.error('تعذر الاتصال بالخادم');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!pass.current) return toast.error('أدخل كلمة المرور الحالية');
    if (pass.new.length < 6) return toast.error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل');
    if (pass.new !== pass.confirm) return toast.error('كلمة المرور الجديدة وتأكيدها غير متطابقين');
    setSavingPass(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: pass.current, newPassword: pass.new }),
      });
      const data = await res.json();
      if (res.ok) {
        setSecurityModalText(data.message || 'تم تقديم طلب تعديل كلمة المرور الخاصة بك بنجاح إلى إدارة النظام للمراجعة والاعتماد.');
        setPass({ current: '', new: '', confirm: '' });
      } else {
        toast.error(data.message || 'فشل تغيير كلمة المرور');
      }
    } catch {
      toast.error('تعذر الاتصال بالخادم');
    } finally {
      setSavingPass(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page Title */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <User className="text-blue-600" />
              الإعدادات الشخصية
            </h1>
            <p className="text-xs text-gray-400 mt-1 font-semibold">
              إدارة بيانات حسابك الشخصي وإعدادات المظهر وإشعارات النظام.
            </p>
          </div>
        </div>

        {/* ── Account Info Card ── */}
        <div className="bg-gradient-to-l from-slate-50 to-blue-50/30 rounded-2xl border border-slate-100 p-6 flex items-center gap-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.03),transparent)] pointer-events-none" />
          <div className="relative z-10 w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-3xl font-black shadow-sm text-blue-600">
            {(user?.fullName || user?.full_name || '?').charAt(0)}
          </div>
          <div className="relative z-10">
            <h2 className="font-black text-xl leading-none mb-2 tracking-tight text-slate-800">{user?.fullName || user?.full_name}</h2>
            <p className="text-slate-500 text-sm font-mono font-semibold">{user?.username}</p>
            <span className="inline-block mt-3 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl shadow-sm border border-blue-100/50">
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>
        </div>

        {/* ── Profile Section ── */}
        <SectionCard icon={User} title="بيانات الملف الشخصي" color="bg-slate-50/80 text-blue-700">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">الاسم الكامل</label>
              <input value={profile.fullName}
                onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))}
                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-xl transition-all outline-none text-sm font-semibold text-slate-800" placeholder="الاسم الكامل" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">اسم المستخدم</label>
              <input value={user?.username || ''} disabled
                className="w-full h-11 px-4 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-400 cursor-not-allowed" dir="ltr" />
              <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1 font-medium">
                <Info size={12} /> لا يمكن تغيير اسم المستخدم لدواعي أمنية
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">الدور الوظيفي</label>
              <input value={ROLE_LABELS[user?.role] || user?.role || ''} disabled
                className="w-full h-11 px-4 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-400 cursor-not-allowed" />
            </div>
            <div className="pt-2">
              <button type="submit" disabled={savingProfile}
                className="flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm w-full md:w-auto min-w-[160px]">
                {savingProfile
                  ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  : <Save size={16} />}
                {savingProfile ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          </form>
        </SectionCard>

        {/* ── Change Password Section ── */}
        <SectionCard icon={Lock} title="تغيير كلمة المرور" color="bg-slate-50/80 text-amber-600">
          <form onSubmit={handleChangePassword} className="space-y-5">
            <PasswordField label="كلمة المرور الحالية"
              value={pass.current} onChange={e => setPass(p => ({ ...p, current: e.target.value }))}
              placeholder="••••••••" autoComplete="current-password" />
            <PasswordField label="كلمة المرور الجديدة"
              value={pass.new} onChange={e => setPass(p => ({ ...p, new: e.target.value }))}
              placeholder="6 أحرف على الأقل" autoComplete="new-password" />
            <PasswordField label="تأكيد كلمة المرور الجديدة"
              value={pass.confirm} onChange={e => setPass(p => ({ ...p, confirm: e.target.value }))}
              placeholder="أعد إدخال كلمة المرور" autoComplete="new-password" />

            {/* Strength Indicator */}
            {pass.new && (
              <div>
                <div className="flex gap-1.5 mb-2">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                      pass.new.length >= i * 2
                        ? pass.new.length >= 8 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                        : 'bg-slate-100'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-slate-400 font-bold">
                  مستوى الأمان: {pass.new.length < 6 ? 'ضعيف' : pass.new.length < 8 ? 'مقبول' : 'قوي جدًا'}
                </p>
              </div>
            )}

            {/* Match Indicator */}
            {pass.confirm && (
              <p className={`text-xs flex items-center gap-1.5 font-bold ${
                pass.new === pass.confirm ? 'text-emerald-600' : 'text-rose-500'
              }`}>
                {pass.new === pass.confirm ? <><CheckCircle size={14} /> كلمتا المرور متطابقتان</> : '✗ كلمتا المرور غير متطابقتين'}
              </p>
            )}

            <div className="pt-2">
              <button type="submit" disabled={savingPass}
                className="flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm w-full md:w-auto min-w-[200px]">
                {savingPass
                  ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  : <Shield size={16} />}
                {savingPass ? 'جاري رفع الطلب...' : 'طلب تغيير كلمة المرور'}
              </button>
            </div>
          </form>
        </SectionCard>



        {/* ── Theme Toggler Section ── */}
        <SectionCard icon={Sun} title="مظهر النظام (Theme Mode)" color="bg-slate-50/80 text-blue-600">
          <div className="flex gap-4">
            <button
              onClick={() => toggleTheme('light')}
              className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                theme === 'light'
                  ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sun size={24} className={theme === 'light' ? 'text-amber-500' : ''} />
              <span className="text-xs font-black">الوضع الفاتح</span>
            </button>

            <button
              onClick={() => toggleTheme('dark')}
              className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-inner'
                  : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Moon size={24} className={theme === 'dark' ? 'text-blue-400' : ''} />
              <span className="text-xs font-black">الوضع الداكن</span>
            </button>
          </div>
        </SectionCard>

        {/* ── Reassuring Security Modal ── */}
        {securityModalText && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" dir="rtl">
            <div className="absolute inset-0" onClick={() => setSecurityModalText('')} />
            <div className="relative z-10 bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
              {/* Header */}
              <div className="p-6 bg-gradient-to-l from-amber-50 to-white border-b border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Shield size={24} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-800 tracking-tight">حوكمة الأمان وتأمين الحساب</h3>
                  <p className="text-[11px] text-slate-500 font-bold mt-1">طلب تغيير كلمة المرور قيد المراجعة</p>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                <p className="text-sm font-semibold text-slate-700 leading-relaxed text-justify">
                  {securityModalText}
                </p>
                <div className="bg-amber-50 border border-amber-200/50 p-4 rounded-2xl flex items-start gap-3">
                  <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-amber-800 leading-relaxed">
                    وفقاً لحوكمة الأمان والرقابة المالية المشددة للنظام، يتطلب اعتماد تغيير كلمات المرور موافقة مدير النظام والمدقق المالي المباشر (Auditor) لحماية البيانات.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 bg-slate-50 flex justify-end border-t border-slate-100">
                <button
                  onClick={() => setSecurityModalText('')}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl text-sm shadow-md transition-colors"
                >
                  فهمت، موافق
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalSettings;

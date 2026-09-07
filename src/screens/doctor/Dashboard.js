import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  Users,
  Activity,
  Wallet,
  Stethoscope,
  ArrowUpRight,
  Award,
  BadgePercent,
  Coins,
  Receipt
} from "lucide-react";
import { toast } from "react-toastify";
import useAuthStore from "../../store/useAuthStore";
import useSocketStore from "../../store/useSocketStore";
import { useNavigate } from "react-router-dom";

export default function DoctorDashboard() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const latestPatientEvent = useSocketStore(state => state.latestPatientEvent);
  const lastFetchRef = useRef(0);

  const fetchStats = async (silent = false) => {
    try {
      if (!silent && !stats) setLoading(true);
      const res = await axios.get("/api/doctor/dashboard-stats", { headers });
      setStats(res.data);
      lastFetchRef.current = Date.now();
    } catch {
      if (!silent) toast.error("خطأ في تحميل إحصائيات لوحة القيادة");
    } finally {
      if (!silent || loading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  useEffect(() => {
    if (latestPatientEvent?.timestamp && latestPatientEvent.timestamp > lastFetchRef.current) {
      fetchStats(true);
    }
  }, [latestPatientEvent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-bold">
            جاري تحميل لوحة القيادة...
          </p>
        </div>
      </div>
    );
  }

  const {
    patientsFlow = {},
    procedures = {},
    financial = {},
  } = stats || {};

  const totalRevenue = financial?.totalRevenue || 0;
  const consultationIncome = financial?.consultationIncome || 0;
  const servicesIncome = financial?.servicesIncome || 0;
  const exemptionsValue = financial?.exemptionsValue || 0;
  const discountsValue = financial?.discounts || 0;

  const totalDiscountsExemptions = discountsValue + exemptionsValue;

  // Calculate percentages for visual progress bars
  const totalIncomeCalc = consultationIncome + servicesIncome;
  const consultationPercent = totalIncomeCalc > 0 ? (consultationIncome / totalIncomeCalc) * 100 : 0;
  const servicesPercent = totalIncomeCalc > 0 ? (servicesIncome / totalIncomeCalc) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-6 lg:p-8 space-y-6" dir="rtl">
      {/* Header banner */}
      <div className="bg-gradient-to-l from-blue-700 to-blue-600 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden shadow-lg shadow-blue-600/20">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            <span className="text-blue-100 text-xs font-bold tracking-wider uppercase">النظام يعمل مباشر</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2 tracking-tight text-white">
            أهلاً بك {user?.fullName || "الطبيب"} 👋
          </h1>
          <p className="text-blue-100/90 text-sm mt-2 font-medium max-w-lg leading-relaxed">
            هذه لوحة القيادة التنفيذية الخاصة بك. يمكنك متابعة العمليات السريرية والتدفق المالي بشكل لحظي.
          </p>
        </div>
        <button
          onClick={() => navigate("/doctor/queue")}
          className="relative z-10 px-6 py-3.5 bg-white text-blue-700 font-extrabold text-sm rounded-xl hover:bg-blue-50 transition-all duration-300 shadow-md hover:-translate-y-0.5 flex items-center gap-3 group/btn">
          <Stethoscope size={20} className="group-hover/btn:scale-110 transition-transform duration-300" /> 
          مساحة العمل السريرية
        </button>
      </div>

      {/* Top Row: Primary KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Total Consultations */}
        <div className="bg-white rounded-2xl border-2 border-blue-100 hover:border-blue-300 p-6 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:shadow-blue-100 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
              <Users size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">اليوم</span>
          </div>
          <div>
            <h3 className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tight">{patientsFlow?.total || 0}</h3>
            <p className="text-sm font-bold text-slate-500 mt-1">إجمالي المعاينات</p>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
               <div className="h-full bg-blue-500 rounded-full w-[80%]"></div>
            </div>
          </div>
        </div>

        {/* Card 2: Total Procedures */}
        <div className="bg-white rounded-2xl border-2 border-indigo-100 hover:border-indigo-300 p-6 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:shadow-indigo-100 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform duration-300">
              <Activity size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">اليوم</span>
          </div>
          <div>
            <h3 className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tight">{procedures?.total || 0}</h3>
            <p className="text-sm font-bold text-slate-500 mt-1">الإجراءات المطلوبة</p>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
               <div className="h-full bg-indigo-500 rounded-full w-[60%]"></div>
            </div>
          </div>
        </div>

        {/* Card 3: Total Revenue */}
        <div className="bg-white rounded-2xl border-2 border-emerald-100 hover:border-emerald-300 p-6 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:shadow-emerald-100 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform duration-300">
              <Wallet size={24} />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">مباشر</span>
          </div>
          <div>
            <h3 className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tight">{totalRevenue.toLocaleString()}</h3>
            <p className="text-sm font-bold text-slate-500 mt-1">الإيرادات الإجمالية</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">إجمالي المبلغ بالريال اليمني</p>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
               <div className="h-full bg-emerald-500 rounded-full w-[100%] animate-[pulse_2s_ease-in-out_infinite]"></div>
            </div>
          </div>
        </div>

        {/* Card 4: Discounts & Exemptions */}
        <div className="bg-white rounded-2xl border-2 border-rose-100 hover:border-rose-300 p-6 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md hover:shadow-rose-100 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-lg shadow-rose-500/30 group-hover:scale-110 transition-transform duration-300">
              <BadgePercent size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">مباشر</span>
          </div>
          <div>
            <h3 className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tight">{totalDiscountsExemptions.toLocaleString()}</h3>
            <p className="text-sm font-bold text-slate-500 mt-1">الخصومات والإعفاءات</p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">إجمالي المبلغ بالريال اليمني</p>
            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-4 overflow-hidden">
               <div className="h-full bg-rose-500 rounded-full w-[35%]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Second Row: Financial Breakdowns & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col 1 & 2: Financial Breakdown */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col transition-all duration-300 hover:shadow-md hover:border-slate-200">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">التحليل المالي للإيرادات</h3>
              <p className="text-sm text-slate-400 mt-1 font-medium">توزيع مصادر الدخل لليوم الحالي بين المعاينات والخدمات</p>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
              <Receipt size={20} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            {/* Consultation Income Breakdown */}
            <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl p-6 transition-all duration-300 hover:border-emerald-200 hover:shadow-md group">
               <div className="flex justify-between items-start mb-4">
                 <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Stethoscope size={20} />
                 </div>
                 <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{consultationPercent.toFixed(1)}%</span>
               </div>
               <div>
                  <p className="text-sm font-bold text-slate-500 mb-1">دخل رسوم المعاينات</p>
                  <h4 className="text-2xl font-black text-slate-800 tracking-tight">{consultationIncome.toLocaleString()}</h4>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">ريال يمني</p>
               </div>
               <div className="w-full h-1.5 bg-slate-100 rounded-full mt-5 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${consultationPercent}%` }}></div>
               </div>
            </div>

            {/* Services Income Breakdown */}
            <div className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl p-6 transition-all duration-300 hover:border-blue-200 hover:shadow-md group">
               <div className="flex justify-between items-start mb-4">
                 <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Coins size={20} />
                 </div>
                 <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{servicesPercent.toFixed(1)}%</span>
               </div>
               <div>
                  <p className="text-sm font-bold text-slate-500 mb-1">دخل الخدمات والإجراءات</p>
                  <h4 className="text-2xl font-black text-slate-800 tracking-tight">{servicesIncome.toLocaleString()}</h4>
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">ريال يمني</p>
               </div>
               <div className="w-full h-1.5 bg-slate-100 rounded-full mt-5 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${servicesPercent}%` }}></div>
               </div>
            </div>
          </div>
        </div>

        {/* Col 3: Quick Actions */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 md:p-8 shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:border-slate-200">
          <div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">
              إجراءات النظام
            </h3>
            <p className="text-sm text-slate-400 mb-6 font-medium">
              الوصول السريع للمهام اليومية
            </p>

            <div className="space-y-4">
              <button
                onClick={() => navigate("/doctor/queue")}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-md cursor-pointer rounded-2xl group transition-all duration-300 text-right">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
                    <Stethoscope size={20} />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-800 text-sm block">العيادة السريرية</span>
                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5">إدارة معاينات المرضى</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
                   <ArrowUpRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                </div>
              </button>

              <button
                onClick={() => navigate("/settings")}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-300 hover:shadow-md cursor-pointer rounded-2xl group transition-all duration-300 text-right">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 text-white flex items-center justify-center shadow-md shadow-slate-800/20 group-hover:scale-105 transition-transform duration-300">
                    <Award size={20} />
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-800 text-sm block">تفضيلات الحساب</span>
                    <p className="text-[11px] font-semibold text-slate-400 mt-0.5">الأمان وإعدادات النظام</p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
                   <ArrowUpRight size={16} className="text-slate-500 transition-colors" />
                </div>
              </button>
            </div>
          </div>
          
          <div className="mt-8 pt-5 border-t border-slate-100 text-center flex flex-col items-center gap-2 text-right">
            <span className="w-10 h-1 rounded-full bg-slate-200"></span>
            <p className="text-[11px] text-slate-400 font-bold leading-normal">
              تعمل اللوحة بتزامن لحظي وآمن
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePersistentState } from '../../hooks/usePersistentState';
import SearchInput from '../../components/common/SearchInput';
import { createPortal } from 'react-dom';
import PatientExaminationCard from '../../components/common/PatientExaminationCard';
import PatientEMRModal from '../../components/common/PatientEMRModal';
import {
  TrendingUp, Users, Tag, Award, Calendar, RefreshCcw,
  Layers, FlaskConical, Radiation, ShieldAlert, Eye, X, BookOpen, Clock,
  ArrowUpRight, Printer, CheckCircle, LayoutGrid, List,
  Search, User, Phone, Maximize2, Minimize2, Download, ChevronLeft, ChevronRight, Crown
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';
import useAuthStore from '../../store/useAuthStore';
import taffyot from '../../utils/taffyot';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function DoctorReports() {
  const { token } = useAuthStore();
  const headers = { Authorization: `Bearer ${token}` };

  // Data States
  const [completedCases, setCompletedCases] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [exemptions, setExemptions] = useState([]);
  const [vipExemptions, setVipExemptions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'discounts' | 'exemptions'
  const [viewMode, setViewMode] = usePersistentState('global_layout_preference', 'list'); // 'list' | 'grid'
  const [selectedCase, setSelectedCase] = useState(null);
  const [isMaximized, setIsMaximized] = usePersistentState('doctor_modal_maximized_preference', false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected EMR Patient View
  const [selectedEMRPatient, setSelectedEMRPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedEMRVisit, setSelectedEMRVisit] = useState(null);
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [loadingPrescription, setLoadingPrescription] = useState(false);
  const [emrTab, setEmrTab] = useState('timeline');

  // Pagination States
  const [casesPage, setCasesPage] = useState(1);
  const [discountsPage, setDiscountsPage] = useState(1);
  const [exemptionsPage, setExemptionsPage] = useState(1);
  const ITEMS_PER_PAGE = 20;



  // ─── Historic EMR Loading ─────────────────────────────────────────
  const handleOpenEMR = async (patient) => {
    setSelectedEMRPatient(patient);
    setPatientHistory([]);
    setSelectedEMRVisit(null);
    setPrescriptionItems([]);
    setEmrTab('timeline');

    try {
      setHistoryLoading(true);
      const res = await axios.get(`/api/doctor/patient/${patient.id || patient.patient_id}/history`, { headers });
      const visits = Array.isArray(res.data) ? res.data : [];
      setPatientHistory(visits);
      
      // Auto-select the latest visit if any exists
      if (visits.length > 0) {
        handleSelectVisit(visits[0]);
      }
    } catch {
      toast.error('فشل تحميل السجل التاريخي للمريض');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectVisit = async (visit) => {
    setSelectedEMRVisit(visit);
    setPrescriptionItems([]);
    setLoadingPrescription(true);

    try {
      const prescRes = await axios.get(`/api/doctor/visit/${visit.id}/prescription`, { headers });
      if (prescRes.data && prescRes.data.items) {
        setPrescriptionItems(prescRes.data.items);
      }
    } catch {
      setPrescriptionItems([]);
    } finally {
      setLoadingPrescription(false);
    }
  };

  const handlePrintPrescription = () => {
    if (!selectedEMRVisit) return;
    const printContent = document.getElementById('print-area').innerHTML;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة الوصفة الطبية</title>
          <style>
            body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; padding: 40px; }
            .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .title { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
            .patient-info { display: grid; grid-cols: 2; gap: 15px; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border-radius: 8px; }
            .rx-title { font-size: 20px; font-weight: bold; color: #1e3a8a; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 15px; }
            .item { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #eee; }
            .footer { margin-top: 50px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ─── Export Functions (ExcelJS) ─────────────────────────────────────────────
  
  // 1. Export Full Archive (Cases)
  const exportCasesToExcel = async () => {
    if (!filteredCompletedCases || filteredCompletedCases.length === 0) {
      toast.warning('لا توجد بيانات للتصدير');
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('السجل الطبي الشامل');
    sheet.views = [{ rightToLeft: true }];
    
    // Header
    sheet.columns = [
      { header: 'رقم الزيارة', key: 'visit_number', width: 15 },
      { header: 'رقم الملف', key: 'patient_id', width: 15 },
      { header: 'اسم المريض', key: 'full_name', width: 28 },
      { header: 'حالة الزيارة', key: 'status', width: 18 },
      { header: 'تاريخ الزيارة', key: 'visit_date', width: 22 },
      { header: 'الخدمات المقدمة', key: 'services_provided', width: 35 },
      { header: 'إجمالي الفاتورة', key: 'total_invoice', width: 20 },
      { header: 'إجمالي الخصومات', key: 'total_discount', width: 20 },
      { header: 'المدفوع', key: 'total_paid', width: 20 }
    ];

    // Style Header
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });
    sheet.getRow(1).height = 25;

    // Add Rows
    filteredCompletedCases.forEach(c => {
      const labs = c.labRequests || [];
      const rads = c.radiologyRequests || [];
      const clinics = c.clinicalRequests || [];
      
      let servicesTextArray = [];
      if (labs.length > 0) servicesTextArray.push(`مختبر (${labs.length})`);
      if (rads.length > 0) servicesTextArray.push(`أشعة (${rads.length})`);
      if (clinics.length > 0) servicesTextArray.push(`سريرية (${clinics.length})`);
      const servicesText = servicesTextArray.length > 0 ? servicesTextArray.join('، ') : 'رسوم معاينة فقط';

      const allServices = [...labs, ...rads, ...clinics];
      const servicesOriginalPrice = allServices.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
      const servicesDiscount = allServices.reduce((sum, s) => sum + (parseFloat(s.discount_amount) || 0), 0);
      const servicesFinalPrice = allServices.reduce((sum, s) => sum + (parseFloat(s.final_price || s.price) || 0), 0);

      const consultationFee = parseFloat(c.consultation_fee) || 0;
      const consultationDiscount = c.is_exempt ? consultationFee : 0;
      const consultationPaid = c.is_exempt ? 0 : consultationFee;

      const totalInvoice = servicesOriginalPrice + consultationFee;
      const totalDiscount = servicesDiscount + consultationDiscount;
      const totalPaid = servicesFinalPrice + consultationPaid;

      sheet.addRow({
        visit_number: c.visit_number,
        patient_id: c.patient_id,
        full_name: c.full_name,
        status: c.status === 'completed' ? 'مكتملة' : c.status === 'paid' ? 'مدفوعة' : 'غير مكتملة',
        visit_date: new Date(c.created_at).toLocaleString('ar-EG'),
        services_provided: servicesText,
        total_invoice: `${totalInvoice} ريال`,
        total_discount: `${totalDiscount} ريال`,
        total_paid: `${totalPaid} ريال`
      });
    });

    // Style All cells
    sheet.eachRow((row, rowNumber) => {
      if(rowNumber > 1) {
        row.height = 22;
        row.eachCell((cell, colNumber) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          
          // Style financial columns
          if ([7, 8, 9].includes(colNumber)) {
            cell.font = { bold: true, color: { argb: colNumber === 8 && cell.value !== '0 ريال' ? 'FFEF4444' : 'FF334155' } };
            if(colNumber === 9) cell.font = { bold: true, color: { argb: 'FF059669' } }; // Emerald paid
          }
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `السجل_الطبي_الشامل_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
  };

  // 2. Export Discounts/Exemptions
  const exportDiscountsToExcel = async (data, title) => {
    if (!data || data.length === 0) {
      toast.warning('لا توجد بيانات للتصدير');
      return;
    }
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title);
    sheet.views = [{ rightToLeft: true }];
    
    // Header
    sheet.columns = [
      { header: 'رقم الملف', key: 'patient_id', width: 18 },
      { header: 'اسم المريض', key: 'patient_name', width: 30 },
      { header: 'الخدمة المعفاة/المخصومة', key: 'service_name', width: 35 },
      { header: 'القسم', key: 'category', width: 18 },
      { header: 'تاريخ الإجراء', key: 'created_at', width: 22 },
      { header: 'السعر الأساسي', key: 'price', width: 20 },
      { header: 'الخصم', key: 'discount', width: 25 },
      { header: 'السعر المعتمد', key: 'final', width: 20 }
    ];

    // Style Header
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; 
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 12 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });
    sheet.getRow(1).height = 25;

    let totalDiscountAmount = 0;

    // Add Rows
    data.forEach(c => {
      let cat = 'أخرى';
      if (c.type === 'lab') cat = 'مختبر';
      if (c.type === 'radiology') cat = 'أشعة';
      if (c.type === 'clinical') cat = 'سريرية';
      if (!c.type) cat = 'معاينة';

      const dateVal = c.date || c.created_at || c.closed_at;
      const originalPrice = parseFloat(c.original_price || c.consultation_fee || c.price || 0);
      const isFree = c.is_free === 1 || title === 'الإعفاءات وحالات VIP' || c.is_exempt === 1;
      
      let discountAmount = 0;
      let discountText = '';
      let finalPrice = 0;

      if (isFree) {
         discountAmount = originalPrice;
         discountText = 'إعفاء كلي';
         finalPrice = 0;
      } else {
         discountAmount = parseFloat(c.discount_amount || 0);
         discountText = `% ${c.discount_percentage || 0} (-${discountAmount} ريال)`;
         finalPrice = parseFloat(c.final_price || originalPrice);
      }

      totalDiscountAmount += discountAmount;

      sheet.addRow({
        patient_id: c.patient_id || '—',
        patient_name: c.patient_name || c.full_name || '—',
        service_name: c.service_name || 'رسوم معاينة',
        category: cat,
        created_at: dateVal ? new Date(dateVal).toLocaleString('ar-EG') : '—',
        price: `${originalPrice} ريال`,
        discount: discountText,
        final: `${finalPrice} ريال`
      });
    });

    // Add Total Footer
    if (totalDiscountAmount > 0) {
      const lastRowNumber = sheet.rowCount + 1;
      sheet.mergeCells(`A${lastRowNumber}:E${lastRowNumber}`);
      sheet.getCell(`A${lastRowNumber}`).value = 'إجمالي مبلغ الخصومات / الإعفاءات:';
      sheet.getCell(`A${lastRowNumber}`).font = { bold: true, size: 12 };
      sheet.getCell(`A${lastRowNumber}`).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(`A${lastRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      
      sheet.mergeCells(`F${lastRowNumber}:H${lastRowNumber}`);
      sheet.getCell(`F${lastRowNumber}`).value = `${totalDiscountAmount} ريال يمني`;
      sheet.getCell(`F${lastRowNumber}`).font = { bold: true, color: { argb: 'FF4F46E5' }, size: 13 };
      sheet.getCell(`F${lastRowNumber}`).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getCell(`F${lastRowNumber}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      sheet.getRow(lastRowNumber).height = 25;
    }

    // Style All cells
    sheet.eachRow((row, rowNumber) => {
      if(rowNumber > 1 && rowNumber < sheet.rowCount) {
        row.height = 22;
        row.eachCell((cell, colNumber) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          
          if ([6, 7, 8].includes(colNumber)) {
            cell.font = { bold: true, color: { argb: colNumber === 7 && cell.value !== 'إعفاء كلي' ? 'FFEF4444' : 'FF334155' } };
          }
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${title}_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
  };

  // 3. Export Single Patient (Modal)
  const exportModalToExcel = async () => {
    if (!selectedCase) return;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`ملف المريض ${selectedCase.patient_id || ''}`);

    // Set right-to-left layout
    sheet.views = [{ rightToLeft: true }];
    sheet.columns = [
      { key: 'A', width: 30 },
      { key: 'B', width: 25 },
      { key: 'C', width: 20 },
      { key: 'D', width: 25 },
      { key: 'E', width: 20 }
    ];

    // --- Personal Information Section ---
    sheet.mergeCells('A1:E1');
    sheet.getCell('A1').value = 'البيانات الشخصية للمريض';
    sheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // slate-800
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    sheet.getCell('A2').value = 'رقم الملف:';
    sheet.getCell('B2').value = selectedCase.patient_id || '—';
    sheet.getCell('D2').value = 'الاسم الكامل:';
    sheet.getCell('E2').value = selectedCase.full_name || '—';

    sheet.getCell('A3').value = 'العمر:';
    sheet.getCell('B3').value = selectedCase.age || '—';
    sheet.getCell('D3').value = 'الجنس:';
    sheet.getCell('E3').value = selectedCase.gender === 'male' ? 'ذكر' : 'أنثى';

    sheet.getCell('A4').value = 'رقم الهاتف:';
    sheet.getCell('B4').value = selectedCase.phone || '—';
    sheet.getCell('D4').value = 'تاريخ الزيارة:';
    sheet.getCell('E4').value = new Date(selectedCase.created_at).toLocaleString('ar-EG');

    // Style Personal Info Cells with Borders
    for (let r = 2; r <= 4; r++) {
      sheet.getRow(r).height = 25;
      ['A', 'B', 'C', 'D', 'E'].forEach(c => {
        sheet.getCell(`${c}${r}`).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        sheet.getCell(`${c}${r}`).alignment = { vertical: 'middle', horizontal: 'center' };
      });
    }

    ['A2','D2','A3','D3','A4','D4'].forEach(cell => {
      sheet.getCell(cell).font = { bold: true, color: { argb: 'FF475569' } };
      sheet.getCell(cell).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
    
    ['B2','E2','B3','E3','B4','E4'].forEach(cell => {
      sheet.getCell(cell).font = { bold: true, color: { argb: 'FF4F46E5' } };
    });

    // --- Financial Services Section ---
    sheet.mergeCells('A6:E6');
    sheet.getCell('A6').value = 'الخدمات والمعاملات المالية للزيارة';
    sheet.getCell('A6').font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A6').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // indigo-600
    sheet.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(6).height = 28;

    // Table Header
    sheet.getRow(7).values = ['الخدمة', 'القسم', 'السعر الأساسي', 'الخصم الممنوح', 'السعر المعتمد'];
    sheet.getRow(7).height = 25;
    sheet.getRow(7).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FF334155' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // slate-100
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      };
    });

    const allItems = [
      ...(selectedCase.labRequests || []).map(r => ({ ...r, typeLabel: 'مختبر' })),
      ...(selectedCase.radiologyRequests || []).map(r => ({ ...r, typeLabel: 'أشعة' })),
      ...(selectedCase.clinicalRequests || []).map(r => ({ ...r, typeLabel: 'خدمة سريرية' }))
    ];

    let startRow = 8;
    if (allItems.length === 0 && !selectedCase.is_exempt) {
      sheet.mergeCells(`A${startRow}:E${startRow}`);
      sheet.getCell(`A${startRow}`).value = 'لا توجد بيانات مسجلة';
      sheet.getCell(`A${startRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getCell(`A${startRow}`).font = { bold: true, color: { argb: 'FF94A3B8' } };
      startRow++;
    } else {
      // If VIP, add consultation fee exemption
      if (selectedCase.is_exempt) {
        sheet.getRow(startRow).values = [
          'رسوم المعاينة والكشف',
          'معاينة',
          `${selectedCase.consultation_fee || 0} ريال`,
          'إعفاء كلي (VIP)',
          'مجانًا'
        ];
        sheet.getRow(startRow).alignment = { horizontal: 'center', vertical: 'middle' };
        startRow++;
      }

      allItems.forEach(item => {
        sheet.getRow(startRow).values = [
          item.service_name || item.test_name,
          item.typeLabel,
          `${item.price} ريال`,
          item.is_free ? 'إعفاء كلي' : `% ${item.discount_percentage} (-${item.discount_amount} ريال)`,
          item.is_free ? 'مجانًا' : `${item.final_price || item.price} ريال`
        ];
        sheet.getRow(startRow).alignment = { horizontal: 'center', vertical: 'middle' };
        startRow++;
      });
    }

    // Apply borders to table rows
    for(let r = 8; r < startRow; r++) {
      sheet.getRow(r).height = 22;
      sheet.getRow(r).eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        if (colNumber === 3) cell.font = { bold: true, color: { argb: 'FF94A3B8' } };
        if (colNumber === 4 && cell.value !== 'إعفاء كلي (VIP)' && cell.value !== 'إعفاء كلي') cell.font = { bold: true, color: { argb: 'FFEF4444' } };
        if (colNumber === 5) cell.font = { bold: true, color: { argb: 'FF059669' } };
      });
    }

    // Totals Footer
    const vipDiscount = selectedCase.is_exempt === 1 ? parseFloat(selectedCase.consultation_fee || 0) : 0;
    const servicesDiscount = allItems.reduce((acc, curr) => acc + (parseFloat(curr.discount_amount) || 0), 0);
    const totalExempted = vipDiscount + servicesDiscount;

    if (totalExempted > 0) {
      sheet.mergeCells(`A${startRow}:C${startRow}`);
      sheet.getCell(`A${startRow}`).value = 'إجمالي القيمة المعفاة / الخصومات:';
      sheet.getCell(`A${startRow}`).font = { bold: true, size: 12 };
      sheet.getCell(`A${startRow}`).alignment = { horizontal: 'right', vertical: 'middle' };
      sheet.getCell(`A${startRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

      sheet.mergeCells(`D${startRow}:E${startRow}`);
      sheet.getCell(`D${startRow}`).value = `${totalExempted} ريال يمني`;
      sheet.getCell(`D${startRow}`).font = { bold: true, color: { argb: 'FF4F46E5' }, size: 13 };
      sheet.getCell(`D${startRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getCell(`D${startRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      sheet.getRow(startRow).height = 25;
      
      // Border for footer
      ['A', 'D'].forEach(c => {
         sheet.getCell(`${c}${startRow}`).border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `ملف_المريض_${selectedCase.patient_id}_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
  };

  // ─── Filter Logic ─────────────────────────────────────────────
  const filteredCompletedCases = useMemo(() => {
    const validCases = completedCases.filter(c => c.is_follow_up !== 1 && c.is_follow_up !== true);
    if (!searchQuery) return validCases;
    const lower = searchQuery.toLowerCase();
    return validCases.filter(c => c.full_name?.toLowerCase().includes(lower) || String(c.visit_number).includes(lower));
  }, [completedCases, searchQuery]);

  const filteredDiscounts = useMemo(() => {
    if (!searchQuery) return discounts;
    const lower = searchQuery.toLowerCase();
    return discounts.filter(c => c.patient_name?.toLowerCase().includes(lower) || c.service_name?.toLowerCase().includes(lower));
  }, [discounts, searchQuery]);

  const filteredExemptions = useMemo(() => {
    if (!searchQuery) return exemptions;
    const lower = searchQuery.toLowerCase();
    return exemptions.filter(c => c.patient_name?.toLowerCase().includes(lower) || c.service_name?.toLowerCase().includes(lower));
  }, [exemptions, searchQuery]);

  const filteredVipExemptions = useMemo(() => {
    if (!searchQuery) return vipExemptions;
    const lower = searchQuery.toLowerCase();
    return vipExemptions.filter(c => c.full_name?.toLowerCase().includes(lower) || String(c.visit_number).includes(lower));
  }, [vipExemptions, searchQuery]);

  // --- Pagination Logic ---
  const paginatedCases = useMemo(() => {
    const start = (casesPage - 1) * ITEMS_PER_PAGE;
    return filteredCompletedCases.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCompletedCases, casesPage]);

  const paginatedDiscounts = useMemo(() => {
    const start = (discountsPage - 1) * ITEMS_PER_PAGE;
    return filteredDiscounts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDiscounts, discountsPage]);

  const combinedExemptions = useMemo(() => {
    const vips = filteredVipExemptions.map(v => ({ ...v, isVip: true }));
    const regulars = filteredExemptions.map(r => ({ ...r, isVip: false }));
    const all = [...vips, ...regulars];
    all.sort((a, b) => new Date(b.closed_at || b.created_at || b.date).getTime() - new Date(a.closed_at || a.created_at || a.date).getTime());
    return all;
  }, [filteredVipExemptions, filteredExemptions]);

  const paginatedExemptions = useMemo(() => {
    const start = (exemptionsPage - 1) * ITEMS_PER_PAGE;
    return combinedExemptions.slice(start, start + ITEMS_PER_PAGE);
  }, [combinedExemptions, exemptionsPage]);

  const renderPagination = (currentPage, setPage, totalItems) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
        <span className="text-xs font-bold text-gray-500">إجمالي السجلات: {totalItems}</span>
        <div className="flex items-center gap-2" dir="ltr">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronLeft size={16} /></button>
          <span className="text-sm font-bold text-gray-700 px-3">صفحة {currentPage} من {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>
    );
  };

  // ─── Fetch Analytical Reports ────────────────────────────────────
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/doctor/reports/analytical';
      if (dateFilter === 'custom' && customRange.start && customRange.end) {
        url += `?startDate=${customRange.start}&endDate=${customRange.end}`;
      } else if (dateFilter !== 'all') {
        const now = new Date();
        let start = '';
        const pad = (n) => n.toString().padStart(2, '0');
        const format = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        
        if (dateFilter === 'today') {
          start = format(now);
        } else if (dateFilter === 'week') {
          const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          start = format(past);
        } else if (dateFilter === 'month') {
          const past = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          start = format(past);
        }
        url += `?startDate=${start}&endDate=${format(now)}`;
      }

      const res = await axios.get(url, { headers });
      setCompletedCases(res.data.completedCases || []);
      setDiscounts(res.data.discounts || []);
      setExemptions(res.data.exemptions || []);
      setVipExemptions(res.data.vipExemptions || []);
    } catch {
      toast.error('فشل في جلب التقارير التحليلية');
    } finally {
      setLoading(false);
    }
  }, [token, dateFilter, customRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Reset Filters
  const handleResetFilters = () => {
    setDateFilter('all');
    setCustomRange({ start: '', end: '' });
    toast.info('تم إعادة تعيين فلاتر التقارير');
  };

  // ─── Calculations & Taffyot Spellers ──────────────────────────────
  const totalDiscounts = useMemo(() => {
    return discounts.reduce((sum, item) => sum + (parseFloat(item.discount_amount) || 0), 0);
  }, [discounts]);

  const spelledDiscounts = useMemo(() => {
    return taffyot(totalDiscounts);
  }, [totalDiscounts]);

  const totalExemptions = useMemo(() => {
    return exemptions.reduce((sum, item) => sum + (parseFloat(item.original_price) || 0), 0);
  }, [exemptions]);

  const spelledExemptions = useMemo(() => {
    return taffyot(totalExemptions);
  }, [totalExemptions]);

  const totalExemptedConsultations = useMemo(() => {
    return vipExemptions.reduce((sum, c) => sum + (Number(c.consultation_fee) || 0), 0);
  }, [vipExemptions]);

  const spelledConsultations = useMemo(() => taffyot(totalExemptedConsultations), [totalExemptedConsultations]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Banner */}
      <div className="bg-gradient-to-l from-slate-50 to-blue-50/30 rounded-2xl border border-slate-100 p-6 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 text-blue-600 flex items-center justify-center shadow-sm">
            <TrendingUp size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">التقارير الطبية والتحليلات البيانية</h1>
            <p className="text-slate-500 text-sm font-semibold mt-1">تتبع أداء الحالات المنجزة والخصومات الممنوحة وقيم الإعفاءات الإنسانية (VIP)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => {
            if (activeTab === 'cases') exportCasesToExcel();
            else if (activeTab === 'discounts') exportDiscountsToExcel(filteredDiscounts, 'الخصومات');
            else exportDiscountsToExcel([...filteredVipExemptions, ...filteredExemptions], 'الإعفاءات وحالات VIP');
          }} className="px-5 py-2.5 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm">
            <Download size={16} /> تصدير كـ Excel
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Search bar */}
          <SearchInput
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو رقم الملف..."
            className="md:col-span-5"
          />
          
          <div className="md:col-span-7 flex flex-col md:flex-row justify-end items-center gap-3">
            <div className="flex flex-wrap gap-1 bg-gray-100 p-1.5 rounded-2xl text-[11px] font-bold text-gray-500">
              {[
                { id: 'all', label: 'الكل' },
                { id: 'today', label: 'اليوم' },
                { id: 'week', label: 'آخر 7 أيام' },
                { id: 'month', label: 'آخر 30 يوماً' },
                { id: 'custom', label: 'تاريخ مخصص' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setDateFilter(f.id)}
                  className={`px-4 py-2 rounded-xl transition-all ${
                    dateFilter === f.id ? 'bg-white text-indigo-800 shadow-xs' : 'hover:bg-white/40'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

          {dateFilter !== 'all' && (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors shrink-0"
            >
              إعادة تعيين
            </button>
          )}
        </div>
      </div>

        {/* Custom Range Picker */}
        {dateFilter === 'custom' && (
          <div
            className="transition-all duration-300 animate-in fade-in slide-in-from-top-2 p-5 bg-gradient-to-l from-indigo-50/50 to-white rounded-2xl border border-indigo-100 shadow-sm flex flex-wrap gap-5 items-center text-sm mt-4"
          >
            <div className="flex items-center gap-3 relative">
              <span className="font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2">
                <Calendar size={14} className="text-indigo-500" />
                من تاريخ:
              </span>
              <input
                type="date"
                value={customRange.start}
                onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                className="px-4 py-2 bg-white border-2 border-transparent focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl font-black outline-none text-gray-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
              />
            </div>
            <div className="w-8 h-[1px] bg-indigo-200 hidden md:block"></div>
            <div className="flex items-center gap-3 relative">
              <span className="font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2">
                <Calendar size={14} className="text-indigo-500" />
                إلى تاريخ:
              </span>
              <input
                type="date"
                value={customRange.end}
                onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                className="px-4 py-2 bg-white border-2 border-transparent focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-xl font-black outline-none text-gray-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI Overviews */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Completed Cases KPI */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
          <div className="space-y-1">
            <div className="text-gray-400 font-bold mb-1 text-sm flex justify-between">
              إجمالي الحالات المنجزة
              {searchQuery && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">تصفية البحث: {filteredCompletedCases.length}</span>}
            </div>
            <h3 className="text-xl font-black text-gray-800">{filteredCompletedCases.length} مريض</h3>
            <p className="text-[10px] text-gray-400 font-semibold">الحالات المنجزة وإعفاءات الـ VIP الفورية</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-100 text-indigo-600 flex items-center justify-center shadow-inner"><Users size={20}/></div>
        </div>

        {/* Discounts KPI */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-gray-400">إجمالي الخصومات</span>
            <h3 className="text-xl font-black text-indigo-700">{totalDiscounts.toLocaleString()} ريال</h3>
            {totalDiscounts > 0 && (
              <p className="text-[9px] text-indigo-500 font-bold leading-normal" title={spelledDiscounts}>
                ({spelledDiscounts})
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner"><Tag size={20}/></div>
        </div>

        {/* Exemptions KPI */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-gray-400">إعفاءات الخدمات (VIP)</span>
            <h3 className="text-xl font-black text-emerald-700">{totalExemptions.toLocaleString()} ريال</h3>
            {totalExemptions > 0 && (
              <p className="text-[9px] text-emerald-500 font-bold leading-normal" title={spelledExemptions}>
                ({spelledExemptions})
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-600 flex items-center justify-center shadow-inner"><Award size={20}/></div>
        </div>

        {/* Exempted Consultations KPI */}
        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-xs flex items-center justify-between hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-gray-400">رسوم معاينة معفاة</span>
            <h3 className="text-xl font-black text-amber-600">{totalExemptedConsultations.toLocaleString()} ريال</h3>
            {totalExemptedConsultations > 0 && (
              <p className="text-[9px] text-amber-500 font-bold leading-normal" title={spelledConsultations}>
                ({spelledConsultations})
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-600 flex items-center justify-center shadow-inner"><ShieldAlert size={20}/></div>
        </div>
      </div>

      {/* Tabs and View Mode */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Tabs list */}
        <div className="flex border-b border-gray-100 bg-white p-2 gap-1 text-xs font-bold text-gray-500 rounded-3xl shadow-xs border w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'cases', label: 'السجل الطبي الشامل', icon: BookOpen },
            { id: 'discounts', label: 'بيان الخصومات المالية', icon: Tag },
            { id: 'exemptions', label: 'سجل إعفاءات وحالات الـ VIP', icon: ShieldAlert }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl transition-all whitespace-nowrap ${
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

        {/* View Mode Toggle */}
        <div className="flex items-center bg-white border border-gray-200 rounded-2xl p-1 shadow-xs flex-shrink-0">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-400 hover:bg-gray-50'}`}
            title="عرض القائمة"
          >
            <List size={18} />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-400 hover:bg-gray-50'}`}
            title="عرض شبكي"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* Detailed Reports Render */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
          
          {/* TAB 1: CASES */}
          {activeTab === 'cases' && (
            viewMode === 'list' ? (
              <>
              <table className="w-full text-right text-sm" style={{ tableLayout: "fixed" }}>
                <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                  <tr>
                    <th className="p-4 w-24">رقم الملف</th>
                    <th className="p-4 w-48">اسم المريض</th>
                    <th className="p-4 w-32">العمر والجنس</th>
                    <th className="p-4 w-32">تاريخ المعاينة</th>
                    <th className="p-4">الإجراءات والخدمات</th>
                    <th className="p-4 w-24">الملف</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompletedCases.length === 0 ? (
                    <tr>
                      <td colSpan="6" onClick={(e) => e.stopPropagation()} className="p-20 text-center text-gray-400 font-bold">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <BookOpen size={48} className="text-gray-300" strokeWidth={1.5} />
                          <p>لا يوجد حالات منجزة في هذه الفترة.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedCases.map((item, idx) => {
                      const servicesCount = (item.labRequests?.length || 0) + (item.radiologyRequests?.length || 0) + (item.clinicalRequests?.length || 0);
                      return (
                        <tr key={idx} onClick={() => handleOpenEMR(item)} className="border-b border-gray-50 hover:bg-slate-50 transition-colors cursor-pointer">
                          <td className="p-4 font-black text-indigo-700">{item.patient_id || item.id}</td>
                          <td className="p-4 font-extrabold text-slate-800">{item.full_name}</td>
                          <td className="p-4 text-gray-500 font-bold">{item.age} سنة · {item.gender === 'male' ? '♂ ذكر' : '♀ أنثى'}</td>
                          <td className="p-4 text-gray-400 font-bold">{new Date(item.closed_at || item.created_at).toLocaleString('ar')}</td>
                          <td className="p-4">
                            <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-black">
                              {servicesCount} خدمة طبية
                            </span>
                          </td>
                          <td className="p-4">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedCase(item); }}
                              className="p-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors font-bold text-xs w-full"
                            >
                              <Eye size={16} /> فتح
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {renderPagination(casesPage, setCasesPage, filteredCompletedCases.length)}
              </>
            ) : (
              <>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-slate-50/50">
                {filteredCompletedCases.length === 0 ? (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center gap-3 text-gray-400 font-bold">
                    <BookOpen size={48} className="text-gray-300" strokeWidth={1.5} />
                    <p>لا يوجد حالات منجزة في هذه الفترة.</p>
                  </div>
                ) : (
                  paginatedCases.map((item, idx) => {
                    return (
                      <PatientExaminationCard
                        key={idx}
                        patient={{ ...item, id: item.patient_id || item.id }}
                        isSelected={selectedEMRPatient?.id === item.id}
                        onClick={() => handleOpenEMR(item)}
                        onActionClick={() => setSelectedCase(item)}
                        isVIP={item.is_exempt === 1}
                        vipConsultationFee={item.consultation_fee}
                        isFollowUp={item.is_follow_up === 1}
                        actionText="عرض الملف"
                        showDate={true}
                        dateLabel="تاريخ الإغلاق:"
                        dateValue={new Date(item.closed_at || item.created_at).toLocaleString('ar')}
                      />
                    );
                  })
                )}
              </div>
              {renderPagination(casesPage, setCasesPage, filteredCompletedCases.length)}
              </>
            )
          )}

          {/* TAB 2: DISCOUNTS */}
          {activeTab === 'discounts' && (
            viewMode === 'list' ? (
              <>
              <table className="w-full text-right text-sm" style={{ tableLayout: "fixed" }}>
                <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                  <tr>
                    <th className="p-4">رقم الملف</th>
                    <th className="p-4">اسم المريض</th>
                    <th className="p-4">تاريخ الطلب</th>
                    <th className="p-4">الخدمة</th>
                    <th className="p-4">السعر الأساسي</th>
                    <th className="p-4">الخصم</th>
                    <th className="p-4">السعر المعتمد</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDiscounts.length === 0 ? (
                    <tr>
                      <td colSpan="7" onClick={(e) => e.stopPropagation()} className="p-20 text-center text-gray-400 font-bold">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Tag size={48} className="text-gray-300" strokeWidth={1.5} />
                          <p>لا يوجد خصومات ممنوحة في هذه الفترة.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedDiscounts.map((item, idx) => (
                      <tr key={idx} onClick={() => handleOpenEMR(item)} className="border-b border-gray-50 hover:bg-slate-50 transition-colors cursor-pointer">
                        <td className="p-4 font-black text-indigo-700">{item.patient_id || item.id || "—"}</td>
                        <td className="p-4 font-extrabold text-slate-800">{item.patient_name}</td>
                        <td className="p-4 text-gray-400 font-bold text-xs">{new Date(item.date).toLocaleDateString('ar-EG')}</td>
                        <td className="p-4">
                          <span className="font-extrabold text-slate-700 block">
                              {item.service_name}
                              {item.type === 'radiology' && (item.with_film === false || item.with_film === 0 || item.withFilm === false) && (
                                <span className="inline-flex items-center text-[9px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md border border-rose-100 mr-2">بدون فيلم</span>
                              )}
                            </span>
                          <span className="text-[10px] font-black text-gray-400">{item.type === 'lab' ? 'مختبر' : item.type === 'radiology' ? 'أشعة' : 'خدمة سريرية'}</span>
                        </td>
                        <td className="p-4 font-black text-gray-400 line-through decoration-red-300 decoration-2">{item.original_price} ريال</td>
                        <td className="p-4 text-indigo-700 font-extrabold">% {item.discount_percentage} <span className="text-xs text-red-500 ml-1">(-{item.discount_amount})</span></td>
                        <td className="p-4 text-emerald-700 font-black text-base">{item.final_price} ريال</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {renderPagination(discountsPage, setDiscountsPage, filteredDiscounts.length)}
              </>
            ) : (
              <>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50">
                {filteredDiscounts.length === 0 ? (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center gap-3 text-gray-400 font-bold">
                    <Tag size={48} className="text-gray-300" strokeWidth={1.5} />
                    <p>لا يوجد خصومات ممنوحة في هذه الفترة.</p>
                  </div>
                ) : (
                  paginatedDiscounts.map((item, idx) => (
                    <div key={idx} onClick={() => handleOpenEMR(item)} className="p-4 rounded-3xl border transition-all cursor-pointer shadow-sm bg-white border-gray-100 hover:border-indigo-150 hover:shadow-md flex flex-col justify-between">
                      <div>
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                          <div className="bg-indigo-50 text-indigo-700 font-black text-[11px] px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
                            ملف: #{item.patient_id || item.id || "—"}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400">{new Date(item.date).toLocaleDateString('ar-EG')}</span>
                            <div className={`font-black text-[10px] px-2.5 py-1 rounded-lg border shadow-sm ${
                              item.type === 'lab' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                              item.type === 'radiology' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}>
                              {item.type === 'lab' ? 'مختبر' : item.type === 'radiology' ? 'أشعة' : 'خدمة سريرية'}
                            </div>
                          </div>
                        </div>
                        
                        {/* Main Info */}
                        <div className="flex items-center gap-3.5 mb-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 flex items-center justify-center font-black text-lg border border-slate-200 shadow-sm flex-shrink-0">
                            <Tag size={20} className="text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-extrabold text-sm text-gray-800 line-clamp-1 mb-1.5 leading-tight">
                              {item.patient_name}
                            </span>
                            <div className="text-[10px] text-gray-500 font-bold flex flex-wrap gap-2">
                              <span className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg line-clamp-1">
                                {item.service_name}
                                {item.type === 'radiology' && (item.with_film === false || item.with_film === 0 || item.withFilm === false) && (
                                  <span className="inline-flex items-center text-[9px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md border border-rose-100 mr-2">بدون فيلم</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Financial Details */}
                        <div className="bg-gray-50 rounded-2xl p-3 space-y-2 border border-gray-100">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-gray-500">السعر الأساسي:</span>
                            <span className="text-gray-400 line-through">{item.original_price} ريال</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-red-500">قيمة الخصم ({item.discount_percentage}%):</span>
                            <span className="text-red-600">-{item.discount_amount} ريال</span>
                          </div>
                          <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-black">
                            <span className="text-slate-700">النهائي:</span>
                            <span className="text-emerald-600">{item.final_price} ريال</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {renderPagination(discountsPage, setDiscountsPage, filteredDiscounts.length)}
              </>
            )
          )}

                    {/* TAB 3: EXEMPTIONS */}
          {activeTab === 'exemptions' && (
            viewMode === 'list' ? (
              <>
              <table className="w-full text-right text-sm" style={{ tableLayout: "fixed" }}>
                <thead className="bg-gray-50 border-b border-gray-150 font-bold text-gray-500">
                  <tr>
                    <th className="p-4 w-24">رقم الملف</th>
                    <th className="p-4 w-48">اسم المريض</th>
                    <th className="p-4 w-32">تاريخ الطلب</th>
                    <th className="p-4">الخدمة المعفاة</th>
                    <th className="p-4 w-32">القيمة المعفاة</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedExemptions.length === 0 ? (
                    <tr>
                      <td colSpan="5" onClick={(e) => e.stopPropagation()} className="p-20 text-center text-gray-400 font-bold">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <ShieldAlert size={48} className="text-gray-300" strokeWidth={1.5} />
                          <p>لا يوجد تحويلات مجانية أو إعفاءات في هذه الفترة.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <>
                      {paginatedExemptions.map((item, idx) => {
                        if (item.isVip) {
                          return (
                            <tr key={`vip-${idx}`} onClick={() => handleOpenEMR(item)} className="border-b border-gray-50 hover:bg-slate-50 transition-colors cursor-pointer">
                              <td className="p-4 font-black text-indigo-700">{item.patient_id || item.id || "—"}</td>
                              <td className="p-4 font-extrabold text-slate-800">{item.full_name}</td>
                              <td className="p-4 text-gray-400 font-bold text-xs">{new Date(item.closed_at || item.created_at).toLocaleDateString('ar-EG')}</td>
                              <td className="p-4">
                                <span className="font-extrabold text-slate-700 block">رسوم المعاينة</span>
                                <span className="text-[10px] font-black text-gray-400">خدمة سريرية</span>
                              </td>
                              <td className="p-4 text-red-500 font-black text-base">{item.consultation_fee || 0} ريال</td>
                            </tr>
                          );
                        } else {
                          return (
                            <tr key={`svc-${idx}`} onClick={() => handleOpenEMR(item)} className="border-b border-gray-50 hover:bg-slate-50 transition-colors cursor-pointer">
                              <td className="p-4 font-black text-indigo-700">{item.patient_id || item.id || "—"}</td>
                              <td className="p-4 font-extrabold text-slate-800">{item.patient_name}</td>
                              <td className="p-4 text-gray-400 font-bold text-xs">{new Date(item.date).toLocaleDateString('ar-EG')}</td>
                              <td className="p-4">
                                <span className="font-extrabold text-slate-700 block">
                                  {item.service_name}
                                  {item.type === 'radiology' && (item.with_film === false || item.with_film === 0 || item.withFilm === false) && (
                                    <span className="inline-flex items-center text-[9px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md border border-rose-100 mr-2">بدون فيلم</span>
                                  )}
                                </span>
                                <span className="text-[10px] font-black text-gray-400">
                                  {item.type === 'lab' ? 'مختبر' : item.type === 'radiology' ? 'أشعة' : 'خدمة سريرية'}
                                </span>
                              </td>
                              <td className="p-4 text-red-500 font-black text-base">{item.original_price} ريال</td>
                            </tr>
                          );
                        }
                      })}
                    </>
                  )}
                </tbody>
              </table>
              {renderPagination(exemptionsPage, setExemptionsPage, combinedExemptions.length)}
              </>
            ) : (
              <>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50">
                {combinedExemptions.length === 0 ? (
                  <div className="col-span-full py-20 flex flex-col items-center justify-center gap-3 text-gray-400 font-bold">
                    <ShieldAlert size={48} className="text-gray-300" strokeWidth={1.5} />
                    <p>لا يوجد تحويلات مجانية أو إعفاءات في هذه الفترة.</p>
                  </div>
                ) : (
                  <>
                    {paginatedExemptions.map((item, idx) => {
                      if (item.isVip) {
                        return (
                          <div key={`vip-${idx}`} onClick={() => handleOpenEMR(item)} className="p-4 rounded-3xl border transition-all cursor-pointer shadow-sm bg-white border-gray-100 hover:border-emerald-200 hover:shadow-md flex flex-col justify-between">
                            <div>
                              {/* Header */}
                              <div className="flex justify-between items-center mb-4">
                                <div className="bg-indigo-50 text-indigo-700 font-black text-[11px] px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
                                  ملف: #{item.patient_id || item.id || "—"}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-gray-400">{new Date(item.closed_at || item.created_at).toLocaleDateString('ar-EG')}</span>
                                  <div className="font-black text-[10px] px-2.5 py-1 rounded-lg border shadow-sm bg-emerald-50 text-emerald-700 border-emerald-100">
                                    خدمة سريرية
                                  </div>
                                </div>
                              </div>
                              
                              {/* Main Info */}
                              <div className="flex items-center gap-3.5 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 flex items-center justify-center font-black text-lg border border-slate-200 shadow-sm flex-shrink-0">
                                  <ShieldAlert size={20} className="text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-extrabold text-sm text-gray-800 line-clamp-1 mb-1.5 leading-tight">
                                    {item.full_name}
                                  </span>
                                  <div className="text-[10px] text-gray-500 font-bold flex flex-wrap gap-2">
                                    <span className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg line-clamp-1">
                                      رسوم المعاينة
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Financial Details */}
                              <div className="bg-gray-50 rounded-2xl p-3 space-y-2 border border-gray-100">
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-gray-500">السعر الأساسي:</span>
                                  <span className="text-gray-400 line-through">{item.consultation_fee || 0} ريال</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-red-500">قيمة الإعفاء (100%):</span>
                                  <span className="text-red-600">-{item.consultation_fee || 0} ريال</span>
                                </div>
                                <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-black">
                                  <span className="text-slate-700">النهائي:</span>
                                  <span className="text-emerald-600">0 ريال</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={`svc-${idx}`} onClick={() => handleOpenEMR(item)} className="p-4 rounded-3xl border transition-all cursor-pointer shadow-sm bg-white border-gray-100 hover:border-emerald-200 hover:shadow-md flex flex-col justify-between">
                            <div>
                              {/* Header */}
                              <div className="flex justify-between items-center mb-4">
                                <div className="bg-indigo-50 text-indigo-700 font-black text-[11px] px-3 py-1.5 rounded-xl border border-indigo-100 shadow-sm">
                                  ملف: #{item.patient_id || item.id || "—"}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-gray-400">{new Date(item.date).toLocaleDateString('ar-EG')}</span>
                                  <div className={`font-black text-[10px] px-2.5 py-1 rounded-lg border shadow-sm ${
                                    item.type === 'lab' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                    item.type === 'radiology' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  }`}>
                                    {item.type === 'lab' ? 'مختبر' : item.type === 'radiology' ? 'أشعة' : 'خدمة سريرية'}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Main Info */}
                              <div className="flex items-center gap-3.5 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 flex items-center justify-center font-black text-lg border border-slate-200 shadow-sm flex-shrink-0">
                                  <ShieldAlert size={20} className="text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                  <span className="font-extrabold text-sm text-gray-800 line-clamp-1 mb-1.5 leading-tight">
                                    {item.patient_name}
                                  </span>
                                  <div className="text-[10px] text-gray-500 font-bold flex flex-wrap gap-2">
                                    <span className="flex items-center gap-1 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg line-clamp-1">
                                      {item.service_name}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Financial Details */}
                              <div className="bg-gray-50 rounded-2xl p-3 space-y-2 border border-gray-100">
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-gray-500">السعر الأساسي:</span>
                                  <span className="text-gray-400 line-through">{item.original_price} ريال</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-red-500">قيمة الإعفاء (100%):</span>
                                  <span className="text-red-600">-{item.original_price} ريال</span>
                                </div>
                                <div className="pt-2 border-t border-gray-200 flex justify-between text-sm font-black">
                                  <span className="text-slate-700">النهائي:</span>
                                  <span className="text-emerald-600">0 ريال</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })}
                  </>
                )}
              </div>
              {renderPagination(exemptionsPage, setExemptionsPage, combinedExemptions.length)}
              </>
            )
          )}
              </div>
      )}

      {/* ─── READ-ONLY DRILL DOWN EMR MODAL ─── */}
      {selectedCase && createPortal((
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-overlay-anim" dir="rtl">
          <div className={`bg-white rounded-3xl shadow-luxury overflow-hidden flex flex-col border border-gray-100 relative animate-scale-in transition-all duration-300 ${isMaximized ? "w-[98vw] h-[98vh]" : "w-full max-w-6xl h-[88vh]"}`}>
              
              {/* Header (PatientArchive Match) */}
              <div className="px-5 py-2.5 flex items-center justify-between flex-shrink-0 shadow-md text-white transition-colors duration-300 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600">
                <div className="flex items-center gap-2">
                  <Layers size={16} />
                  <span className="text-xs font-black tracking-wide">
                    السجل السريري المؤرشف | زيارة رقم ({selectedCase.visit_number}) للمراجع: {selectedCase.full_name} — [للقراءة فقط]
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setIsMaximized(!isMaximized)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                    {isMaximized ? <Minimize2 size={16}/> : <Maximize2 size={16}/>}
                  </button>
                  <button onClick={() => setSelectedCase(null)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                    <X size={16}/>
                  </button>
                </div>
              </div>

              {/* Modal Header & Context Bar (Matching PatientEMRModal) */}
              <div className="p-5 border-b border-gray-100 flex-shrink-0 bg-white flex flex-col gap-4 relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  {/* Right Side: Patient Profile */}
                  <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-700 flex items-center justify-center font-black text-3xl border border-indigo-200 shadow-sm flex-shrink-0">
                      {selectedCase.full_name?.charAt(0)}
                    </div>
                    <div className="flex flex-col justify-center">
                      <h3 className="font-extrabold text-xl text-gray-900">{selectedCase.full_name}</h3>
                      <div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500 font-bold">
                        <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">رقم الملف: {selectedCase.patient_id || selectedCase.id}</span>
                        {selectedCase.phone && <span className="flex items-center gap-1"><Phone size={14}/> <span dir="ltr">{selectedCase.phone}</span></span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs font-bold text-gray-500">
                        <span className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100"><User size={14} className="inline-block -mt-0.5 mr-1"/> العمر: {selectedCase.age ? `${selectedCase.age} سنة` : '—'}</span>
                        <span className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">الجنس: {selectedCase.gender === 'male' ? 'ذكر' : 'أنثى'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Premium Full-Width Visit Context Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 px-4 py-3 rounded-2xl border border-slate-100">
                   <div className="flex items-center gap-4">
                      <div className="flex items-center text-[11px] font-extrabold text-gray-500 bg-white px-3 py-1.5 rounded-xl border border-gray-150 shadow-sm gap-2">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-indigo-400"/>
                          {new Date(selectedCase.closed_at || selectedCase.created_at).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <div className="w-[1px] h-3.5 bg-gray-200"></div>
                        <span className="flex items-center gap-1.5" dir="ltr">
                          <Clock size={13} className="text-amber-500"/>
                          {new Date(selectedCase.closed_at || selectedCase.created_at).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                   </div>

                   <div className="flex items-center gap-2">
                      {Boolean(selectedCase.is_exempt) && (
                        <span className="text-[11px] font-extrabold px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5 shadow-sm">
                          <Crown size={13} className="text-amber-600"/> إعفاء
                        </span>
                      )}
                      <span className={`text-[11px] font-extrabold px-3 py-1.5 rounded-xl border shadow-sm ${
                        Boolean(selectedCase.is_follow_up)
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {selectedCase.is_follow_up ? 'مراجعة مجانية' : 'كشف جديد'}
                      </span>
                   </div>
                </div>
              </div>

              {/* Scroll Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">

                {/* Services Ordered */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
                      <Layers size={18} className="text-indigo-600" />
                      الخدمات المطلوبة والمسددة
                    </h4>
                  </div>
                  
                  <div className="p-0">
                    {(() => {
                      const allItems = [
                        ...(selectedCase.labRequests || []).map(r => ({ ...r, typeLabel: 'مختبر' })),
                        ...(selectedCase.radiologyRequests || []).map(r => ({ ...r, typeLabel: 'أشعة' })),
                        ...(selectedCase.clinicalRequests || []).map(r => ({ ...r, typeLabel: 'خدمة سريرية' }))
                      ];
                      const vipDiscount = selectedCase.is_exempt === 1 ? parseFloat(selectedCase.consultation_fee || 0) : 0;
                      const servicesDiscount = allItems.reduce((acc, curr) => acc + (parseFloat(curr.discount_amount) || 0), 0);
                      const totalExempted = vipDiscount + servicesDiscount;

                      return (
                    <table className="w-full text-right text-xs">
                      <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-400 font-bold">
                        <tr>
                          <th className="p-4">الخدمة</th>
                          <th className="p-4">القسم</th>
                          <th className="p-4">السعر الأساسي</th>
                          <th className="p-4">الخصم الممنوح</th>
                          <th className="p-4">السعر المعتمد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allItems.length === 0 && !selectedCase.is_exempt ? (
                          <tr>
                            <td colSpan="5" className="p-12 text-center text-gray-400 font-bold">
                              <div className="flex flex-col items-center gap-2">
                                <ShieldAlert size={32} className="text-gray-300" strokeWidth={1.5}/>
                                <span>لم يتم طلب أي خدمات في هذه الزيارة.</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <>
                            {selectedCase.is_exempt === 1 && (
                              <tr className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 font-bold text-gray-800">رسوم المعاينة والكشف</td>
                                <td className="p-4 font-bold text-gray-500">
                                  خدمة سريرية
                                </td>
                                <td className="p-4 text-gray-400 font-bold line-through">{selectedCase.consultation_fee || 0} ريال</td>
                                <td className="p-4 font-bold text-indigo-500">إعفاء كلي (VIP)</td>
                                <td className="p-4 font-black text-indigo-600 text-sm">مجانًا</td>
                              </tr>
                            )}
                          {allItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors">
                              <td className="p-4 font-bold text-gray-800">
                                {item.name}
                                {item.typeLabel === 'أشعة' && (item.with_film === false || item.with_film === 0 || item.withFilm === false) && (
                                  <span className="inline-flex items-center text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200 mr-2">بدون فيلم</span>
                                )}
                              </td>
                              <td className="p-4 font-bold text-gray-500">
                                {item.typeLabel}
                              </td>
                              <td className="p-4 text-gray-400 font-bold line-through">{item.price} ريال</td>
                              <td className="p-4 font-bold text-indigo-500">{item.is_free ? 'إعفاء كلي' : `% ${item.discount_percentage} (-${item.discount_amount} ريال)`}</td>
                              <td className="p-4 font-black text-indigo-600 text-sm">{item.is_free ? 'مجانًا' : `${item.final_price || item.price} ريال`}</td>
                            </tr>
                          ))}
                          </>
                        )}
                      </tbody>
                      {totalExempted > 0 && (
                        <tfoot className="bg-slate-50/50 border-t border-slate-200">
                          <tr>
                            <td colSpan="3" className="p-4 font-black text-slate-700 text-right">إجمالي القيمة المعفاة / الخصومات:</td>
                            <td colSpan="2" className="p-4 text-left">
                              <div className="font-black text-indigo-600 text-base">{totalExempted} ريال يمني</div>
                              <div className="text-[10px] text-gray-500 font-bold mt-1">
                                فقط {taffyot(totalExempted)} لا غير
                              </div>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
                <button
                  onClick={exportModalToExcel}
                  className="px-6 py-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 transition-colors font-black rounded-xl text-xs flex items-center gap-2"
                >
                  <Download size={16} /> تصدير كـ Excel
                </button>
                <button
                  onClick={() => setSelectedCase(null)}
                  className="px-6 py-2.5 bg-slate-800 text-white hover:bg-slate-700 transition-colors font-black rounded-xl text-xs"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        ), document.body)}

      {/* ─── HISTORIC READ-ONLY EMR MODAL ─── */}
      <PatientEMRModal
        isOpen={!!selectedEMRPatient}
        onClose={() => setSelectedEMRPatient(null)}
        patient={selectedEMRPatient}
        visit={selectedEMRVisit || selectedEMRPatient}
        readOnly={true}
        isArchiveScreen={true}
        historyLoading={historyLoading}
        patientHistory={patientHistory}
        selectedVisit={selectedEMRVisit}
        onSelectVisit={handleSelectVisit}
        prescriptionItems={prescriptionItems}
        loadingPrescription={loadingPrescription}
        onPrintPrescription={handlePrintPrescription}
      />

    </div>
  );
}

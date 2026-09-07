import React from 'react';
import taffyot from '../utils/taffyot';

const InvoiceTemplate = ({ data }) => {
  if (!data) return null;

  const {
    invoiceNumber = 'REC-' + new Date().getFullYear() + '-' + Math.floor(10000 + Math.random() * 90000),
    date = new Date().toLocaleString('ar-YE'),
    patientName,
    visitNumber,
    items = [], // { description, price, qty, total }
    subtotal = 0,
    discount = 0,
    discountReason = '',
    totalPaid = 0,
    cashierName,
    currency = 'YER'
  } = data;

  return (
    <div id="printable-invoice" className="hidden print:block w-full text-black" dir="rtl" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
      {/* Header */}
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-2xl font-black mb-1">أورثوكير لجراحة العظام</h1>
        <h2 className="text-lg font-bold">Orthocare Surgery Center</h2>
        <p className="text-sm">اليمن - صنعاء</p>
        <div className="mt-4 inline-block border border-black px-4 py-1 font-bold">
          سند قبض - Invoice
        </div>
      </div>

      {/* Info */}
      <div className="flex justify-between mb-6 text-sm">
        <div>
          <p><span className="font-bold">رقم السند:</span> {invoiceNumber}</p>
          <p><span className="font-bold">التاريخ:</span> {date}</p>
        </div>
        <div>
          <p><span className="font-bold">المريض:</span> {patientName}</p>
          <p><span className="font-bold">رقم الزيارة:</span> {visitNumber}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-sm mb-6 border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="py-2 text-right">البيان (Description)</th>
            <th className="py-2 text-center">الكمية</th>
            <th className="py-2 text-left">المبلغ ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-300">
              <td className="py-2">{item.description}</td>
              <td className="py-2 text-center">{item.qty || 1}</td>
              <td className="py-2 text-left font-bold">{parseFloat(item.total).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end text-sm">
        <div className="w-1/2">
          <div className="flex justify-between py-1">
            <span>الإجمالي:</span>
            <span className="font-bold">{subtotal.toLocaleString()} {currency}</span>
          </div>
          {parseFloat(discount) > 0 && (
            <div className="flex justify-between py-1 text-gray-700">
              <span>الخصم ({discountReason}):</span>
              <span className="font-bold">- {parseFloat(discount).toLocaleString()} {currency}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-t border-black mt-1 pt-1 font-black text-lg">
            <span>الإجمالي (المدفوع):</span>
            <div className="text-left">
              <span>{parseFloat(totalPaid).toLocaleString()} {currency}</span>
              <div className="amount-words" style={{ fontSize: '13px', marginTop: '5px', fontWeight: 'bold' }}>فقط: {taffyot(totalPaid)} لا غير</div>
            </div>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="flex justify-between mt-12 pt-8 text-sm text-center">
        <div className="w-32 border-t border-black pt-2">
          <p>توقيع المحاسب</p>
          <p className="font-bold mt-1">{cashierName}</p>
        </div>
        <div className="w-32 border-t border-black pt-2">
          <p>توقيع المريض</p>
        </div>
      </div>
      
      <div className="text-center text-xs mt-8 text-gray-500">
        <p>الأسعار شاملة ضريبة القيمة المضافة إن وجدت.</p>
        <p>نتمنى لكم دوام الصحة والعافية.</p>
      </div>
      
      {/* Page Break for multiple prints if needed */}
      <div className="page-break" style={{ pageBreakAfter: 'always' }}></div>
    </div>
  );
};

export default InvoiceTemplate;




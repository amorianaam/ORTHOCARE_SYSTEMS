export const formatArabicQuantity = (qty, unit) => {
  if (!unit) return `${qty}`;
  const unitStr = unit.trim();
  const numQty = parseFloat(qty) || 0;
  
  if (numQty === 1) return `${unitStr}`;
  if (numQty === 2) {
    if (unitStr === 'قطعة') return 'قطعتان';
    if (unitStr === 'علبة') return 'علبتان';
    if (unitStr === 'شريط') return 'شريطان';
    if (unitStr === 'حبة') return 'حبتان';
    if (unitStr === 'كيس') return 'كيسان';
    if (unitStr === 'امبولة' || unitStr === 'أمبولة') return 'أمبولتان';
    if (unitStr === 'كرتون') return 'كرتونان';
    return `2 ${unitStr}`;
  }
  
  if (numQty >= 3 && numQty <= 10) {
    if (unitStr === 'قطعة') return `${numQty} قطع`;
    if (unitStr === 'علبة') return `${numQty} علب`;
    if (unitStr === 'شريط') return `${numQty} أشرطة`;
    if (unitStr === 'حبة') return `${numQty} حبات`;
    if (unitStr === 'كيس') return `${numQty} أكياس`;
    if (unitStr === 'امبولة' || unitStr === 'أمبولة') return `${numQty} أمبولات`;
    if (unitStr === 'كرتون') return `${numQty} كراتين`;
    return `${numQty} ${unitStr}`;
  }
  
  if (numQty >= 11 && numQty <= 99) {
    if (unitStr === 'قطعة') return `${numQty} قطعة`;
    if (unitStr === 'علبة') return `${numQty} علبة`;
    if (unitStr === 'شريط') return `${numQty} شريطاً`;
    if (unitStr === 'حبة') return `${numQty} حبة`;
    if (unitStr === 'كيس') return `${numQty} كيساً`;
    if (unitStr === 'امبولة' || unitStr === 'أمبولة') return `${numQty} أمبولة`;
    if (unitStr === 'كرتون') return `${numQty} كرتوناً`;
    return `${numQty} ${unitStr}`;
  }
  
  return `${numQty} ${unitStr}`;
};

export const formatArabicItemsCount = (count) => {
  if (count === 1) return "صنف واحد";
  if (count === 2) return "صنفان";
  if (count >= 3 && count <= 10) return `${count} أصناف`;
  if (count >= 11 && count <= 99) return `${count} صنفاً`;
  return `${count} صنف`;
};

export const getSmartItemText = (count, itemName) => {
  const numCount = parseInt(count, 10) || 0;
  if (numCount === 1 && itemName) return itemName;
  return formatArabicItemsCount(numCount);
};

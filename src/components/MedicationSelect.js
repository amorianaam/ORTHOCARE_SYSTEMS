import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

const MedicationSelect = ({ value, onChange, options, placeholder, disabled, theme = 'blue' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  // Define theme colors dynamically based on the passed theme ('blue' for standard, 'indigo' for VIP)
  const themeColors = {
    focusBorder: theme === 'indigo' ? 'focus:border-indigo-400' : 'focus:border-blue-400',
    focusRing: theme === 'indigo' ? 'focus:ring-indigo-100' : 'focus:ring-blue-100',
    hoverBg: theme === 'indigo' ? 'hover:bg-indigo-50' : 'hover:bg-blue-50',
    activeBg: theme === 'indigo' ? 'bg-indigo-50/50' : 'bg-blue-50/50',
    iconColor: theme === 'indigo' ? 'text-indigo-600' : 'text-blue-600'
  };

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredOptions = options.filter(opt => 
    opt && opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (val) => {
    onChange(val);
    setSearchTerm(val);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            onChange(e.target.value); // Allow free text input
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder={placeholder || "ابحث أو اكتب اسم الدواء..."}
          className={`w-full bg-gray-50 border border-gray-200 focus:bg-white ${themeColors.focusBorder} focus:ring-2 ${themeColors.focusRing} rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-gray-800 transition-all outline-none`}
          dir="ltr"
        />
        <Search size={16} className="absolute left-3 text-gray-400 pointer-events-none" />
        <div 
          className="absolute right-2 p-1.5 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors"
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <ChevronDown 
            size={16} 
            className={`text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-150 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] max-h-64 overflow-y-auto" dir="ltr">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => (
              <div 
                key={i}
                onClick={() => handleSelect(opt)}
                className={`px-4 py-3 ${themeColors.hoverBg} cursor-pointer flex items-center justify-between border-b border-gray-50 last:border-none transition-colors ${value === opt ? themeColors.activeBg : ''}`}
              >
                <span className="text-sm font-bold text-gray-700">{opt}</span>
                {value === opt && <Check size={16} className={themeColors.iconColor} />}
              </div>
            ))
          ) : (
            <div className="px-4 py-4 flex flex-col items-center justify-center text-sm text-gray-500 text-center gap-2">
              <span className="bg-gray-100 p-2 rounded-full">💊</span>
              <p>الدواء غير موجود في القائمة المرجعية</p>
              <p className="text-[10px] text-gray-400">سيتم اعتماده كإدخال يدوي</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MedicationSelect;

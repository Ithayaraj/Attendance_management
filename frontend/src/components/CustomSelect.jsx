import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export const CustomSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  className = '',
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  const handleSelect = (optionValue) => {
    onChange({ target: { value: String(optionValue) } });
    setIsOpen(false);
  };

  return (
    <div ref={selectRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`
          w-full px-2.5 sm:px-3 py-1.5 sm:py-2 
          border border-slate-300 dark:border-slate-600 
          rounded-lg 
          focus:ring-2 focus:ring-cyan-500 
          dark:bg-slate-800 dark:text-white 
          text-xs sm:text-sm 
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-between gap-2
          bg-white dark:bg-slate-800
          min-w-0
          ${isOpen ? 'ring-2 ring-cyan-500' : ''}
        `}
      >
        <span className="text-xs sm:text-sm truncate min-w-0 flex-1 text-left flex items-center gap-2" title={selectedOption?.label || placeholder}>
          {loading ? 'Loading...' : selectedOption ? (
            <>
              <span className="truncate" title={selectedOption.label}>{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : placeholder}
        </span>
        <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.length === 0 ? (
            <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center">
              No options
            </div>
          ) : (
            options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                title={option.label}
                className={`
                  w-full text-left px-2.5 sm:px-3 py-1.5 sm:py-2 
                  text-xs sm:text-sm
                  hover:bg-slate-100 dark:hover:bg-slate-700
                  ${String(option.value) === String(value) ? 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400' : 'text-slate-900 dark:text-white'}
                  transition-colors
                  first:rounded-t-lg last:rounded-b-lg
                  flex items-center justify-between gap-2
                `}
              >
                <span className="flex-1 truncate" title={option.label}>{option.label}</span>
                {option.badge && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                    {option.badge}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};


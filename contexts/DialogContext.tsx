
import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

interface DialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info' | 'warning';
}

interface DialogContextType {
  confirm: (options: DialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions>({ title: '', message: '' });
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: DialogOptions) => {
    setOptions({
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        type: 'info',
        ...opts
    });
    setIsOpen(true);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleClose = (result: boolean) => {
    setIsOpen(false);
    if (resolver) {
      resolver(result);
      setResolver(null);
    }
  };

  return (
    <DialogContext.Provider value={{ confirm }}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in border border-gray-100">
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                  options.type === 'danger' ? 'bg-red-100 text-red-600' : 
                  options.type === 'warning' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
              }`}>
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{options.title}</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                {options.message}
              </p>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => handleClose(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <X size={18} /> {options.cancelText}
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-105 ${
                      options.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 
                      'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
                  }`}
                >
                  <Check size={18} /> {options.confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

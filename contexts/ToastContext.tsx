
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(({ type, title, message, duration = 4000 }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300); // Wait for animation
  };

  const styles = {
    success: 'border-l-green-500 bg-white text-gray-800',
    error: 'border-l-red-500 bg-white text-gray-800',
    warning: 'border-l-yellow-500 bg-white text-gray-800',
    info: 'border-l-blue-500 bg-white text-gray-800',
  };

  const icons = {
    success: <CheckCircle2 className="text-green-500" size={20} />,
    error: <AlertCircle className="text-red-500" size={20} />,
    warning: <AlertTriangle className="text-yellow-500" size={20} />,
    info: <Info className="text-blue-500" size={20} />,
  };

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 p-4 rounded-lg shadow-xl border-l-4 border-gray-100 ring-1 ring-black/5
        transition-all duration-300 ease-in-out transform translate-x-0 opacity-100
        ${styles[toast.type]}
        ${isExiting ? 'translate-x-full opacity-0' : 'animate-slide-in-right'}
      `}
    >
      <div className="shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1">
        {toast.title && <h4 className="font-bold text-sm mb-1">{toast.title}</h4>}
        <p className="text-sm text-gray-600 leading-snug">{toast.message}</p>
      </div>
      <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

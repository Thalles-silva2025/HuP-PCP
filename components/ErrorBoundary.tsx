import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full border-t-8 border-red-600">
            <div className="flex items-center gap-4 text-red-600 mb-6">
                <AlertTriangle size={48} />
                <h1 className="text-2xl font-bold">Ops! Algo deu errado.</h1>
            </div>
            
            <p className="text-gray-600 mb-4">
                O aplicativo encontrou um erro inesperado e precisou ser interrompido para sua segurança.
            </p>

            {this.state.error && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-xs font-mono text-red-800 mb-6 overflow-auto max-h-40">
                    <strong>Erro:</strong> {this.state.error.toString()}
                </div>
            )}

            <div className="flex gap-3">
                <button 
                    onClick={() => window.location.reload()}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                    <RefreshCcw size={18}/> Recarregar Página
                </button>
                <button 
                    onClick={() => {
                        localStorage.clear();
                        window.location.href = '/';
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-200 border border-gray-300"
                >
                    Limpar Cache & Reiniciar
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

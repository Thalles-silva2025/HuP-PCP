
import React, { useEffect, useState, useMemo } from 'react';
import { SubcontractorOrder, ProductionOrder, Partner } from '../types';
import { MockService } from '../services/mockDb';
import { 
  DollarSign, CheckCircle2, Search, Filter, 
  Wallet, AlertCircle, Clock, ChevronDown, 
  Download, X, Banknote, CalendarDays
} from 'lucide-react';
import { ModernDatePicker } from './ModernDatePicker';

interface PayableItem {
    id: string; 
    opId: string;
    partner: string;
    partnerType: string;
    serviceType: string;
    executionDate: string; // Data da realização
    dueDate: string; // Data de Vencimento (Calculada: Exec + 24h)
    quantity: number;
    unitPrice: number;
    total: number;
    amountPaid: number;
    status: 'Pendente' | 'Parcial' | 'Pago';
    bankAccountName?: string;
    // Helper status for UI
    isOverdue?: boolean;
    daysOverdue?: number;
}

interface FinancialFilters {
    search: string;
    status: 'ALL' | 'OVERDUE' | 'TODAY' | 'OPEN' | 'PAID';
    partner: string;
    startDate: Date;
    endDate: Date;
    label: string;
}

export const PaymentsModule: React.FC = () => {
  // State
  const [payables, setPayables] = useState<PayableItem[]>([]);
  const [partnersList, setPartnersList] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters State
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [filters, setFilters] = useState<FinancialFilters>({
      search: '',
      status: 'ALL',
      partner: '',
      startDate: startOfMonth, 
      endDate: today,
      label: 'Este Mês'
  });

  // Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PayableItem | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: 0, bankAccount: '', paymentDate: today.toISOString().split('T')[0] });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Fetch real generated payments from DB (Simulation + User Actions)
    const [dbPayments, partners] = await Promise.all([
        MockService.getPayments(),
        MockService.getPartners()
    ]);

    setPartnersList(partners);

    // Helper: Calculate Due Date (Standard: 24h after execution if not set)
    const calculateDueDate = (dateStr: string): string => {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + 1); // +1 Day Rule
        return date.toISOString().split('T')[0];
    };

    // Enrich with Status Logic (Overdue)
    const enriched: PayableItem[] = dbPayments.map(p => {
        // Use DB date as execution date, calculate due date logic
        const dueDate = new Date(calculateDueDate(p.date)); 
        dueDate.setHours(0,0,0,0);
        
        const now = new Date();
        now.setHours(0,0,0,0);
        
        const isOverdue = p.status !== 'Pago' && dueDate.getTime() < now.getTime();
        const daysOverdue = isOverdue ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 3600 * 24)) : 0;
        
        return {
            id: p.id,
            opId: p.opId,
            partner: p.partnerName,
            partnerType: p.partnerType,
            serviceType: p.stage,
            executionDate: p.date,
            dueDate: calculateDueDate(p.date),
            quantity: p.quantityDelivered,
            unitPrice: p.ratePerPiece,
            total: p.totalAmount,
            amountPaid: p.amountPaid,
            status: p.status,
            bankAccountName: p.bankAccountName,
            isOverdue,
            daysOverdue
        };
    });

    // Sort: Overdue first, then by Due Date asc
    enriched.sort((a,b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    setPayables(enriched);
    setLoading(false);
  };

  // --- FILTERED DATA ---
  const filteredData = useMemo(() => {
      return payables.filter(p => {
          // 1. Text Search
          const textMatch = !filters.search || 
              p.partner.toLowerCase().includes(filters.search.toLowerCase()) || 
              p.opId.toLowerCase().includes(filters.search.toLowerCase()) ||
              p.id.toLowerCase().includes(filters.search.toLowerCase());

          // 2. Partner Filter
          const partnerMatch = !filters.partner || p.partner === filters.partner;

          // 3. Status Filter (Smart Logic)
          let statusMatch = true;
          const due = new Date(p.dueDate);
          due.setHours(0,0,0,0);
          const now = new Date();
          now.setHours(0,0,0,0);

          switch(filters.status) {
              case 'OVERDUE': statusMatch = p.isOverdue === true && p.status !== 'Pago'; break;
              case 'TODAY': statusMatch = due.getTime() === now.getTime() && p.status !== 'Pago'; break;
              case 'PAID': statusMatch = p.status === 'Pago'; break;
              case 'OPEN': statusMatch = p.status !== 'Pago'; break; // Includes overdue + future
              default: statusMatch = true;
          }

          // 4. Date Range Filter (Applied to Due Date)
          let dateMatch = true;
          const filterStart = new Date(filters.startDate); filterStart.setHours(0,0,0,0);
          const filterEnd = new Date(filters.endDate); filterEnd.setHours(23,59,59,999);
          
          if (filters.startDate && filters.endDate) {
              const itemDate = new Date(p.dueDate);
              itemDate.setHours(0,0,0,0);
              dateMatch = itemDate >= filterStart && itemDate <= filterEnd;
          }

          return textMatch && partnerMatch && statusMatch && dateMatch;
      });
  }, [payables, filters]);

  // --- KPI CALCULATIONS ---
  // FIX: Using Number() to ensure math operations work correctly
  const stats = useMemo(() => {
      const pending = payables.filter(p => p.status !== 'Pago');
      const overdue = pending.filter(p => p.isOverdue);
      
      const dueToday = pending.filter(p => {
          const d = new Date(p.dueDate); d.setHours(0,0,0,0);
          const n = new Date(); n.setHours(0,0,0,0);
          return d.getTime() === n.getTime();
      });
      
      const future = pending.filter(p => !p.isOverdue && (new Date(p.dueDate).setHours(0,0,0,0) > new Date().setHours(0,0,0,0)));
      const paid = payables.filter(p => p.status === 'Pago');

      const sum = (arr: PayableItem[]) => arr.reduce((acc, item) => acc + (Number(item.total) - Number(item.amountPaid)), 0);
      const sumPaid = (arr: PayableItem[]) => arr.reduce((acc, item) => acc + Number(item.amountPaid), 0);

      return {
          overdueCount: overdue.length,
          overdueValue: sum(overdue),
          todayCount: dueToday.length,
          todayValue: sum(dueToday),
          futureCount: future.length,
          futureValue: sum(future),
          paidCount: paid.length,
          paidValue: sumPaid(paid)
      };
  }, [payables]);

  // --- ACTIONS ---

  const handleOpenPayment = (item: PayableItem) => {
      setSelectedPayment(item);
      setPaymentForm({
          amount: item.total - item.amountPaid,
          bankAccount: item.bankAccountName || '',
          paymentDate: new Date().toISOString().split('T')[0]
      });
      setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = () => {
      if (!selectedPayment) return;
      const newPaidAmount = selectedPayment.amountPaid + paymentForm.amount;
      const remaining = selectedPayment.total - newPaidAmount;
      let newStatus: 'Pendente' | 'Parcial' | 'Pago' = 'Pendente';
      
      if (remaining <= 0.01) newStatus = 'Pago';
      else if (newPaidAmount > 0) newStatus = 'Parcial';

      setPayables(prev => prev.map(p => p.id === selectedPayment.id ? { 
          ...p, 
          amountPaid: newPaidAmount,
          status: newStatus,
          bankAccountName: paymentForm.bankAccount
      } : p));

      setIsPaymentModalOpen(false);
  };

  // --- HELPERS ---
  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div className="space-y-6 pb-20 animate-fade-in bg-gray-50/50 min-h-screen">
      {/* HEADER */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="text-green-600" /> Contas a Pagar (Serviços)
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gestão financeira de facções e prestadores de serviço terceirizados.</p>
        </div>
        <div className="text-xs text-gray-400 bg-white px-3 py-1 rounded border shadow-sm">
            Vencimento Padrão: <b>24h</b> após execução
        </div>
      </div>

      {/* KPI DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Vencidos (Critical) */}
          <div 
            onClick={() => setFilters({...filters, status: 'OVERDUE'})}
            className={`bg-white p-5 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${filters.status === 'OVERDUE' ? 'ring-2 ring-red-500 border-red-500' : 'border-red-500'}`}
          >
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertCircle size={20}/></div>
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">{stats.overdueCount} títulos</span>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Vencido (Atrasado)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.overdueValue)}</div>
          </div>

          {/* Card 2: Vence Hoje (Action) */}
          <div 
            onClick={() => setFilters({...filters, status: 'TODAY'})}
            className={`bg-white p-5 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${filters.status === 'TODAY' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-blue-500'}`}
          >
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><CalendarDays size={20}/></div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{stats.todayCount} títulos</span>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Vence Hoje</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.todayValue)}</div>
          </div>

          {/* Card 3: A Vencer (Future) */}
          <div 
            onClick={() => setFilters({...filters, status: 'OPEN'})}
            className="bg-white p-5 rounded-xl border-l-4 border-gray-300 shadow-sm cursor-pointer transition-all hover:shadow-md"
          >
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-gray-50 text-gray-600 rounded-lg"><Clock size={20}/></div>
                  <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-full">{stats.futureCount} títulos</span>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">A Vencer (Futuro)</div>
              <div className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(stats.futureValue)}</div>
          </div>

          {/* Card 4: Pago (History) */}
          <div 
            onClick={() => setFilters({...filters, status: 'PAID'})}
            className={`bg-white p-5 rounded-xl border-l-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${filters.status === 'PAID' ? 'ring-2 ring-green-500 border-green-500' : 'border-green-500'}`}
          >
              <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle2 size={20}/></div>
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">{stats.paidCount} pagos</span>
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase">Total Pago</div>
              <div className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(stats.paidValue)}</div>
          </div>
      </div>

      {/* PROFESSIONAL FILTERS TOOLBAR */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
          <div className="flex flex-col lg:flex-row gap-4 flex-1">
              {/* Search */}
              <div className="relative w-full lg:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                  <input 
                    type="text" 
                    placeholder="Buscar Ref, OP ou Parceiro..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm"
                    value={filters.search}
                    onChange={e => setFilters({...filters, search: e.target.value})}
                  />
              </div>

              {/* Status Dropdown */}
              <div className="relative">
                  <select 
                    className="w-full lg:w-40 pl-3 pr-8 py-2 border rounded-lg appearance-none bg-white text-sm focus:ring-2 focus:ring-green-500 outline-none cursor-pointer"
                    value={filters.status}
                    onChange={e => setFilters({...filters, status: e.target.value as any})}
                  >
                      <option value="ALL">Status: Todos</option>
                      <option value="OPEN">Em Aberto</option>
                      <option value="OVERDUE">Vencidos</option>
                      <option value="TODAY">Vence Hoje</option>
                      <option value="PAID">Pagos</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16}/>
              </div>

              {/* Partner Dropdown */}
              <div className="relative">
                  <select 
                    className="w-full lg:w-48 pl-3 pr-8 py-2 border rounded-lg appearance-none bg-white text-sm focus:ring-2 focus:ring-green-500 outline-none cursor-pointer"
                    value={filters.partner}
                    onChange={e => setFilters({...filters, partner: e.target.value})}
                  >
                      <option value="">Fornecedor: Todos</option>
                      {partnersList.filter(p => p.contractType === 'PJ').map(p => (
                          <option key={p.name} value={p.name}>{p.name}</option>
                      ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16}/>
              </div>

              {/* Modern Date Picker */}
              <ModernDatePicker 
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                  label={filters.label}
                  onChange={(range) => setFilters({...filters, startDate: range.start, endDate: range.end, label: range.label || 'Personalizado'})}
              />
          </div>

          <div className="flex gap-2">
              <button 
                onClick={() => setFilters({ search: '', status: 'ALL', partner: '', startDate: startOfMonth, endDate: today, label: 'Este Mês' })}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                title="Limpar Filtros"
              >
                  <Filter size={18}/>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">
                  <Download size={16}/> Exportar
              </button>
          </div>
      </div>

      {/* PAYABLES TABLE */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-bold border-b">
                  <tr>
                      <th className="p-4 w-10">St</th>
                      <th className="p-4">Vencimento</th>
                      <th className="p-4">Favorecido (Parceiro)</th>
                      <th className="p-4">Referência / Serviço</th>
                      <th className="p-4 text-right">Valor Total</th>
                      <th className="p-4 text-right">A Pagar</th>
                      <th className="p-4 text-center">Ações</th>
                  </tr>
              </thead>
              <tbody className="divide-y">
                  {filteredData.map(item => {
                      const isPaid = item.status === 'Pago';
                      const remaining = item.total - item.amountPaid;
                      
                      return (
                          <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${item.isOverdue ? 'bg-red-50/30' : ''}`}>
                              <td className="p-4">
                                  {isPaid ? (
                                      <CheckCircle2 size={18} className="text-green-500" title="Pago"/>
                                  ) : item.isOverdue ? (
                                      <AlertCircle size={18} className="text-red-500" title={`Vencido há ${item.daysOverdue} dias`}/>
                                  ) : (
                                      <div className="w-4 h-4 rounded-full border-2 border-gray-300" title="Aberto"></div>
                                  )}
                              </td>
                              <td className="p-4">
                                  <div className={`font-bold ${item.isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                                      {formatDate(item.dueDate)}
                                  </div>
                                  <div className="text-xs text-gray-400">Exec: {formatDate(item.executionDate)}</div>
                              </td>
                              <td className="p-4">
                                  <div className="font-medium text-gray-900">{item.partner}</div>
                                  <div className="text-xs text-gray-500">{item.partnerType} • {item.bankAccountName || 'S/ Conta Cadastrada'}</div>
                              </td>
                              <td className="p-4">
                                  <div className="font-mono text-xs text-blue-600 font-bold bg-blue-50 w-fit px-2 py-0.5 rounded mb-1">{item.id}</div>
                                  <div className="text-gray-600">{item.serviceType} <span className="text-gray-400 text-xs">(OP: {item.opId})</span></div>
                              </td>
                              <td className="p-4 text-right text-gray-500">
                                  {formatCurrency(item.total)}
                              </td>
                              <td className="p-4 text-right">
                                  <div className={`font-bold text-base ${isPaid ? 'text-green-600 line-through decoration-1 opacity-60' : 'text-gray-800'}`}>
                                      {formatCurrency(remaining)}
                                  </div>
                              </td>
                              <td className="p-4 text-center">
                                  {!isPaid && (
                                      <button 
                                        onClick={() => handleOpenPayment(item)}
                                        className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg shadow-sm transition-colors"
                                        title="Realizar Pagamento"
                                      >
                                          <Banknote size={18}/>
                                      </button>
                                  )}
                                  {isPaid && (
                                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded">PAGO</span>
                                  )}
                              </td>
                          </tr>
                      );
                  })}
                  {filteredData.length === 0 && (
                      <tr><td colSpan={7} className="p-12 text-center text-gray-400">Nenhum título encontrado com os filtros selecionados.</td></tr>
                  )}
              </tbody>
          </table>
      </div>

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && selectedPayment && (
          <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                  <div className="bg-green-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2"><DollarSign/> Baixar Título</h3>
                      <button onClick={() => setIsPaymentModalOpen(false)} className="hover:bg-green-700 p-1 rounded"><X size={20}/></button>
                  </div>
                  <div className="p-6 space-y-5">
                      <div className="bg-gray-50 p-4 rounded-lg border text-center">
                          <div className="text-xs text-gray-500 uppercase font-bold mb-1">Valor em Aberto</div>
                          <div className="text-3xl font-bold text-gray-800">
                              {formatCurrency(selectedPayment.total - selectedPayment.amountPaid)}
                          </div>
                          <div className="text-sm text-gray-600 mt-2">Favorecido: <b>{selectedPayment.partner}</b></div>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">Valor do Pagamento</label>
                          <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                              <input 
                                type="number" step="0.01"
                                className="w-full pl-10 pr-4 py-3 border rounded-lg text-lg font-bold text-green-700 focus:ring-2 focus:ring-green-500 outline-none"
                                value={paymentForm.amount || ''}
                                onChange={e => setPaymentForm({...paymentForm, amount: Number(e.target.value)})}
                                placeholder="0.00"
                              />
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Data Pagamento</label>
                              <input 
                                type="date"
                                className="w-full border rounded-lg p-2.5 text-sm"
                                value={paymentForm.paymentDate}
                                onChange={e => setPaymentForm({...paymentForm, paymentDate: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-sm font-bold text-gray-700 mb-1">Conta Bancária</label>
                              <input 
                                type="text"
                                className="w-full border rounded-lg p-2.5 text-sm"
                                placeholder="Banco / Pix"
                                value={paymentForm.bankAccount}
                                onChange={e => setPaymentForm({...paymentForm, bankAccount: e.target.value})}
                              />
                          </div>
                      </div>

                      <button 
                        onClick={handleConfirmPayment} 
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg flex justify-center items-center gap-2 mt-4"
                      >
                          <CheckCircle2 size={18}/> Confirmar Baixa
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
  AlertCircle, Clock, CheckCircle2, Factory, TrendingUp, DollarSign, 
  ShoppingBag, AlertTriangle, ArrowRight, ChevronDown, PackageX, Calendar, Filter, Target, PackageCheck, Flame
} from 'lucide-react';
import { MockService } from '../services/mockDb';
import { ProductionOrder, OrderStatus, Material, PaymentRecord, Product, ProductionGoal } from '../types';
import { useNavigate } from 'react-router-dom';

// --- TYPES ---
type DashboardView = 'overview' | 'delayed' | 'efficiency' | 'wip';

interface DashboardStats {
  openOps: number;
  delayedOps: number;
  delayedPieces: number;
  avgLeadTime: number;
  efficiencyRate: number;
  totalRevenuePotential: number;
}

interface GoalStats {
    target: number;
    realized: number;
    percent: number;
    monthLabel: string;
}

interface DateRange {
    label: string;
    days: number | 'custom';
    start: Date;
    end: Date;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<DashboardView>('overview');
  const [loading, setLoading] = useState(true);
  
  // Date Filter State
  const [dateRange, setDateRange] = useState<DateRange>({
      label: '30 Dias',
      days: 30,
      start: new Date(new Date().setDate(new Date().getDate() - 30)),
      end: new Date()
  });

  // Data State
  const [allOps, setAllOps] = useState<ProductionOrder[]>([]);
  const [filteredOps, setFilteredOps] = useState<ProductionOrder[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [goals, setGoals] = useState<ProductionGoal[]>([]);
  
  // Computed State
  const [stats, setStats] = useState<DashboardStats>({
    openOps: 0, delayedOps: 0, delayedPieces: 0, avgLeadTime: 0, efficiencyRate: 0, totalRevenuePotential: 0
  });
  const [goalStats, setGoalStats] = useState<GoalStats>({ target: 0, realized: 0, percent: 0, monthLabel: '-' });
  const [urgentMaterials, setUrgentMaterials] = useState<{material: Material, missing: number}[]>([]);
  const [todaysPayments, setTodaysPayments] = useState<PaymentRecord[]>([]);
  const [finishingPriority, setFinishingPriority] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
      filterDataAndCalc();
  }, [dateRange, allOps]);

  const loadData = async () => {
    setLoading(true);
    const [ops, mats, pay, prods, prodGoals] = await Promise.all([
      MockService.getProductionOrders(),
      MockService.getMaterials(),
      MockService.getPayments(),
      MockService.getProducts(),
      MockService.getProductionGoals()
    ]);

    setAllOps(ops);
    setMaterials(mats);
    setPayments(pay);
    setProducts(prods);
    setGoals(prodGoals);
    
    // Calculate Goals immediately after load
    calculateGoalStats(ops, prodGoals);
    
    setLoading(false);
  };

  const calculateGoalStats = (ops: ProductionOrder[], goals: ProductionGoal[]) => {
      // Logic: Find the "Current Context Date". 
      // If we have data in the future (2025), use the latest OP date as "Current".
      // Otherwise use actual Today.
      let refDate = new Date();
      const completedOps = ops.filter(o => o.status === OrderStatus.COMPLETED && o.packingDetails?.packedDate);
      
      if (completedOps.length > 0) {
          const maxDateStr = completedOps.reduce((max, op) => op.packingDetails!.packedDate! > max ? op.packingDetails!.packedDate! : max, '');
          const maxDate = new Date(maxDateStr);
          if (maxDate > refDate) {
              refDate = maxDate; // Use simulation date
          }
      }

      const monthKey = `${refDate.getFullYear()}-${(refDate.getMonth() + 1).toString().padStart(2, '0')}`;
      const monthLabel = refDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

      // 1. Get Target
      const target = goals.find(g => g.month === monthKey)?.targetQuantity || 0;

      // 2. Get Realized
      const realized = completedOps
        .filter(op => {
            const d = new Date(op.packingDetails!.packedDate!);
            return d.getFullYear() === refDate.getFullYear() && d.getMonth() === refDate.getMonth();
        })
        .reduce((sum, op) => sum + op.quantityTotal, 0);

      setGoalStats({
          target,
          realized,
          percent: target > 0 ? Math.round((realized / target) * 100) : 0,
          monthLabel
      });
  };

  const handleRangeChange = (days: number | 'custom') => {
      const end = new Date();
      let start = new Date();
      
      if (days === 'custom') {
          // Keep current dates but change mode, handled by inputs
          setDateRange({ ...dateRange, label: 'Custom', days: 'custom' });
          return;
      } else {
          start.setDate(end.getDate() - days);
      }
      
      setDateRange({
          label: `${days} Dias`,
          days,
          start,
          end
      });
  };

  const filterDataAndCalc = () => {
      // 1. Filter OPs based on Range (Created At)
      const rangeStart = dateRange.start.getTime();
      const rangeEnd = dateRange.end.getTime();

      // For charts involving history (Efficiency, Lead Time), use filtered list
      const relevantHistoryOps = allOps.filter(op => {
          const d = new Date(op.createdAt).getTime();
          return d >= rangeStart && d <= rangeEnd;
      });
      setFilteredOps(relevantHistoryOps);

      calculateMetrics(allOps, relevantHistoryOps, materials, payments, products);
  };

  const calculateMetrics = (
      allOps: ProductionOrder[], 
      historyOps: ProductionOrder[], 
      mats: Material[], 
      pay: PaymentRecord[], 
      prods: Product[]
  ) => {
      const today = new Date();
      today.setHours(0,0,0,0);

      // 1. Active & Delayed (Uses ALL open OPs, regardless of date filter, to be accurate for "Today")
      const activeOps = allOps.filter(o => o.status !== OrderStatus.COMPLETED && o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.DRAFT);
      
      const delayed = activeOps.filter(o => {
          // Delayed Logic: Due Date < Today
          const due = new Date(o.dueDate);
          return due < today;
      });

      const delayedPcs = delayed.reduce((a,b) => a + b.quantityTotal, 0);

      // 2. Lead Time & Efficiency (Uses HISTORY OPs filtered by date range)
      const completedInPeriod = historyOps.filter(o => o.status === OrderStatus.COMPLETED);
      let totalDays = 0;
      completedInPeriod.forEach(o => {
          const start = new Date(o.startDate).getTime();
          const end = new Date(o.packingDetails?.packedDate || new Date().toISOString()).getTime();
          totalDays += (end - start) / (1000 * 3600 * 24);
      });
      const avgLead = completedInPeriod.length ? totalDays / completedInPeriod.length : 0;

      // Efficiency (Quality) - Based on Revision
      // Filter OPs that have revision data
      let totalQuality = 0;
      let countQuality = 0;
      historyOps.forEach(o => {
          if (o.revisionDetails) {
              const total = o.revisionDetails.approvedQty + o.revisionDetails.reworkQty + o.revisionDetails.rejectedQty;
              if (total > 0) {
                  totalQuality += (o.revisionDetails.approvedQty / total);
                  countQuality++;
              }
          }
      });
      const efficiency = countQuality ? (totalQuality / countQuality) * 100 : 100;

      setStats({
          openOps: activeOps.length,
          delayedOps: delayed.length,
          delayedPieces: delayedPcs,
          avgLeadTime: Math.round(avgLead),
          efficiencyRate: parseFloat(efficiency.toFixed(1)),
          totalRevenuePotential: activeOps.reduce((acc, op) => {
              const p = prods.find(x => x.id === op.productId);
              const price = p?.techPacks[0]?.suggestedPrice || 0;
              return acc + (op.quantityTotal * price);
          }, 0)
      });

      // 2. Urgent Materials
      const criticalMats: {material: Material, missing: number}[] = [];
      mats.forEach(m => {
          if (m.currentStock < 100) { 
             criticalMats.push({ material: m, missing: 100 - m.currentStock });
          }
      });
      setUrgentMaterials(criticalMats.slice(0, 5));

      // 3. Payments Due Today or Overdue
      const due = pay.filter(p => {
          const d = new Date(p.date);
          d.setHours(0,0,0,0);
          return p.status !== 'Pago' && d <= today;
      });
      setTodaysPayments(due);

      // 4. Finishing Priority (Sales Type)
      const finishingOps = allOps.filter(o => o.status === OrderStatus.QUALITY_CONTROL || o.status === OrderStatus.PACKING);
      const groups: Record<string, number> = { 'Hype': 0, 'Vende Tudo': 0, 'Vende Bem': 0, 'Normal': 0 };
      
      finishingOps.forEach(op => {
          const p = prods.find(x => x.id === op.productId);
          const tp = p?.techPacks.find(t => t.version === op.techPackVersion);
          const type = tp?.salesType || 'Normal';
          if(groups[type] !== undefined) groups[type] += op.quantityTotal;
      });

      setFinishingPriority([
          { name: 'Hype', value: groups['Hype'], color: '#9333ea' }, // Purple
          { name: 'Vende Tudo', value: groups['Vende Tudo'], color: '#f97316' }, // Orange
          { name: 'Vende Bem', value: groups['Vende Bem'], color: '#3b82f6' }, // Blue
          { name: 'Normal', value: groups['Normal'], color: '#94a3b8' } // Gray
      ].filter(g => g.value > 0));
  };

  // --- CHART DATA GENERATORS ---

  const getWipData = () => {
      const stages = {
          [OrderStatus.PLANNED]: 0,
          [OrderStatus.CUTTING]: 0,
          [OrderStatus.SEWING]: 0,
          [OrderStatus.QUALITY_CONTROL]: 0,
          [OrderStatus.PACKING]: 0
      };
      allOps.forEach(op => {
          if (stages[op.status] !== undefined) {
              stages[op.status] += op.quantityTotal;
          }
      });
      return Object.keys(stages).map(k => ({ name: k, value: stages[k as OrderStatus] }));
  };

  const getDelayData = () => {
      return allOps
        .filter(o => o.status !== OrderStatus.COMPLETED && o.status !== OrderStatus.CANCELLED && new Date(o.dueDate) < new Date())
        .map(o => ({
            name: o.lotNumber,
            days: Math.floor((new Date().getTime() - new Date(o.dueDate).getTime()) / (1000 * 3600 * 24)),
            qty: o.quantityTotal
        }))
        .sort((a,b) => b.days - a.days)
        .slice(0, 10);
  };

  // FIX: Chart data for quality now properly handles safe access
  const getQualityChartData = () => {
      // Get OPs with actual revision details in the filtered period
      const relevant = filteredOps.filter(o => o.revisionDetails && (o.revisionDetails.approvedQty > 0 || o.revisionDetails.rejectedQty > 0));
      
      return relevant.slice(-15).map(o => ({
          name: o.lotNumber,
          aprovado: o.revisionDetails?.approvedQty || 0,
          defeito: (o.revisionDetails?.reworkQty || 0) + (o.revisionDetails?.rejectedQty || 0)
      }));
  };

  // --- RENDER HELPERS ---

  const StatCard = ({ title, value, sub, icon: Icon, color, activeKey, onClick }: any) => (
    <div 
        onClick={() => onClick(activeKey)}
        className={`relative p-6 rounded-2xl border transition-all cursor-pointer overflow-hidden group
            ${activeView === activeKey 
                ? `ring-2 ring-offset-2 ring-${color}-500 border-${color}-500 bg-white shadow-lg` 
                : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'
            }
        `}
    >
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity`}>
          <Icon size={80} className={`text-${color}-600`}/>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg bg-${color}-50 text-${color}-600`}>
                <Icon size={20} />
            </div>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-wide">{title}</p>
        </div>
        <h3 className="text-3xl font-bold text-gray-800 tracking-tight">{value}</h3>
        <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${sub.includes('+') || sub.includes('Crítico') ? 'text-red-500' : 'text-green-500'}`}>
          {sub.includes('Crítico') ? <AlertTriangle size={12}/> : <TrendingUp size={12}/>}
          {sub}
        </p>
      </div>
      
      {activeView === activeKey && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50"/>
      )}
    </div>
  );

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      {/* HEADER & FILTER BAR */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Painel de Controle</h1>
            <p className="text-gray-500">Visão estratégica da operação.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-full border shadow-sm">
                <Clock size={16}/> Última atualização: {new Date().toLocaleTimeString()}
            </div>
        </div>

        {/* DATE RANGE FILTER */}
        <div className="bg-white p-2 rounded-xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 px-2">
                <Filter size={18} className="text-gray-400"/>
                <span className="text-sm font-bold text-gray-600">Período:</span>
            </div>
            <div className="flex gap-2 overflow-x-auto p-1">
                {[7, 15, 30, 60, 90].map(d => (
                    <button 
                        key={d} 
                        onClick={() => handleRangeChange(d)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap
                            ${dateRange.days === d ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                        `}
                    >
                        {d} dias
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border">
                <Calendar size={16} className="text-gray-400"/>
                <input 
                    type="date" 
                    className="bg-transparent text-sm text-gray-700 outline-none"
                    value={dateRange.start.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange({ ...dateRange, days: 'custom', start: new Date(e.target.value) })}
                />
                <span className="text-gray-400">-</span>
                <input 
                    type="date" 
                    className="bg-transparent text-sm text-gray-700 outline-none"
                    value={dateRange.end.toISOString().split('T')[0]}
                    onChange={(e) => setDateRange({ ...dateRange, days: 'custom', end: new Date(e.target.value) })}
                />
            </div>
        </div>
      </div>

      {/* KPI CARDS (INTERACTIVE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Produção Ativa" 
          value={stats.openOps} 
          sub={`R$ ${(stats.totalRevenuePotential/1000).toFixed(1)}k em potencial`} 
          icon={Factory} 
          color="blue" 
          activeKey="overview"
          onClick={setActiveView}
        />
        <StatCard 
          title="Peças em Atraso" 
          value={stats.delayedPieces} 
          sub={`Crítico: ${stats.delayedOps} OPs`} 
          icon={AlertCircle} 
          color="red" 
          activeKey="delayed"
          onClick={setActiveView}
        />
        <StatCard 
          title="Lead Time Médio" 
          value={`${stats.avgLeadTime} Dias`} 
          sub="Meta: 12 Dias" 
          icon={Clock} 
          color="orange" 
          activeKey="overview" 
          onClick={setActiveView}
        />
        <StatCard 
          title="Qualidade Facção" 
          value={`${stats.efficiencyRate}%`} 
          sub="Aprovado 1ª" 
          icon={CheckCircle2} 
          color="green" 
          activeKey="efficiency"
          onClick={setActiveView}
        />
      </div>

      {/* EXPANDED DETAILS SECTION (DRILL DOWN) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-500">
          
          {/* VIEW: OVERVIEW / WIP */}
          {activeView === 'overview' && (
              <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2">
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2"><Factory className="text-blue-600"/> Distribuição de OPs (WIP)</h3>
                      <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={getWipData()} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                                  <XAxis type="number" hide/>
                                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fontWeight: 'bold'}}/>
                                  <Tooltip cursor={{fill: '#f0f9ff'}} contentStyle={{borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}/>
                                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={32}>
                                      {getWipData().map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={['#94a3b8', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899'][index % 5]} />
                                      ))}
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
                  
                  {/* METAS CARD - CONNECTED TO REAL DATA */}
                  <div 
                    onClick={() => navigate('/goals')}
                    className="bg-blue-50 rounded-xl p-6 border border-blue-100 flex flex-col justify-center items-center text-center cursor-pointer hover:shadow-md hover:bg-blue-100 transition-all group relative overflow-hidden"
                  >
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-blue-600 group-hover:scale-110 transition-transform relative z-10">
                          <Target size={32}/>
                      </div>
                      <h4 className="text-blue-900 font-bold text-lg relative z-10">Meta de Produção</h4>
                      <div className="text-4xl font-bold text-blue-600 my-2 relative z-10">{goalStats.percent}%</div>
                      <div className="text-xs text-blue-800 bg-blue-200/50 px-2 py-1 rounded font-mono mb-2 relative z-10 capitalize">
                          {goalStats.monthLabel}
                      </div>
                      <p className="text-sm text-blue-700 relative z-10 flex flex-col gap-1">
                          <span>Real: <b>{goalStats.realized}</b></span>
                          <span>Meta: <b>{goalStats.target}</b></span>
                      </p>
                      
                      {/* Progress Bar Background */}
                      <div className="absolute bottom-0 left-0 h-2 bg-blue-200 w-full">
                          <div className="h-full bg-blue-600 transition-all duration-1000" style={{width: `${Math.min(100, goalStats.percent)}%`}}></div>
                      </div>

                      <span className="mt-6 text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg group-hover:bg-blue-700 transition-colors flex items-center gap-1 relative z-10">
                          Gerenciar Metas <ArrowRight size={12}/>
                      </span>
                  </div>
              </div>
          )}

          {/* VIEW: DELAYED OPS */}
          {activeView === 'delayed' && (
              <div className="p-6 bg-red-50/50">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="text-red-600"/> OPs Críticas (Atrasadas)</h3>
                      <button onClick={() => navigate('/ops')} className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1 rounded font-bold hover:bg-red-50">Gerenciar OPs</button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white rounded-xl shadow-sm border p-4">
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Top Atrasos (Dias)</h4>
                          <div className="h-60">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={getDelayData()}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                      <XAxis dataKey="name" tick={{fontSize: 10}}/>
                                      <YAxis hide/>
                                      <Tooltip/>
                                      <Bar dataKey="days" fill="#ef4444" radius={[4, 4, 0, 0]} name="Dias Atraso"/>
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-red-100 text-red-800 font-bold">
                                  <tr>
                                      <th className="p-3">OP</th>
                                      <th className="p-3">Entrega</th>
                                      <th className="p-3 text-right">Atraso</th>
                                      <th className="p-3 text-right">Qtd</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-red-100">
                                  {allOps.filter(o => new Date(o.dueDate) < new Date() && o.status !== OrderStatus.COMPLETED && o.status !== OrderStatus.CANCELLED).slice(0, 5).map(op => {
                                      const daysLate = Math.floor((new Date().getTime() - new Date(op.dueDate).getTime()) / (1000 * 3600 * 24));
                                      return (
                                          <tr key={op.id} className="hover:bg-red-50 cursor-pointer" onClick={() => navigate('/ops', { state: { highlightOpId: op.id } })}>
                                              <td className="p-3 font-bold text-red-700">{op.lotNumber}</td>
                                              <td className="p-3 text-gray-500">{new Date(op.dueDate).toLocaleDateString()}</td>
                                              <td className="p-3 text-right font-bold text-red-600">+{daysLate}d</td>
                                              <td className="p-3 text-right">{op.quantityTotal}</td>
                                          </tr>
                                      );
                                  })}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          )}

          {/* VIEW: EFFICIENCY */}
          {activeView === 'efficiency' && (
              <div className="p-6 bg-green-50/50">
                  <h3 className="font-bold text-green-800 mb-6 flex items-center gap-2"><CheckCircle2 className="text-green-600"/> Qualidade Recente</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col items-center justify-center">
                          <div className="text-5xl font-bold text-green-600 mb-2">{stats.efficiencyRate}%</div>
                          <div className="text-sm text-gray-500 font-medium">Aprovação Direta (1ª)</div>
                      </div>
                      <div className="col-span-2 bg-white p-6 rounded-xl border shadow-sm">
                          <h4 className="text-xs font-bold text-gray-500 uppercase mb-4">Volume Aprovado vs Retrabalho (Últimas OPs)</h4>
                          <div className="h-40">
                              <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart data={getQualityChartData()}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                      <XAxis dataKey="name" hide/>
                                      <Tooltip/>
                                      <Area type="monotone" dataKey="aprovado" stackId="1" stroke="#16a34a" fill="#22c55e" name="Aprovado" />
                                      <Area type="monotone" dataKey="defeito" stackId="1" stroke="#dc2626" fill="#ef4444" name="Defeito/Retrabalho" />
                                  </AreaChart>
                              </ResponsiveContainer>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* --- DECISION SUPPORT SECTION --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* 1. NEW: FINISHING PRIORITY (Sales Type) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
              <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                  <h3 className="font-bold text-indigo-900 flex items-center gap-2"><Flame size={18} className="text-purple-600"/> Prioridade de Entrega</h3>
                  <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full font-bold">Fase Final</span>
              </div>
              <div className="flex-1 p-6 flex flex-col justify-center">
                  {finishingPriority.length > 0 ? (
                      <div className="space-y-4">
                          <p className="text-xs text-gray-500 mb-2">Produtos em Revisão ou Embalagem agrupados por potencial de venda.</p>
                          {finishingPriority.map((item, idx) => (
                              <div key={idx}>
                                  <div className="flex justify-between text-sm font-bold mb-1">
                                      <span style={{color: item.color}}>{item.name}</span>
                                      <span>{item.value} pçs</span>
                                  </div>
                                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full transition-all" style={{width: '100%', backgroundColor: item.color}}></div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="text-center text-gray-400">
                          <PackageCheck size={48} className="mx-auto mb-2 opacity-20"/>
                          <p>Nenhum produto em fase final.</p>
                      </div>
                  )}
              </div>
              <div className="p-3 border-t bg-gray-50 text-center">
                  <button onClick={() => navigate('/packing')} className="text-sm font-bold text-indigo-600 hover:underline">Ir para Embalagem</button>
              </div>
          </div>

          {/* 2. URGENT PURCHASES */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
              <div className="p-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                  <h3 className="font-bold text-orange-900 flex items-center gap-2"><ShoppingBag size={18}/> Compras Urgentes</h3>
                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full font-bold">{urgentMaterials.length} Itens</span>
              </div>
              <div className="flex-1 overflow-y-auto max-h-80 p-0">
                  {urgentMaterials.length > 0 ? (
                      <table className="w-full text-sm text-left">
                          <tbody className="divide-y divide-gray-100">
                              {urgentMaterials.map((item, i) => (
                                  <tr key={i} className="hover:bg-orange-50/50 group">
                                      <td className="p-4">
                                          <div className="font-bold text-gray-800">{item.material.name}</div>
                                          <div className="text-xs text-gray-500">{item.material.supplier}</div>
                                      </td>
                                      <td className="p-4 text-right">
                                          <div className="text-xs text-red-500 font-bold uppercase">Faltam</div>
                                          <div className="font-bold text-gray-900">{item.missing} {item.material.unit}</div>
                                      </td>
                                      <td className="p-4 w-10">
                                          <button className="text-blue-600 hover:bg-blue-50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" title="Ver Detalhes">
                                              <ArrowRight size={16}/>
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                          <CheckCircle2 size={48} className="mb-2 text-green-200"/>
                          <p>Estoque de insumos OK.</p>
                      </div>
                  )}
              </div>
              <div className="p-3 border-t bg-gray-50 text-center">
                  <button onClick={() => navigate('/consolidation')} className="text-sm font-bold text-blue-600 hover:underline">Ver Consolidação Completa</button>
              </div>
          </div>

          {/* 3. QUICK ACTIONS / SHORTCUTS */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-lg text-white p-6 flex flex-col justify-between">
              <div>
                  <h3 className="font-bold text-lg mb-1 flex items-center gap-2"><Factory className="text-blue-400"/> Ações Rápidas</h3>
                  <p className="text-slate-400 text-sm mb-6">Atalhos para operações frequentes.</p>
                  
                  <div className="space-y-3">
                      <button onClick={() => navigate('/ops/new')} className="w-full bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl flex items-center justify-between transition-colors group">
                          <div className="flex items-center gap-3">
                              <div className="bg-blue-700/50 p-2 rounded-lg"><TrendingUp size={18}/></div>
                              <span className="font-bold">Nova OP</span>
                          </div>
                          <ArrowRight size={16} className="text-blue-300 group-hover:translate-x-1 transition-transform"/>
                      </button>

                      <button onClick={() => navigate('/cutting')} className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl flex items-center justify-between transition-colors group">
                          <div className="flex items-center gap-3">
                              <div className="bg-slate-800 p-2 rounded-lg"><Clock size={18}/></div>
                              <span className="font-bold">Apontar Corte</span>
                          </div>
                          <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform"/>
                      </button>

                      <button onClick={() => navigate('/subcontractors')} className="w-full bg-slate-700 hover:bg-slate-600 text-white p-3 rounded-xl flex items-center justify-between transition-colors group">
                          <div className="flex items-center gap-3">
                              <div className="bg-slate-800 p-2 rounded-lg"><PackageX size={18}/></div>
                              <span className="font-bold">Gerar Remessa</span>
                          </div>
                          <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform"/>
                      </button>
                  </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-700">
                  <div className="flex justify-between items-end">
                      <div>
                          <div className="text-xs text-slate-400 uppercase font-bold">Total em Aberto</div>
                          <div className="text-2xl font-bold text-white">{stats.openOps} Ordens</div>
                      </div>
                      <div className="h-10 w-20">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={[{v:10}, {v:15}, {v:12}, {v:20}, {v:18}, {v:25}]}>
                                  <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false}/>
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>
          </div>

      </div>
    </div>
  );
};
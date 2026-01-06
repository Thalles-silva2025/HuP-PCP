
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ProductionGoal, ProductionOrder, OrderStatus } from '../types';
import { MockService } from '../services/mockDb';
import { Target, TrendingUp, Calendar, Save, BarChart3, Settings, X, Activity, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { 
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  RadialBarChart, RadialBar, PolarAngleAxis
} from 'recharts';

// --- TYPES & HELPERS ---
interface PeriodMetric {
    label: string;
    days: number;
    realized: number;
    target: number;
    percent: number;
}

const COLORS = {
    low: '#ef4444',    // < 70%
    mid: '#f59e0b',    // 70% - 99%
    high: '#10b981',   // >= 100%
    super: '#9333ea'   // >= 110% (Overachievement)
};

const getColor = (percent: number) => {
    if (percent >= 110) return COLORS.super;
    if (percent >= 100) return COLORS.high;
    if (percent >= 70) return COLORS.mid;
    return COLORS.low;
};

export const ProductionGoalModule: React.FC = () => {
  const currentYear = new Date().getFullYear();
  
  // State
  const [selectedYear, setSelectedYear] = useState(2025); // Default to 2025 as per request context
  const [goals, setGoals] = useState<ProductionGoal[]>([]);
  const [ops, setOps] = useState<ProductionOrder[]>([]); // Need raw OPs for precise date calcs
  const [loading, setLoading] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Year Picker State
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [pickerStartYear, setPickerStartYear] = useState(2020);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
            setIsYearPickerOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync Picker Page with Selected Year
  useEffect(() => {
      if (isYearPickerOpen) {
          const base = 2020;
          const diff = selectedYear - base;
          // Calculate which 9-year page the selected year belongs to
          // If selected is 2025, diff is 5. 5/9 = 0. Page 0 starts at 2020.
          // If selected is 2030, diff is 10. 10/9 = 1. Page 1 starts at 2029.
          const pageIndex = Math.floor(diff / 9);
          // Ensure we don't go below 2020 if something weird happens, though logic handles it.
          const start = base + (pageIndex * 9); 
          setPickerStartYear(start < 2020 ? 2020 : start);
      }
  }, [isYearPickerOpen, selectedYear]);

  const loadData = async () => {
    setLoading(true);
    const [allGoals, allOps] = await Promise.all([
        MockService.getProductionGoals(),
        MockService.getProductionOrders()
    ]);
    setGoals(allGoals);
    setOps(allOps.filter(op => op.status === OrderStatus.COMPLETED && op.packingDetails?.packedDate));
    setLoading(false);
  };

  // --- CALCULATION ENGINE ---

  // 1. Annual Chart Data
  const annualData = useMemo(() => {
      const data = [];
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      
      for (let i = 0; i < 12; i++) {
          const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
          
          // Target
          const goal = goals.find(g => g.month === monthStr)?.targetQuantity || 0;
          
          // Realized (Filter OPs in this month/year)
          const realized = ops
            .filter(op => {
                const d = new Date(op.packingDetails!.packedDate!);
                return d.getFullYear() === selectedYear && d.getMonth() === i;
            })
            .reduce((sum, op) => sum + op.quantityTotal, 0);

          data.push({
              name: months[i],
              fullName: `${months[i]}/${selectedYear}`,
              monthKey: monthStr,
              meta: goal,
              realizado: realized,
              delta: realized - goal,
              percent: goal > 0 ? (realized / goal) * 100 : 0
          });
      }
      return data;
  }, [selectedYear, goals, ops]);

  // 2. Precise Date Range Calculator (7, 15, 21...)
  const calculatePeriodMetrics = (days: number, refDate: Date): PeriodMetric => {
      const endDate = new Date(refDate);
      const startDate = new Date(refDate);
      startDate.setDate(endDate.getDate() - days);

      // A. Realized in Period
      const realized = ops
        .filter(op => {
            const d = new Date(op.packingDetails!.packedDate!);
            return d >= startDate && d <= endDate;
        })
        .reduce((sum, op) => sum + op.quantityTotal, 0);

      // B. Target in Period (Daily Pro-Rata)
      // This iterates day by day to find the goal for that specific month
      let totalTarget = 0;
      const tempDate = new Date(startDate);
      
      while (tempDate <= endDate) {
          const mKey = `${tempDate.getFullYear()}-${(tempDate.getMonth() + 1).toString().padStart(2, '0')}`;
          const monthlyGoal = goals.find(g => g.month === mKey)?.targetQuantity || 0;
          
          // Days in this month
          const daysInMonth = new Date(tempDate.getFullYear(), tempDate.getMonth() + 1, 0).getDate();
          
          totalTarget += (monthlyGoal / daysInMonth);
          
          tempDate.setDate(tempDate.getDate() + 1);
      }

      const safeTarget = Math.max(1, Math.round(totalTarget));
      
      return {
          label: `${days} Dias`,
          days,
          realized,
          target: safeTarget,
          percent: Math.round((realized / safeTarget) * 100) // Allow > 100
      };
  };

  const periodMetrics = useMemo(() => {
      // Find latest OP date to use as reference "Today" if data is in future (2025)
      let refDate = new Date();
      if (ops.length > 0) {
          const maxDate = new Date(Math.max(...ops.map(o => new Date(o.packingDetails!.packedDate!).getTime())));
          if (maxDate > refDate) refDate = maxDate;
      }

      return [
          calculatePeriodMetrics(7, refDate),
          calculatePeriodMetrics(15, refDate),
          calculatePeriodMetrics(21, refDate),
          calculatePeriodMetrics(30, refDate),
          calculatePeriodMetrics(60, refDate),
          calculatePeriodMetrics(90, refDate)
      ];
  }, [goals, ops]); 

  // --- ACTIONS ---

  const handleGoalChange = (monthKey: string, val: string) => {
      const numVal = parseInt(val.replace(/\D/g, '')) || 0;
      const newGoals = [...goals];
      const idx = newGoals.findIndex(g => g.month === monthKey);
      
      if (idx !== -1) newGoals[idx].targetQuantity = numVal;
      else newGoals.push({ month: monthKey, targetQuantity: numVal });
      
      setGoals(newGoals);
  };

  const saveAllGoals = async () => {
      // Save all goals in state to mockDb
      for (const g of goals) {
          await MockService.saveProductionGoal(g);
      }
      setIsConfigModalOpen(false);
      alert('Metas atualizadas com sucesso!');
  };

  // --- RENDERERS ---

  const renderGaugeCard = (metric: PeriodMetric) => {
      const color = getColor(metric.percent);
      const data = [{ name: 'L', value: metric.percent, fill: color }];
      
      // Calculate dynamic max domain. If percent > 100, scale the chart so bar fits.
      const maxDomain = Math.max(100, metric.percent);

      return (
          <div key={metric.days} className="bg-white rounded-xl border shadow-sm p-4 flex flex-col items-center relative overflow-hidden group hover:shadow-md transition-all">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <Activity size={12}/> Últimos {metric.days} Dias
              </h4>
              
              <div className="h-32 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart 
                        innerRadius="60%" 
                        outerRadius="100%" 
                        barSize={10} 
                        data={data} 
                        startAngle={180} 
                        endAngle={0}
                      >
                          <PolarAngleAxis type="number" domain={[0, maxDomain]} angleAxisId={0} tick={false} />
                          <RadialBar background dataKey="value" cornerRadius={10} />
                      </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                      <span className="text-3xl font-bold" style={{color}}>{metric.percent}%</span>
                      <span className="text-xs text-gray-400">da Meta</span>
                  </div>
              </div>

              <div className="w-full grid grid-cols-2 text-center text-xs mt-2 border-t pt-2">
                  <div>
                      <div className="text-gray-400">Realizado</div>
                      <div className="font-bold text-gray-700">{metric.realized.toLocaleString()}</div>
                  </div>
                  <div>
                      <div className="text-gray-400">Meta</div>
                      <div className="font-bold text-gray-700">{metric.target.toLocaleString()}</div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-8 pb-20 animate-fade-in bg-gray-50 min-h-screen">
        {/* HEADER BAR */}
        <div className="bg-white border-b sticky top-0 z-20 px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-sm">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="text-indigo-600" /> Dashboard de Metas (BI)
                </h1>
                <p className="text-gray-500 text-sm">Acompanhamento em tempo real da performance produtiva.</p>
            </div>
            
            <div className="flex items-center gap-4 mt-4 md:mt-0">
                {/* Modern Square Year Picker */}
                <div className="relative" ref={pickerRef}>
                    <button 
                        onClick={() => setIsYearPickerOpen(!isYearPickerOpen)}
                        className="bg-white border-2 border-gray-200 rounded-xl px-4 py-2 flex items-center gap-3 text-gray-700 hover:border-indigo-500 hover:text-indigo-600 transition-all font-bold shadow-sm"
                    >
                        <Calendar size={18} />
                        <span className="text-lg">{selectedYear}</span>
                        <ChevronDown size={16} className={`transition-transform duration-300 ${isYearPickerOpen ? 'rotate-180' : ''}`}/>
                    </button>

                    {isYearPickerOpen && (
                        <div className="absolute top-full right-0 md:left-0 md:right-auto mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl p-4 z-50 w-72 animate-fade-in-down">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
                                <button onClick={() => setPickerStartYear(prev => prev - 9)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 transition-colors"><ChevronLeft size={20}/></button>
                                <span className="text-sm font-bold text-gray-500">Período: {pickerStartYear} - {pickerStartYear + 8}</span>
                                <button onClick={() => setPickerStartYear(prev => prev + 9)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 transition-colors"><ChevronRight size={20}/></button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {Array.from({length: 9}).map((_, i) => {
                                    const y = pickerStartYear + i;
                                    const isSelected = y === selectedYear;
                                    const isCurrent = y === currentYear;
                                    return (
                                        <button 
                                            key={y} 
                                            onClick={() => { setSelectedYear(y); setIsYearPickerOpen(false); }}
                                            className={`
                                                h-12 rounded-lg text-sm font-bold transition-all relative flex items-center justify-center
                                                ${isSelected 
                                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105 z-10' 
                                                    : 'bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-transparent hover:border-indigo-100'
                                                }
                                            `}
                                        >
                                            {y}
                                            {isCurrent && !isSelected && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-green-500 rounded-full"></span>}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <button 
                    onClick={() => setIsConfigModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                    <Settings size={18}/> Definir Metas
                </button>
            </div>
        </div>

        <div className="px-6 space-y-8">
            {/* ANNUAL CHART SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2"><TrendingUp/> Evolução Anual ({selectedYear})</h3>
                        <div className="flex gap-4 text-xs font-bold">
                            <span className="flex items-center gap-1 text-blue-500"><div className="w-3 h-3 bg-blue-500 rounded-full"/> Realizado</span>
                            <span className="flex items-center gap-1 text-red-400"><div className="w-3 h-3 bg-red-400 rounded-full"/> Meta</span>
                        </div>
                    </div>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={annualData} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" tick={{fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                <YAxis tick={{fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                <Tooltip 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                                    cursor={{fill: '#f8fafc'}}
                                />
                                <Bar dataKey="realizado" name="Realizado" barSize={32} fill="#3b82f6" radius={[6,6,0,0]} />
                                <Line type="monotone" dataKey="meta" name="Meta" stroke="#ef4444" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: 'white'}} activeDot={{r: 6}} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Annual Stats Card */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl flex flex-col justify-between h-[180px]">
                        <div>
                            <div className="text-indigo-100 font-bold text-sm uppercase mb-1">Total Acumulado ({selectedYear})</div>
                            <div className="text-4xl font-bold">{annualData.reduce((a,b)=>a+b.realizado,0).toLocaleString()} <span className="text-lg opacity-60">pçs</span></div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm opacity-80 mb-2">
                                <span>Progresso da Meta Anual</span>
                                <span>{Math.round((annualData.reduce((a,b)=>a+b.realizado,0) / Math.max(1, annualData.reduce((a,b)=>a+b.meta,0))) * 100)}%</span>
                            </div>
                            <div className="w-full bg-black/20 rounded-full h-2">
                                <div 
                                    className="bg-white h-full rounded-full transition-all duration-1000" 
                                    style={{width: `${Math.min(100, (annualData.reduce((a,b)=>a+b.realizado,0) / Math.max(1, annualData.reduce((a,b)=>a+b.meta,0))) * 100)}%`}}
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-6 border shadow-sm h-[190px] flex flex-col justify-center">
                        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Target size={18}/> Status Geral</h4>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="text-green-600"/>
                                    <span className="text-sm font-bold text-gray-700">Meses na Meta</span>
                                </div>
                                <span className="font-bold text-green-700">{annualData.filter(d => d.realizado >= d.meta && d.meta > 0).length}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100">
                                <div className="flex items-center gap-2">
                                    <AlertCircle size={16} className="text-red-500"/>
                                    <span className="text-sm font-bold text-gray-700">Abaixo da Meta</span>
                                </div>
                                <span className="font-bold text-red-600">{annualData.filter(d => d.realizado < d.meta && d.meta > 0).length}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BREAKDOWN SECTION (7, 15, 21, 30, 60, 90) */}
            <div>
                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Activity className="text-orange-500"/> Análise de Performance (Curto Prazo)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {periodMetrics.map(metric => renderGaugeCard(metric))}
                </div>
            </div>
        </div>

        {/* --- GOAL CONFIGURATION MODAL --- */}
        {isConfigModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-indigo-600 p-6 flex justify-between items-center shrink-0">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Settings/> Configuração de Metas ({selectedYear})
                        </h2>
                        <button onClick={() => setIsConfigModalOpen(false)} className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors">
                            <X size={24}/>
                        </button>
                    </div>
                    
                    <div className="p-8 overflow-y-auto bg-gray-50 flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {annualData.map((data, i) => {
                                // Find current goal in state or default to 0
                                const currentGoal = goals.find(g => g.month === data.monthKey)?.targetQuantity || 0;
                                
                                return (
                                    <div key={i} className="bg-white p-4 rounded-xl border shadow-sm hover:border-indigo-300 transition-colors">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-bold text-gray-700 uppercase text-sm tracking-wide">{data.name}</span>
                                            <span className="text-xs text-indigo-500 font-bold bg-indigo-50 px-2 py-1 rounded">
                                                Ref: {data.monthKey}
                                            </span>
                                        </div>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                className="w-full border-2 border-gray-200 rounded-lg pl-3 pr-10 py-3 font-bold text-lg text-gray-800 outline-none focus:border-indigo-500 transition-all text-center"
                                                value={currentGoal}
                                                onChange={(e) => handleGoalChange(data.monthKey, e.target.value)}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold pointer-events-none">UN</span>
                                        </div>
                                        <div className="mt-2 text-center text-xs text-gray-400">
                                            Realizado: {data.realizado}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-6 border-t bg-white flex justify-end gap-3 shrink-0">
                        <button onClick={() => setIsConfigModalOpen(false)} className="px-6 py-2 rounded-lg text-gray-600 font-bold hover:bg-gray-100 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={saveAllGoals} className="px-8 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 shadow-lg shadow-green-200 transition-colors flex items-center gap-2">
                            <Save size={18}/> Salvar Todas as Metas
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

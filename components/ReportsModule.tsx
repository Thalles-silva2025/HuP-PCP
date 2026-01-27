
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area, PieChart, Pie, Cell, LabelList,
  ComposedChart, Scatter, ReferenceLine, ScatterChart, ZAxis
} from 'recharts';
import { 
  DollarSign, Filter, Calendar, ArrowLeft, Scissors, Layers, 
  Activity, Package, Printer, Wallet, Clock, List, Crown, AlertOctagon, TrendingDown, Loader2, ChevronRight, ChevronDown, Scale, AlertTriangle, TrendingUp, CheckCircle2, XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiService } from '../services/api';
import { OrderStatus, ProductionOrder, Product, Material, SubcontractorOrder, PaymentRecord } from '../types';
import { useQuery } from '@tanstack/react-query';

// --- TYPES ---
type ReportType = 
  | 'hub'
  | 'cost-real-vs-theory' 
  | 'cutting-efficiency' 
  | 'lead-time'
  | 'quality-ranking'
  | 'cash-flow'
  | 'abc-analysis'
  | 'stockout-prediction'
  | 'monthly-ops'
  | 'execution-list'
  | 'financial-deep-dive';

interface FilterState {
  startDate: string;
  endDate: string;
  collection: string;
  partner: string;
}

// COLORS PALETTE
const COLORS = {
    primary: '#4f46e5', // Indigo
    success: '#10b981', // Emerald
    warning: '#f59e0b', // Amber
    danger: '#ef4444',  // Red
    info: '#3b82f6',    // Blue
    slate: '#64748b',   // Slate
    chart: ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#10b981', '#14b8a6']
};

export const ReportsModule: React.FC = () => {
  const navigate = useNavigate();
  const [activeReport, setActiveReport] = useState<ReportType>('hub');
  const [executionTab, setExecutionTab] = useState<'cuts'|'sewing'|'reviews'|'packing'>('cuts');
  const [selectedFinancialOp, setSelectedFinancialOp] = useState<string | null>(null);

  // Date Logic
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [filters, setFilters] = useState<FilterState>({
    startDate: firstDay,
    endDate: lastDay,
    collection: '',
    partner: ''
  });

  // --- SMART CACHE (DATA FETCHING) ---
  const { data: ops = [] } = useQuery<ProductionOrder[]>({ queryKey: ['productionOrders'], queryFn: ApiService.getProductionOrders, staleTime: 1000 * 60 * 5 });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ['products'], queryFn: ApiService.getProducts, staleTime: 1000 * 60 * 10 });
  const { data: materials = [] } = useQuery<Material[]>({ queryKey: ['materials'], queryFn: ApiService.getMaterials, staleTime: 1000 * 60 * 10 });
  const { data: osfs = [] } = useQuery<SubcontractorOrder[]>({ queryKey: ['subcontractorOrders'], queryFn: ApiService.getSubcontractorOrders, staleTime: 1000 * 60 * 5 });
  const { data: payments = [] } = useQuery<PaymentRecord[]>({ queryKey: ['payments'], queryFn: ApiService.getPayments, staleTime: 1000 * 60 * 5 });

  // --- FILTER ENGINE ---
  const filteredOps = useMemo(() => {
      const start = new Date(filters.startDate).setHours(0,0,0,0);
      const end = new Date(filters.endDate).setHours(23,59,59,999);

      return ops.filter(op => {
          const opDate = new Date(op.createdAt).getTime();
          const prod = products.find(p => p.id === op.productId);
          
          const dateCheck = opDate >= start && opDate <= end;
          const collCheck = filters.collection ? prod?.collection === filters.collection : true;
          const partnerCheck = filters.partner ? op.subcontractor === filters.partner : true;

          return dateCheck && collCheck && partnerCheck;
      });
  }, [ops, products, filters]);

  // --- ANALYTICS ENGINE (QUALITY & EVOLUTION) ---
  const getQualityAnalytics = () => {
      // 1. Evolution Data (Last 12 Months)
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const currentYear = new Date().getFullYear();
      const evolutionMap: Record<string, any> = {};
      const partnersList = new Set<string>();

      // Init Structure
      months.forEach((m, idx) => {
          evolutionMap[idx] = { name: m, total: 0 };
      });

      // Process OSFs for Evolution
      osfs.forEach(osf => {
          const date = new Date(osf.returnDate || osf.sentDate); // Use return date for realized production
          // Fixed type overlap issue by casting status to string for legacy support
          if (date.getFullYear() === currentYear && (osf.status === 'Concluido' || (osf.status as string) === 'Concluído' || osf.status === 'Parcial')) {
              const monthIdx = date.getMonth();
              const partner = osf.subcontractorName;
              const qty = osf.receivedQuantity || 0;

              partnersList.add(partner);
              if (!evolutionMap[monthIdx][partner]) evolutionMap[monthIdx][partner] = 0;
              evolutionMap[monthIdx][partner] += qty;
              evolutionMap[monthIdx].total += qty;
          }
      });

      const evolutionData = Object.values(evolutionMap);

      // 2. Performance Matrix & KPIs
      const partnerStats: Record<string, { 
          name: string, 
          totalSent: number, 
          totalReceived: number, 
          totalDefect: number, 
          leadTimeSum: number, 
          count: number 
      }> = {};

      osfs.forEach(osf => {
          if (!partnerStats[osf.subcontractorName]) {
              partnerStats[osf.subcontractorName] = { name: osf.subcontractorName, totalSent: 0, totalReceived: 0, totalDefect: 0, leadTimeSum: 0, count: 0 };
          }
          
          const stats = partnerStats[osf.subcontractorName];
          stats.totalSent += (osf.sentQuantity || 0);
          stats.totalReceived += (osf.receivedQuantity || 0);
          stats.totalDefect += (osf.defectiveQuantity || 0);
          
          if (osf.returnDate && osf.sentDate) {
              const start = new Date(osf.sentDate).getTime();
              const end = new Date(osf.returnDate).getTime();
              const days = (end - start) / (1000 * 3600 * 24);
              if (days > 0) {
                  stats.leadTimeSum += days;
                  stats.count++;
              }
          }
      });

      const matrixData = Object.values(partnerStats).map(p => {
          const avgLeadTime = p.count > 0 ? p.leadTimeSum / p.count : 0;
          const defectRate = p.totalReceived > 0 ? (p.totalDefect / p.totalReceived) * 100 : 0;
          const volume = p.totalReceived;
          const reworkQty = Math.round(p.totalDefect * 0.7); // Estimativa de retrabalho vs perda
          const lossQty = p.totalDefect - reworkQty;
          // Score: 100 - (defectRate * 2) - (leadTime/2), capped at 100
          const score = Math.max(0, Math.min(100, 100 - (defectRate * 5) - (avgLeadTime * 0.5)));

          return {
              name: p.name,
              x: Number(avgLeadTime.toFixed(1)), // Lead Time
              y: Number(defectRate.toFixed(2)), // Defect %
              z: volume, // Bubble Size
              score: Math.round(score),
              reworkQty,
              lossQty,
              totalDefect: p.totalDefect,
              volume
          };
      });

      // KPI Aggregates
      const totalVol = matrixData.reduce((a,b) => a + b.volume, 0);
      const totalDefects = matrixData.reduce((a,b) => a + b.totalDefect, 0);
      const avgDefectRate = totalVol > 0 ? (totalDefects / totalVol) * 100 : 0;
      const weightedLeadTime = totalVol > 0 ? matrixData.reduce((a,b) => a + (b.x * b.volume), 0) / totalVol : 0;
      const estimatedLossValue = totalDefects * 15; // Estimativa R$ 15,00 custo médio por erro
      const bestPartner = matrixData.sort((a,b) => b.score - a.score)[0];

      return {
          evolutionData,
          partners: Array.from(partnersList),
          matrixData,
          kpis: {
              avgDefectRate,
              avgLeadTime: weightedLeadTime,
              estimatedLossValue,
              bestPartner
          }
      };
  };

  // --- EXISTING GENERATORS (PRESERVED) ---
  const getAdvancedCuttingStats = () => {
      const cuttingData: any[] = [];
      let onTime = 0;
      let late = 0;

      filteredOps.forEach(op => {
          if (op.cuttingDetails?.jobs && op.cuttingDetails.jobs.length > 0) {
              const prod = products.find(p => p.id === op.productId);
              const tp = prod?.techPacks.find(t => t.version === op.techPackVersion) || prod?.techPacks[0];
              
              const expectedConsumption = tp?.materials.reduce((acc, m) => {
                  const mat = materials.find(x => x.id === m.materialId);
                  return mat?.type === 'Tecido' ? acc + (m.usagePerPiece * (1 + m.wasteMargin)) : acc;
              }, 0) || 0;

              let totalWeight = 0;
              let totalPieces = 0;
              let totalWaste = 0;
              let maxDate = new Date(0);

              op.cuttingDetails.jobs.forEach(job => {
                  totalWeight += (job.markerWeight || 0);
                  totalWaste += (job.wasteWeight || 0);
                  totalPieces += job.totalPieces;
                  const d = new Date(job.date);
                  if (d > maxDate) maxDate = d;
              });

              if (totalPieces > 0) {
                  const realConsumption = (totalWeight + totalWaste) / totalPieces;
                  const avgFabricCost = 45; 
                  const costPerPiece = realConsumption * avgFabricCost;

                  const plannedCutEnd = op.phaseDates?.cuttingEnd ? new Date(op.phaseDates.cuttingEnd) : null;
                  const isLate = plannedCutEnd ? maxDate > plannedCutEnd : false;
                  if (isLate) late++; else onTime++;

                  cuttingData.push({
                      lot: op.lotNumber,
                      product: prod?.sku,
                      realConsumption,
                      expectedConsumption,
                      efficiency: expectedConsumption > 0 ? (expectedConsumption / realConsumption) * 100 : 100,
                      costPerPiece,
                      isLate,
                      totalPieces
                  });
              }
          }
      });

      return {
          cuttingData: cuttingData.sort((a,b) => a.efficiency - b.efficiency),
          deadlineStats: [
              { name: 'No Prazo', value: onTime, fill: '#10b981' },
              { name: 'Atrasado', value: late, fill: '#ef4444' }
          ]
      };
  };

  const getFinancialDeepDive = () => {
      return filteredOps.map(op => {
          const prod = products.find(p => p.id === op.productId);
          const tp = prod?.techPacks.find(t => t.version === op.techPackVersion) || prod?.techPacks[0];
          
          const fabricPurchased = op.fabricPurchasedTotal || op.cuttingDetails?.jobs?.reduce((a,b) => a + (b.markerWeight || 0) + (b.wasteWeight || 0), 0) || 0;
          const fabricWaste = op.cuttingDetails?.jobs?.reduce((a,b) => a + (b.wasteWeight || 0), 0) || 0;
          const fabricUtilized = Math.max(0, fabricPurchased - fabricWaste);
          
          const fabricMaterial = tp?.materials.find(m => {
              const mat = materials.find(x => x.id === m.materialId);
              return mat?.type === 'Tecido';
          });
          const unitPrice = materials.find(m => m.id === fabricMaterial?.materialId)?.costUnit || 45; 

          const totalFabricSpent = fabricUtilized * unitPrice;
          const totalWasteCost = fabricWaste * unitPrice;

          const laborSpent = payments.filter(p => p.opId === op.id).reduce((a,b) => a + b.totalAmount, 0);
          
          const totalCostReal = totalFabricSpent + laborSpent;
          const revenuePotential = op.quantityTotal * (tp?.suggestedPrice || 0);
          const margin = revenuePotential - totalCostReal;

          return {
              op, prod, tp, fabricPurchased, fabricWaste, fabricUtilized, unitPrice, totalFabricSpent, totalWasteCost, laborSpent, totalCostReal, revenuePotential, margin,
              marginPercent: revenuePotential > 0 ? (margin / revenuePotential) * 100 : 0
          };
      }).filter(item => item.totalCostReal > 0);
  };

  const getCashFlowAnalysis = () => {
      const timeline: Record<string, { date: string, paid: number, overdue: number, open: number }> = {};
      const partnerTotal: Record<string, number> = {};
      const partnerLateTotal: Record<string, number> = {};

      payments.forEach(p => {
          const dStr = p.dueDate || p.date;
          if (!dStr) return;
          const date = new Date(dStr);
          if (isNaN(date.getTime())) return;

          const monthKey = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
          
          if (!timeline[monthKey]) timeline[monthKey] = { date: monthKey, paid: 0, overdue: 0, open: 0 };
          
          const val = p.totalAmount;
          const paidVal = p.amountPaid;
          const remaining = val - paidVal;

          if (p.status === 'Pago') {
              timeline[monthKey].paid += val;
          } else {
              if (paidVal > 0) timeline[monthKey].paid += paidVal;
              // Fixed: Removed redundant p.status !== 'Pago' check since we are in else block
              const isOverdue = new Date(p.dueDate || p.date) < new Date(); 
              if (isOverdue) timeline[monthKey].overdue += remaining;
              else timeline[monthKey].open += remaining;
          }

          if (!partnerTotal[p.partnerName]) partnerTotal[p.partnerName] = 0;
          partnerTotal[p.partnerName] += val;

          if (new Date(p.dueDate || p.date) < new Date() && p.status !== 'Pago') {
              if (!partnerLateTotal[p.partnerName]) partnerLateTotal[p.partnerName] = 0;
              partnerLateTotal[p.partnerName] += remaining;
          }
      });

      const timelineData = Object.values(timeline);
      const partnerPie = Object.entries(partnerTotal).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 6);
      const partnerLate = Object.entries(partnerLateTotal).map(([name, lateAmount]) => ({ name, lateAmount })).sort((a,b) => b.lateAmount - a.lateAmount).slice(0, 10);

      return { timelineData, partnerPie, partnerLate };
  };

  const getABCData = () => {
      return materials.map(m => ({
          name: m.name,
          stock: m.currentStock,
          unit: m.unit,
          value: m.currentStock * m.costUnit
      })).sort((a,b) => b.value - a.value);
  };

  const getLeadTimeData = () => {
      return filteredOps.map(op => {
          const start = new Date(op.startDate).getTime();
          const end = op.packingDetails?.packedDate ? new Date(op.packingDetails.packedDate).getTime() : new Date().getTime();
          const due = new Date(op.dueDate).getTime();
          
          const totalDays = Math.ceil((end - start) / (1000 * 3600 * 24));
          const delay = Math.ceil((end - due) / (1000 * 3600 * 24));
          const isLate = delay > 0;

          const cutDays = 2; 
          const sewDays = Math.max(1, totalDays - 5);
          const finishDays = 3;

          return {
              lot: op.lotNumber,
              totalDays,
              stages: { cut: cutDays, sew: sewDays, finish: finishDays },
              isLate,
              delay
          };
      }).sort((a,b) => b.totalDays - a.totalDays);
  };

  // --- RENDER HELPERS ---

  const renderHeader = (title: string, icon: any, subtitle?: string) => (
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
              <button onClick={() => setActiveReport('hub')} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 transition-colors">
                  <ArrowLeft size={24}/>
              </button>
              <div>
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      {React.createElement(icon, { size: 28, className: "text-indigo-600" })}
                      {title}
                  </h2>
                  {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
              </div>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 shadow-sm transition-colors no-print">
              <Printer size={18}/> Imprimir
          </button>
      </div>
  );

  const renderHub = () => {
      const cards = [
          { id: 'quality-ranking', title: 'Ranking de Qualidade & Facções', icon: Crown, color: 'purple', desc: 'Performance, taxa de defeitos e evolução de parceiros.' },
          { id: 'financial-deep-dive', title: 'Finanças & Custos Reais', icon: DollarSign, color: 'green', desc: 'Análise detalhada de insumos, quebras e margem real por OP.' },
          { id: 'cutting-efficiency', title: 'Eficiência de Corte', icon: Scissors, color: 'teal', desc: 'Aproveitamento, custo por peça e cumprimento de prazos.' },
          { id: 'cash-flow', title: 'Fluxo de Caixa', icon: Wallet, color: 'blue', desc: 'Contas a pagar, previsões e atrasos.' },
          { id: 'lead-time', title: 'Lead Time (Prazos)', icon: Clock, color: 'orange', desc: 'Tempo de ciclo e gargalos produtivos.' },
          { id: 'abc-analysis', title: 'Curva ABC Estoque', icon: Package, color: 'indigo', desc: 'Valorização de inventário.' },
          { id: 'stockout-prediction', title: 'Previsão de Ruptura', icon: TrendingDown, color: 'red', desc: 'Riscos de falta de material.' },
          { id: 'monthly-ops', title: 'Volume de OPs', icon: Layers, color: 'slate', desc: 'Listagem geral de ordens.' },
      ];

      return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
              <div className="col-span-full mb-4">
                  <h2 className="text-3xl font-bold text-gray-900">Central de Relatórios</h2>
                  <p className="text-gray-500">Inteligência de negócio e análise de performance.</p>
              </div>

              {cards.map(card => (
                  <div 
                    key={card.id} 
                    onClick={() => setActiveReport(card.id as ReportType)}
                    className={`bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden`}
                  >
                      <div className={`absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity text-${card.color}-600`}>
                          {React.createElement(card.icon, { size: 100 })}
                      </div>
                      <div className={`w-12 h-12 rounded-xl bg-${card.color}-50 text-${card.color}-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                          {React.createElement(card.icon, { size: 24 })}
                      </div>
                      <h3 className="font-bold text-gray-800 text-lg mb-1 group-hover:text-indigo-600 transition-colors">{card.title}</h3>
                      <p className="text-sm text-gray-500">{card.desc}</p>
                  </div>
              ))}

              <div onClick={() => setActiveReport('execution-list')} className="col-span-full mt-4 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 text-white cursor-pointer hover:shadow-2xl transition-all flex items-center justify-between group">
                  <div>
                      <h3 className="font-bold text-2xl mb-2 flex items-center gap-3"><List size={28}/> Relatório de Execução Detalhada</h3>
                      <p className="text-slate-400">Listagem completa e auditável de todos os apontamentos (Corte, Costura, Revisão).</p>
                  </div>
                  <div className="bg-white/10 p-3 rounded-full group-hover:bg-white/20 transition-colors">
                      <ChevronRight size={32}/>
                  </div>
              </div>
          </div>
      );
  };

  // --- RENDER: QUALITY & PERFORMANCE ---
  const renderQualityReport = () => {
      const { evolutionData, partners, matrixData, kpis } = getQualityAnalytics();

      return (
          <div className="space-y-8 animate-fade-in">
              {renderHeader('Ranking de Qualidade & Performance', Crown, 'Análise 360º de Facções: Volume, Defeitos e Pontualidade.')}

              {/* 1. EVOLUTION CHART (HIGHLIGHT) */}
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-6">
                      <div>
                          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                              <TrendingUp className="text-indigo-600"/> Evolução de Entregas (Facções)
                          </h3>
                          <p className="text-gray-500 text-sm">Volume de peças entregues mês a mês no ano atual.</p>
                      </div>
                      <div className="flex gap-2">
                          {partners.map((p, i) => (
                              <div key={p} className="flex items-center gap-1 text-xs font-bold text-gray-600">
                                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS.chart[i % COLORS.chart.length]}}></div>
                                  {p}
                              </div>
                          ))}
                      </div>
                  </div>
                  <div className="h-[350px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={evolutionData} margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                              <defs>
                                  {partners.map((p, i) => (
                                      <linearGradient key={p} id={`color${i}`} x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor={COLORS.chart[i % COLORS.chart.length]} stopOpacity={0.8}/>
                                          <stop offset="95%" stopColor={COLORS.chart[i % COLORS.chart.length]} stopOpacity={0}/>
                                      </linearGradient>
                                  ))}
                              </defs>
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}}/>
                              <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}}/>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb"/>
                              <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}/>
                              {partners.map((p, i) => (
                                  <Area 
                                      key={p} 
                                      type="monotone" 
                                      dataKey={p} 
                                      stroke={COLORS.chart[i % COLORS.chart.length]} 
                                      fillOpacity={1} 
                                      fill={`url(#color${i})`} 
                                      stackId="1"
                                  />
                              ))}
                          </AreaChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* 2. KPI CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-xl border-l-4 border-green-500 shadow-sm">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-1">Taxa Média Defeitos</div>
                      <div className={`text-3xl font-bold ${kpis.avgDefectRate > 3 ? 'text-red-600' : 'text-green-600'}`}>
                          {kpis.avgDefectRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-400 mt-2">Meta: {'<'} 3.0%</div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-1">Lead Time Médio (Ciclo)</div>
                      <div className="text-3xl font-bold text-blue-600">
                          {kpis.avgLeadTime.toFixed(1)} <span className="text-sm text-gray-400 font-normal">dias</span>
                      </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border-l-4 border-red-500 shadow-sm">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-1">Prejuízo (Não-Qualidade)</div>
                      <div className="text-3xl font-bold text-red-600">
                          R$ {kpis.estimatedLossValue.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-400 mt-2">Est. R$ 15/peça com defeito</div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border-l-4 border-purple-500 shadow-sm">
                      <div className="text-xs font-bold text-gray-500 uppercase mb-1">Melhor Parceiro</div>
                      <div className="text-xl font-bold text-purple-700 truncate" title={kpis.bestPartner?.name || '-'}>
                          {kpis.bestPartner?.name || '-'}
                      </div>
                      <div className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded w-fit mt-2">
                          Score: {kpis.bestPartner?.score || 0}/100
                      </div>
                  </div>
              </div>

              {/* 3. MATRIX & COMPOSITION CHARTS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Scatter Matrix */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="mb-4">
                          <h4 className="font-bold text-gray-800 flex items-center gap-2"><Activity size={18}/> Matriz de Desempenho</h4>
                          <p className="text-xs text-gray-500">Cruza velocidade de entrega (Eixo X) com qualidade (Eixo Y).</p>
                      </div>
                      <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart margin={{top: 20, right: 20, bottom: 20, left: 0}}>
                                  <CartesianGrid strokeDasharray="3 3"/>
                                  <XAxis type="number" dataKey="x" name="Dias" unit="d" label={{ value: 'Tempo Médio (Dias)', position: 'bottom', offset: 0 }} />
                                  <YAxis type="number" dataKey="y" name="Defeito" unit="%" label={{ value: '% Defeito', angle: -90, position: 'insideLeft' }} />
                                  <ZAxis type="number" dataKey="z" range={[50, 400]} name="Volume" />
                                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({payload}) => {
                                      if (payload && payload.length) {
                                          const data = payload[0].payload;
                                          return (
                                              <div className="bg-white p-2 border shadow rounded text-xs">
                                                  <b>{data.name}</b><br/>
                                                  Tempo: {data.x} dias<br/>
                                                  Defeito: {data.y}%<br/>
                                                  Vol: {data.z} pçs
                                              </div>
                                          );
                                      }
                                      return null;
                                  }}/>
                                  <ReferenceLine y={3} stroke="green" strokeDasharray="3 3" label="Meta Qualidade"/>
                                  <Scatter name="Partners" data={matrixData} fill="#8884d8">
                                      {matrixData.map((entry, index) => (
                                          <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />
                                      ))}
                                  </Scatter>
                              </ScatterChart>
                          </ResponsiveContainer>
                      </div>
                  </div>

                  {/* Composition Chart */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="mb-4">
                          <h4 className="font-bold text-gray-800 flex items-center gap-2"><AlertTriangle size={18}/> Composição de Não-Conformidade</h4>
                          <p className="text-xs text-gray-500">Proporção de Retrabalho (Recuperável) vs Perda Total.</p>
                      </div>
                      <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={matrixData} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                                  <XAxis type="number"/>
                                  <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}}/>
                                  <Tooltip/>
                                  <Legend/>
                                  <Bar dataKey="lossQty" name="Rejeição (Perda)" stackId="a" fill="#ef4444" />
                                  <Bar dataKey="reworkQty" name="Retrabalho (Recuperável)" stackId="a" fill="#f59e0b" />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>

              {/* 4. DETAILED TABLE */}
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b font-bold text-gray-700">Tabela Detalhada de Performance</div>
                  <table className="w-full text-sm text-left">
                      <thead className="bg-white text-gray-50 border-b">
                          <tr>
                              <th className="p-4">Parceiro</th>
                              <th className="p-4 text-center">Score</th>
                              <th className="p-4 text-center">Volume</th>
                              <th className="p-4 text-center">Prazo Médio</th>
                              <th className="p-4 text-right">Retrabalho</th>
                              <th className="p-4 text-right text-red-600">Perda</th>
                              <th className="p-4 text-right">% Defeito</th>
                              <th className="p-4 text-right">Custo Est.</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y">
                          {matrixData.sort((a,b) => b.score - a.score).map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                  <td className="p-4 font-bold text-gray-800">{row.name}</td>
                                  <td className="p-4 text-center">
                                      <span className={`px-2 py-1 rounded text-xs font-bold text-white ${row.score >= 90 ? 'bg-green-500' : row.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                          {row.score}
                                      </span>
                                  </td>
                                  <td className="p-4 text-center">{row.volume}</td>
                                  <td className="p-4 text-center">{row.x} dias</td>
                                  <td className="p-4 text-right text-yellow-600 font-medium">{row.reworkQty}</td>
                                  <td className="p-4 text-right text-red-600 font-bold">{row.lossQty}</td>
                                  <td className="p-4 text-right font-bold">{row.y}%</td>
                                  <td className="p-4 text-right text-gray-500">R$ {(row.totalDefect * 15).toLocaleString()}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  return (
    <div className="space-y-8 pb-20 bg-gray-50/50 min-h-screen">
        {/* FILTER BAR */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center justify-between no-print sticky top-0 z-20">
            <div className="flex items-center gap-2 text-gray-700 font-bold">
                <Filter size={20} className="text-indigo-600"/> 
                <span className="hidden md:inline">Filtros de Análise</span>
            </div>
            <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                    <input type="date" className="bg-transparent border-none text-sm font-medium focus:ring-0" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})}/>
                    <span className="text-gray-400">-</span>
                    <input type="date" className="bg-transparent border-none text-sm font-medium focus:ring-0" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})}/>
                </div>
                <select className="border-gray-200 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" value={filters.collection} onChange={e => setFilters({...filters, collection: e.target.value})}>
                    <option value="">Todas as Coleções</option>
                    {Array.from(new Set(products.map(p => p.collection))).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button 
                    onClick={() => { /* Cache handles invalidation */ }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    Aplicar
                </button>
            </div>
        </div>

        <div className="px-1">
            {activeReport === 'hub' && renderHub()}

            {activeReport === 'quality-ranking' && renderQualityReport()}

            {/* --- UPGRADED CUTTING REPORT --- */}
            {activeReport === 'cutting-efficiency' && (
                <div>
                    {renderHeader('Dashboard de Eficiência do Corte', Scissors, 'Análise de custo por peça, quebra e cumprimento de prazos.')}
                    {(() => {
                        const { cuttingData, deadlineStats } = getAdvancedCuttingStats();
                        return (
                            <div className="space-y-8 animate-fade-in">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Cost Per Piece Chart */}
                                    <div className="bg-white p-6 rounded-xl border shadow-sm h-80">
                                        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><DollarSign size={16}/> Custo Médio por Peça (Tecido)</h4>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={cuttingData.slice(0, 10)}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                                <XAxis dataKey="lot" tick={{fontSize: 10}}/>
                                                <YAxis tickFormatter={(val) => `R$ ${val}`}/>
                                                <Tooltip formatter={(val: number) => `R$ ${val.toFixed(2)}`} cursor={{fill: '#f8fafc'}}/>
                                                <Bar dataKey="costPerPiece" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Custo Tecido/Peça"/>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Deadline Pie Chart */}
                                    <div className="bg-white p-6 rounded-xl border shadow-sm h-80 flex flex-col">
                                        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Clock size={16}/> Cumprimento de Prazos do Corte</h4>
                                        <div className="flex-1">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={deadlineStats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                        {deadlineStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                                    </Pie>
                                                    <Tooltip/>
                                                    <Legend verticalAlign="middle" align="right"/>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Yield Table */}
                                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                    <div className="p-4 border-b bg-gray-50 flex items-center gap-2">
                                        <Scale size={18} className="text-gray-600"/>
                                        <h4 className="font-bold text-gray-800">Relatório de Quebra de Rendimento</h4>
                                    </div>
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-100 font-bold text-gray-600">
                                            <tr>
                                                <th className="p-4">Lote / Produto</th>
                                                <th className="p-4 text-center">Consumo Teórico (Ficha)</th>
                                                <th className="p-4 text-center">Consumo Real (Corte)</th>
                                                <th className="p-4 text-right">Eficiência</th>
                                                <th className="p-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {cuttingData.map((row, i) => {
                                                const efficiencyDrop = row.efficiency < 98;
                                                return (
                                                    <tr key={i} className="hover:bg-gray-50">
                                                        <td className="p-4">
                                                            <div className="font-bold text-gray-800">{row.lot}</div>
                                                            <div className="text-xs text-gray-500">{row.product}</div>
                                                        </td>
                                                        <td className="p-4 text-center">{row.expectedConsumption.toFixed(3)} kg/pç</td>
                                                        <td className="p-4 text-center font-bold">{row.realConsumption.toFixed(3)} kg/pç</td>
                                                        <td className={`p-4 text-right font-bold ${efficiencyDrop ? 'text-red-600' : 'text-green-600'}`}>
                                                            {row.efficiency.toFixed(1)}%
                                                        </td>
                                                        <td className="p-4 text-center">
                                                            {efficiencyDrop ? (
                                                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">Rendimento Baixo</span>
                                                            ) : (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-bold">Excelente</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* --- FINANCIAL DEEP DIVE REPORT (NEW) --- */}
            {activeReport === 'financial-deep-dive' && (
                <div>
                    {renderHeader('Finanças & Custos Reais', DollarSign, 'Raio-X financeiro por Ordem de Produção (Realizado vs Teórico).')}
                    
                    <div className="grid grid-cols-1 gap-6 animate-fade-in">
                        {getFinancialDeepDive().map((data) => {
                            const isExpanded = selectedFinancialOp === data.op.id;
                            return (
                                <div key={data.op.id} className={`bg-white rounded-xl shadow-sm border transition-all ${isExpanded ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:border-indigo-300'}`}>
                                    {/* Card Header (Clickable) */}
                                    <div 
                                        onClick={() => setSelectedFinancialOp(isExpanded ? null : data.op.id)}
                                        className="p-5 cursor-pointer flex flex-col md:flex-row justify-between items-center gap-4"
                                    >
                                        <div className="flex items-center gap-4 w-full md:w-auto">
                                            <div className={`p-3 rounded-full ${data.marginPercent > 30 ? 'bg-green-100 text-green-600' : data.marginPercent > 15 ? 'bg-yellow-100 text-yellow-600' : 'bg-red-100 text-red-600'}`}>
                                                <DollarSign size={24}/>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500 font-bold uppercase tracking-wide">OP: {data.op.lotNumber}</div>
                                                <div className="text-lg font-bold text-gray-900">{data.prod?.name}</div>
                                            </div>
                                        </div>

                                        <div className="flex gap-8 text-center w-full md:w-auto justify-around md:justify-end">
                                            <div>
                                                <div className="text-xs text-gray-400 uppercase">Custo Real</div>
                                                <div className="font-bold text-gray-700">R$ {data.totalCostReal.toLocaleString()}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-400 uppercase">Lucro Est.</div>
                                                <div className={`font-bold ${data.margin > 0 ? 'text-green-600' : 'text-red-600'}`}>R$ {data.margin.toLocaleString()}</div>
                                            </div>
                                            <div className="hidden md:block">
                                                <ChevronDown size={20} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}/>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="p-6 border-t bg-gray-50/50 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-down">
                                            
                                            {/* LEFT: Numbers Logic */}
                                            <div className="space-y-6">
                                                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                                    <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><Scale size={16}/> Cálculo do Tecido Realizado</h4>
                                                    <div className="text-sm space-y-2">
                                                        <div className="flex justify-between">
                                                            <span className="text-indigo-700">Total Comprado:</span>
                                                            <span className="font-bold">{data.fabricPurchased.toFixed(2)} kg</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-red-600">(-) Peso Retalhos (Desperdício):</span>
                                                            <span className="font-bold text-red-600">-{data.fabricWaste.toFixed(2)} kg</span>
                                                        </div>
                                                        <div className="border-t border-indigo-200 my-1 pt-1 flex justify-between font-bold">
                                                            <span className="text-indigo-900">(=) Total Utilizado Líquido:</span>
                                                            <span>{data.fabricUtilized.toFixed(2)} kg</span>
                                                        </div>
                                                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                                                            <span>Custo Unitário (Médio):</span>
                                                            <span>R$ {data.unitPrice.toFixed(2)} / kg</span>
                                                        </div>
                                                        <div className="bg-white p-2 rounded border border-indigo-100 text-center mt-2 font-bold text-lg text-indigo-700 shadow-sm">
                                                            Total Gasto Tecido: R$ {data.totalFabricSpent.toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                                                        <div className="text-xs text-gray-500 uppercase">Custo Mão de Obra</div>
                                                        <div className="text-lg font-bold text-gray-800">R$ {data.laborSpent.toLocaleString()}</div>
                                                    </div>
                                                    <div className="bg-white p-3 rounded-lg border shadow-sm">
                                                        <div className="text-xs text-gray-500 uppercase">Custo Desperdício</div>
                                                        <div className="text-lg font-bold text-red-500">R$ {data.totalWasteCost.toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* RIGHT: Charts */}
                                            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col items-center justify-center">
                                                <h4 className="font-bold text-gray-700 mb-4 w-full text-left">Composição da Margem</h4>
                                                <div className="w-full h-48">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart layout="vertical" data={[
                                                            { name: 'Tecido', value: data.totalFabricSpent, fill: '#3b82f6' },
                                                            { name: 'Mão Obra', value: data.laborSpent, fill: '#f59e0b' },
                                                            { name: 'Desperdício', value: data.totalWasteCost, fill: '#ef4444' },
                                                            { name: 'Lucro', value: data.margin, fill: '#10b981' },
                                                        ]}>
                                                            <XAxis type="number" hide/>
                                                            <YAxis type="category" dataKey="name" width={80} tick={{fontSize: 11}}/>
                                                            <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString()}`}/>
                                                            <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
                                                                {
                                                                    [
                                                                        { fill: '#3b82f6' },
                                                                        { fill: '#f59e0b' },
                                                                        { fill: '#ef4444' },
                                                                        { fill: '#10b981' }
                                                                    ].map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                                                    ))
                                                                }
                                                                <LabelList dataKey="value" position="right" formatter={(val: number) => `R$ ${val.toFixed(0)}`} style={{fontSize: 11, fill: '#666'}}/>
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="w-full mt-4 pt-4 border-t flex justify-between items-center">
                                                    <span className="text-xs text-gray-500 uppercase font-bold">Potencial de Venda</span>
                                                    <span className="text-xl font-bold text-purple-700">R$ {data.revenuePotential.toLocaleString()}</span>
                                                </div>
                                            </div>

                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {getFinancialDeepDive().length === 0 && (
                            <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border border-dashed">
                                Nenhuma OP com dados financeiros suficientes para análise.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- CASH FLOW REPORT --- */}
            {activeReport === 'cash-flow' && (
                <div>
                    {renderHeader('Fluxo de Caixa & Pagamentos', Wallet, 'Análise de vencimentos, realizados e performance de pagamentos.')}
                    {(() => {
                        const { timelineData, partnerPie, partnerLate } = getCashFlowAnalysis();
                        return (
                            <div className="space-y-6 animate-fade-in">
                                {/* Main Chart */}
                                <div className="bg-white p-6 rounded-xl border shadow-sm h-96">
                                    <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2"><Activity size={18}/> Linha do Tempo Financeira</h4>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={timelineData} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                            <XAxis dataKey="date" tick={{fontSize: 11}} minTickGap={30}/>
                                            <YAxis />
                                            <Tooltip cursor={{fill: '#f8fafc'}}/>
                                            <Legend verticalAlign="top" height={36}/>
                                            <Bar dataKey="paid" name="Pago" stackId="a" fill="#10b981" />
                                            <Bar dataKey="overdue" name="Vencido" stackId="a" fill="#ef4444" />
                                            <Bar dataKey="open" name="A Vencer" stackId="a" fill="#fbbf24" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Partner Share */}
                                    <div className="bg-white p-6 rounded-xl border shadow-sm h-80 flex flex-col">
                                        <h4 className="font-bold text-gray-700 mb-4">Volume por Parceiro (Top 6)</h4>
                                        <div className="flex-1">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie data={partnerPie} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                        {partnerPie.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />)}
                                                    </Pie>
                                                    <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString()}`}/>
                                                    <Legend layout="vertical" verticalAlign="middle" align="right"/>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Late Payments */}
                                    <div className="bg-white p-6 rounded-xl border shadow-sm h-80">
                                        <h4 className="font-bold text-gray-700 mb-4 text-red-600 flex items-center gap-2"><AlertOctagon size={16}/> Ranking de Atrasos</h4>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={partnerLate} layout="vertical" margin={{left: 20}}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                                                <XAxis type="number" hide/>
                                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}}/>
                                                <Tooltip formatter={(val: number) => `R$ ${val.toLocaleString()}`}/>
                                                <Bar dataKey="lateAmount" fill="#ef4444" radius={[0,4,4,0]} barSize={20}>
                                                    <LabelList dataKey="lateAmount" position="right" formatter={(val: number) => `R$ ${val/1000}k`} style={{fontSize: 10, fontWeight: 'bold', fill: '#ef4444'}}/>
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* --- ABC ANALYSIS --- */}
            {activeReport === 'abc-analysis' && (
                <div>
                    {renderHeader('Curva ABC de Materiais', Package)}
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 font-bold text-gray-600"><tr><th className="p-4">Material</th><th className="p-4 text-right">Estoque</th><th className="p-4 text-right">Valor Total</th></tr></thead>
                            <tbody className="divide-y">{getABCData().map((m,i)=>(<tr key={i} className="hover:bg-gray-50"><td className="p-4">{m.name}</td><td className="p-4 text-right">{m.stock} {m.unit}</td><td className="p-4 text-right font-bold">R$ {m.value.toFixed(2)}</td></tr>))}</tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- LEAD TIME REPORT --- */}
            {activeReport === 'lead-time' && (
                <div>
                    {renderHeader('Lead Time (Tempos de Ciclo)', Clock, 'Análise de duração real vs prazos.')}
                    {(() => {
                        const data = getLeadTimeData();
                        const avgTotal = data.reduce((a,b) => a+b.totalDays, 0) / (data.length || 1);
                        
                        return (
                            <div className="space-y-6 animate-fade-in">
                                {/* Timeline Chart */}
                                <div className="bg-white p-6 rounded-xl border shadow-sm h-96">
                                    <h4 className="font-bold text-gray-700 mb-4">Ciclo de Produção (Dias Corridos)</h4>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.slice(0, 20)} margin={{top: 20, right: 30, left: 0, bottom: 5}}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                                            <XAxis dataKey="lot" tick={{fontSize: 10}}/>
                                            <YAxis />
                                            <Tooltip cursor={{fill: '#f8fafc'}}/>
                                            <Legend/>
                                            <ReferenceLine y={avgTotal} stroke="red" strokeDasharray="3 3" label="Média"/>
                                            <Bar dataKey="stages.cut" name="Corte" stackId="a" fill="#f59e0b" />
                                            <Bar dataKey="stages.sew" name="Costura" stackId="a" fill="#6366f1" />
                                            <Bar dataKey="stages.finish" name="Acabamento" stackId="a" fill="#10b981" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Detailed Table */}
                                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-600 font-bold">
                                            <tr>
                                                <th className="p-4">Lote</th>
                                                <th className="p-4 text-center">Dias Totais</th>
                                                <th className="p-4 text-center">Corte</th>
                                                <th className="p-4 text-center">Facção</th>
                                                <th className="p-4 text-center">Acab.</th>
                                                <th className="p-4 text-right">Atraso</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {data.map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50">
                                                    <td className="p-4 font-mono font-bold text-indigo-600">{row.lot}</td>
                                                    <td className="p-4 text-center font-bold">{row.totalDays}</td>
                                                    <td className="p-4 text-center text-gray-500">{row.stages.cut}</td>
                                                    <td className="p-4 text-center text-gray-500">{row.stages.sew}</td>
                                                    <td className="p-4 text-center text-gray-500">{row.stages.finish}</td>
                                                    <td className={`p-4 text-right font-bold ${row.isLate ? 'text-red-600' : 'text-green-600'}`}>
                                                        {row.isLate ? `+${row.delay} dias` : 'No Prazo'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* --- EXECUTION LIST --- */}
            {activeReport === 'execution-list' && (
                <div>
                    {renderHeader('Listagem de Execução', List)}
                    <div className="flex gap-2 mb-4">
                        {['cuts','sewing','reviews','packing'].map(tab => (
                            <button key={tab} onClick={() => setExecutionTab(tab as any)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${executionTab === tab ? 'bg-indigo-600 text-white shadow' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                                {tab === 'cuts' ? 'Cortes' : tab === 'sewing' ? 'Facção' : tab === 'reviews' ? 'Revisão' : 'Embalagem'}
                            </button>
                        ))}
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 font-bold text-gray-600">
                                <tr><th className="p-4">Data</th><th className="p-4">Lote</th><th className="p-4">Detalhe</th><th className="p-4 text-right">Qtd</th></tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredOps.map(op => {
                                    if(executionTab === 'cuts' && op.cuttingDetails?.jobs) return op.cuttingDetails.jobs.map(j => <tr key={j.id}><td className="p-4">{new Date(j.date).toLocaleDateString()}</td><td className="p-4 font-mono">{op.lotNumber}</td><td className="p-4">{j.cutterName} ({j.cutType})</td><td className="p-4 text-right font-bold">{j.totalPieces}</td></tr>);
                                    if(executionTab === 'sewing') return osfs.filter(o => o.opId === op.id).map(osf => <tr key={osf.id}><td className="p-4">{new Date(osf.sentDate).toLocaleDateString()}</td><td className="p-4 font-mono">{op.lotNumber}</td><td className="p-4">{osf.subcontractorName}</td><td className="p-4 text-right font-bold">{osf.sentQuantity}</td></tr>);
                                    return null;
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

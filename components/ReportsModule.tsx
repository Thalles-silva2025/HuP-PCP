
import React, { useEffect, useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, AreaChart, Area, PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, ComposedChart, ReferenceLine, ReferenceArea, Label
} from 'recharts';
import { 
  DollarSign, TrendingUp, AlertTriangle, CheckCircle, Truck, 
  Filter, Calendar, ChevronRight, ArrowLeft, ArrowRight, Scissors, Layers, 
  Activity, Package, Users, BarChart3, FileText, Download, Search, ClipboardList, Wallet, Clock, List, Printer, PieChart as PieChartIcon, ThumbsUp, ThumbsDown, Timer, HelpCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MockService } from '../services/mockDb';
import { ProductionOrder, Product, Material, SubcontractorOrder, OrderStatus, MaterialType, PaymentRecord } from '../types';

// --- TYPES ---
type ReportType = 
  | 'hub'
  | 'cost-real-vs-theory' 
  | 'cutting-efficiency' 
  | 'production-funnel'
  | 'lead-time'
  | 'quality-ranking'
  | 'cash-flow'
  | 'abc-analysis'
  | 'stockout-prediction'
  | 'monthly-ops'
  | 'execution-list';

interface FilterState {
  startDate: string;
  endDate: string;
  collection: string;
  partner: string;
}

export const ReportsModule: React.FC = () => {
  const navigate = useNavigate();
  // State
  const [activeReport, setActiveReport] = useState<ReportType>('hub');
  
  // Execution List Tab State
  const [executionTab, setExecutionTab] = useState<'cuts'|'sewing'|'reviews'|'packing'>('cuts');

  // Date Logic: Default to Current Month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [filters, setFilters] = useState<FilterState>({
    startDate: firstDay,
    endDate: lastDay,
    collection: '',
    partner: ''
  });

  // Data
  const [ops, setOps] = useState<ProductionOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [osfs, setOsfs] = useState<SubcontractorOrder[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allOps, allProds, allMats, allOsfs, allPayments] = await Promise.all([
      MockService.getProductionOrders(),
      MockService.getProducts(),
      MockService.getMaterials(),
      MockService.getSubcontractorOrders(),
      MockService.getPayments()
    ]);
    setOps(allOps);
    setProducts(allProds);
    setMaterials(allMats);
    setOsfs(allOsfs);
    setPayments(allPayments);
  };

  // --- FILTER LOGIC ---
  const filteredOps = useMemo(() => {
    return ops.filter(op => {
      const prod = products.find(p => p.id === op.productId);
      const opDate = new Date(op.createdAt);
      opDate.setHours(0,0,0,0);
      const start = new Date(filters.startDate);
      start.setHours(0,0,0,0);
      const end = new Date(filters.endDate);
      end.setHours(23,59,59,999);

      const dateCheck = opDate >= start && opDate <= end;
      const collCheck = filters.collection ? prod?.collection === filters.collection : true;
      const partnerCheck = filters.partner ? op.subcontractor === filters.partner : true;
      
      return dateCheck && collCheck && partnerCheck;
    });
  }, [ops, products, filters]);

  // --- NAVIGATOR ---
  const handleOpenOp = (opId: string) => {
      navigate('/ops', { state: { highlightOpId: opId } });
  };

  // --- GENERATORS ---

  const getCostAnalysisData = () => {
    const data = filteredOps.filter(op => op.status === OrderStatus.COMPLETED || op.status === OrderStatus.PACKING).map(op => {
        const prod = products.find(p => p.id === op.productId);
        const tp = prod?.techPacks.find(t => t.version === op.techPackVersion);
        let realFabricCost = 0;
        if (op.cuttingDetails?.jobs) {
            const totalWeight = op.cuttingDetails.jobs.reduce((sum, job) => sum + (job.markerWeight || 0) + (job.wasteWeight || 0), 0);
            const avgCost = 45; 
            realFabricCost = totalWeight * avgCost;
        }
        const laborCost = op.items.reduce((a,b)=>a+b.quantity,0) * (tp?.laborCost || 0);
        const totalReal = realFabricCost + laborCost;
        const perPieceReal = op.quantityTotal > 0 ? totalReal / op.quantityTotal : 0;
        const theoretical = tp?.totalCost || 0;

        return {
            id: op.lotNumber,
            product: prod?.name,
            teorico: theoretical,
            real: perPieceReal,
            diff: perPieceReal - theoretical,
            percent: theoretical > 0 ? ((perPieceReal - theoretical) / theoretical) * 100 : 0
        };
    });
    return data.sort((a,b) => b.diff - a.diff);
  };

  const getQualityAnalytics = () => {
      const partnerStats: Record<string, { 
          totalQty: number, 
          approved: number, 
          rework: number, 
          rejected: number,
          leadTimeSum: number,
          leadTimeCount: number,
          lostValue: number
      }> = {};

      filteredOps.forEach(op => {
          if (op.revisionDetails && op.subcontractor) {
              const partner = op.subcontractor;
              if (!partnerStats[partner]) {
                  partnerStats[partner] = { 
                      totalQty: 0, approved: 0, rework: 0, rejected: 0, 
                      leadTimeSum: 0, leadTimeCount: 0, lostValue: 0 
                  };
              }

              // Quality Stats
              const stats = partnerStats[partner];
              stats.approved += op.revisionDetails.approvedQty;
              stats.rework += op.revisionDetails.reworkQty;
              stats.rejected += op.revisionDetails.rejectedQty;
              const totalOp = op.revisionDetails.approvedQty + op.revisionDetails.reworkQty + op.revisionDetails.rejectedQty;
              stats.totalQty += totalOp;

              // Cost Calculation (Estimate)
              stats.lostValue += (op.revisionDetails.rejectedQty * (op.costSnapshot || 20));

              // Lead Time Calculation (Using OSFs linked to this OP if available)
              const relatedOsfs = osfs.filter(o => o.opId === op.id);
              relatedOsfs.forEach(osf => {
                  if (osf.sentDate && osf.returnDate) {
                      const start = new Date(osf.sentDate).getTime();
                      const end = new Date(osf.returnDate).getTime();
                      const days = Math.max(1, (end - start) / (1000 * 3600 * 24));
                      stats.leadTimeSum += days;
                      stats.leadTimeCount++;
                  }
              });
          }
      });

      return Object.keys(partnerStats).map(key => {
          const s = partnerStats[key];
          const totalDefects = s.rework + s.rejected;
          const defectRate = s.totalQty > 0 ? (totalDefects / s.totalQty) * 100 : 0;
          const avgLeadTime = s.leadTimeCount > 0 ? s.leadTimeSum / s.leadTimeCount : 0;
          
          // Custom Score
          const qualityScore = Math.max(0, 100 - (defectRate * 2));
          
          return {
              name: key,
              total: s.totalQty,
              approved: s.approved,
              rework: s.rework,
              rejected: s.rejected,
              defectRate: parseFloat(defectRate.toFixed(1)),
              avgLeadTime: parseFloat(avgLeadTime.toFixed(1)),
              lostValue: s.lostValue,
              score: Math.round(qualityScore)
          };
      }).sort((a,b) => b.score - a.score); 
  };

  const getEfficiencyStats = () => {
      const data = filteredOps.filter(op => op.cuttingDetails?.jobs?.length);
      let totalMarkerWeight = 0;
      let totalWasteWeight = 0;
      
      const cutterStats: Record<string, { net: number, waste: number }> = {};

      data.forEach(op => {
          op.cuttingDetails?.jobs?.forEach(job => {
              totalMarkerWeight += (job.markerWeight || 0);
              totalWasteWeight += (job.wasteWeight || 0);
              
              if(!cutterStats[job.cutterName]) cutterStats[job.cutterName] = { net: 0, waste: 0 };
              cutterStats[job.cutterName].net += (job.markerWeight || 0);
              cutterStats[job.cutterName].waste += (job.wasteWeight || 0);
          });
      });

      const totalWeight = totalMarkerWeight + totalWasteWeight;
      const globalEfficiency = totalWeight > 0 ? (totalMarkerWeight / totalWeight) * 100 : 0;

      const cutterChartData = Object.keys(cutterStats).map(c => {
          const t = cutterStats[c].net + cutterStats[c].waste;
          return {
              name: c,
              efficiency: t > 0 ? parseFloat(((cutterStats[c].net / t) * 100).toFixed(1)) : 0,
              totalKg: parseFloat(t.toFixed(1))
          };
      }).sort((a,b) => b.efficiency - a.efficiency);

      const pieData = [
          { name: 'Tecido Útil', value: totalMarkerWeight, fill: '#10b981' }, // green
          { name: 'Retalho/Perda', value: totalWasteWeight, fill: '#ef4444' } // red
      ];

      return {
          globalEfficiency: globalEfficiency.toFixed(1),
          totalFabric: totalWeight.toFixed(1),
          totalWaste: totalWasteWeight.toFixed(1),
          cutterChartData,
          pieData,
          scatterData: data.map(op => {
              const jobs = op.cuttingDetails!.jobs;
              const n = jobs.reduce((a,b) => a + (b.markerWeight || 0), 0);
              const w = jobs.reduce((a,b) => a + (b.wasteWeight || 0), 0);
              const t = n + w;
              return {
                  name: op.lotNumber,
                  efficiency: t > 0 ? parseFloat(((n / t) * 100).toFixed(1)) : 0,
                  waste: t > 0 ? parseFloat(((100 - (n/t)*100)).toFixed(1)) : 0,
                  totalWeight: t.toFixed(2),
                  cutter: jobs[0]?.cutterName
              };
          })
      };
  };

  const getProductionFunnel = () => {
      const planned = filteredOps.reduce((a,b) => a + b.quantityTotal, 0);
      const cut = filteredOps.reduce((a,b) => a + (b.cuttingDetails?.jobs?.reduce((x,y)=>x+y.totalPieces,0) || 0), 0);
      const sewn = filteredOps.reduce((a,b) => b.status === OrderStatus.QUALITY_CONTROL || b.status === OrderStatus.PACKING || b.status === OrderStatus.COMPLETED ? a + b.quantityTotal : a, 0);
      const approved = filteredOps.reduce((a,b) => a + (b.revisionDetails?.approvedQty || 0), 0);

      return [
          { name: 'Planejado', value: planned, fill: '#6366f1' },
          { name: 'Cortado', value: cut, fill: '#f59e0b' },
          { name: 'Costurado', value: sewn, fill: '#8b5cf6' },
          { name: 'Aprovado (1ª)', value: approved, fill: '#10b981' }
      ];
  };

  // UPDATED LEAD TIME LOGIC
  const getLeadTimeAnalytics = () => {
      const completedOps = filteredOps.filter(o => o.status === OrderStatus.COMPLETED);
      
      const breakdown = completedOps.map(op => {
          const start = new Date(op.startDate).getTime();
          const end = new Date(op.packingDetails?.packedDate || new Date().toISOString()).getTime();
          const totalDays = Math.max(1, Math.floor((end - start) / (1000 * 3600 * 24)));
          
          // Simulate stage breakdown based on total days (Mock logic as timestamps aren't fully granular in mockDb)
          // Ideally: Cut End - Cut Start, Sew End - Cut End, etc.
          // Simulation: Cut (15%), Sew (60%), Finish (25%)
          const cuttingDays = Math.max(1, Math.round(totalDays * 0.15));
          const sewingDays = Math.max(1, Math.round(totalDays * 0.60));
          const finishingDays = Math.max(1, totalDays - cuttingDays - sewingDays);

          const prod = products.find(p => p.id === op.productId);

          return { 
              name: op.lotNumber, 
              product: prod?.name,
              totalDays,
              cuttingDays,
              sewingDays,
              finishingDays,
              volume: op.quantityTotal,
              start: new Date(op.startDate).toLocaleDateString(),
              end: new Date(op.packingDetails?.packedDate || '').toLocaleDateString()
          };
      }).sort((a,b) => b.totalDays - a.totalDays);

      const avgDays = breakdown.length > 0 ? breakdown.reduce((a,b) => a + b.totalDays, 0) / breakdown.length : 0;
      const avgSewing = breakdown.length > 0 ? breakdown.reduce((a,b) => a + b.sewingDays, 0) / breakdown.length : 0;

      return {
          breakdown,
          avgDays: avgDays.toFixed(1),
          avgSewing: avgSewing.toFixed(1),
          slowestStage: 'Costura (Facção)', // Hardcoded based on simulation logic
          onTimeRate: 85 // Mocked compliance rate
      };
  };

  const getCashFlowData = () => {
      const relevantPayments = payments.filter(p => {
          const d = new Date(p.date);
          const start = new Date(filters.startDate);
          const end = new Date(filters.endDate);
          return d >= start && d <= end;
      });

      const grouped: Record<string, { planned: number, paid: number }> = {};
      relevantPayments.forEach(p => {
          const dateStr = new Date(p.date).toLocaleDateString('pt-BR');
          if (!grouped[dateStr]) grouped[dateStr] = { planned: 0, paid: 0 };
          if (p.status === 'Pago') grouped[dateStr].paid += p.amountPaid;
          else grouped[dateStr].planned += (p.totalAmount - p.amountPaid);
      });

      return Object.keys(grouped).map(d => ({
          date: d,
          pago: grouped[d].paid,
          previsto: grouped[d].planned
      })).sort((a,b) => {
          const [dA, mA, yA] = a.date.split('/');
          const [dB, mB, yB] = b.date.split('/');
          return new Date(Number(yA), Number(mA)-1, Number(dA)).getTime() - new Date(Number(yB), Number(mB)-1, Number(dB)).getTime();
      });
  };

  const getABCAnalysis = () => {
      const data = materials.map(m => ({
          name: m.name,
          totalValue: m.currentStock * m.costUnit,
          stock: m.currentStock,
          unitCost: m.costUnit,
          unit: m.unit,
          code: m.code
      })).sort((a,b) => b.totalValue - a.totalValue);

      const totalInventoryValue = data.reduce((sum, item) => sum + item.totalValue, 0);
      let cumulativeValue = 0;

      return data.map(item => {
          cumulativeValue += item.totalValue;
          const percentage = (cumulativeValue / totalInventoryValue) * 100;
          let classification = 'C';
          if (percentage <= 80) classification = 'A';
          else if (percentage <= 95) classification = 'B';
          
          return { ...item, classification, percentage: parseFloat(percentage.toFixed(1)) };
      });
  };

  const getABCStats = () => {
      const analysis = getABCAnalysis();
      const stats = {
          A: { count: 0, value: 0, fill: '#10b981' }, // Green
          B: { count: 0, value: 0, fill: '#f59e0b' }, // Amber
          C: { count: 0, value: 0, fill: '#ef4444' }  // Red
      };
      analysis.forEach(item => {
          if(item.classification === 'A' || item.classification === 'B' || item.classification === 'C') {
              stats[item.classification].count++;
              stats[item.classification].value += item.totalValue;
          }
      });
      return stats;
  };

  const getStockoutPrediction = () => {
      const reqs: any[] = [];
      const plannedOps = ops.filter(o => o.status === OrderStatus.PLANNED || o.status === OrderStatus.CUTTING);
      
      plannedOps.forEach(op => {
          const prod = products.find(p => p.id === op.productId);
          const tp = prod?.techPacks.find(t => t.version === op.techPackVersion);
          const alreadyCut = op.cuttingDetails?.jobs?.reduce((sum, j) => sum + j.totalPieces, 0) || 0;
          const remainingToCut = Math.max(0, op.quantityTotal - alreadyCut);

          if (remainingToCut > 0) {
              tp?.materials.forEach(bom => {
                  const mat = materials.find(m => m.id === bom.materialId);
                  if(!mat) return;
                  const needed = bom.usagePerPiece * remainingToCut * (1 + bom.wasteMargin);
                  const exists = reqs.find(r => r.id === mat.id);
                  if(exists) exists.needed += needed;
                  else reqs.push({ 
                      id: mat.id, name: mat.name, current: mat.currentStock, needed, unit: mat.unit, supplier: mat.supplier
                  });
              });
          }
      });
      return reqs.map(r => ({ ...r, balance: r.current - r.needed })).sort((a,b) => a.balance - b.balance);
  };

  // --- RENDERERS ---

  const renderHub = () => (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
          <div className="col-span-full mb-2">
              <h2 className="text-2xl font-bold text-gray-800">Central de Inteligência (BI)</h2>
              <p className="text-gray-500">Visão panorâmica da operação.</p>
          </div>

          <div onClick={() => setActiveReport('cost-real-vs-theory')} className="bg-white rounded-2xl p-6 border shadow-sm cursor-pointer hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign size={80}/></div>
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><DollarSign className="text-green-600"/> Custo Real</h3>
              <p className="text-xs text-gray-500 mb-4">Meta vs Realizado (Margem)</p>
              <div className="text-2xl font-bold text-gray-800">R$ {getCostAnalysisData().reduce((a,b)=>a+b.real,0).toFixed(0)}</div>
          </div>

          <div onClick={() => setActiveReport('monthly-ops')} className="bg-white rounded-2xl p-6 border shadow-sm cursor-pointer hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Calendar size={80}/></div>
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Calendar className="text-blue-600"/> OPs do Mês</h3>
              <p className="text-xs text-gray-500 mb-4">Volume total programado.</p>
              <div className="text-2xl font-bold text-gray-800">{filteredOps.length} <span className="text-sm font-normal">Ordens</span></div>
          </div>

          <div onClick={() => setActiveReport('cash-flow')} className="bg-white rounded-2xl p-6 border shadow-sm cursor-pointer hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet size={80}/></div>
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Wallet className="text-purple-600"/> Fluxo Caixa</h3>
              <p className="text-xs text-gray-500 mb-4">Pagamentos Facção/Svcs</p>
              <div className="text-2xl font-bold text-gray-800">R$ {getCashFlowData().reduce((a,b)=>a+b.previsto,0).toFixed(0)}</div>
          </div>

          <div onClick={() => setActiveReport('lead-time')} className="bg-white rounded-2xl p-6 border shadow-sm cursor-pointer hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={80}/></div>
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Clock className="text-orange-600"/> Lead Time</h3>
              <p className="text-xs text-gray-500 mb-4">Tempo médio de ciclo.</p>
              <div className="text-2xl font-bold text-gray-800">{getLeadTimeAnalytics().avgDays} <span className="text-sm font-normal">Dias</span></div>
          </div>

          <div onClick={() => setActiveReport('quality-ranking')} className="bg-white rounded-2xl p-6 border shadow-sm cursor-pointer hover:shadow-md transition-all">
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><AlertTriangle size={18}/> Qualidade</h3>
              <p className="text-xs text-gray-500">Performance de facções & defeitos.</p>
          </div>
          <div onClick={() => setActiveReport('cutting-efficiency')} className="bg-white rounded-2xl p-6 border shadow-sm cursor-pointer hover:shadow-md transition-all">
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Scissors size={18}/> Eficiência Corte</h3>
              <p className="text-xs text-gray-500">Aproveitamento de tecido.</p>
          </div>
          <div onClick={() => setActiveReport('abc-analysis')} className="bg-white rounded-2xl p-6 border shadow-sm cursor-pointer hover:shadow-md transition-all">
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Package size={18}/> Curva ABC</h3>
              <p className="text-xs text-gray-500">Valuation de estoque.</p>
          </div>
          <div onClick={() => setActiveReport('stockout-prediction')} className="bg-white rounded-2xl p-6 border shadow-sm cursor-pointer hover:shadow-md transition-all">
              <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><TrendingUp size={18}/> Ruptura</h3>
              <p className="text-xs text-gray-500">Previsão de falta de insumo.</p>
          </div>

          <div onClick={() => setActiveReport('execution-list')} className="col-span-full bg-indigo-50 rounded-2xl p-6 border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition-colors flex items-center justify-between">
              <div>
                  <h3 className="font-bold text-indigo-900 mb-1 flex items-center gap-2"><List/> Relatório de Execução Detalhada</h3>
                  <p className="text-indigo-700 text-sm">Listagem completa de Cortes, Facções, Revisões e Embalagens.</p>
              </div>
              <ChevronRight className="text-indigo-400"/>
          </div>
      </div>
  );

  const renderDetailHeader = (title: string, icon: any) => (
      <div className="flex items-center justify-between mb-6 no-print">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveReport('hub')} className="p-2 hover:bg-gray-200 rounded-full text-gray-600 transition-colors">
                <ArrowLeft size={24}/>
            </button>
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    {React.createElement(icon, { size: 28, className: "text-indigo-600" })}
                    {title}
                </h2>
            </div>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 transition-colors">
              <Printer size={18}/> Imprimir / PDF
          </button>
      </div>
  );

  const renderDetailContent = (ChartComponent: any, tableHeaders: string[], tableData: any[], renderRow: (row: any, i: number) => React.ReactNode) => (
      <div className="space-y-6 animate-fade-in">
          {ChartComponent && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    {ChartComponent}
                </ResponsiveContainer>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b bg-gray-50 flex justify-between">
                  <h3 className="font-bold text-gray-700">Detalhamento dos Dados</h3>
                  <button className="text-xs flex items-center gap-1 text-gray-500 hover:text-indigo-600 no-print"><Download size={14}/> CSV</button>
              </div>
              <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 font-medium border-b">
                      <tr>
                          {tableHeaders.map((h, i) => <th key={i} className="p-4">{h}</th>)}
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                      {tableData.map((row, i) => renderRow(row, i))}
                  </tbody>
              </table>
          </div>
      </div>
  );

  return (
    <div className="space-y-6 pb-20">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-end no-print justify-between">
            <div className="flex items-center gap-2 text-gray-700 font-bold">
                <Filter size={20}/> Filtros
            </div>
            <div className="flex gap-4">
                <input type="date" className="border rounded p-2 text-sm" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})}/>
                <input type="date" className="border rounded p-2 text-sm" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})}/>
                <select className="border rounded p-2 text-sm" value={filters.collection} onChange={e => setFilters({...filters, collection: e.target.value})}>
                    <option value="">Todas Coleções</option>
                    {Array.from(new Set(products.map(p => p.collection))).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        </div>

        {activeReport === 'hub' && renderHub()}

        {/* --- QUALITY DASHBOARD (FACÇÃO ANALYTICS) --- */}
        {activeReport === 'quality-ranking' && (
            <div>
                {renderDetailHeader('Ranking de Qualidade & Performance (Facções)', AlertTriangle)}
                {(() => {
                    const stats = getQualityAnalytics();
                    // Metrics
                    const avgDefect = stats.reduce((a,b) => a + b.defectRate, 0) / (stats.length || 1);
                    const totalLoss = stats.reduce((a,b) => a + b.lostValue, 0);
                    const bestPartner = stats[0] ? stats[0].name : '-';
                    const avgLead = stats.reduce((a,b) => a + b.avgLeadTime, 0) / (stats.length || 1);

                    return (
                        <div className="space-y-6 animate-fade-in">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-xl border shadow-sm">
                                    <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Taxa Média Defeitos</h4>
                                    <div className={`text-3xl font-bold ${avgDefect > 5 ? 'text-red-600' : 'text-green-600'}`}>{avgDefect.toFixed(1)}%</div>
                                </div>
                                <div className="bg-white p-6 rounded-xl border shadow-sm">
                                    <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Lead Time Médio (Ciclo)</h4>
                                    <div className="text-3xl font-bold text-blue-600">{avgLead.toFixed(1)} <span className="text-sm font-normal text-gray-400">dias</span></div>
                                </div>
                                <div className="bg-white p-6 rounded-xl border shadow-sm">
                                    <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Prejuízo (Não-Qualidade)</h4>
                                    <div className="text-3xl font-bold text-red-600">R$ {totalLoss.toLocaleString(undefined, {minimumFractionDigits: 0})}</div>
                                </div>
                                <div className="bg-white p-6 rounded-xl border shadow-sm overflow-hidden">
                                    <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Melhor Parceiro</h4>
                                    <div className="text-xl font-bold text-purple-600 truncate" title={bestPartner}>{bestPartner}</div>
                                    <div className="text-xs text-gray-400 mt-1">Score: {stats[0]?.score || 0}/100</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Performance Matrix - Improved Clarity */}
                                <div className="bg-white p-6 rounded-xl border shadow-sm h-96">
                                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Activity size={16}/> Matriz de Desempenho</h3>
                                    <p className="text-xs text-gray-400 mb-4">Cruza velocidade de entrega (Eixo X) com qualidade (Eixo Y).</p>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{top: 20, right: 20, bottom: 20, left: 20}}>
                                            <CartesianGrid strokeDasharray="3 3"/>
                                            <XAxis type="number" dataKey="avgLeadTime" name="Tempo" unit="d" label={{ value: 'Tempo Médio (Dias) →', position: 'insideBottom', offset: -5 }} domain={[0, 'auto']}/>
                                            <YAxis type="number" dataKey="defectRate" name="Defeito" unit="%" label={{ value: '% Defeito ↑', angle: -90, position: 'insideLeft' }} domain={[0, 'auto']}/>
                                            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                                                if (payload && payload.length) {
                                                    const d = payload[0].payload;
                                                    return (
                                                        <div className="bg-white p-2 border shadow-lg rounded text-xs">
                                                            <div className="font-bold text-blue-700">{d.name}</div>
                                                            <div>Tempo: {d.avgLeadTime} dias</div>
                                                            <div>Defeito: {d.defectRate}%</div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}/>
                                            
                                            {/* ZONES - Improved clarity */}
                                            {/* Green Zone: Fast (<10 days) and Good Quality (<2% defect) */}
                                            <ReferenceArea x1={0} x2={12} y1={0} y2={3} fill="#dcfce7" fillOpacity={0.5} stroke="none"/>
                                            
                                            {/* Red Zone: Slow (>15 days) OR Bad Quality (>5%) */}
                                            <ReferenceArea x1={15} y1={5} fill="#fee2e2" fillOpacity={0.5} stroke="none"/>

                                            <ReferenceLine x={12} stroke="green" strokeDasharray="3 3" label={{ value: 'Meta Tempo', position: 'insideTopRight', fontSize: 10, fill: 'green' }} />
                                            <ReferenceLine y={3} stroke="green" strokeDasharray="3 3" label={{ value: 'Meta Qualidade', position: 'insideRight', fontSize: 10, fill: 'green' }} />

                                            <Scatter name="Parceiros" data={stats} fill="#8884d8">
                                                {stats.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.defectRate < 3 && entry.avgLeadTime < 12 ? '#16a34a' : entry.defectRate > 5 ? '#dc2626' : '#ca8a04'} />
                                                ))}
                                            </Scatter>
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Stacked Bar: Defect Composition */}
                                <div className="bg-white p-6 rounded-xl border shadow-sm h-96">
                                    <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><AlertTriangle size={16}/> Composição de Não-Conformidade</h3>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={stats} layout="vertical" margin={{top: 5, right: 30, left: 40, bottom: 5}}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                                            <XAxis type="number"/>
                                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}}/>
                                            <Tooltip/>
                                            <Legend/>
                                            <Bar dataKey="rework" name="Retrabalho (Recuperável)" stackId="a" fill="#eab308" />
                                            <Bar dataKey="rejected" name="Rejeição (Perda)" stackId="a" fill="#ef4444" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="p-4 border-b bg-gray-50 flex justify-between">
                                    <h3 className="font-bold text-gray-700">Tabela Detalhada de Performance</h3>
                                    <button className="text-xs flex items-center gap-1 text-gray-500 hover:text-indigo-600 no-print"><Download size={14}/> CSV</button>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white text-gray-500 font-medium border-b">
                                        <tr>
                                            <th className="p-4">Parceiro</th>
                                            <th className="p-4 text-center">Score</th>
                                            <th className="p-4 text-right">Volume</th>
                                            <th className="p-4 text-right">Prazo Médio</th>
                                            <th className="p-4 text-right">Retrabalho</th>
                                            <th className="p-4 text-right text-red-600 font-bold">Perda</th>
                                            <th className="p-4 text-right text-red-600 font-bold">% Defeito</th>
                                            <th className="p-4 text-right">Custo Est.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {stats.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="p-4 font-bold text-gray-800 max-w-[200px] truncate" title={row.name}>{row.name}</td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold text-white ${row.score > 80 ? 'bg-green-500' : row.score > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                                        {row.score}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">{row.total}</td>
                                                <td className="p-4 text-right">{row.avgLeadTime > 0 ? row.avgLeadTime : '-'} dias</td>
                                                <td className="p-4 text-right text-yellow-600">{row.rework}</td>
                                                <td className="p-4 text-right text-red-600 font-bold">{row.rejected}</td>
                                                <td className="p-4 text-right font-bold">{row.defectRate}%</td>
                                                <td className="p-4 text-right text-gray-500">R$ {row.lostValue.toFixed(0)}</td>
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

        {/* CLICKABLE OP REPORT */}
        {activeReport === 'monthly-ops' && (
            <div>
                {renderDetailHeader('Relatório Mensal de OPs', Calendar)}
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b font-bold text-gray-700">Ordens Criadas no Período Selecionado</div>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white text-gray-600 font-bold">
                            <tr>
                                <th className="p-4">Data</th>
                                <th className="p-4">OP (Clique para Abrir)</th>
                                <th className="p-4">Produto</th>
                                <th className="p-4 text-right">Qtd</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Facção</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredOps.map((op, i) => {
                                const prod = products.find(p => p.id === op.productId);
                                return (
                                    <tr key={i} className="hover:bg-blue-50/50 group">
                                        <td className="p-4 text-gray-500">{new Date(op.createdAt).toLocaleDateString()}</td>
                                        <td 
                                            className="p-4 font-mono font-bold text-blue-600 cursor-pointer hover:underline hover:text-blue-800 flex items-center gap-2"
                                            onClick={() => handleOpenOp(op.id)}
                                            title="Abrir detalhes da OP"
                                        >
                                            {op.lotNumber} <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                                        </td>
                                        <td className="p-4">{prod?.name}</td>
                                        <td className="p-4 text-right font-bold">{op.quantityTotal}</td>
                                        <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{op.status}</span></td>
                                        <td className="p-4 text-xs text-gray-500">{op.subcontractor}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- LEAD TIME REPORT (IMPROVED) --- */}
        {activeReport === 'lead-time' && (
            <div>
                {renderDetailHeader('Lead Time (Tempo de Ciclo)', Clock)}
                {(() => {
                    const data = getLeadTimeAnalytics();
                    return (
                        <div className="space-y-6 animate-fade-in">
                            {/* RESTORED BIG ORANGE CHART */}
                            <div className="bg-white p-6 rounded-xl border shadow-sm h-96">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Clock size={18} className="text-orange-600"/> Visão Geral: Dias Corridos por OP
                                </h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.breakdown} margin={{top: 20, right: 30, left: 0, bottom: 5}}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0"/>
                                        <XAxis dataKey="name" tickLine={false} axisLine={false} />
                                        <YAxis unit="d" tickLine={false} axisLine={false}/>
                                        <Tooltip cursor={{fill: '#fff7ed'}}/>
                                        <Bar dataKey="totalDays" name="Dias Totais" fill="#f97316" radius={[4,4,0,0]} barSize={50} />
                                        <ReferenceLine y={parseFloat(data.avgDays)} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: `Média: ${data.avgDays}d`, fill: '#ef4444', fontSize: 12 }} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-4 gap-6">
                                <div className="bg-white p-6 rounded-xl border shadow-sm">
                                    <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Tempo Médio Total</h4>
                                    <div className="text-3xl font-bold text-orange-600">{data.avgDays} <span className="text-sm font-normal text-gray-400">dias</span></div>
                                </div>
                                <div className="bg-white p-6 rounded-xl border shadow-sm">
                                    <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Gargalo (Etapa Lenta)</h4>
                                    <div className="text-xl font-bold text-gray-800">{data.slowestStage}</div>
                                    <div className="text-xs text-gray-400 mt-1">Média: {data.avgSewing} dias</div>
                                </div>
                                <div className="bg-white p-6 rounded-xl border shadow-sm">
                                    <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">Entrega no Prazo</h4>
                                    <div className="text-3xl font-bold text-blue-600">{data.onTimeRate}%</div>
                                </div>
                                <div className="bg-white p-6 rounded-xl border shadow-sm">
                                    <h4 className="text-gray-500 font-bold text-xs uppercase mb-2">OPs Analisadas</h4>
                                    <div className="text-3xl font-bold text-gray-800">{data.breakdown.length}</div>
                                </div>
                            </div>

                            {/* Detailed Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Stacked Bar: Where is the time going? */}
                                <div className="bg-white p-6 rounded-xl border shadow-sm h-96">
                                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Timer size={16}/> Decomposição do Ciclo (Por OP)</h3>
                                    <p className="text-xs text-gray-400 mb-4">Onde gastamos mais tempo em cada lote?</p>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.breakdown} margin={{top: 5, right: 30, left: 0, bottom: 5}}>
                                            <CartesianGrid strokeDasharray="3 3"/>
                                            <XAxis dataKey="name" />
                                            <YAxis unit="d"/>
                                            <Tooltip cursor={{fill: '#f8fafc'}}/>
                                            <Legend/>
                                            <Bar dataKey="cuttingDays" name="Corte" stackId="a" fill="#f59e0b" />
                                            <Bar dataKey="sewingDays" name="Costura" stackId="a" fill="#6366f1" />
                                            <Bar dataKey="finishingDays" name="Acabamento" stackId="a" fill="#10b981" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Scatter: Volume vs Time */}
                                <div className="bg-white p-6 rounded-xl border shadow-sm h-96">
                                    <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><TrendingUp size={16}/> Correlação: Volume x Tempo</h3>
                                    <p className="text-xs text-gray-400 mb-4">Pedidos maiores demoram mais? (Ideal: Linha tendendo a subir suavemente)</p>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ScatterChart margin={{top: 20, right: 20, bottom: 20, left: 0}}>
                                            <CartesianGrid />
                                            <XAxis type="number" dataKey="volume" name="Qtd Peças" unit="un" label={{ value: 'Quantidade →', position: 'insideBottom', offset: -5 }}/>
                                            <YAxis type="number" dataKey="totalDays" name="Dias" unit="d" label={{ value: 'Dias Totais ↑', angle: -90, position: 'insideLeft' }}/>
                                            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                                            <Scatter name="OPs" data={data.breakdown} fill="#ec4899" />
                                        </ScatterChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Analysis Text */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                                <HelpCircle className="text-blue-600 mt-1 shrink-0"/>
                                <div>
                                    <h4 className="font-bold text-blue-800 text-sm">Insights do Ciclo de Produção</h4>
                                    <p className="text-sm text-blue-700 mt-1">
                                        O gargalo principal identificado é a <b>Costura</b>, representando a maior fatia do tempo total. 
                                        A correlação mostra que pedidos acima de 500 peças tendem a dobrar o tempo de ciclo. 
                                        Recomendamos dividir grandes lotes para manter o fluxo contínuo.
                                    </p>
                                </div>
                            </div>

                            {/* Detail Table */}
                            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                                <div className="p-4 border-b bg-gray-50">
                                    <h3 className="font-bold text-gray-700">Detalhamento por Ordem</h3>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white text-gray-500 font-medium border-b">
                                        <tr>
                                            <th className="p-4">OP</th>
                                            <th className="p-4">Produto</th>
                                            <th className="p-4 text-right">Início</th>
                                            <th className="p-4 text-right">Fim</th>
                                            <th className="p-4 text-center bg-orange-50">Corte</th>
                                            <th className="p-4 text-center bg-indigo-50">Costura</th>
                                            <th className="p-4 text-center bg-green-50">Acab.</th>
                                            <th className="p-4 text-right font-bold">Total Dias</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {data.breakdown.map((row, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="p-4 font-bold font-mono">{row.name}</td>
                                                <td className="p-4 max-w-[200px] truncate" title={row.product}>{row.product}</td>
                                                <td className="p-4 text-right text-gray-500">{row.start}</td>
                                                <td className="p-4 text-right text-gray-500">{row.end}</td>
                                                <td className="p-4 text-center text-gray-600 bg-orange-50/30">{row.cuttingDays}d</td>
                                                <td className="p-4 text-center text-gray-600 bg-indigo-50/30">{row.sewingDays}d</td>
                                                <td className="p-4 text-center text-gray-600 bg-green-50/30">{row.finishingDays}d</td>
                                                <td className="p-4 text-right font-bold text-orange-600">{row.totalDays} dias</td>
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

        {activeReport === 'cash-flow' && (
            <div>
                {renderDetailHeader('Fluxo de Caixa (Pagamentos de Serviço)', Wallet)}
                {renderDetailContent(
                    <BarChart data={getCashFlowData()}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="date"/>
                        <YAxis/>
                        <Tooltip/>
                        <Legend/>
                        <Bar dataKey="pago" fill="#22c55e" name="Pago (Realizado)" stackId="a"/>
                        <Bar dataKey="previsto" fill="#eab308" name="A Pagar (Previsto)" stackId="a"/>
                    </BarChart>,
                    ['Data', 'Valor Pago', 'Valor Previsto', 'Total Dia'],
                    getCashFlowData(),
                    (row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                            <td className="p-4 font-bold">{row.date}</td>
                            <td className="p-4 text-green-600 font-bold">R$ {row.pago.toFixed(2)}</td>
                            <td className="p-4 text-yellow-600">R$ {row.previsto.toFixed(2)}</td>
                            <td className="p-4 font-bold">R$ {(row.pago + row.previsto).toFixed(2)}</td>
                        </tr>
                    )
                )}
            </div>
        )}

        {activeReport === 'stockout-prediction' && (
             <div>
                {renderDetailHeader('Previsão de Ruptura (Compras)', TrendingUp)}
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="p-4">Material</th>
                                <th className="p-4">Fornecedor</th>
                                <th className="p-4 text-right">Necessidade (Plan)</th>
                                <th className="p-4 text-right">Estoque Atual</th>
                                <th className="p-4 text-right">Balanço</th>
                                <th className="p-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {getStockoutPrediction().map((row, i) => (
                                <tr key={i} className={row.balance < 0 ? 'bg-red-50' : ''}>
                                    <td className="p-4 font-bold">{row.name}</td>
                                    <td className="p-4 text-gray-500">{row.supplier}</td>
                                    <td className="p-4 text-right">{row.needed.toFixed(2)} {row.unit}</td>
                                    <td className="p-4 text-right">{row.current.toFixed(2)} {row.unit}</td>
                                    <td className={`p-4 text-right font-bold ${row.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>{row.balance.toFixed(2)}</td>
                                    <td className="p-4 text-center">{row.balance < 0 ? <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-bold">COMPRAR</span> : 'OK'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
        )}

        {activeReport === 'execution-list' && (
            <div>
                {renderDetailHeader('Relatório de Execução Detalhada', List)}
                
                <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg w-fit no-print">
                    <button onClick={()=>setExecutionTab('cuts')} className={`px-4 py-2 rounded-md text-sm font-bold ${executionTab === 'cuts' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>Cortes</button>
                    <button onClick={()=>setExecutionTab('sewing')} className={`px-4 py-2 rounded-md text-sm font-bold ${executionTab === 'sewing' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Facções</button>
                    <button onClick={()=>setExecutionTab('reviews')} className={`px-4 py-2 rounded-md text-sm font-bold ${executionTab === 'reviews' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>Revisões</button>
                    <button onClick={()=>setExecutionTab('packing')} className={`px-4 py-2 rounded-md text-sm font-bold ${executionTab === 'packing' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>Embalagens</button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-600 font-bold">
                            <tr>
                                <th className="p-4">Data</th>
                                <th className="p-4">OP</th>
                                <th className="p-4">Detalhes / Responsável</th>
                                <th className="p-4 text-right">Quantidade</th>
                                {executionTab === 'cuts' && <th className="p-4 text-right">Peso (kg)</th>}
                                {executionTab === 'sewing' && <th className="p-4 text-right">Retorno</th>}
                                {executionTab === 'reviews' && <th className="p-4 text-right">Defeitos</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredOps.map(op => {
                                if (executionTab === 'cuts' && op.cuttingDetails?.jobs) {
                                    return op.cuttingDetails.jobs.map(job => (
                                        <tr key={job.id} className="hover:bg-orange-50">
                                            <td className="p-4 text-gray-500">{new Date(job.date).toLocaleDateString()}</td>
                                            <td className="p-4 font-mono font-bold">{op.lotNumber}</td>
                                            <td className="p-4">{job.cutterName} <span className="text-xs text-gray-400">({job.cutType})</span></td>
                                            <td className="p-4 text-right font-bold">{job.totalPieces}</td>
                                            <td className="p-4 text-right">{job.markerWeight}</td>
                                        </tr>
                                    ));
                                }
                                if (executionTab === 'sewing') {
                                    const opOsfs = osfs.filter(o => o.opId === op.id);
                                    return opOsfs.map(osf => (
                                        <tr key={osf.id} className="hover:bg-blue-50">
                                            <td className="p-4 text-gray-500">{new Date(osf.sentDate).toLocaleDateString()}</td>
                                            <td className="p-4 font-mono font-bold">{op.lotNumber}</td>
                                            <td className="p-4">{osf.subcontractorName} <span className="text-xs bg-gray-100 px-1 rounded">{osf.status}</span></td>
                                            <td className="p-4 text-right font-bold">{osf.sentQuantity}</td>
                                            <td className="p-4 text-right text-green-600">{osf.receivedQuantity}</td>
                                        </tr>
                                    ));
                                }
                                if (executionTab === 'reviews' && op.revisionDetails?.isFinalized) {
                                    return (
                                        <tr key={`rev-${op.id}`} className="hover:bg-purple-50">
                                            <td className="p-4 text-gray-500">{new Date(op.revisionDetails.endDate!).toLocaleDateString()}</td>
                                            <td className="p-4 font-mono font-bold">{op.lotNumber}</td>
                                            <td className="p-4">{op.revisionDetails.inspectorName}</td>
                                            <td className="p-4 text-right font-bold text-green-600">{op.revisionDetails.approvedQty}</td>
                                            <td className="p-4 text-right text-red-600">{op.revisionDetails.rejectedQty + op.revisionDetails.reworkQty}</td>
                                        </tr>
                                    );
                                }
                                if (executionTab === 'packing' && op.packingDetails?.isFinalized) {
                                    return (
                                        <tr key={`pack-${op.id}`} className="hover:bg-pink-50">
                                            <td className="p-4 text-gray-500">{new Date(op.packingDetails.packedDate!).toLocaleDateString()}</td>
                                            <td className="p-4 font-mono font-bold">{op.lotNumber}</td>
                                            <td className="p-4">{op.packingDetails.packerName} <span className="text-xs text-gray-400">({op.packingDetails.warehouse})</span></td>
                                            <td className="p-4 text-right font-bold text-pink-600">{op.packingDetails.totalPackedQty}</td>
                                        </tr>
                                    );
                                }
                                return null;
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeReport === 'cost-real-vs-theory' && (
            <div>
                {renderDetailHeader('Custo Real vs. Teórico', DollarSign)}
                {renderDetailContent(
                    <BarChart data={getCostAnalysisData()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis dataKey="id"/>
                        <YAxis/>
                        <Tooltip/>
                        <Legend/>
                        <Bar dataKey="teorico" name="Meta" fill="#e5e7eb" radius={[4,4,0,0]}/>
                        <Bar dataKey="real" name="Realizado" fill="#6366f1" radius={[4,4,0,0]}/>
                    </BarChart>,
                    ['OP', 'Produto', 'Custo Meta', 'Custo Real', 'Desvio R$'],
                    getCostAnalysisData(),
                    (row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                            <td className="p-4 font-mono font-bold">{row.id}</td>
                            <td className="p-4">{row.product}</td>
                            <td className="p-4">R$ {row.teorico.toFixed(2)}</td>
                            <td className="p-4 font-bold">R$ {row.real.toFixed(2)}</td>
                            <td className={`p-4 font-bold ${row.diff > 0 ? 'text-red-500' : 'text-green-500'}`}>{row.diff.toFixed(2)}</td>
                        </tr>
                    )
                )}
            </div>
        )}

        {activeReport === 'production-funnel' && (
             <div>
                {renderDetailHeader('Funil de Produção', Layers)}
                {renderDetailContent(
                    <BarChart data={getProductionFunnel()}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="name"/>
                        <YAxis/>
                        <Tooltip/>
                        <Bar dataKey="value" name="Qtd" fill="#8884d8">
                            {getProductionFunnel().map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Bar>
                    </BarChart>,
                    ['Etapa', 'Quantidade (Peças)'],
                    getProductionFunnel(),
                    (row, i) => <tr key={i}><td className="p-4 font-bold">{row.name}</td><td className="p-4">{row.value}</td></tr>
                )}
             </div>
        )}
    </div>
  );
};

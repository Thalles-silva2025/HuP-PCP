
export enum OrderStatus {
  DRAFT = 'Rascunho',
  PLANNED = 'Planejado',
  CUTTING = 'Em Corte',
  SEWING = 'Em Costura (Facção)',
  QUALITY_CONTROL = 'Revisão',
  PACKING = 'Em Embalagem',
  COMPLETED = 'Concluído',
  CANCELLED = 'Cancelado'
}

export enum ProductStatus {
  ACTIVE = 'Ativo',
  INACTIVE = 'Inativo'
}

export enum MaterialType {
  FABRIC = 'Tecido',
  TRIM = 'Aviamento',
  LABEL = 'Etiqueta',
  PACKAGING = 'Embalagem'
}

export enum UnitOfMeasure {
  METER = 'm',
  KG = 'kg',
  UNIT = 'un',
  PAIR = 'par',
  ROLL = 'rolo'
}

export type SalesType = 'Normal' | 'Vende Bem' | 'Vende Tudo' | 'Hype';

export interface Color {
  id: string;
  name: string;
  hex: string;
}

export interface StandardOperation {
  id: string;
  name: string;
  machine: string;
  standardTimeMinutes?: number;
  costPerMinute?: number;
  laborType?: 'CLT' | 'Terceirizado';
}

export interface StandardObservation {
  id: string;
  text: string;
  category?: 'Corte' | 'Costura' | 'Geral';
}

export interface MeasurementPoint {
  id: string;
  name: string;
  tolerance: number;
  values: Record<string, number>;
}

export interface Operation {
  id: string;
  name: string;
  machine: string;
  standardTimeMinutes: number;
  costPerMinute: number;
  laborType: 'CLT' | 'Terceirizado';
  partnerId?: string;
  negotiatedPrice?: number;
}

export interface ExtraCost {
  id?: string;
  name: string;
  category: string;
  value: number;
}

export interface BOMItem {
  materialId: string;
  usagePerPiece: number;
  wasteMargin: number;
  variesWithColor?: boolean;
  colorVariant?: string;
  colorCosts?: Record<string, number>;
}

export interface TechPack {
  id: string;
  productId: string;
  version: number;
  status: 'rascunho' | 'aprovado' | 'obsoleto';
  isFrozen: boolean;
  createdAt: string;
  approvedBy?: string;
  salesType?: SalesType;
  
  materials: BOMItem[];
  operations: Operation[];
  measurements: MeasurementPoint[];
  secondaryCuts?: { id: string; name: string; consumption: number }[];
  extraCosts?: ExtraCost[];
  activeSizes?: string[];
  standardObservations?: string[]; 

  materialCost: number;
  laborCost: number;
  totalCost: number;
  targetMargin: number;
  suggestedPrice: number;
  currentPrice?: number;
  taxes?: string;
  commercialExpenses?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  collection: string;
  sizes: string[];
  colors: string[];
  status: ProductStatus;
  imageUrl?: string;
  techPacks: TechPack[];
}

export interface MaterialVariant {
  id: string;
  name: string;
  stock: number;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  type: MaterialType | string;
  usageStage?: 'Corte' | 'Facção' | 'Revisão' | 'Embalagem'; // Novo Campo
  unit: UnitOfMeasure | string;
  currentStock: number;
  costUnit: number;
  supplier: string;
  status: string;
  hasColors?: boolean;
  variants?: MaterialVariant[];
  properties?: {
    width?: number;
    grammage?: number;
    yield?: number;
  };
}

export interface Partner {
  id: string;
  name: string;
  type: 'Facção' | 'Cortador' | 'Revisão' | 'Embalagem' | 'Fornecedor' | 'Outro'; // Added Fornecedor
  contractType: 'PJ' | 'CLT';
  address?: string;
  phone?: string;
  defaultRate?: number;
  observations?: string; // New field
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  type: string;
}

export interface ProductionGoal {
  month: string; 
  targetQuantity: number;
}

export interface ProductionOrderItem {
  color: string;
  size: string;
  quantity: number;
}

export interface MatrixRatio {
  size: string;
  ratio: number;
}

export interface LayerDefinition {
  color: string;
  layers: number;
}

export interface CuttingJob {
  id: string;
  tacoNumber: string;
  date: string;
  cutterName: string;
  cutType: string;
  markerWidth: number;
  markerLength: number;
  markerWeight: number;
  wasteWeight: number;
  bundles: number;
  matrix: MatrixRatio[];
  layers: LayerDefinition[];
  totalPieces: number;
  fabricConsumption: number;
}

export interface CuttingDetails {
  plannedMatrix: MatrixRatio[];
  plannedLayers: LayerDefinition[];
  cutterName?: string;
  jobs?: CuttingJob[];
  isFinalized: boolean;
}

export interface RevisionDetails {
  inspectorName: string;
  approvedQty: number;
  reworkQty: number;
  rejectedQty: number;
  missingQty?: number;
  
  itemsApproved?: ProductionOrderItem[];
  itemsRework?: ProductionOrderItem[];
  itemsRejected?: ProductionOrderItem[];
  itemsMissing?: ProductionOrderItem[];

  isFinalized: boolean;
  startDate?: string;
  endDate?: string;
}

export interface PackingDetails {
  packerName?: string;
  packingType?: string;
  totalBoxes?: number;
  totalPackedQty?: number;
  itemsPacked?: ProductionOrderItem[];
  warehouse?: string;
  isFinalized: boolean;
  packedDate?: string;
  executor?: string;
}

export interface SubcontractorDetails {
  name: string;
  sentDate: string;
  returnDate?: string;
  sentQty: number;
  receivedQty: number;
}

export interface PhaseDates {
  cuttingStart: string;
  cuttingEnd: string;
  sewingStart: string;
  sewingEnd: string;
  revisionStart: string;
  revisionEnd: string;
  packingStart: string;
  packingEnd: string;
}

export interface ProductionEvent {
  date: string;
  user: string;
  action: string;
  description: string;
  type: 'status_change' | 'alert' | 'info';
}

export interface ProductionOrder {
  id: string;
  lotNumber: string;
  productId: string;
  techPackVersion: number;
  
  quantityTotal: number;
  items: ProductionOrderItem[];
  originalItems?: ProductionOrderItem[];
  
  status: OrderStatus;
  startDate: string;
  dueDate: string;
  phaseDates?: PhaseDates;

  subcontractor?: string;
  createdAt: string;
  costSnapshot: number;
  
  cuttingDetails?: CuttingDetails;
  subcontractorDetails?: SubcontractorDetails;
  revisionDetails?: RevisionDetails;
  packingDetails?: PackingDetails;
  
  events: ProductionEvent[];

  selectedFabricId?: string;
  fabricPurchasedTotal?: number;
  fabricPurchasedBreakdown?: Record<string, number>;
  plannedMarkerWidth?: number;
  plannedMarkerLength?: number;
}

export interface ReturnItem {
  color: string;
  size: string;
  quantity: number;
  type: 'approved' | 'defect';
}

export interface SubcontractorOrder {
  id: string;
  opId: string;
  partnerId?: string | null;
  subcontractorName: string;
  type: string; 
  status: 'Enviado' | 'Parcial' | 'Concluido';
  sentDate: string;
  sentQuantity: number;
  receivedQuantity: number;
  defectiveQuantity: number;
  
  itemsSnapshot?: ProductionOrderItem[];
  itemsReturned?: ProductionOrderItem[];
  
  materialsSnapshot?: any[];
  
  returnDate?: string;
  conferente?: string;
  observations?: string;
  externalToken?: string;
}

export interface FinishedProductStock {
  id: string;
  productId: string;
  opId?: string;
  opLotNumber?: string;
  warehouse: string;
  quantity: number;
  color: string;
  size: string;
  cost: number;
  price?: number;
  date: string;
  status: 'Disponível' | 'Reservado' | 'Exportado';
}

export interface WIPItem {
  opId: string;
  product: Product;
  quantity: number;
  stage: OrderStatus;
  startDate: string;
  subcontractor: string;
}

export interface ConsolidatedRequirement {
  material: Material;
  requiredQty: number;
  stockQty: number;
  status: 'ok' | 'critical';
}

export interface PaymentRecord {
  id: string;
  opId: string;
  partnerName: string;
  partnerType: string;
  stage: string; 
  totalAmount: number;
  amountPaid: number;
  quantityDelivered: number;
  ratePerPiece: number;
  status: 'Pendente' | 'Parcial' | 'Pago';
  date: string; 
  dueDate?: string;
  bankAccountName?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  organization_id?: string;
  role: string;
  full_name?: string;
  company_name?: string;
  phone?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
  employees_count?: string;
  revenue_range?: string;
  main_pain_point?: string;
  production_model?: string;
  current_system?: string;
  is_profitable?: boolean;
  loss_areas?: string;
}

export interface OrganizationConfig {
  organizationId: string;
  companyLogoUrl?: string;
  primaryColor?: string;
  enableNotifications: boolean;
  daysToAlertOverdue: number;
  defaultPaymentTerms?: string;
  invoiceFooterText?: string;
  leadTimeCutting?: number;
  leadTimeSewing?: number;
  leadTimeRevision?: number;
  leadTimePacking?: number;
}

export interface ImportPreviewItem {
    sku: string;
    name: string;
}

// NEW: Interfaces for Purchasing Module
export interface MaterialPurchase {
    id: string;
    materialId: string;
    materialName?: string; // Rich data
    materialCode?: string;
    supplier: string;
    purchaseDate: string;
    invoiceNumber?: string;
    quantity: number;
    originalQuantity?: number; // New field for audit
    unitPricePaid: number;
    totalCost: number;
    unitPriceStandard?: number;
    colorBreakdown?: Record<string, number>;
    status?: 'Pendente' | 'Concluido';
    verifiedAt?: string;
    verifiedBy?: string;
    paymentId?: string;
}
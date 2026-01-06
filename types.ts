
// Enums
export enum UnitOfMeasure {
  METER = 'm',
  KG = 'kg',
  UNIT = 'un',
  ROLL = 'rolo',
  PACK = 'pct'
}

export enum OrderStatus {
  DRAFT = 'Rascunho',
  PLANNED = 'Planejado',
  CUTTING = 'Em Corte',
  SEWING = 'Em Costura (Facção)',
  QUALITY_CONTROL = 'Revisão',
  PACKING = 'Embalagem',
  COMPLETED = 'Concluído',
  CANCELLED = 'Cancelado'
}

export enum ProductStatus {
  ACTIVE = 'Ativo',
  INACTIVE = 'Inativo',
  DISCONTINUED = 'Descontinuado',
  EXPORTED = 'Exportado/Finalizado'
}

export enum MaterialType {
  FABRIC = 'Tecido',
  TRIM = 'Aviamento',
  PACKAGING = 'Embalagem',
  LABEL = 'Etiqueta'
}

// User Profile Extended
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'user';
  created_at?: string;
  // Extended Business Info (Onboarding)
  company_name?: string;
  phone?: string;
  employees_count?: string;
  revenue_range?: string;
  market_years?: string;
  production_model?: string; // Propria, Facção, Hibrida
  main_pain_point?: string;
  is_profitable?: boolean;
  loss_areas?: string;
  current_system?: string;
  onboarding_completed?: boolean;
}

// Master Data Interfaces
export interface Partner {
  id: string;
  name: string;
  type: 'Facção' | 'Cortador' | 'Revisão' | 'Embalagem' | 'Outro';
  contractType: 'CLT' | 'PJ'; // New Field
  address?: string;
  phone?: string;
  cnpj?: string; // Added field
  capabilities?: string[];
  defaultRate?: number; // Preço padrão por peça/minuto
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  type: 'Interno' | 'Loja' | 'Expedição';
}

export interface Color {
  id: string;
  name: string;
  hex: string; // Hexadecimal code (e.g., #FF0000)
}

export interface StandardObservation {
  id: string;
  text: string;
  category: 'Corte' | 'Costura' | 'Geral';
}

// Interfaces

// NEW: Material Variant Structure
export interface MaterialVariant {
    id: string;
    name: string; // The specific color name (e.g., "Royal Blue")
    stock: number;
}

export interface Material {
  id: string;
  code: string;
  name: string;
  type: MaterialType;
  unit: UnitOfMeasure;
  currentStock: number; // If hasColors, this is the sum of variants
  costUnit: number;
  supplier: string;
  status?: 'Ativo' | 'Inativo'; // Added status field
  
  // Logic for Colors
  hasColors?: boolean;
  variants?: MaterialVariant[];

  properties?: {
    width?: number; 
    grammage?: number; 
    yield?: number; 
  };
}

export interface InventoryMovement {
  id: string;
  date: string;
  itemId: string; // Material ID or Product ID
  itemType: 'Material' | 'Product';
  type: InventoryMovementType;
  quantity: number;
  unitCost: number; // Custo no momento da movimentação
  totalValue: number;
  documentRef?: string; // Nº Nota Fiscal, Nº OP, Nº Pedido
  notes?: string;
  warehouseId: string;
  user: string;
}

export enum InventoryMovementType {
  IN_PURCHASE = 'Compra (NF)',
  IN_PRODUCTION = 'Produção Finalizada',
  IN_RETURN = 'Devolução',
  IN_ADJUSTMENT = 'Ajuste (Sobra)',
  OUT_PRODUCTION = 'Consumo Ordem Produção',
  OUT_SALES = 'Venda / Expedição',
  OUT_LOSS = 'Perda / Defeito',
  OUT_ADJUSTMENT = 'Ajuste (Inventário)'
}

export interface StandardOperation {
  id: string;
  name: string;
  machine: string;
  standardTimeMinutes?: number;
  costPerMinute?: number;
  laborType?: 'CLT' | 'Terceirizado';
}

export interface FinishedProductStock {
  id: string;
  productId: string;
  opId?: string;
  warehouse: string;
  quantity: number;
  color?: string; // Added variant support
  size?: string;  // Added variant support
  cost: number;
  price: number;
  date: string;
  observation?: string;
  gtin?: string;
  status: 'Disponível' | 'Exportado'; // New field for export control
}

export interface BOMItem {
  materialId: string;
  usagePerPiece: number;
  wasteMargin: number;
  notes?: string;
  
  // Logic for Mapping
  colorVariant?: string; // Product Color Filter (e.g., "Use this row only for Blue T-Shirt")
  
  // Specific Material Variant Selection
  materialVariantId?: string; // The ID/Name of the specific color chosen from the Material Registry
  materialVariantName?: string; // Snapshot of the name for display

  colorCosts?: Record<string, number>; // Specific cost per color variant
  variesWithColor?: boolean; // Determines if the material changes with the product color (e.g. Fabric vs Label)
}

export interface Operation {
  id: string;
  name: string;
  machine: string;
  standardTimeMinutes: number;
  costPerMinute: number; // Used for Internal/CLT calculation
  laborType: 'CLT' | 'Terceirizado'; 
  partnerId?: string; // Specific PJ Partner executing this
  negotiatedPrice?: number; // Specific price for this PJ on this product
}

export interface MeasurementPoint {
  id: string;
  name: string;
  tolerance: number;
  values: Record<string, number>;
}

export interface SecondaryCutDefinition {
  id: string;
  name: string; // ex: Gola, Punho, Bolso
  materialId?: string; // Opcional, se usar tecido diferente
  consumption: number;
}

export interface ExtraCost {
  id: string;
  name: string;
  category: string;
  value: number;
}

export type SalesType = 'Normal' | 'Vende Bem' | 'Vende Tudo' | 'Hype';

export interface TechPack {
  id: string;
  productId: string;
  version: number;
  isFrozen: boolean;
  status: 'rascunho' | 'aprovado' | 'obsoleto'; // Traduzido
  materials: BOMItem[];
  operations: Operation[];
  measurements: MeasurementPoint[]; 
  secondaryCuts?: SecondaryCutDefinition[]; 
  activeSizes?: string[];
  standardObservations?: string[]; // IDs of StandardObservations
  createdAt: string;
  approvedBy?: string;
  
  // Costing
  materialCost: number;
  laborCost: number;
  extraCosts?: ExtraCost[];
  totalCost: number;
  
  // Pricing & Strategy
  targetMargin: number; 
  suggestedPrice: number;
  currentPrice?: number; // Actual selling price
  salesType: SalesType; // NEW FIELD: Product sales potential
}

// FULL FIDELITY PRODUCT INTERFACE (BLING COMPATIBLE)
export interface Product {
  id: string;
  sku: string; // Código
  name: string; // Descrição
  unit?: string; // Unidade
  status: ProductStatus; // Situação
  collection: string;
  
  // Pricing
  defaultPrice?: number; // Preço
  defaultCost?: number; // Preço de Custo
  purchasePrice?: number; // Preço de Compra
  
  // Taxonomy & Organization
  brand?: string; // Marca
  category?: string; // Categoria do produto
  department?: string; // Departamento
  productGroup?: string; // Grupo de produtos
  supplier?: string; // Fornecedor
  supplierCode?: string; // Cód. no fornecedor
  tags?: string; // Grupo de Tags/Tags
  
  // Fiscal & Tax
  ncm?: string; // NCM
  origin?: string; // Origem
  cest?: string; // CEST
  ipiFixedValue?: number; // Valor IPI fixo
  ipiClass?: string; // Classe de enquadramento do IPI
  serviceListCode?: string; // Código na Lista de Serviços
  itemType?: string; // Tipo do item
  tributes?: string; // Tributos
  fciNumber?: string; // Número FCI
  icmsStBase?: number; // Valor base ICMS ST
  icmsStValue?: number; // Valor ICMS ST
  icmsSubValue?: number; // Valor ICMS próprio do substituto
  
  // Logistics & Stock
  gtin?: string; // GTIN/EAN
  gtinPackaging?: string; // GTIN/EAN da Embalagem
  weight?: number; // Peso líquido (Kg)
  grossWeight?: number; // Peso bruto (Kg)
  width?: number; // Largura do produto
  height?: number; // Altura do Produto
  depth?: number; // Profundidade do produto
  volumes?: number; // Volumes
  itemsPerBox?: number; // Itens p/ caixa
  crossDocking?: string; // Cross-Docking
  location?: string; // Localização
  minStock?: number; // Estoque mínimo
  maxStock?: number; // Estoque máximo
  currentStock?: number; // Estoque (Quantity imported)
  productionType?: string; // Tipo Produção
  condition?: string; // Condição do Produto
  freeShipping?: string; // Frete Grátis
  validityDate?: string; // Data Validade
  
  // Descriptions & Media
  shortDescription?: string; // Descrição Curta
  complementaryDescription?: string; // Descrição Complementar
  supplierDescription?: string; // Descrição do Produto no Fornecedor
  additionalInfo?: string; // Informações Adicionais
  imageUrl?: string; // URL Imagens Externas
  videoUrl?: string; // Vídeo
  externalLink?: string; // Link Externo
  warrantyMonths?: string; // Meses Garantia no Fornecedor
  
  // Hierarchy
  parentCode?: string; // Código Pai
  isVariant?: boolean; // Produto Variação (Sim/Não)
  
  // System Specific
  techPacks: TechPack[];
  sizes: string[]; 
  colors: string[];
  defaultWarehouse?: string;
  integrationCode?: string; // Código Integração
  cloneParentData?: string; // Clonar dados do pai
}

// --- NEW CUTTING MATRIX TYPES ---

export interface MatrixRatio {
  size: string;
  ratio: number;
}

export interface LayerDefinition {
  color: string;
  layers: number;
  rollsUsed?: number;
}

export interface ProductionOrderItem {
  color: string;
  size: string;
  quantity: number;
}

// Represents a single Cut Session (Enfesto)
export interface CuttingJob {
  id: string;
  tacoNumber: string; // Sequencial Taco #
  date: string;
  cutterName: string;
  cutType: string; // 'Principal' ou nome do corte secundário
  
  markerWidth?: number;  // Largura (m)
  markerLength?: number; // Comprimento (m)
  markerWeight?: number; // Peso do Risco (kg)
  wasteWeight?: number;  // Peso das Pontas/Sobras (kg)
  
  bundles?: number; // Volumes/Fardos gerados

  matrix: MatrixRatio[]; // O risco usado neste corte
  layers: LayerDefinition[]; // As folhas cortadas neste corte
  
  totalPieces: number;
  fabricConsumption: number;
}

export interface CuttingDetails {
  // Global Planning (Initial)
  plannedMatrix: MatrixRatio[];
  plannedLayers: LayerDefinition[]; // Sum of planned
  
  // Real Execution (Multiple Jobs)
  jobs: CuttingJob[];
  
  isFinalized: boolean;
  cutterName?: string; // Planned cutter
}

export interface SentMaterialItem {
  materialName: string;
  quantity: number;
  unit: string;
  isExtra: boolean;
}

export interface SubcontractorDetails {
  sentDate: string;
  expectedReturnDate: string;
  materialsSent: SentMaterialItem[];
  deliveredToFaccao: boolean;
  deliveryDate?: string;
}

export interface RevisionDetails {
  startDate?: string;
  endDate?: string;
  inspectorName?: string;
  
  approvedQty: number; // 1a Qualidade (Total)
  itemsApproved?: ProductionOrderItem[]; // DETALHAMENTO GRADE APROVADA

  reworkQty: number; // 2a Qualidade / Retrabalho (Total)
  rejectedQty: number; // Perda (Total)
  
  notes?: string;
  isFinalized: boolean;
}

export interface PackingDetails {
  packedDate?: string;
  totalBoxes: number;
  packingType: 'Caixa Padrão' | 'Saco Individual' | 'Cabide';
  itemsPerBox?: number;
  
  totalPackedQty: number; // Total
  itemsPacked?: ProductionOrderItem[]; // DETALHAMENTO GRADE EMBALADA

  warehouse?: string; // New field for stock destination
  isFinalized: boolean;
  packerName?: string; // Quem embalou
}

export interface ProductionEvent {
  date: string;
  user: string;
  action: string;
  description: string;
  type: 'status_change' | 'update' | 'alert';
}

// NEW: Planning Phases Dates
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

export interface ProductionOrder {
  id: string; 
  lotNumber: string;
  productId: string;
  techPackVersion: number;
  
  // Totals
  quantityTotal: number;
  items: ProductionOrderItem[]; // Consolidated Items (Plan or Real)
  
  // Status & Dates
  status: OrderStatus;
  startDate: string;
  dueDate: string;
  
  // Enhanced Planning Dates
  phaseDates?: PhaseDates;

  subcontractor?: string; 
  createdAt: string;
  costSnapshot: number;
  
  // Stages
  cuttingDetails?: CuttingDetails;
  subcontractorDetails?: SubcontractorDetails;
  revisionDetails?: RevisionDetails;
  packingDetails?: PackingDetails;
  
  // Audit
  events: ProductionEvent[];
}

export interface ReturnItem {
  color: string;
  size: string;
  quantity: number;
  type: 'approved' | 'defect';
}

// Updated structure to support Material Return (Future Proof)
export interface ReturnedMaterial {
    materialId: string;
    quantity: number;
    unit: string;
    isScrap: boolean; // Retalho ou sobra inutilizável
}

export interface ReturnEvent {
  id: string;
  date: string;
  totalQuantity: number;
  conferente: string;
  items: ReturnItem[];
  returnedMaterials?: ReturnedMaterial[]; // Added for future implementation
}

export interface SubcontractorOrder {
  id: string;
  opId: string;
  parentId?: string; // For split orders
  subcontractorName: string;
  sentDate: string;
  sentQuantity: number;
  
  // Return Logic
  receivedQuantity: number; 
  defectiveQuantity: number;
  returnDate?: string;
  itemsReturned?: ReturnItem[];
  returnHistory?: ReturnEvent[]; // History of all partial returns
  conferente?: string; // Name of person checking return
  
  status: 'Enviado' | 'Parcial' | 'Concluido';
  externalToken?: string; // For external access
  observations?: string; // New: Full text logs for returns
}

export interface ConsolidatedRequirement {
  material: Material;
  requiredQty: number;
  stockQty: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface WIPItem {
  opId: string;
  product: Product;
  quantity: number;
  stage: OrderStatus;
  startDate: string;
  subcontractor: string;
}

export interface PaymentRecord {
  id: string;
  opId: string;
  partnerName: string;
  partnerType: string;
  stage: string; // Corte, Costura, Embalagem
  
  // Payment Details
  totalAmount: number; // Valor Total Devido
  amountPaid: number;  // Valor Já Pago
  remainingAmount: number; // Restante
  
  quantityDelivered: number;
  quantityDefect: number;
  ratePerPiece: number;
  
  status: 'Pendente' | 'Parcial' | 'Pago';
  date: string; // Data de vencimento ou criação
  bankAccountName?: string;
}

export interface ImportPreviewItem {
  isValid: boolean;
  errors: string[];
  data: Product;
  rowId: number;
}

export interface ProductionGoal {
  month: string; // Format "YYYY-MM"
  targetQuantity: number;
}

// --- BLING IMPORT TYPES (Raw Mapped) ---
export interface BlingImportRow {
    codigo: string;
    codigoPai?: string;
    descricao: string;
    unidade?: string;
    ncm?: string;
    origem?: string;
    preco?: number;
    valorIpi?: number;
    observacoes?: string;
    situacao?: string;
    estoque?: number;
    fornecedor?: string;
    marca?: string;
    gtin?: string;
    pesoLiquido?: number;
    pesoBruto?: number;
    variacao?: string; // Often implied in description or specific field
}

export interface ProductImportGroup {
    parentCode: string;
    parentRow: BlingImportRow;
    variants: BlingImportRow[];
}

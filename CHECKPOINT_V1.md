
# 🛡️ CHECKPOINT V1 - SISTEMA ESTÁVEL

**Status:** PROTEGIDO (LOCKED)
**Data:** 25/05/2025

Este arquivo marca um ponto de estabilidade crítica no desenvolvimento do B-Hub PCP.
Os módulos listados abaixo atingiram maturidade de produção e estão totalmente integrados ao Banco de Dados (Supabase).

## 🚫 ZONA PROTEGIDA (NÃO ALTERAR SEM AUTORIZAÇÃO EXPLÍCITA)

### 1. Módulo Ficha Técnica (`components/TechPackModule.tsx`)
*   **Status:** 🟢 Finalizado (Production Ready)
*   **Funcionalidades:** 
    *   Criação/Edição de Produtos e Tech Packs.
    *   Versionamento Automático (Rascunho -> Aprovado).
    *   Cálculo de Custos (Matéria Prima + MO + Indiretos).
    *   Upload de Imagens.
    *   Integração total com `services/api.ts`.

### 2. Módulo Cadastros (`components/SettingsModule.tsx`)
*   **Status:** 🟢 Finalizado (Production Ready)
*   **Funcionalidades:**
    *   CRUD de Materiais (Tecidos/Aviamentos) com Cores.
    *   CRUD de Operações, Tamanhos, Cores e Observações.
    *   Gestão de Parceiros e Depósitos.

### 3. API Core (`services/api.ts`)
*   **Status:** 🟡 Core Stable (Pode crescer, mas funções existentes estão congeladas)
*   **Descrição:** Camada de acesso ao Supabase que sustenta os módulos acima. Alterações nas assinaturas de métodos existentes (`saveProduct`, `saveTechPack`, `getMaterials`) são PROIBIDAS para evitar quebra de contrato.

### 4. Módulo Ordem de Produção (`components/ProductionOrderList.tsx` & `components/ProductionWizard.tsx`)
*   **Status:** 🟢 Finalizado (Locked)
*   **Funcionalidades:**
    *   Listagem Agrupada por Lotes (Visualização de Múltiplos Modelos).
    *   Criação e Edição de Lotes (Wizard).
    *   Correção de Sufixos de Lote (-A, -B) e prevenção de órfãos.
    *   Integração total com as tabelas `production_orders` e `production_order_items`.
    *   Fluxo completo: Planejamento -> Corte -> Facção -> Revisão -> Embalagem.

### 5. Módulo Sala de Corte (`components/CuttingModule.tsx`)
*   **Status:** 🟢 Finalizado (Locked)
*   **Funcionalidades:**
    *   Painel Kanban de Status (A Planejar, Em Corte, Finalizado).
    *   Apontamento de Enfestos com matriz de grade real.
    *   Geração automática de títulos financeiros (Contas a Pagar).
    *   Controle de excesso de corte com autorização.

---

**Instrução para o Desenvolvedor (IA):**
Ao receber solicitações de alteração no código, verifique se o arquivo alvo está nesta lista. Se estiver, priorize criar novos arquivos ou estender funcionalidades sem modificar a lógica base já estabilizada.

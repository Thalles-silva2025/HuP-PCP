
# 🚀 B-Hub PCP: Plano Estratégico de Monetização e Implementação Técnica

**Versão:** 1.0
**Data:** 25/05/2025
**Autor:** Arquiteto de Software & Product Manager

---

## 1. Resumo Executivo

O **B-Hub PCP** é uma ferramenta de gestão industrial voltada para confecções e marcas de moda. O objetivo deste plano é definir o roteiro para transformar o protótipo atual (React + Mock Data) em um produto SaaS (Software as a Service) robusto, escalável e rentável.

O diferencial competitivo reside na usabilidade (UX) superior aos ERPs tradicionais e na especificidade para o fluxo têxtil (Grade, Cores, Facção).

---

## 2. Estratégia de Monetização (Modelo de Negócio)

Para maximizar a receita e garantir a sustentabilidade, adotaremos um modelo **SaaS B2B com Assinatura Recorrente (MRR)**.

### 2.1. Público-Alvo
1.  **Pequenas Marcas (DNVB):** Foco em gestão de produto e compras, pouca produção interna.
2.  **Médias Confecções:** Gestão híbrida (interna + facção), necessidade de controle de estoque rigoroso.
3.  **Grandes Indústrias:** Foco em BI, eficiência, cronometragem e integração com ERPs (Bling, Tiny, Totvs).

### 2.2. Tiers de Preço (Sugestão)

| Plano | Público | Preço Sugerido (Mensal) | Limites & Recursos |
| :--- | :--- | :--- | :--- |
| **Starter** | Pequenas Marcas | **R$ 297,00** | • Até 2 usuários<br>• Até 50 OPs ativas/mês<br>• Fichas Técnicas<br>• Controle de Facção Básico |
| **Growth** | Médias Confecções | **R$ 697,00** | • Até 10 usuários<br>• OPs ilimitadas<br>• Controle de Estoque Avançado<br>• Gestão Financeira (Contas a Pagar)<br>• App para Facção (Portal do Parceiro) |
| **Industrial** | Grandes Operações | **R$ 1.490,00** | • Usuários ilimitados<br>• Integração API (Bling/ERPs)<br>• BI Avançado (Dashboard de Metas)<br>• Módulo de Cronometragem<br>• Suporte Dedicado |

### 2.3. Fontes de Receita Adicionais (Upsell)
*   **Taxa de Setup/Onboarding (R$ 1.500 - R$ 5.000):** Para grandes clientes, oferecendo migração de dados e treinamento da equipe.
*   **Consultoria de PCP:** Venda de horas de consultoria para otimizar o processo produtivo usando a ferramenta.

---

## 3. Arquitetura Técnica e Banco de Dados Robusto

Para suportar múltiplos clientes (Multi-tenancy) com segurança e performance, abandonaremos o `mockDb` e migraremos para uma arquitetura baseada em nuvem.

### 3.1. Stack Tecnológica Recomendada
*   **Frontend:** React (Vite) + Tailwind (Já implementado).
*   **Backend:** Node.js (NestJS) ou Serverless Functions (Supabase/AWS Lambda).
*   **Banco de Dados:** **PostgreSQL**. É a escolha padrão da indústria para dados relacionais complexos (OPs, Grades, Estoque).
*   **Autenticação:** Supabase Auth, Clerk ou Auth0 (Gerenciamento seguro de sessões).
*   **Infraestrutura:** Vercel (Frontend) + Supabase/AWS RDS (Database).

### 3.2. Modelagem do Banco de Dados (Schema Relacional)

O banco deve ser **Multi-tenant**, ou seja, todas as tabelas terão uma coluna `tenant_id` (ID da Empresa) para garantir que um cliente nunca veja os dados de outro.

#### Diagrama Lógico das Tabelas Principais:

1.  **organizations (Tenants)**
    *   `id` (UUID), `name`, `cnpj`, `plan_tier`, `subscription_status`.

2.  **users**
    *   `id`, `organization_id` (FK), `email`, `role` (Admin, PCP, Financeiro), `password_hash`.

3.  **products**
    *   `id`, `organization_id` (FK), `sku`, `name`, `collection`, `image_url`.
    *   *Relacionamento:* 1 Produto tem N Variações (SKUs filhos).

4.  **product_variants** (Grade)
    *   `id`, `product_id` (FK), `color`, `size`, `ean_gtin`.

5.  **tech_packs** (Engenharia)
    *   `id`, `product_id` (FK), `version`, `is_active`, `total_cost`.

6.  **tech_pack_materials** (Consumo)
    *   `id`, `tech_pack_id` (FK), `material_id` (FK), `consumption`, `waste_margin`.

7.  **production_orders** (OPs)
    *   `id`, `organization_id` (FK), `lot_number`, `product_id` (FK), `status` (Enum), `quantity_total`.
    *   `start_date`, `due_date`, `current_stage`.

8.  **production_order_items** (Grade da OP)
    *   `id`, `op_id` (FK), `variant_id` (FK), `quantity_planned`, `quantity_real`.

9.  **inventory_movements** (Kardex)
    *   `id`, `organization_id` (FK), `item_type` (Material/Product), `item_id`, `type` (IN/OUT), `quantity`, `cost`.

10. **partners** (Facções/Fornecedores)
    *   `id`, `organization_id` (FK), `name`, `type`, `default_rate`.

11. **subcontractor_orders** (Remessas)
    *   `id`, `op_id` (FK), `partner_id` (FK), `sent_date`, `return_date`, `status`.

---

## 4. Plano de Implementação (Roadmap)

Este roadmap visa lançar o MVP comercial em **8 semanas**.

### Fase 1: Fundação (Semanas 1-3)
*   [ ] Configurar projeto no **Supabase** (Postgres + Auth).
*   [ ] Criar scripts de migração SQL para criar as tabelas acima.
*   [ ] Implementar sistema de Login/Cadastro no Frontend.
*   [ ] Substituir `MockService` por `ApiService` conectando ao Supabase.
*   *Meta:* O sistema salva e lê dados reais do banco, segregando por empresa.

### Fase 2: Migração de Módulos Críticos (Semanas 4-6)
*   [ ] Migrar Cadastro de Produtos e Materiais.
*   [ ] Migrar Engenharia (Ficha Técnica).
*   [ ] Migrar Ordens de Produção e Grade.
*   *Meta:* Usuário consegue criar um produto e gerar uma OP que persiste no banco.

### Fase 3: Financeiro e Estoque (Semana 7)
*   [ ] Implementar lógica de baixa de estoque ao finalizar OP.
*   [ ] Implementar geração de Contas a Pagar baseada nas Facções.
*   *Meta:* Ciclo fechado: Compra -> Produção -> Estoque -> Financeiro.

### Fase 4: Polimento e Lançamento (Semana 8)
*   [ ] Integração com Gateway de Pagamento (Stripe ou Asaas) para cobrar a assinatura.
*   [ ] Testes de carga e segurança (Row Level Security no Postgres).
*   [ ] Lançamento Beta para 5 clientes convidados.

---

## 5. Próximos Passos Imediatos

Para dar início a este projeto sem quebrar a aplicação atual:

1.  **Aprovação:** O Sr. aprova este documento e a arquitetura sugerida?
2.  **Configuração de Ambiente:** Posso gerar o código para configurar o cliente do Supabase e o Contexto de Autenticação?
3.  **Migração Gradual:** Começaremos criando a camada de API sem deletar o Mock, permitindo alternar entre "Modo Demo" e "Modo Real".

---
**Fim do Documento**

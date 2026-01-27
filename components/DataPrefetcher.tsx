
import React, { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiService } from '../services/api';

/**
 * DataPrefetcher
 * Componente invisível responsável por "aquecer" o cache do aplicativo.
 * Ele dispara requisições para todos os endpoints principais assim que o usuário loga,
 * garantindo que quando o usuário clicar na aba, os dados já estejam lá.
 */
export const DataPrefetcher: React.FC = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const prefetchData = async () => {
      // Definição de prioridade: Carrega dados críticos em paralelo
      const criticalQueries = [
        { key: ['productionOrders'], fn: ApiService.getProductionOrders },
        { key: ['subcontractorOrders'], fn: ApiService.getSubcontractorOrders },
        { key: ['products'], fn: ApiService.getProducts },
        { key: ['materials'], fn: ApiService.getMaterials },
        { key: ['finishedGoods'], fn: ApiService.getFinishedGoods },
        { key: ['partners'], fn: ApiService.getPartners },
        { key: ['payments'], fn: ApiService.getPayments },
        { key: ['colors'], fn: ApiService.getColors },
        { key: ['standardOperations'], fn: ApiService.getStandardOperations }
      ];

      // Dispara todas as requisições simultaneamente (Promise.all)
      // Isso é muito mais rápido do que carregar um por um
      try {
        await Promise.all(
          criticalQueries.map(({ key, fn }) => 
            queryClient.prefetchQuery({
              queryKey: key,
              queryFn: fn,
              staleTime: 1000 * 60 * 5, // Considera os dados frescos por 5 minutos
            })
          )
        );
        console.log('🚀 Sistema: Todos os módulos pré-carregados com sucesso.');
      } catch (error) {
        console.error('⚠️ Falha no pré-carregamento em segundo plano:', error);
      }
    };

    // Executa imediatamente ao montar o componente
    prefetchData();

    // Opcional: Intervalo para manter dados frescos (Polling silencioso a cada 5 min)
    const intervalId = setInterval(prefetchData, 1000 * 60 * 5);

    return () => clearInterval(intervalId);
  }, [queryClient]);

  return null; // Componente visualmente invisível
};

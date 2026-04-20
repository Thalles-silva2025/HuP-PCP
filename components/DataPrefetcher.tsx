
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
      // Definição de prioridade: Carrega dados críticos sequencialmente para não sobrecarregar
      // a rede ou a API free tier.
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

      // Executa em batches de 3 para não bloquear a thread principal ou a rede
      const chunkSize = 3;
      for (let i = 0; i < criticalQueries.length; i += chunkSize) {
          const chunk = criticalQueries.slice(i, i + chunkSize);
          await Promise.allSettled(chunk.map(({ key, fn }) => 
            queryClient.prefetchQuery({
              queryKey: key,
              queryFn: fn,
              staleTime: 1000 * 60 * 5, // Considera os dados frescos por 5 minutos
            })
          ));
      }
      console.log('🚀 Sistema: Pré-carregamento concluído.');
    };

    // Executa imediatamente ao montar o componente
    prefetchData();

    // Opcional: Intervalo para manter dados frescos (Polling silencioso a cada 5 min)
    const intervalId = setInterval(prefetchData, 1000 * 60 * 5);

    return () => clearInterval(intervalId);
  }, [queryClient]);

  return null; // Componente visualmente invisível
};

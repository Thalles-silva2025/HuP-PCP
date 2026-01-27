
import { supabase } from './supabase';

export interface SystemLog {
    id: string;
    timestamp: string; // Mapeado de created_at
    type: 'success' | 'error' | 'warning' | 'info';
    action: string;
    details: string;
    resolved: boolean;
}

export const SystemLogService = {
    // Recupera logs do Banco de Dados (Limitado a 20)
    getLogs: async (): Promise<SystemLog[]> => {
        try {
            const { data, error } = await supabase
                .from('system_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20); // Limite solicitado

            if (error) throw error;

            return (data || []).map((log: any) => ({
                id: log.id,
                timestamp: log.created_at,
                type: log.type as any,
                action: log.action,
                details: log.details,
                resolved: log.resolved
            }));
        } catch (e) {
            console.error("Erro ao buscar logs:", e);
            return [];
        }
    },

    // Adiciona um novo log e limpa antigos
    addLog: async (type: 'success' | 'error' | 'warning' | 'info', action: string, details: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            let orgId = null;
            
            if (user) {
                const { data: profile } = await supabase
                    .from('user_profiles')
                    .select('organization_id')
                    .eq('id', user.id)
                    .single();
                orgId = profile?.organization_id;
            }

            const newLog = {
                organization_id: orgId,
                type,
                action,
                details: typeof details === 'object' ? JSON.stringify(details) : String(details),
                resolved: type === 'success'
            };

            await supabase.from('system_logs').insert([newLog]);
            
            // AUTO-CLEANUP: Remove logs com mais de 7 dias ou mantém apenas os últimos 50 no banco para não inchar
            if (Math.random() < 0.2) { // Roda em 20% das vezes para não pesar
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                await supabase.from('system_logs').delete().lt('created_at', oneWeekAgo.toISOString());
            }
            
            return {
                id: 'temp-id',
                timestamp: new Date().toISOString(),
                ...newLog
            } as SystemLog;

        } catch (e) {
            console.error("Falha ao salvar log no banco:", e);
            return null;
        }
    },

    clearLogs: async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if(!user) return;
            await supabase.from('system_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000'); 
        } catch (e) {
            console.error("Erro ao limpar logs:", e);
        }
    },

    getErrorCount: async () => {
        const { count } = await supabase
            .from('system_logs')
            .select('*', { count: 'exact', head: true })
            .eq('type', 'error');
        return count || 0;
    }
};

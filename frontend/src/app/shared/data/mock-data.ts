import { ReportView, UserView } from '../models/cashier.model';

// Relatórios avançados e gestão de usuários permanecem ilustrativos nesta versão.
export const reports: ReportView[] = [
  { label: 'Faturamento semanal', value: 'Em breve', detail: 'Exportação detalhada fica para a próxima versão', icon: 'pi pi-chart-bar' },
  { label: 'Produtos vendidos', value: 'Dashboard', detail: 'O ranking real já está disponível no Dashboard', icon: 'pi pi-box' },
  { label: 'Tempo médio cozinha', value: 'Em breve', detail: 'Métrica histórica ainda não implementada', icon: 'pi pi-clock' },
];

export const users: UserView[] = [
  { name: 'Administrador', role: 'ADMIN', status: 'Ambiente local', lastAccess: 'usuário de desenvolvimento' },
  { name: 'Gestão de usuários', role: 'Próxima versão', status: 'Parcial', lastAccess: 'sem autenticação real' },
];

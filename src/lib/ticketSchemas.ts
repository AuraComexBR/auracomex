import { z } from 'zod';

export const ticketCategories = ['bug', 'sugestao', 'duvida', 'outro'] as const;
export const ticketPriorities = ['baixa', 'media', 'alta'] as const;
export const ticketStatuses = ['aberto', 'em_andamento', 'resolvido', 'fechado'] as const;

export type TicketCategory = typeof ticketCategories[number];
export type TicketPriority = typeof ticketPriorities[number];
export type TicketStatus = typeof ticketStatuses[number];

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  bug: 'Bug',
  sugestao: 'Sugestão',
  duvida: 'Dúvida',
  outro: 'Outro',
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

export const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
  fechado: 'Fechado',
};

export const STATUS_COLOR: Record<TicketStatus, string> = {
  aberto: 'bg-status-attention/20 text-status-attention',
  em_andamento: 'bg-primary/20 text-primary',
  resolvido: 'bg-status-completed/20 text-status-completed',
  fechado: 'bg-muted text-muted-foreground',
};

export const ticketFormSchema = z.object({
  title: z.string().trim().min(3, 'Título muito curto').max(120, 'Máx 120 caracteres'),
  description: z.string().trim().min(10, 'Descreva com mais detalhes').max(4000, 'Máx 4000 caracteres'),
  category: z.enum(ticketCategories),
  priority: z.enum(ticketPriorities),
});

export type TicketFormValues = z.infer<typeof ticketFormSchema>;

export const messageSchema = z.object({
  body: z.string().trim().min(1, 'Escreva uma mensagem').max(4000, 'Máx 4000 caracteres'),
});
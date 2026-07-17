import { z } from 'zod';

/** Schemas centrais de validação. Reutilize em forms e edge functions. */

export const emailSchema = z.string().trim().email('E-mail inválido').max(255);

export const strongPasswordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Z]/, 'Precisa de ao menos 1 letra maiúscula')
  .regex(/[a-z]/, 'Precisa de ao menos 1 letra minúscula')
  .regex(/[0-9]/, 'Precisa de ao menos 1 número');

export const changePasswordSchema = z
  .object({
    newPassword: strongPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'As senhas não conferem',
    path: ['confirm'],
  });

export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN deve ter 4 dígitos');

export const taxIdSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ''))
  .refine((v) => v.length === 11 || v.length === 14, 'CPF ou CNPJ inválido');

export const totpCodeSchema = z.string().regex(/^\d{6}$/, 'Código deve ter 6 dígitos');

/** Sanitização básica anti-XSS para strings livres exibidas em HTML/PDF. */
export function sanitizeText(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Mail, Pencil, Trash2, Loader2, KeyRound, LogIn, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { CompanyUsersPanel } from './CompanyUsersPanel';

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function getAccessStatus(expiresAt: string | null) {
  if (!expiresAt) return { label: 'Sem prazo', variant: 'secondary' as const, color: '' };
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return { label: 'Expirado', variant: 'destructive' as const, color: '' };
  if (diffDays <= 15) return { label: `${diffDays}d restantes`, variant: 'outline' as const, color: 'border-yellow-500 text-yellow-600 dark:text-yellow-400' };
  return { label: `${diffDays}d restantes`, variant: 'outline' as const, color: 'border-green-500 text-green-600 dark:text-green-400' };
}

interface CompanyCardProps {
  company: any;
  resettingPassword: string | null;
  onAccess: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onResetPassword: () => void;
  onRenew: () => void;
}

export function CompanyCard({ company, resettingPassword, onAccess, onEdit, onDelete, onResetPassword, onRenew }: CompanyCardProps) {
  const status = getAccessStatus(company.access_expires_at);
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="py-4 space-y-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{company.name}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {company.cnpj && <span className="font-mono">{formatCnpj(company.cnpj)}</span>}
              {company.email && (
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {company.email}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.variant} className={`${status.color} justify-center min-w-[110px] shrink-0`}>
              {status.label}
            </Badge>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              title="Gerenciar usuários"
              className="min-w-[76px] justify-center shrink-0"
            >
              <Users className="w-3 h-3 mr-1" />{company.userCount}
              {expanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
            </Button>
            <Button variant="outline" size="sm" onClick={onRenew} title="Renovar acesso">
              <RefreshCw className="w-4 h-4 mr-1" />Renovar
            </Button>
            <Button variant="default" size="sm" onClick={onAccess} title="Acessar sistema da empresa">
              <LogIn className="w-4 h-4 mr-1" />Acessar
            </Button>
            {/* Slot de largura fixa: mantém o alinhamento dos ícones seguintes mesmo quando
                a empresa não tem adminEmail (ex: empresa SUPERADMIN) */}
            <div className="w-9 shrink-0">
              {company.adminEmail && (
                <Button
                  variant="ghost" size="icon"
                  onClick={onResetPassword}
                  disabled={resettingPassword === company.id}
                  title={`Enviar recuperação para ${company.adminEmail}`}
                >
                  {resettingPassword === company.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <KeyRound className="w-4 h-4" />}
                </Button>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>


        {expanded && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-sm font-medium mb-3">Usuários e Cargos</p>
            <CompanyUsersPanel companyId={company.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

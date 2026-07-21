import { useState } from 'react';
import { Bell, Globe, Sparkles, LogOut, CheckCheck, Trash2, X, UserCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ReleaseNotesDialog } from '@/components/releases/ReleaseNotesDialog';
import { useReleases } from '@/hooks/useReleases';
import { PlanBadge } from '@/components/billing/PlanBadge';
import { useNotifications } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { t, language, setLanguage } = useLanguage();
  const { profile, signOut } = useAuth();
  const { unread } = useReleases();
  const [notesOpen, setNotesOpen] = useState(false);
  const { items: notifications, unreadCount, markRead, markAllRead, remove, clearAll } = useNotifications();
  const navigate = useNavigate();

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'FF';

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-lg flex items-center justify-end px-6">
      {/* Right side */}
      <div className="flex items-center gap-3">
        <div data-tour="plan-badge"><PlanBadge /></div>
        {/* What's new */}
        <Button variant="ghost" size="sm" onClick={() => setNotesOpen(true)} className="gap-1.5 text-xs">
          <Sparkles className="w-4 h-4 text-primary" />
          {unread.length > 0 && <span className="w-2 h-2 bg-primary rounded-full" />}
        </Button>
        <ReleaseNotesDialog mode="manual" open={notesOpen} onOpenChange={setNotesOpen} />

        {/* Language toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLanguage(language === 'pt' ? 'en' : 'pt')}
          className="relative"
        >
          <Globe className="w-4 h-4" />
          <span className="absolute -bottom-0.5 -right-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded px-0.5">
            {language.toUpperCase()}
          </span>
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 text-[9px] font-bold flex items-center justify-center bg-status-urgent text-white rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 max-h-[500px] overflow-y-auto">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-sm font-semibold">{t('common.notifications')}</span>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => markAllRead.mutate()}>
                    <CheckCheck className="w-3 h-3" /> Marcar todas
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={() => clearAll.mutate()}>
                    <Trash2 className="w-3 h-3" /> Limpar todas
                  </Button>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 && (
              <DropdownMenuItem className="text-muted-foreground justify-center py-6" disabled>
                {t('common.no_notifications')}
              </DropdownMenuItem>
            )}
            {notifications.map((n: any) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => {
                  if (n.link) {
                    if (!n.read) markRead.mutate(n.id);
                    navigate(n.link);
                  } else {
                    remove.mutate(n.id);
                  }
                }}
                className={cn(
                  'flex flex-col items-start gap-0.5 py-2 cursor-pointer',
                  !n.read && 'bg-primary/5',
                )}
              >
                <div className="flex items-center gap-2 w-full">
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                  <span className="text-sm font-medium flex-1 truncate">{n.title}</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      remove.mutate(n.id);
                    }}
                    className="opacity-60 hover:opacity-100 shrink-0"
                    title="Remover"
                    aria-label="Remover notificação"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {n.message && (
                  <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                )}
                <span className="text-[10px] text-muted-foreground/70">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden md:block">
                {profile?.full_name}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{profile?.full_name}</span>
              <span className="text-xs font-normal text-muted-foreground truncate">{profile?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/account')} className="cursor-pointer">
              <UserCircle className="w-4 h-4 mr-2" />
              {language === 'pt' ? 'Minha Conta' : 'My Account'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              {t('nav.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

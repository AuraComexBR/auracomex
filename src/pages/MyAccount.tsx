import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MyProfileSection } from '@/components/settings/MyProfileSection';
import { SecuritySection } from '@/components/settings/SecuritySection';

/**
 * Área do usuário — configurações pessoais, separadas das configurações da empresa.
 * Contém: Idioma, Meu Perfil, Alterar Senha e Autenticação em dois fatores (2FA).
 */
export default function MyAccount() {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="space-y-6 max-w-2xl animate-slide-in">
      <h1 className="text-2xl font-bold tracking-tight">
        {language === 'pt' ? 'Minha Conta' : 'My Account'}
      </h1>

      {/* Idioma */}
      <Card className="glass">
        <CardHeader><CardTitle>{t('settings.language')}</CardTitle></CardHeader>
        <CardContent>
          <Select value={language} onValueChange={(v) => setLanguage(v as 'pt' | 'en')}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pt">🇧🇷 Português</SelectItem>
              <SelectItem value="en">🇺🇸 English</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Meu Perfil */}
      <MyProfileSection />

      {/* Alterar Senha + Autenticação em dois fatores (2FA) */}
      <SecuritySection />
    </div>
  );
}

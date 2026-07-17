import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Trash2, Loader2, Image } from 'lucide-react';
import { toast } from 'sonner';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

type LogoVariant = 'light' | 'dark';

export function PlatformLogoUpload() {
  const queryClient = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const [uploading, setUploading] = useState<LogoVariant | null>(null);
  const lightRef = useRef<HTMLInputElement>(null);
  const darkRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>, variant: LogoVariant) {
    const file = e.target.files?.[0];
    if (!file || !settings) return;

    if (file.size > 2 * 1024 * 1024) { toast.error('Máximo 2MB'); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('PNG, JPG ou WebP'); return;
    }

    setUploading(variant);
    try {
      const ext = file.name.split('.').pop();
      const filename = variant === 'dark' ? 'logo-dark' : 'logo-light';
      const path = `platform/${filename}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(path);
      const url = urlData.publicUrl + '?t=' + Date.now();

      const patch: any = variant === 'dark' ? { logo_dark_url: url } : { logo_url: url };
      patch.updated_at = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('platform_settings' as any).update(patch).eq('id', settings.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast.success(variant === 'dark' ? 'Logo (fundo escuro) atualizado!' : 'Logo (fundo claro) atualizado!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(null);
      if (variant === 'light' && lightRef.current) lightRef.current.value = '';
      if (variant === 'dark' && darkRef.current) darkRef.current.value = '';
    }
  }

  async function handleRemove(variant: LogoVariant) {
    if (!settings) return;
    setUploading(variant);
    try {
      const prefix = variant === 'dark' ? 'logo-dark' : 'logo-light';
      const { data: files } = await supabase.storage.from('company-logos').list('platform');
      const toRemove = (files || []).filter(f => f.name.startsWith(prefix)).map(f => `platform/${f.name}`);
      if (toRemove.length > 0) await supabase.storage.from('company-logos').remove(toRemove);

      const patch: any = variant === 'dark' ? { logo_dark_url: null } : { logo_url: null };
      patch.updated_at = new Date().toISOString();
      await supabase.from('platform_settings' as any).update(patch).eq('id', settings.id);

      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast.success('Logo removido');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(null);
    }
  }

  const lightUrl = settings?.logo_url;
  const darkUrl = (settings as any)?.logo_dark_url;

  function Slot({ variant, url, inputRef }: { variant: LogoVariant; url?: string | null; inputRef: React.RefObject<HTMLInputElement> }) {
    const isDark = variant === 'dark';
    const busy = uploading === variant;
    return (
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium">{isDark ? 'Fundo escuro (logo claro)' : 'Fundo claro (logo padrão)'}</p>
        <div className="flex items-center gap-3">
          {url ? (
            <img
              src={url}
              alt="Logo"
              className="h-16 w-16 object-contain rounded-lg border border-border p-1"
              style={{ background: isDark ? '#0A0A0E' : '#ffffff' }}
            />
          ) : (
            <div
              className="h-16 w-16 rounded-lg border border-dashed border-border flex items-center justify-center text-xs"
              style={{ background: isDark ? '#0A0A0E' : '#ffffff', color: isDark ? '#888' : '#666' }}
            >
              Logo
            </div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
                Enviar
              </Button>
              {url && (
                <Button variant="ghost" size="sm" onClick={() => handleRemove(variant)} disabled={busy}>
                  <Trash2 className="w-4 h-4 mr-1" /> Remover
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG ou WebP · Máx 2MB</p>
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
          className="hidden" onChange={(e) => handleUpload(e, variant)} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Image className="w-4 h-4" /> Logo da Plataforma
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Envie duas versões: uma para áreas com fundo claro (login, cadastros) e outra para áreas com fundo escuro (sidebar interna).
        </p>
        <div className="flex flex-col md:flex-row gap-6">
          <Slot variant="light" url={lightUrl} inputRef={lightRef} />
          <Slot variant="dark" url={darkUrl} inputRef={darkRef} />
        </div>
      </CardContent>
    </Card>
  );
}

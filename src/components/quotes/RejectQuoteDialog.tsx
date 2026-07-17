import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Props {
  quote: any | null;
  onClose: () => void;
  onRejected: () => void;
}

export function RejectQuoteDialog({ quote, onClose, onRejected }: Props) {
  const { t } = useLanguage();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReject() {
    if (!quote) return;
    setLoading(true);
    try {
      const { error } = await (supabase
        .from('quotes') as any)
        .update({ status: 'rejected', rejection_reason: reason || null })
        .eq('id', quote.id);
      if (error) throw error;
      toast.success(t('quotes.rejected_success'));
      setReason('');
      onRejected();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!quote} onOpenChange={() => { setReason(''); onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('quotes.reject')}</DialogTitle>
          <DialogDescription>{t('quotes.reject_desc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('quotes.reject_reason')}</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('quotes.reject_reason_placeholder')}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setReason(''); onClose(); }}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" size="lg" className="px-8" onClick={handleReject} disabled={loading}>
              {loading ? t('common.loading') : t('quotes.reject_confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

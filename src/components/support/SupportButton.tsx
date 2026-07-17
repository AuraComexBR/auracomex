import { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TicketForm } from './TicketForm';
import { TicketList } from './TicketList';

interface SupportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportSheet({ open, onOpenChange }: SupportSheetProps) {
  const [tab, setTab] = useState('new');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" /> Suporte
          </SheetTitle>
        </SheetHeader>
        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="new">Novo ticket</TabsTrigger>
            <TabsTrigger value="mine">Meus tickets</TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="mt-4">
            <TicketForm onSuccess={() => setTab('mine')} />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <TicketList />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
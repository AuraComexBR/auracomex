import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WhatsappContact {
  id: string;
  phone: string;
  name: string | null;
  status: "lead" | "client" | "descartado";
  last_message_at: string | null;
}

interface WhatsappMessage {
  id: string;
  contact_id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  message_type: string;
  status: string;
  created_at: string;
}

function formatPhone(phone: string) {
  const match = phone.match(/^55(\d{2})(\d{5})(\d{4})$/);
  if (!match) return `+${phone}`;
  return `+55 (${match[1]}) ${match[2]}-${match[3]}`;
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function WhatsAppTab() {
  const queryClient = useQueryClient();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["whatsapp_contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .select("id, phone, name, status, last_message_at")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as WhatsappContact[];
    },
  });

  useEffect(() => {
    if (!selectedContactId && contacts.length > 0) {
      setSelectedContactId(contacts[0].id);
    }
  }, [contacts, selectedContactId]);

  const { data: messages = [] } = useQuery({
    queryKey: ["whatsapp_messages", selectedContactId],
    queryFn: async () => {
      if (!selectedContactId) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("id, contact_id, direction, body, message_type, status, created_at")
        .eq("contact_id", selectedContactId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as WhatsappMessage[];
    },
    enabled: !!selectedContactId,
  });

  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp_messages"] });
          queryClient.invalidateQueries({ queryKey: ["whatsapp_contacts"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_contacts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp_contacts"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [contacts, selectedContactId],
  );

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContact) throw new Error("Nenhum contato selecionado");
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { phone: selectedContact.phone, body: draft },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp_messages", selectedContactId] });
    },
    onError: (err: any) => {
      // Fora da janela de 24h desde a última mensagem do cliente, a Graph API
      // rejeita texto livre — nesse caso é preciso enviar um template aprovado.
      toast.error(err?.message ?? "Falha ao enviar mensagem");
    },
  });

  return (
    <div className="flex h-[70vh] min-h-[500px] border rounded-lg overflow-hidden bg-card">
      {/* Lista de contatos */}
      <div className="w-80 border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Conversas</h3>
          <p className="text-sm text-muted-foreground">Prospecção e atendimento AuraComex</p>
        </div>
        <ScrollArea className="flex-1">
          {loadingContacts && <p className="p-4 text-sm text-muted-foreground">Carregando...</p>}
          {contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContactId(contact.id)}
              className={cn(
                "w-full flex items-center gap-3 p-3 text-left border-b hover:bg-muted/50 transition-colors",
                selectedContactId === contact.id && "bg-muted",
              )}
            >
              <Avatar>
                <AvatarFallback>{(contact.name ?? contact.phone).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium truncate">{contact.name ?? formatPhone(contact.phone)}</p>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgo(contact.last_message_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{formatPhone(contact.phone)}</p>
              </div>
              <Badge variant={contact.status === "client" ? "default" : "secondary"} className="shrink-0">
                {contact.status === "client" ? "Cliente" : contact.status === "lead" ? "Lead" : "Descartado"}
              </Badge>
            </button>
          ))}
          {!loadingContacts && contacts.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
          )}
        </ScrollArea>
      </div>

      {/* Thread de mensagens */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedContact ? (
          <>
            <div className="p-4 border-b shrink-0">
              <p className="font-medium">{selectedContact.name ?? formatPhone(selectedContact.phone)}</p>
              <p className="text-sm text-muted-foreground">{formatPhone(selectedContact.phone)}</p>
            </div>
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="flex flex-col gap-2">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[70%] rounded-lg px-3 py-2 text-sm",
                      msg.direction === "outbound"
                        ? "self-end bg-primary text-primary-foreground"
                        : "self-start bg-muted",
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p className="text-[10px] opacity-70 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {msg.direction === "outbound" && ` · ${msg.status}`}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-4 border-t flex gap-2 shrink-0">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escreva uma mensagem..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && draft.trim()) {
                    e.preventDefault();
                    sendMutation.mutate();
                  }
                }}
              />
              <Button onClick={() => sendMutation.mutate()} disabled={!draft.trim() || sendMutation.isPending}>
                Enviar
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecione uma conversa
          </div>
        )}
      </div>
    </div>
  );
}

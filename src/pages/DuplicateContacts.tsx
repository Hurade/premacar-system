import React, { useState, useEffect, useMemo } from 'react';
import { Users, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button';
import { api } from '@/services/api';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BasicContact {
  id: string;
  name: string | null;
  call_name: string | null;
  phone_number: string;
  email: string | null;
  created_at: string;
}

interface DuplicateGroup {
  normalizedPhone: string;
  contacts: BasicContact[];
}

// Normaliza números brasileiros para uma chave canônica, unificando variações
// que representam o mesmo número mas são gravadas com formatos diferentes:
//   - com/sem código do país (55)
//   - com/sem o 9º dígito do celular (ex: 11987654321 vs 1187654321)
// Sem isso, duas linhas com o "mesmo" número no WhatsApp não batem como
// string idêntica e passam despercebidas como duplicadas.
const normalizePhone = (phone: string) => {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    digits = digits.slice(0, 2) + digits.slice(3); // remove o "9" logo após o DDD
  }
  return digits;
};

const DuplicateContacts: React.FC = () => {
  const [contacts, setContacts] = useState<BasicContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrimary, setSelectedPrimary] = useState<Record<string, string>>({});
  const [pendingMerge, setPendingMerge] = useState<{ primaryId: string; duplicateId: string; label: string } | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const loadContacts = async () => {
    setLoading(true);
    try {
      const data = await api.fetchContactsBasic();
      setContacts(data);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const groups: DuplicateGroup[] = useMemo(() => {
    const byPhone = new Map<string, BasicContact[]>();
    for (const contact of contacts) {
      const key = normalizePhone(contact.phone_number);
      if (!key) continue;
      if (!byPhone.has(key)) byPhone.set(key, []);
      byPhone.get(key)!.push(contact);
    }
    return Array.from(byPhone.entries())
      .filter(([, list]) => list.length > 1)
      .map(([normalizedPhone, list]) => ({ normalizedPhone, contacts: list }));
  }, [contacts]);

  const contactLabel = (c: BasicContact) => c.name || c.call_name || c.phone_number;

  const handleConfirmMerge = async () => {
    if (!pendingMerge) return;
    setIsMerging(true);
    try {
      await api.mergeContacts(pendingMerge.primaryId, pendingMerge.duplicateId);
      toast.success('Contatos mesclados com sucesso');
      setPendingMerge(null);
      await loadContacts();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao mesclar contatos');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" />
            Contatos Duplicados
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Contatos com o mesmo número de telefone. Escolha o contato principal — o histórico do outro (conversas, negócios, campanhas) será movido para ele e o duplicado será removido.
          </p>
        </div>
        <Button variant="ghost" onClick={loadContacts} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12">Nenhum contato duplicado encontrado. 🎉</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const primaryId = selectedPrimary[group.normalizedPhone] || group.contacts[0].id;
            return (
              <div key={group.normalizedPhone} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
                <p className="text-xs text-slate-500 font-mono">Número: {group.normalizedPhone}</p>
                <div className="space-y-2">
                  {group.contacts.map((contact) => (
                    <label
                      key={contact.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        primaryId === contact.id ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`primary-${group.normalizedPhone}`}
                        checked={primaryId === contact.id}
                        onChange={() => setSelectedPrimary(prev => ({ ...prev, [group.normalizedPhone]: contact.id }))}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{contactLabel(contact)}</div>
                        <div className="text-xs text-slate-500">
                          {contact.phone_number} · {contact.email || 'sem e-mail'} · criado em {new Date(contact.created_at).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                      {primaryId === contact.id && (
                        <span className="text-xs font-semibold text-cyan-400 uppercase">Principal</span>
                      )}
                    </label>
                  ))}
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  {group.contacts.filter(c => c.id !== primaryId).map((duplicate) => (
                    <Button
                      key={duplicate.id}
                      size="sm"
                      variant="outline"
                      onClick={() => setPendingMerge({
                        primaryId,
                        duplicateId: duplicate.id,
                        label: `${contactLabel(duplicate)} → ${contactLabel(group.contacts.find(c => c.id === primaryId)!)}`,
                      })}
                    >
                      Mesclar "{contactLabel(duplicate)}" no principal
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!pendingMerge} onOpenChange={(open) => !open && setPendingMerge(null)}>
        <AlertDialogContent className="bg-slate-900 border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Mesclar Contatos</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta ação é irreversível: {pendingMerge?.label}. Todo o histórico (conversas, negócios, campanhas, tarefas) do contato duplicado será movido para o principal, e o duplicado será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMerging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMerge} disabled={isMerging} className="bg-red-600 hover:bg-red-700">
              {isMerging ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar Mesclagem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DuplicateContacts;

import React, { useEffect, useState, useCallback } from 'react';
import { Search, Filter, Upload, MessageSquare, Loader2, Phone, Users, Check, X, Send, Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import FolderManager, { ContactFolder } from './contacts/FolderManager';
import ImportContactsModal from './contacts/ImportContactsModal';
import BulkActionsBar from './contacts/BulkActionsBar';

interface ContactRow {
  id: string;
  name: string | null;
  phone_number: string;
  oficina: string | null;
  disparo_enabled: boolean;
  folder_id: string | null;
  folder?: ContactFolder;
  last_activity: string;
}

const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [folders, setFolders] = useState<ContactFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showImportModal, setShowImportModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const navigate = useNavigate();

  const loadFolders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('contact_folders')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      
      // Get contact count per folder
      const { data: countData } = await supabase
        .from('contacts')
        .select('folder_id')
        .not('folder_id', 'is', null);
      
      const counts: Record<string, number> = {};
      countData?.forEach(c => {
        if (c.folder_id) {
          counts[c.folder_id] = (counts[c.folder_id] || 0) + 1;
        }
      });

      setFolders((data || []).map(f => ({
        ...f,
        contact_count: counts[f.id] || 0
      })));
    } catch (error) {
      console.error('Erro ao carregar pastas:', error);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('contacts')
        .select(`
          id,
          name,
          phone_number,
          oficina,
          disparo_enabled,
          folder_id,
          last_activity
        `)
        .order('last_activity', { ascending: false });

      if (selectedFolderId) {
        query = query.eq('folder_id', selectedFolderId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setContacts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  }, [selectedFolderId]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = contacts.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      (c.name?.toLowerCase() || '').includes(term) ||
      (c.phone_number || '').includes(term) ||
      (c.oficina?.toLowerCase() || '').includes(term)
    );
  });

  const handleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ folder_id: folderId })
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`${selectedIds.size} contato(s) movido(s)!`);
      setSelectedIds(new Set());
      loadContacts();
      loadFolders();
    } catch (error) {
      console.error('Erro ao mover contatos:', error);
      toast.error('Erro ao mover contatos');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleToggleDisparo = async (enabled: boolean) => {
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ disparo_enabled: enabled })
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`Disparo ${enabled ? 'ativado' : 'desativado'} para ${selectedIds.size} contato(s)!`);
      setSelectedIds(new Set());
      loadContacts();
    } catch (error) {
      console.error('Erro ao atualizar disparo:', error);
      toast.error('Erro ao atualizar disparo');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir ${selectedIds.size} contato(s)?`)) return;
    
    setBulkLoading(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`${selectedIds.size} contato(s) excluído(s)!`);
      setSelectedIds(new Set());
      loadContacts();
      loadFolders();
    } catch (error) {
      console.error('Erro ao excluir contatos:', error);
      toast.error('Erro ao excluir contatos');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleStartConversation = (phone: string) => {
    navigate(`/chat?contact=${encodeURIComponent(phone)}`);
  };

  const getFolderById = (folderId: string | null) => {
    return folders.find(f => f.id === folderId);
  };

  return (
    <div className="flex h-full bg-slate-950 text-slate-50">
      {/* Sidebar with folders */}
      <div className="w-64 p-4 border-r border-slate-800 flex-shrink-0 overflow-y-auto">
        <FolderManager
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          onFoldersChange={loadFolders}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Contatos</h2>
            <p className="text-sm text-slate-400 mt-1">
              {selectedFolderId 
                ? `Pasta: ${getFolderById(selectedFolderId)?.name || 'Desconhecida'}`
                : 'Todos os contatos'}
            </p>
          </div>
          <Button onClick={() => setShowImportModal(true)} className="shadow-lg shadow-cyan-500/20">
            <Upload className="w-4 h-4 mr-2" />
            Importar Planilha
          </Button>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-4 mb-6 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input 
              type="text" 
              placeholder="Buscar por nome, telefone ou oficina"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 placeholder:text-slate-600 transition-all"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm shadow-xl overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-80">
              <Loader2 className="h-10 w-10 animate-spin text-cyan-500 mb-3" />
              <span className="text-sm text-slate-400 animate-pulse">Carregando contatos...</span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-slate-400">
              <Users className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum contato encontrado</p>
              <p className="text-sm text-slate-500 mt-1">
                {searchTerm ? 'Tente buscar por outro termo' : 'Importe uma planilha para começar'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-4 w-10">
                      <Checkbox
                        checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-4">Nome</th>
                    <th className="px-4 py-4">Oficina</th>
                    <th className="px-4 py-4">Telefone</th>
                    <th className="px-4 py-4 text-center">Disparo</th>
                    <th className="px-4 py-4">Pasta</th>
                    <th className="px-4 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredContacts.map((contact) => {
                    const folder = getFolderById(contact.folder_id);
                    return (
                      <tr 
                        key={contact.id} 
                        className={`hover:bg-slate-800/40 transition-colors group ${
                          selectedIds.has(contact.id) ? 'bg-cyan-500/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={() => handleSelect(contact.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-cyan-400">
                              {(contact.name || contact.phone_number || '?').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">
                              {contact.name || 'Sem nome'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {contact.oficina || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Phone className="w-3.5 h-3.5" />
                            <span className="font-mono text-xs">{contact.phone_number}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {contact.disparo_enabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Check className="w-3 h-3" />
                              Sim
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-500 border border-slate-700">
                              <X className="w-3 h-3" />
                              Não
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {folder ? (
                            <span 
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
                              style={{ 
                                backgroundColor: `${folder.color}15`,
                                borderColor: `${folder.color}30`,
                                color: folder.color 
                              }}
                            >
                              <Folder className="w-3 h-3" />
                              {folder.name}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" 
                            title="Iniciar Conversa"
                            onClick={() => handleStartConversation(contact.phone_number)}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats footer */}
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{filteredContacts.length} contato(s)</span>
          <span>
            {contacts.filter(c => c.disparo_enabled).length} habilitado(s) para disparo
          </span>
        </div>
      </div>

      {/* Bulk actions bar */}
      <BulkActionsBar
        selectedCount={selectedIds.size}
        folders={folders}
        onClearSelection={() => setSelectedIds(new Set())}
        onMoveToFolder={handleMoveToFolder}
        onToggleDisparo={handleToggleDisparo}
        onDelete={handleBulkDelete}
        loading={bulkLoading}
      />

      {/* Import modal */}
      <ImportContactsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        folders={folders}
        onImportComplete={() => {
          loadContacts();
          loadFolders();
        }}
      />
    </div>
  );
};

export default Contacts;

import React, { useEffect, useState } from 'react';
import { UserPlus, Search, Loader2, X, Check, Edit2, Users, Settings, Trash2, ShieldCheck, Crown, KeyRound, Eye, EyeOff } from 'lucide-react';
import { Button } from './Button';
import { api } from '../services/api';
import { TeamMember, type Team as TeamType, type TeamFunction } from '../types';
import { supabase } from '@/integrations/supabase/client';
import TeamConfigModal from './TeamConfigModal';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';
import { RoleGate } from './RoleGate';

const Team: React.FC = () => {
  const { isAdmin, isManager, teamRole } = useUserRole();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [teams, setTeams] = useState<TeamType[]>([]);
  const [functions, setFunctions] = useState<TeamFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    role: 'agent',
    team_id: '',
    function_id: '',
    weight: 1
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'agent',
    status: 'invited' as 'active' | 'invited' | 'disabled',
    team_id: '',
    function_id: '',
    weight: 1
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);


  useEffect(() => {
    loadAllData();
    const cleanup = setupRealtime();
    return cleanup;
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [membersData, teamsData, functionsData] = await Promise.all([
        api.fetchTeam(),
        api.fetchTeams(),
        api.fetchTeamFunctions()
      ]);
      setMembers(membersData);
      setTeams(teamsData);
      setFunctions(functionsData);
    } catch (error) {
      console.error("Erro ao carregar dados da equipe", error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    const channel = supabase
      .channel('team-members-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members' }, () => {
        loadAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 6) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-update-user', {
        body: {
          action: 'create',
          email: formData.email,
          password: newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const userId = data?.user?.id;
      if (userId) {
        await supabase.from('team_members').insert({
          user_id: userId,
          name: formData.name,
          email: formData.email,
          role: formData.role as 'admin' | 'manager' | 'agent',
          team_id: formData.team_id || null,
          function_id: formData.function_id || null,
          weight: formData.weight || 1,
          status: 'active' as const,
        });
      }

      toast.success('Usuário criado com sucesso!');
      setShowModal(false);
      setNewPassword('');
      setConfirmPassword('');
      setFormData({ name: '', email: '', role: 'agent', team_id: '', function_id: '', weight: 1 });
      await loadAllData();
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      toast.error('Erro ao criar usuário. Verifique se o email já não está cadastrado.');
    }
  };

  const handleUpdateMember = async (id: string, field: string, value: any) => {
    try {
      await api.updateTeamMember(id, { [field]: value });
      toast.success('Membro atualizado com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar membro:', error);
      toast.error('Erro ao atualizar membro');
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir ${name}?`)) return;
    try {
      await api.deleteTeamMember(id);
      toast.success('Membro removido com sucesso');
      await loadAllData();
    } catch (error) {
      console.error('Erro ao remover membro:', error);
      toast.error('Erro ao remover membro');
    }
  };

  const handleEditClick = (member: TeamMember) => {
    setEditingMember(member);
    setEditFormData({
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.status,
      team_id: member.team_id || '',
      function_id: member.function_id || '',
      weight: member.weight || 1
    });
    setNewPassword('');
    setConfirmPassword('');
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    try {
      await api.updateTeamMember(editingMember.id, {
        name: editFormData.name,
        email: editFormData.email,
        role: editFormData.role as 'admin' | 'manager' | 'agent',
        status: editFormData.status,
        team_id: editFormData.team_id || null,
        function_id: editFormData.function_id || null,
        weight: editFormData.weight
      });

      // Sync email change to auth system if email changed
      const emailChanged = editFormData.email !== editingMember.email;
      if (emailChanged && editingMember.user_id) {
        const response = await supabase.functions.invoke('admin-update-user', {
          body: { target_user_id: editingMember.user_id, new_email: editFormData.email },
        });
        if (response.error || response.data?.error) {
          toast.error('Email atualizado na equipe, mas falhou no sistema de login: ' + (response.data?.error || response.error?.message));
        }
      } else if (emailChanged && !editingMember.user_id) {
        toast.warning('Email atualizado na equipe. Como o usuário ainda não fez login, ele deve usar o novo email ao criar a conta.');
      }

      // Change password if filled
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          toast.error('As senhas não coincidem');
          return;
        }
        if (newPassword.length < 6) {
          toast.error('A senha deve ter no mínimo 6 caracteres');
          return;
        }
        if (!editingMember.user_id) {
          toast.error('Este usuário ainda não acessou o sistema — senha não pode ser alterada');
          return;
        }
        await handleChangePassword(editingMember.user_id);
      }

      toast.success('Membro atualizado com sucesso!');
      setShowEditModal(false);
      setEditingMember(null);
      await loadAllData();
    } catch (error) {
      console.error('Erro ao editar membro:', error);
      toast.error('Erro ao editar membro');
    }
  };

  const handleChangePassword = async (targetUserId: string) => {
    setChangingPassword(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('No session token');

      const response = await supabase.functions.invoke('admin-update-user', {
        body: { target_user_id: targetUserId, new_password: newPassword },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
    } catch (err: any) {
      console.error('Erro ao alterar senha:', err);
      throw err;
    } finally {
      setChangingPassword(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'active':
            return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-950 border border-slate-700 text-white shadow-sm">Ativo</span>;
        case 'invited':
            return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-950 border border-amber-900/50 text-amber-500 shadow-sm">Pendente</span>;
        default:
            return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-950 border border-slate-800 text-slate-500 shadow-sm">Inativo</span>;
    }
  };

  // Filtered members based on search
  const filteredMembers = members.filter(m => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const teamName = teams.find(t => t.id === m.team_id)?.name || '';
    const funcName = functions.find(f => f.id === m.function_id)?.name || '';
    return (
      m.name.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term) ||
      teamName.toLowerCase().includes(term) ||
      funcName.toLowerCase().includes(term)
    );
  });

  // Dynamic stats
  const stats = {
    total: members.length,
    admins: members.filter(m => m.role === 'admin').length,
    members: members.filter(m => m.role !== 'admin').length,
    teams: teams.length
  };

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-950 text-slate-50 relative custom-scrollbar">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Equipe
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Gerencie usuários e times da organização
            {teamRole && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                isAdmin ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
              }`}>
                {isAdmin ? 'Admin' : isManager ? 'Gerente' : 'Visualização'}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <Button onClick={() => setShowConfigModal(true)} variant="outline" className="border-slate-700">
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
          )}
          {isAdmin && (
            <Button onClick={() => setShowModal(true)} className="shadow-lg shadow-cyan-500/20 bg-slate-100 text-slate-900 hover:bg-white hover:text-black">
              <UserPlus className="w-4 h-4 mr-2" />
              Criar Usuário
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-400 mb-2">Total de Usuários</div>
            <div className="text-3xl font-bold text-white">{loading ? '-' : stats.total}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-400 mb-2">Admins</div>
            <div className="text-3xl font-bold text-white">{loading ? '-' : stats.admins}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-400 mb-2">Membros</div>
            <div className="text-3xl font-bold text-white">{loading ? '-' : stats.members}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="text-sm font-medium text-slate-400 mb-2">Times Ativos</div>
            <div className="text-3xl font-bold text-white">{stats.teams}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input 
            type="text" 
            placeholder="Buscar por nome, email, time ou função..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-96 pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-800 rounded-lg text-sm text-slate-200 focus:ring-1 focus:ring-slate-700 outline-none placeholder:text-slate-600 transition-all"
        />
      </div>

      {/* Main Table Card */}
      <div className="bg-slate-900/30 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800">
            <h3 className="text-lg font-bold text-white">Usuários da Equipe</h3>
            <p className="text-sm text-slate-500 mt-1">Gerencie roles e times dos usuários</p>
        </div>

        {loading ? (
             <div className="flex flex-col items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-3" />
                <span className="text-sm text-slate-400">Carregando dados...</span>
           </div>
        ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12">
                <Users className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-slate-400 mb-4">Nenhum membro cadastrado ainda.</p>
                <Button onClick={() => setShowModal(true)} className="bg-slate-100 text-slate-900 hover:bg-white">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Criar Primeiro Membro
                </Button>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-800/50">
                            <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Usuário</th>
                            <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                            <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Função</th>
                            <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Peso</th>
                            <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Status</th>
                            <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/30">
                        {filteredMembers.map((member) => (
                            <tr key={member.id} className="hover:bg-slate-800/20 transition-colors group">
                                {/* User Info */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700 uppercase">
                                            {member.name.substring(0, 2)}
                                        </div>
                                        <span className="text-sm font-medium text-slate-200">{member.name}</span>
                                    </div>
                                </td>
                                
                                {/* Email */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm text-slate-400">{member.email}</span>
                                </td>

                                {/* Role Selector */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {isAdmin ? (
                                      <select
                                          value={member.role}
                                          onChange={(e) => handleUpdateMember(member.id, 'role', e.target.value)}
                                          className="w-32 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-300 cursor-pointer hover:border-slate-600 transition-colors"
                                      >
                                          <option value="agent">Atendente</option>
                                          <option value="manager">Gerente</option>
                                          <option value="admin">Admin</option>
                                      </select>
                                    ) : (
                                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                        member.role === 'admin' ? 'bg-primary/20 text-primary' :
                                        member.role === 'manager' ? 'bg-accent/20 text-accent' :
                                        'bg-slate-800 text-slate-400'
                                      }`}>
                                        {member.role === 'admin' ? 'Admin' : member.role === 'manager' ? 'Gerente' : 'Atendente'}
                                      </span>
                                    )}
                                </td>

                                {/* Time Selector */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {isAdmin ? (
                                      <select
                                          value={member.team_id || ''}
                                          onChange={(e) => handleUpdateMember(member.id, 'team_id', e.target.value || null)}
                                          className="w-32 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-300 cursor-pointer hover:border-slate-600 transition-colors"
                                      >
                                          <option value="">Sem time</option>
                                          {teams.map(team => (
                                              <option key={team.id} value={team.id}>{team.name}</option>
                                          ))}
                                      </select>
                                    ) : (
                                      <span className="text-sm text-slate-400">
                                        {teams.find(t => t.id === member.team_id)?.name || 'Sem time'}
                                      </span>
                                    )}
                                </td>

                                {/* Function Selector */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {isAdmin ? (
                                      <select
                                          value={member.function_id || ''}
                                          onChange={(e) => handleUpdateMember(member.id, 'function_id', e.target.value || null)}
                                          className="w-32 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-300 cursor-pointer hover:border-slate-600 transition-colors"
                                      >
                                          <option value="">Sem função</option>
                                          {functions.map(func => (
                                              <option key={func.id} value={func.id}>{func.name}</option>
                                          ))}
                                      </select>
                                    ) : (
                                      <span className="text-sm text-slate-400">
                                        {functions.find(f => f.id === member.function_id)?.name || 'Sem função'}
                                      </span>
                                    )}
                                </td>

                                {/* Weight */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {isAdmin ? (
                                      <input
                                          type="number"
                                          min="1"
                                          max="10"
                                          value={member.weight || 1}
                                          onChange={(e) => handleUpdateMember(member.id, 'weight', parseInt(e.target.value))}
                                          className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-300 text-center"
                                      />
                                    ) : (
                                      <span className="text-sm text-slate-400 text-center block">{member.weight || 1}</span>
                                    )}
                                </td>

                                {/* Status */}
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {getStatusBadge(member.status)}
                                </td>

                                {/* Actions */}
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        {isAdmin && (
                                          <>
                                            <button 
                                                onClick={() => handleEditClick(member)}
                                                className="p-2 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
                                                title="Editar membro"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteMember(member.id, member.name)}
                                                className="p-2 rounded-lg text-slate-500 hover:bg-red-900/50 hover:text-red-400 transition-colors"
                                                title="Excluir membro"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                          </>
                                        )}
                                        {member.role === 'admin' && (
                                          <span title="Administrador">
                                            <Crown className="w-4 h-4 text-amber-500" />
                                          </span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Criar Novo Usuário</h3>
                    <button onClick={() => { setShowModal(false); setNewPassword(''); setConfirmPassword(''); }} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleInvite} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nome Completo</label>
                        <input 
                            required
                            type="text" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-slate-600 outline-none transition-all"
                            placeholder="Ex: João da Silva"
                            value={formData.name}
                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Email Corporativo</label>
                        <input
                            required
                            type="email"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-slate-600 outline-none transition-all"
                            placeholder="colaborador@empresa.com"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Senha</label>
                        <div className="relative">
                            <input
                                required
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Mínimo 6 caracteres"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-slate-600 outline-none pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Confirmar Senha</label>
                        <input
                            required
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Repita a senha"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-slate-600 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nível de Acesso</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['agent', 'manager', 'admin'].map((role) => (
                                <div 
                                    key={role}
                                    onClick={() => setFormData({...formData, role})}
                                    className={`cursor-pointer rounded-lg border p-2 text-center transition-all ${
                                        formData.role === role 
                                        ? 'bg-slate-800 border-slate-500 text-white' 
                                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="text-xs font-bold uppercase mb-1">{role === 'agent' ? 'Atendente' : role === 'manager' ? 'Gerente' : 'Admin'}</div>
                                    {formData.role === role && <div className="flex justify-center"><Check className="w-3 h-3" /></div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Time (opcional)</label>
                        <select
                            value={formData.team_id}
                            onChange={(e) => setFormData({...formData, team_id: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                        >
                            <option value="">Sem time</option>
                            {teams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Função (opcional)</label>
                        <select
                            value={formData.function_id}
                            onChange={(e) => setFormData({...formData, function_id: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                        >
                            <option value="">Sem função</option>
                            {functions.map(func => (
                                <option key={func.id} value={func.id}>{func.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Peso (para distribuição)</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={formData.weight}
                            onChange={(e) => setFormData({...formData, weight: parseInt(e.target.value)})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="ghost" onClick={() => { setShowModal(false); setNewPassword(''); setConfirmPassword(''); }} className="flex-1 border border-slate-700 hover:bg-slate-800">Cancelar</Button>
                        <Button type="submit" className="flex-1 bg-white text-black hover:bg-slate-200">Criar Usuário</Button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Config Modal */}
      <TeamConfigModal 
        isOpen={showConfigModal} 
        onClose={() => setShowConfigModal(false)} 
        onUpdate={loadAllData}
      />

      {/* Edit Member Modal */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white">Editar Membro</h3>
                    <button onClick={() => { setShowEditModal(false); setEditingMember(null); }} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nome Completo</label>
                        <input 
                            required
                            type="text" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-slate-600 outline-none transition-all"
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Email</label>
                        <input 
                            required
                            type="email" 
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-slate-600 outline-none transition-all"
                            value={editFormData.email}
                            onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Nível de Acesso</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['agent', 'manager', 'admin'].map((role) => (
                                <div 
                                    key={role}
                                    onClick={() => setEditFormData({...editFormData, role})}
                                    className={`cursor-pointer rounded-lg border p-2 text-center transition-all ${
                                        editFormData.role === role 
                                        ? 'bg-slate-800 border-slate-500 text-white' 
                                        : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="text-xs font-bold uppercase mb-1">{role === 'agent' ? 'Atendente' : role === 'manager' ? 'Gerente' : 'Admin'}</div>
                                    {editFormData.role === role && <div className="flex justify-center"><Check className="w-3 h-3" /></div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Status</label>
                        <select
                            value={editFormData.status}
                            onChange={(e) => setEditFormData({...editFormData, status: e.target.value as 'active' | 'invited' | 'disabled'})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                        >
                            <option value="active">Ativo</option>
                            <option value="invited">Pendente</option>
                            <option value="disabled">Inativo</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Time</label>
                        <select
                            value={editFormData.team_id}
                            onChange={(e) => setEditFormData({...editFormData, team_id: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                        >
                            <option value="">Sem time</option>
                            {teams.map(team => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Função</label>
                        <select
                            value={editFormData.function_id}
                            onChange={(e) => setEditFormData({...editFormData, function_id: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                        >
                            <option value="">Sem função</option>
                            {functions.map(func => (
                                <option key={func.id} value={func.id}>{func.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Peso</label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={editFormData.weight}
                            onChange={(e) => setEditFormData({...editFormData, weight: parseInt(e.target.value)})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                        />
                    </div>

                    {/* Password Change Section - Admin only */}
                    {isAdmin && (
                      <div className="pt-2 border-t border-slate-800">
                        <div className="flex items-center gap-2 mb-3">
                          <KeyRound className="w-4 h-4 text-amber-500" />
                          <label className="text-sm font-semibold text-slate-300">Alterar Senha</label>
                          {!editingMember?.user_id && (
                            <span className="text-xs text-slate-500 italic">(usuário ainda não acessou o sistema)</span>
                          )}
                        </div>
                        {editingMember?.user_id ? (
                          <div className="space-y-3">
                            <div className="relative">
                              <input 
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Nova senha (mín. 6 caracteres)"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-amber-600/50 outline-none pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            <input 
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Confirmar nova senha"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:ring-1 focus:ring-amber-600/50 outline-none"
                            />
                            <p className="text-xs text-slate-500">Deixe em branco para não alterar a senha.</p>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 bg-slate-800/50 rounded-lg p-3">
                            A senha só pode ser alterada após o usuário realizar o primeiro acesso ao sistema.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="ghost" onClick={() => { setShowEditModal(false); setEditingMember(null); }} className="flex-1 border border-slate-700 hover:bg-slate-800">Cancelar</Button>
                        <Button type="submit" disabled={changingPassword} className="flex-1 bg-white text-black hover:bg-slate-200">
                          {changingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Salvar Alterações
                        </Button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Team;
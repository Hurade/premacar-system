import React, { useState } from 'react';
import { LayoutDashboard, MessageSquare, Users, Settings as SettingsIcon, LogOut, ShieldCheck, Calendar, Kanban, Send, BarChart3 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, MENU_ROLE_REQUIREMENTS, TeamRole } from '@/hooks/useUserRole';
import { Sidebar, SidebarBody, SidebarLink, useSidebar } from '@/components/ui/sidebar';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import premaLogo from '@/assets/logo-prema.png';
import premaLogoFull from '@/assets/logo-prema-full.png';
const menuItems = [{
  id: 'dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard
}, {
  id: 'pipeline',
  label: 'Pipeline',
  icon: Kanban
}, {
  id: 'chat',
  label: 'Chat',
  icon: MessageSquare
}, {
  id: 'contacts',
  label: 'Contatos',
  icon: Users
}, {
  id: 'broadcasts',
  label: 'Disparos',
  icon: Send
}, {
  id: 'campanhas',
  label: 'Campanhas',
  icon: BarChart3
}, {
  id: 'scheduling',
  label: 'Agendamentos',
  icon: Calendar
}, {
  id: 'team',
  label: 'Equipe',
  icon: ShieldCheck
}, {
  id: 'settings',
  label: 'Configurações',
  icon: SettingsIcon
}];
const Logo = ({
  companyName


}: {companyName: string;}) => {
  return <Link to="/dashboard" className="flex items-center space-x-3 py-1">
      <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
        <img alt="Logo" className="w-full h-full object-cover rounded-xl" src="/lovable-uploads/fd1738a7-c527-49a5-b40a-f34007000e81.png" />
      </div>
      <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      duration: 0.2
    }} className="flex flex-col overflow-hidden">
        <span className="font-bold text-lg tracking-tight text-foreground whitespace-nowrap">{companyName || 'Minha Empresa'}</span>
        <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Workspace</span>
      </motion.div>
    </Link>;
};
const LogoIcon = () => {
  return <Link to="/dashboard" className="flex items-center py-1">
      <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
        <img alt="Logo" className="w-full h-full object-cover rounded-xl" src="/lovable-uploads/fd1738a7-c527-49a5-b40a-f34007000e81.png" />
      </div>
    </Link>;
};
const SidebarContent = () => {
  const {
    companyName
  } = useCompanySettings();
  const {
    user,
    signOut
  } = useAuth();
  const {
    teamRole,
    isAdmin,
    loading: roleLoading
  } = useUserRole();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname.substring(1) || 'dashboard';
  const {
    open,
    setOpen
  } = useSidebar();

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter((item) => {
    const requiredRoles = MENU_ROLE_REQUIREMENTS[item.id];
    if (!requiredRoles) return true; // No restriction
    if (isAdmin) return true; // Admin sees everything
    return teamRole && requiredRoles.includes(teamRole);
  });

  const links = filteredMenuItems.map((item) => ({
    label: item.label,
    href: `/${item.id}`,
    icon: <item.icon className="h-5 w-5" />
  }));
  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso');
      navigate('/auth', {
        replace: true
      });
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  // Get user initials
  const getUserInitials = () => {
    if (!user?.email) return 'US';
    const email = user.email;
    return email.substring(0, 2).toUpperCase();
  };

  // Get display name
  const getDisplayName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    return 'Usuário';
  };
  return <>
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mb-6">
          {open ? <Logo companyName={companyName} /> : <LogoIcon />}
        </div>
        
        <nav className="flex flex-col gap-1.5">
          {links.map((link, idx) => <SidebarLink key={idx} link={link} isActive={currentPath.startsWith(link.href.slice(1))} />)}
        </nav>
      </div>

      {/* Prema Logo - Footer */}
      {open && <motion.div initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      duration: 0.3
    }} className="py-4 flex justify-center px-2">
          
        </motion.div>}

      {/* User Footer */}
      <div className="border-t border-border/50 pt-4">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors cursor-pointer group">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary/20 to-secondary flex items-center justify-center text-xs font-bold text-primary border border-border ring-2 ring-transparent group-hover:ring-primary/20 transition-all flex-shrink-0">
            {getUserInitials()}
          </div>
          <motion.div animate={{
          display: open ? "block" : "none",
          opacity: open ? 1 : 0
        }} transition={{
          duration: 0.2
        }} className="flex-1 overflow-hidden">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground group-hover:text-foreground whitespace-nowrap">{getDisplayName()}</p>
              {teamRole &&
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
            teamRole === 'admin' ?
            'bg-primary/20 text-primary' :
            teamRole === 'manager' ?
            'bg-accent/20 text-accent' :
            'bg-muted text-muted-foreground'}`
            }>
                  {teamRole === 'admin' ? 'Admin' : teamRole === 'manager' ? 'Gerente' : 'Agente'}
                </span>
            }
            </div>
            <p className="text-xs text-muted-foreground truncate">{user?.email || 'email@example.com'}</p>
          </motion.div>
          <motion.div animate={{
          display: open ? "block" : "none",
          opacity: open ? 1 : 0
        }} transition={{
          duration: 0.2
        }}>
            <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors" title="Sair">
              <LogOut className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
            </button>
          </motion.div>
        </div>
      </div>
    </>;
};
const AppSidebar: React.FC = () => {
  const [open, setOpen] = useState(true);
  return <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="justify-between gap-10 bg-card/50 backdrop-blur-xl border-r border-border/50">
        <SidebarContent />
      </SidebarBody>
    </Sidebar>;
};
export default AppSidebar;
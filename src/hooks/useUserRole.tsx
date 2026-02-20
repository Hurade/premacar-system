import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'user';
export type TeamRole = 'admin' | 'manager' | 'agent';

interface UserRoleContextType {
  appRole: AppRole | null;
  teamRole: TeamRole | null;
  teamMemberId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAgent: boolean;
  hasPermission: (permission: Permission) => boolean;
  refetchRoles: () => Promise<void>;
}

// Define permissions for different features
export type Permission = 
  | 'view_dashboard'
  | 'view_pipeline'
  | 'manage_deals'
  | 'view_chat'
  | 'manage_chat'
  | 'view_contacts'
  | 'manage_contacts'
  | 'view_broadcasts'
  | 'manage_broadcasts'
  | 'view_scheduling'
  | 'manage_scheduling'
  | 'view_team'
  | 'manage_team'
  | 'view_settings'
  | 'manage_settings'
  | 'manage_api_keys'
  | 'manage_integrations';

// Permission matrix based on roles
const ROLE_PERMISSIONS: Record<TeamRole | 'user', Permission[]> = {
  admin: [
    'view_dashboard',
    'view_pipeline',
    'manage_deals',
    'view_chat',
    'manage_chat',
    'view_contacts',
    'manage_contacts',
    'view_broadcasts',
    'manage_broadcasts',
    'view_scheduling',
    'manage_scheduling',
    'view_team',
    'manage_team',
    'view_settings',
    'manage_settings',
    'manage_api_keys',
    'manage_integrations',
  ],
  manager: [
    'view_dashboard',
    'view_pipeline',
    'manage_deals',
    'view_chat',
    'manage_chat',
    'view_contacts',
    'manage_contacts',
    'view_broadcasts',
    'manage_broadcasts',
    'view_scheduling',
    'manage_scheduling',
    'view_team',
  ],
  agent: [
    'view_dashboard',
    'view_pipeline',
    'manage_deals',
    'view_chat',
    'manage_chat',
    'view_contacts',
    'view_scheduling',
  ],
  user: [
    'view_dashboard',
    'view_pipeline',
    'view_chat',
    'view_contacts',
  ],
};

// Menu items that require specific roles
export const MENU_ROLE_REQUIREMENTS: Record<string, TeamRole[]> = {
  dashboard: ['admin', 'manager', 'agent'],
  pipeline: ['admin', 'manager', 'agent'],
  chat: ['admin', 'manager', 'agent'],
  contacts: ['admin', 'manager', 'agent'],
  broadcasts: ['admin', 'manager'],
  scheduling: ['admin', 'manager', 'agent'],
  team: ['admin', 'manager'],
  settings: ['admin'],
};

const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [teamRole, setTeamRole] = useState<TeamRole | null>(null);
  const [teamMemberId, setTeamMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    if (!user) {
      setAppRole(null);
      setTeamRole(null);
      setTeamMemberId(null);
      setLoading(false);
      return;
    }

    try {
      // Fetch app role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData) {
        setAppRole(roleData.role as AppRole);
      } else {
        setAppRole('user');
      }

      // Fetch team member info to get team role
      const { data: teamMemberData } = await supabase
        .from('team_members')
        .select('id, role, status')
        .eq('email', user.email!)
        .eq('status', 'active')
        .maybeSingle();

      if (teamMemberData) {
        setTeamRole(teamMemberData.role as TeamRole);
        setTeamMemberId(teamMemberData.id);
      } else {
        // Check if user is admin in user_roles, then treat as admin in team context too
        if (roleData?.role === 'admin') {
          setTeamRole('admin');
        } else {
          setTeamRole('agent'); // Default to agent for non-team members
        }
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
      setAppRole('user');
      setTeamRole('agent');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchRoles();
    }
  }, [user, authLoading]);

  const isAdmin = appRole === 'admin' || teamRole === 'admin';
  const isManager = teamRole === 'manager' || isAdmin;
  const isAgent = teamRole === 'agent' || isManager;

  const hasPermission = (permission: Permission): boolean => {
    if (isAdmin) return true; // Admin has all permissions
    
    const effectiveRole = teamRole || 'user';
    const permissions = ROLE_PERMISSIONS[effectiveRole] || ROLE_PERMISSIONS.user;
    return permissions.includes(permission);
  };

  const refetchRoles = async () => {
    setLoading(true);
    await fetchRoles();
  };

  return (
    <UserRoleContext.Provider
      value={{
        appRole,
        teamRole,
        teamMemberId,
        loading,
        isAdmin,
        isManager,
        isAgent,
        hasPermission,
        refetchRoles,
      }}
    >
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
};

// Helper hook to check if user can access a specific menu item
export const useCanAccessMenu = (menuId: string): boolean => {
  const { teamRole, isAdmin, loading } = useUserRole();
  
  if (loading) return false;
  if (isAdmin) return true;
  
  const requiredRoles = MENU_ROLE_REQUIREMENTS[menuId];
  if (!requiredRoles) return true; // If no requirement defined, allow access
  
  return teamRole ? requiredRoles.includes(teamRole) : false;
};

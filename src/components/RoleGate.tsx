import React from 'react';
import { useUserRole, Permission, TeamRole } from '@/hooks/useUserRole';
import { ShieldAlert } from 'lucide-react';

interface RoleGateProps {
  children: React.ReactNode;
  /**
   * Permission required to view the content
   */
  permission?: Permission;
  /**
   * Minimum role required to view the content
   */
  allowedRoles?: TeamRole[];
  /**
   * What to show when access is denied
   */
  fallback?: React.ReactNode;
  /**
   * If true, hides the content instead of showing a fallback
   */
  hideOnDenied?: boolean;
}

/**
 * Component that gates content based on user role/permissions.
 * Use this to wrap UI elements that should only be visible to certain roles.
 */
export const RoleGate: React.FC<RoleGateProps> = ({
  children,
  permission,
  allowedRoles,
  fallback,
  hideOnDenied = false,
}) => {
  const { hasPermission, teamRole, isAdmin, loading } = useUserRole();

  if (loading) {
    return null; // or a loading skeleton
  }

  let hasAccess = false;

  // Check by permission
  if (permission) {
    hasAccess = hasPermission(permission);
  }
  // Check by allowed roles
  else if (allowedRoles) {
    hasAccess = isAdmin || (teamRole !== null && allowedRoles.includes(teamRole));
  }
  // If neither specified, allow access
  else {
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  if (hideOnDenied) {
    return null;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Default access denied message
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Acesso Restrito
      </h3>
      <p className="text-muted-foreground text-sm max-w-md">
        Você não tem permissão para acessar este conteúdo. 
        Entre em contato com um administrador se precisar de acesso.
      </p>
    </div>
  );
};

/**
 * HOC to wrap a component with role-based access control
 */
export function withRoleGate<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<RoleGateProps, 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <RoleGate {...options}>
        <Component {...props} />
      </RoleGate>
    );
  };
}

export default RoleGate;

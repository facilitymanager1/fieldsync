import React, { useState, useEffect, ReactNode } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Permission, ResourceType } from '../types/permissions';
import { useAuth } from '../context/AuthContext';

interface PermissionGateProps {
  children: ReactNode;
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean; // If true, user must have ALL permissions; if false, user needs ANY permission
  resource?: {
    type: ResourceType;
    id: string;
    data?: any;
  };
  fallback?: ReactNode;
  onAccessDenied?: (reason: string) => void;
  showAlert?: boolean;
  alertTitle?: string;
  alertMessage?: string;
}

interface ConditionalRenderProps {
  hasAccess: boolean;
  isLoading: boolean;
  reason?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  resource,
  fallback,
  onAccessDenied,
  showAlert = false,
  alertTitle = 'Access Denied',
  alertMessage = 'You do not have permission to access this feature.'
}) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reason, setReason] = useState<string>();
  const { hasPermission, hasAnyPermission, hasAllPermissions, canAccessResource } = useAuth();

  useEffect(() => {
    checkAccess();
  }, [permission, permissions, resource]);

  const checkAccess = async () => {
    try {
      setIsLoading(true);
      let result;

      if (resource && permission) {
        // Check resource-specific access
        result = await canAccessResource(
          resource.type,
          resource.id,
          permission,
          resource.data
        );
      } else if (permissions && permissions.length > 0) {
        // Check multiple permissions
        if (requireAll) {
          result = await hasAllPermissions(permissions);
        } else {
          result = await hasAnyPermission(permissions);
        }
      } else if (permission) {
        // Check single permission
        result = await hasPermission(permission);
      } else {
        // No permission specified - allow access
        result = { granted: true };
      }

      setHasAccess(result.granted);
      setReason(result.reason);

      if (!result.granted) {
        if (onAccessDenied) {
          onAccessDenied(result.reason || 'Access denied');
        }
        
        if (showAlert) {
          Alert.alert(
            alertTitle,
            result.reason || alertMessage,
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Permission check error:', error);
      setHasAccess(false);
      setReason('Permission check failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ConditionalRender
      hasAccess={hasAccess}
      isLoading={isLoading}
      reason={reason}
      fallback={fallback}
    >
      {children}
    </ConditionalRender>
  );
};

const ConditionalRender: React.FC<ConditionalRenderProps> = ({
  hasAccess,
  isLoading,
  reason,
  children,
  fallback
}) => {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Checking permissions...</Text>
      </View>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <View style={styles.deniedContainer}>
        <Text style={styles.deniedIcon}>🚫</Text>
        <Text style={styles.deniedTitle}>Access Restricted</Text>
        <Text style={styles.deniedMessage}>
          {reason || 'You do not have permission to access this feature.'}
        </Text>
      </View>
    );
  }

  return <>{children}</>;
};

// Higher-order component version
export function withPermission<T extends object>(
  Component: React.ComponentType<T>,
  permission: Permission,
  fallbackComponent?: React.ComponentType<T>
) {
  return function PermissionWrappedComponent(props: T) {
    return (
      <PermissionGate
        permission={permission}
        fallback={fallbackComponent ? <FallbackComponent {...props} /> : undefined}
      >
        <Component {...props} />
      </PermissionGate>
    );
  };

  function FallbackComponent(props: T) {
    return fallbackComponent ? React.createElement(fallbackComponent, props) : null;
  }
}

// Hook for permission checking in components
export const usePermissionCheck = (
  permission: Permission,
  dependencies: any[] = []
) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reason, setReason] = useState<string>();
  const { hasPermission } = useAuth();

  useEffect(() => {
    checkPermission();
  }, [permission, ...dependencies]);

  const checkPermission = async () => {
    try {
      setIsLoading(true);
      const result = await hasPermission(permission);
      setHasAccess(result.granted);
      setReason(result.reason);
    } catch (error) {
      console.error('Permission check error:', error);
      setHasAccess(false);
      setReason('Permission check failed');
    } finally {
      setIsLoading(false);
    }
  };

  return { hasAccess, isLoading, reason, recheck: checkPermission };
};

// Hook for multiple permission checking
export const useMultiplePermissionCheck = (
  permissions: Permission[],
  requireAll: boolean = false,
  dependencies: any[] = []
) => {
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [reason, setReason] = useState<string>();
  const { hasAnyPermission, hasAllPermissions } = useAuth();

  useEffect(() => {
    checkPermissions();
  }, [permissions, requireAll, ...dependencies]);

  const checkPermissions = async () => {
    try {
      setIsLoading(true);
      const result = requireAll 
        ? await hasAllPermissions(permissions)
        : await hasAnyPermission(permissions);
      
      setHasAccess(result.granted);
      setReason(result.reason);
    } catch (error) {
      console.error('Permission check error:', error);
      setHasAccess(false);
      setReason('Permission check failed');
    } finally {
      setIsLoading(false);
    }
  };

  return { hasAccess, isLoading, reason, recheck: checkPermissions };
};

// Component for role-based rendering
interface RoleGateProps {
  allowedRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const RoleGate: React.FC<RoleGateProps> = ({
  allowedRoles,
  children,
  fallback
}) => {
  const { getUserRole } = useAuth();
  const userRole = getUserRole();

  if (!userRole || !allowedRoles.includes(userRole)) {
    return fallback ? <>{fallback}</> : (
      <View style={styles.deniedContainer}>
        <Text style={styles.deniedIcon}>🚫</Text>
        <Text style={styles.deniedTitle}>Role Access Required</Text>
        <Text style={styles.deniedMessage}>
          Your current role does not have access to this feature.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  deniedContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    margin: 16,
  },
  deniedIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  deniedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  deniedMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default PermissionGate;
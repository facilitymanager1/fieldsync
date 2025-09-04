import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export type UserRole = 'Admin' | 'Supervisor' | 'FieldTech' | 'SiteStaff' | 'Client' | null;

interface AuthContextType {
  user: { username: string; role: UserRole } | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ username: string; role: UserRole } | null>(null);
  const router = useRouter();

  useEffect(() => {
    // On mount, check localStorage for user
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const login = async (username: string, _password: string) => {
    // Replace with real API call
    // Demo: accept any user, assign role by username
    let role: UserRole = null;
    if (username.startsWith('admin')) role = 'Admin';
    else if (username.startsWith('super')) role = 'Supervisor';
    else if (username.startsWith('field')) role = 'FieldTech';
    else if (username.startsWith('site')) role = 'SiteStaff';
    else if (username.startsWith('client')) role = 'Client';
    if (role) {
      const userObj = { username, role };
      setUser(userObj);
      localStorage.setItem('user', JSON.stringify(userObj));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

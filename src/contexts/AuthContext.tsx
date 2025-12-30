import { createContext, useContext, useState, ReactNode } from 'react';

type User = {
  id: string;
  name: string;
  company_name: string;
  isAdmin: boolean;
};

type AuthContextType = {
  user: User | null;
  login: (tenantId: string, pin: string) => Promise<boolean>;
  loginAsAdmin: (code: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (tenantId: string, pin: string): Promise<boolean> => {
    return false;
  };

  const loginAsAdmin = async (code: string): Promise<boolean> => {
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('logged_in_user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginAsAdmin,
        logout,
        isAuthenticated: user !== null
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

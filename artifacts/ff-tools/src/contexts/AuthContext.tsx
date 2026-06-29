import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_KEY = "ff_tools_users";
const SESSION_KEY = "ff_tools_session";

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      try {
        setUser(JSON.parse(session));
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const getUsers = (): Record<string, { password: string; name: string }> => {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
    } catch {
      return {};
    }
  };

  const login = async (email: string, password: string) => {
    await new Promise(r => setTimeout(r, 600));
    const users = getUsers();
    const key = email.toLowerCase().trim();
    const userRecord = users[key];
    if (!userRecord) return { success: false, error: "No account found with this email" };
    if (userRecord.password !== hashPassword(password)) {
      return { success: false, error: "Incorrect password" };
    }
    const userData: User = { email: key, name: userRecord.name };
    setUser(userData);
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    return { success: true };
  };

  const register = async (email: string, password: string, name: string) => {
    await new Promise(r => setTimeout(r, 600));
    const users = getUsers();
    const key = email.toLowerCase().trim();
    if (users[key]) return { success: false, error: "An account with this email already exists" };
    if (password.length < 6) return { success: false, error: "Password must be at least 6 characters" };
    users[key] = { password: hashPassword(password), name };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    const userData: User = { email: key, name };
    setUser(userData);
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

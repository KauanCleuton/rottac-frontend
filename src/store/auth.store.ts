import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type ThemeMode = 'light' | 'dark' | 'system';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role?: UserRole;
  experienceLevel: string;
  examName?: string;
  examDate?: string;
  targetRole?: string;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  themeMode: ThemeMode;
  _hasHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
  setThemeMode: (mode: ThemeMode) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      themeMode: 'system',
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'aprova-ai-auth',
      version: 1,
      // v0 guardava isDark: boolean — converte para themeMode
      migrate: (persisted: any, version) => {
        if (version === 0 && persisted && typeof persisted.isDark === 'boolean') {
          const { isDark, ...rest } = persisted;
          return { ...rest, themeMode: isDark ? 'dark' : 'light' };
        }
        return persisted;
      },
      partialize: ({ token, user, themeMode }) => ({ token, user, themeMode }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

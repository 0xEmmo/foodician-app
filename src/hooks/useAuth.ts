"use client";
// Thin bridge so Lumistro components that call useAuth() get
// the equivalent of Foodician's Zustand sessionUser.
import { useAppStore } from "@/src/store/useAppStore";

export function useAuth() {
  const sessionUser = useAppStore((s) => s.sessionUser);

  return {
    user: sessionUser
      ? {
          id:    sessionUser.id,
          email: sessionUser.email,
          user_metadata: { full_name: sessionUser.name },
        }
      : null,
    loading: false,
  };
}

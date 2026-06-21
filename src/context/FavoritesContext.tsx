"use client";

import {
  createContext, useCallback, useContext,
  useEffect, useState, type ReactNode,
} from "react";
import { supabase } from "@/src/lib/supabase";
import { useAppStore } from "@/src/store/useAppStore";

interface FavoritesContextValue {
  favorites:    Set<string>;
  toggle:       (itemId: string) => Promise<void>;
  isFavorite:   (itemId: string) => boolean;
  loading:      boolean;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favorites:  new Set(),
  toggle:     async () => {},
  isFavorite: () => false,
  loading:    true,
});

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const sessionUser = useAppStore((s) => s.sessionUser);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!sessionUser) {
      setFavorites(new Set());
      setLoading(false);
      return;
    }
    supabase
      .from("favorites")
      .select("item_id")
      .eq("user_id", sessionUser.id)
      .then(({ data }) => {
        setFavorites(new Set((data ?? []).map((r: { item_id: string }) => r.item_id)));
        setLoading(false);
      });
  }, [sessionUser]);

  const toggle = useCallback(async (itemId: string) => {
    if (!sessionUser) return;
    const already = favorites.has(itemId);

    setFavorites((prev) => {
      const next = new Set(prev);
      already ? next.delete(itemId) : next.add(itemId);
      return next;
    });

    if (already) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", sessionUser.id)
        .eq("item_id", itemId);
    } else {
      await supabase
        .from("favorites")
        .insert({ user_id: sessionUser.id, item_id: itemId });
    }
  }, [sessionUser, favorites]);

  const isFavorite = useCallback((itemId: string) => favorites.has(itemId), [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, toggle, isFavorite, loading }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}

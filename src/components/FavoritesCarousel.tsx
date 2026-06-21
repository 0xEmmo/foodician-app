"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/src/context/FavoritesContext";
import { MENU, type MenuItem } from "@/src/store/useAppStore";
import { useAppStore } from "@/src/store/useAppStore";
import MenuCard from "@/src/components/MenuCard";

interface FavoritesCarouselProps {
  autoFavorites?: MenuItem[];
}

export default function FavoritesCarousel({ autoFavorites = [] }: FavoritesCarouselProps) {
  const { isFavorite } = useFavorites();
  const sessionUser = useAppStore((s) => s.sessionUser);

  // Manual favorites pinned by the heart button
  const manualFavItems = MENU.filter((item) => isFavorite(String(item.id)));

  // Merge: manual first, then auto (most-ordered), deduped
  const combined = [
    ...manualFavItems,
    ...autoFavorites.filter((a) => !manualFavItems.some((m) => m.id === a.id)),
  ];

  if (!sessionUser || combined.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-4 mb-3">
        <Heart size={14} className="text-[#E8192C]" fill="#E8192C" />
        <h2 className="text-sm font-semibold text-[#F5F5F5]">Your Favourites</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
        {combined.map((item) => (
          <div key={item.id} className="flex-shrink-0 w-[200px]">
            <MenuCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

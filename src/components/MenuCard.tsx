'use client';

import Image from 'next/image';
import { MenuItem } from '@/src/store/useAppStore';
import { useAppStore } from '@/src/store/useAppStore';

interface MenuCardProps {
  item: MenuItem;
}

export default function MenuCard({ item }: MenuCardProps) {
  const cart = useAppStore((s) => s.cart);
  const changeQty = useAppStore((s) => s.changeQty);

  const qty = cart[item.id] || 0;
  const inCart = qty > 0;

  return (
    <div
      className={`bg-[#0F0F0F] border rounded-[14px] overflow-hidden transition-all duration-300 relative ${
        inCart ? 'border-[#E8192C] shadow-[0_0_15px_rgba(232,25,44,0.15)]' : 'border-[#262626]'
      }`}
    >
      {/* Top section */}
      <div className="flex items-stretch gap-4">
        {/* Image */}
        <div className="w-[105px] min-h-[105px] flex-shrink-0 relative bg-[#161616] overflow-hidden">
<Image
  src={item.image_url ? decodeURIComponent(item.image_url) : "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80"}
  alt={item.name || "Menu item"}
  fill
  className="object-cover"
/>
        </div>
        {/* Info */}
        <div className="pr-4 py-4 flex-1 flex flex-col justify-center">
          <div
            className="font-bebas text-[1.25rem] tracking-[0.7px] leading-[1.1] mb-1 text-white"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {item.name}
          </div>
          <div className="text-[0.775rem] text-[#A0A0A0] font-normal leading-[1.4] line-clamp-2">
            {item.desc}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[#262626] bg-black/30">
        {/* Price */}
        <div
          className="text-[#F5C300] text-[1.3rem] tracking-[0.5px]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          ₦{item.price.toLocaleString()}
        </div>

        {/* Time badge */}
        <div className="text-[0.725rem] text-[#A0A0A0] font-semibold bg-[#161616] px-2 py-0.5 rounded border border-white/[0.03]">
          ⏱ {item.mins} mins
        </div>

        {/* Qty controls */}
        <div className="flex items-center gap-2">
          {qty > 0 && (
            <>
              <button
                onClick={() => changeQty(item.id, -1)}
                className="w-8 h-8 rounded-lg bg-[#161616] border border-[#262626] text-white text-[1.1rem] font-semibold flex items-center justify-center transition-all duration-200 hover:bg-[#FF2E43] hover:border-[#FF2E43] hover:scale-105"
              >
                −
              </button>
              <span
                className="text-[1.2rem] min-w-[20px] text-center text-white"
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                {qty}
              </span>
            </>
          )}
          <button
            onClick={() => changeQty(item.id, 1)}
            className="w-8 h-8 rounded-lg bg-[#E8192C] border border-[#E8192C] text-white text-[1.1rem] font-semibold flex items-center justify-center transition-all duration-200 hover:bg-[#FF2E43] hover:border-[#FF2E43] hover:scale-105 shadow-[0_2px_8px_rgba(232,25,44,0.2)]"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/src/lib/supabase";

interface ShopHour {
  day_of_week: number;
  open_time:   string;
  close_time:  string;
  is_closed:   boolean;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatAMPM(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function computeHoursStatus(row: ShopHour | null): { open: boolean | null; label: string | null } {
  if (!row) return { open: null, label: null };
  if (row.is_closed) return { open: false, label: "Closed today" };

  const now      = new Date();
  const nowMins  = now.getHours() * 60 + now.getMinutes();
  const openMin  = timeToMinutes(row.open_time);
  const closeMin = timeToMinutes(row.close_time);

  if (nowMins < openMin)   return { open: false, label: `Opens at ${formatAMPM(row.open_time)}` };
  if (nowMins >= closeMin) return { open: false, label: `Closed · Opens tomorrow at ${formatAMPM(row.open_time)}` };
  return { open: true, label: `Open until ${formatAMPM(row.close_time)}` };
}

interface ShopContextValue {
  isOpen:     boolean;
  loading:    boolean;
  hoursOpen:  boolean | null;
  hoursLabel: string | null;
}

const ShopContext = createContext<ShopContextValue>({
  isOpen: true, loading: true, hoursOpen: null, hoursLabel: null,
});

export function ShopProvider({ children }: { children: ReactNode }) {
  const [isOpen,     setIsOpen]     = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [hoursOpen,  setHoursOpen]  = useState<boolean | null>(null);
  const [hoursLabel, setHoursLabel] = useState<string | null>(null);

  const hoursRowRef = useRef<ShopHour | null>(null);

  useEffect(() => {
    // Foodician stores manual open/close in restaurant_status table (id=1, is_open)
    supabase
      .from("restaurant_status")
      .select("is_open")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) setIsOpen((data as { is_open: boolean }).is_open);
        setLoading(false);
      });

    // Optional scheduled hours from the new shop_hours table
    const today = new Date().getDay();
    supabase
      .from("shop_hours")
      .select("*")
      .eq("day_of_week", today)
      .single()
      .then(({ data }) => {
        hoursRowRef.current = (data as ShopHour) ?? null;
        const s = computeHoursStatus((data as ShopHour) ?? null);
        setHoursOpen(s.open);
        setHoursLabel(s.label);
      });

    const channel = supabase
      .channel("shop-status-foodician")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "restaurant_status" },
        (payload) => {
          setIsOpen((payload.new as { is_open: boolean }).is_open);
        }
      )
      .subscribe();

    const tick = setInterval(() => {
      const s = computeHoursStatus(hoursRowRef.current);
      setHoursOpen(s.open);
      setHoursLabel(s.label);
    }, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, []);

  return (
    <ShopContext.Provider value={{ isOpen, loading, hoursOpen, hoursLabel }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  return useContext(ShopContext);
}

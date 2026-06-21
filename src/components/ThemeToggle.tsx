"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/src/context/ThemeContext";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`w-9 h-9 flex items-center justify-center rounded-full bg-[#161616] border border-[#262626] text-[#A0A0A0] hover:text-[#F5F5F5] hover:border-[#E8192C]/40 transition-colors ${className}`}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

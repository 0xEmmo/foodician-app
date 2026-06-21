'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, BarChart2, Package, Tag, MessageSquare,
  Users, Star, Settings, ChefHat, Bike, Home, Menu, X, ArrowLeft,
} from 'lucide-react';

type Tab = 'orders' | 'analytics' | 'products' | 'marketing' | 'messages' | 'customers' | 'reviews' | 'settings';

interface Props {
  activeTab: Tab;
  setActiveTab: (t: Tab) => void;
  unreadMessages: number;
  isOpen: boolean;
  onToggleRestaurant: () => void;
  onNavigate: (path: string) => void;
}

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'orders',    label: 'Orders',    icon: <ShoppingBag  size={18} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2    size={18} /> },
  { id: 'products',  label: 'Products',  icon: <Package      size={18} /> },
  { id: 'marketing', label: 'Marketing', icon: <Tag          size={18} /> },
  { id: 'messages',  label: 'Messages',  icon: <MessageSquare size={18} /> },
  { id: 'customers', label: 'Customers', icon: <Users        size={18} /> },
  { id: 'reviews',   label: 'Reviews',   icon: <Star         size={18} /> },
  { id: 'settings',  label: 'Settings',  icon: <Settings     size={18} /> },
];

const COLLAPSED_W = 52;
const EXPANDED_W  = 220;

export default function AdminSidebar({ activeTab, setActiveTab, unreadMessages, isOpen, onToggleRestaurant, onNavigate }: Props) {
  const [hovered,       setHovered]       = useState(false);
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [isMobile,      setIsMobile]      = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const expanded = isMobile ? mobileOpen : hovered;
  const sidebarW = expanded ? EXPANDED_W : COLLAPSED_W;

  function handleNav(id: Tab) {
    if (id === 'messages') { onNavigate('/admin/messages'); }
    else { setActiveTab(id); }
    if (isMobile) setMobileOpen(false);
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Brand */}
      <div style={{ height: 54, display: 'flex', alignItems: 'center', borderBottom: '1px solid #1a1a1a', paddingLeft: 14, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#E8192C', fontSize: '1.15rem', letterSpacing: 2, lineHeight: 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {expanded ? <>FOODICIAN<br /><span style={{ color: '#F5C300', fontSize: '0.6rem', letterSpacing: 3 }}>ADMIN</span></> : 'F'}
        </div>
      </div>

      {/* Status toggle */}
      <div style={{ padding: '0.75rem 0.5rem', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <button
          onClick={onToggleRestaurant}
          title={isOpen ? 'Shop is Open' : 'Shop is Closed'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: expanded ? '0.4rem 0.5rem' : '0.4rem', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: isOpen ? 'rgba(34,197,94,0.1)' : 'rgba(232,25,44,0.1)',
            color: isOpen ? '#22C55E' : '#E8192C',
            justifyContent: expanded ? 'flex-start' : 'center',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: isOpen ? '#22C55E' : '#E8192C', flexShrink: 0, display: 'inline-block' }} />
          {expanded && <span style={{ fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{isOpen ? 'Shop Open' : 'Shop Closed'}</span>}
        </button>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.5rem 0.4rem' }}>
        {NAV_ITEMS.map(({ id, label, icon }) => {
          const active = activeTab === id && id !== 'messages';
          return (
            <button
              key={id}
              onClick={() => handleNav(id)}
              title={label}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0.6rem', marginBottom: 2,
                borderRadius: 8, border: 'none', cursor: 'pointer', position: 'relative',
                background: active ? 'rgba(232,25,44,0.12)' : 'transparent',
                color: active ? '#E8192C' : '#A0A0A0',
                textAlign: 'left',
                justifyContent: expanded ? 'flex-start' : 'center',
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#161616'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <span style={{ flexShrink: 0, color: active ? '#E8192C' : 'inherit' }}>{icon}</span>
              {expanded && <span style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>}
              {id === 'messages' && unreadMessages > 0 && (
                <span style={{
                  position: expanded ? 'relative' : 'absolute', top: expanded ? undefined : 4, right: expanded ? undefined : 4,
                  background: '#E8192C', color: '#fff', borderRadius: 20, fontSize: '0.58rem', fontWeight: 800,
                  minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                  marginLeft: expanded ? 'auto' : 0, flexShrink: 0,
                }}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div style={{ height: 1, background: '#1a1a1a', margin: '0.5rem 0' }} />

        {/* External links: Kitchen, Rider, App */}
        {[
          { label: 'Kitchen', icon: <ChefHat size={18} />, path: '/kitchen', color: '#F5C300' },
          { label: 'Rider',   icon: <Bike    size={18} />, path: '/rider',   color: '#60a5fa' },
          { label: 'App',     icon: <Home    size={18} />, path: '/',        color: '#A0A0A0' },
        ].map(({ label, icon, path, color }) => (
          <button
            key={path}
            onClick={() => { onNavigate(path); if (isMobile) setMobileOpen(false); }}
            title={label}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '0.6rem 0.6rem', marginBottom: 2,
              borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color,
              textAlign: 'left', justifyContent: expanded ? 'flex-start' : 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#161616'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <span style={{ flexShrink: 0 }}>{icon}</span>
            {expanded && <span style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>}
          </button>
        ))}
      </div>

      {/* Close button on mobile */}
      {isMobile && (
        <div style={{ padding: '0.75rem', borderTop: '1px solid #1a1a1a', flexShrink: 0 }}>
          <button
            onClick={() => setMobileOpen(false)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0.6rem', borderRadius: 8, border: '1px solid #262626', background: 'transparent', color: '#555', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            <X size={16} /> Close menu
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — hover to expand */}
      {!isMobile && (
        <motion.div
          style={{ position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100, background: '#000', borderRight: '1px solid #1a1a1a', overflow: 'hidden', flexShrink: 0 }}
          animate={{ width: sidebarW }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <SidebarContent />
        </motion.div>
      )}

      {/* Mobile hamburger button */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(true)}
          style={{ position: 'fixed', top: 12, left: 12, zIndex: 200, background: '#161616', border: '1px solid #262626', color: '#F5F5F5', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <Menu size={18} />
        </button>
      )}

      {/* Mobile sidebar + backdrop */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 150, backdropFilter: 'blur(4px)' }}
            />
            <motion.div
              initial={{ x: -EXPANDED_W }} animate={{ x: 0 }} exit={{ x: -EXPANDED_W }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              style={{ position: 'fixed', top: 0, left: 0, width: EXPANDED_W, height: '100vh', zIndex: 200, background: '#000', borderRight: '1px solid #1a1a1a', overflow: 'hidden' }}
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* Exported constant so the admin page knows how wide the collapsed sidebar is */
export { COLLAPSED_W };

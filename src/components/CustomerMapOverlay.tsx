'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { X } from 'lucide-react';

type Props = {
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number, address: string) => void;
  onClose:   () => void;
};

export default function CustomerMapOverlay({ initialLat = 6.5205, initialLng = 3.3958, onConfirm, onClose }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<LeafletMap | null>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [address,     setAddress]     = useState('Scroll map to your door…');
  const [geocoding,   setGeocoding]   = useState(false);
  const [confirming,  setConfirming]  = useState(false);

  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17`,
        { headers: { 'User-Agent': 'Foodician/1.0' } },
      );
      const data = await res.json() as { display_name?: string };
      setAddress(data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setGeocoding(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let destroyed = false;

    import('leaflet').then((L) => {
      if (destroyed || !containerRef.current) return;

      const map = L.map(containerRef.current!, { zoomControl: false }).setView([initialLat, initialLng], 16);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      map.on('movestart', () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setAddress('Scroll map to your door…');
      });

      map.on('moveend', () => {
        const { lat, lng } = map.getCenter();
        debounceRef.current = setTimeout(() => reverseGeocode(lat, lng), 700);
      });

      mapRef.current = map;
      reverseGeocode(initialLat, initialLng);
    });

    return () => {
      destroyed = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirm = () => {
    if (!mapRef.current || geocoding) return;
    setConfirming(true);
    const { lat, lng } = mapRef.current.getCenter();
    onConfirm(lat, lng, address);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', background: '#050505' }}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 10,
        background: 'rgba(5,5,5,0.96)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1a1a1a',
        padding: '0.875rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.875rem', flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ background: '#161616', border: '1px solid #262626', color: '#A0A0A0', cursor: 'pointer', padding: '0.4rem', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <X size={18} />
        </button>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#F5F5F5', fontFamily: "'DM Sans', sans-serif" }}>Pin Your Location</div>
          <div style={{ fontSize: '0.72rem', color: '#666', fontFamily: "'DM Sans', sans-serif" }}>Scroll so the pin sits on your door</div>
        </div>
      </div>

      {/* Map */}
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Fixed crosshair pin — stays centered while map scrolls */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -100%)',
          zIndex: 1000, pointerEvents: 'none',
          filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))',
        }}>
          <svg width="36" height="44" viewBox="0 0 36 44" fill="none">
            <path d="M18 0C8.06 0 0 8.06 0 18c0 11 18 26 18 26s18-15 18-26C36 8.06 27.94 0 18 0z" fill="#E8192C"/>
            <circle cx="18" cy="18" r="8" fill="white"/>
            <circle cx="18" cy="18" r="4.5" fill="#E8192C"/>
          </svg>
        </div>
        {/* Pin shadow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, 0)',
          zIndex: 999, pointerEvents: 'none',
          width: 14, height: 5, borderRadius: '50%',
          background: 'rgba(0,0,0,0.25)', marginTop: 2,
        }} />
      </div>

      {/* Bottom sheet — address + confirm */}
      <div style={{ background: '#0A0A0A', borderTop: '1px solid #1a1a1a', padding: '1rem 1.25rem 1.5rem', flexShrink: 0 }}>
        <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
          Delivering to
        </div>
        <div style={{
          fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '1rem', minHeight: 44,
          color: geocoding ? '#555' : '#F5F5F5',
          fontStyle: geocoding ? 'italic' : 'normal',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {geocoding ? 'Getting address…' : address}
        </div>
        <button
          onClick={handleConfirm}
          disabled={confirming || geocoding}
          style={{
            width: '100%', background: '#E8192C', color: '#fff',
            border: 'none', padding: '0.9rem', borderRadius: 12,
            fontWeight: 700, fontSize: '1rem', cursor: confirming || geocoding ? 'not-allowed' : 'pointer',
            opacity: confirming || geocoding ? 0.6 : 1,
            fontFamily: "'DM Sans', sans-serif",
            transition: 'opacity 0.2s',
          }}
        >
          {confirming ? 'Confirming…' : 'Confirm Location'}
        </button>
      </div>
    </div>
  );
}

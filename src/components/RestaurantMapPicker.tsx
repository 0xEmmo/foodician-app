'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import { supabase } from '@/src/lib/supabase';

type Props = {
  initialLat:  number;
  initialLng:  number;
  configRowId: string;
};

export default function RestaurantMapPicker({ initialLat, initialLng, configRowId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);
  const markerRef    = useRef<Marker | null>(null);

  const [lat,    setLat]    = useState(initialLat);
  const [lng,    setLng]    = useState(initialLng);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let destroyed = false;

    import('leaflet').then((L) => {
      if (destroyed || !containerRef.current) return;

      // Fix webpack broken default icon paths
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!).setView([initialLat, initialLng], 16);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

      const updateCoords = (newLat: number, newLng: number) => {
        setLat(Math.round(newLat * 1e6) / 1e6);
        setLng(Math.round(newLng * 1e6) / 1e6);
        setSaved(false);
      };

      marker.on('dragend', () => {
        const p = marker.getLatLng();
        updateCoords(p.lat, p.lng);
      });

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        updateCoords(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current    = map;
      markerRef.current = marker;
    });

    return () => {
      destroyed = true;
      mapRef.current?.remove();
      mapRef.current    = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await supabase.from('restaurant_config')
      .update({ latitude: lat, longitude: lng, updated_at: new Date().toISOString() })
      .eq('id', configRowId);
    setSaving(false);
    setSaved(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Leaflet CSS loaded inline to avoid SSR issues */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      <div
        ref={containerRef}
        style={{ width: '100%', height: 320, borderRadius: 10, border: '1px solid #1a1a1a', overflow: 'hidden', background: '#0C0C0C' }}
      />

      <div style={{
        display: 'flex', gap: '1.5rem', alignItems: 'center',
        fontSize: '0.82rem', color: '#A0A0A0',
        background: '#0C0C0C', border: '1px solid #1a1a1a', borderRadius: 8, padding: '0.6rem 1rem',
      }}>
        <span>Lat: <strong style={{ color: '#F5F5F5', fontFamily: 'monospace' }}>{lat}</strong></span>
        <span>Lng: <strong style={{ color: '#F5F5F5', fontFamily: 'monospace' }}>{lng}</strong></span>
        <span style={{ marginLeft: 'auto', color: '#555', fontSize: '0.76rem' }}>Drag pin or click map to reposition</span>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          alignSelf: 'flex-start',
          background: saved ? 'rgba(34,197,94,0.12)' : saving ? '#262626' : '#E8192C',
          color: saved ? '#22C55E' : '#fff',
          border: saved ? '1px solid rgba(34,197,94,0.35)' : 'none',
          padding: '0.65rem 1.75rem',
          borderRadius: 8,
          cursor: saving ? 'not-allowed' : 'pointer',
          fontWeight: 700,
          fontSize: '0.9rem',
          opacity: saving ? 0.6 : 1,
          transition: 'all 0.25s',
        }}
      >
        {saved ? 'Restaurant location updated ✓' : saving ? 'Saving…' : 'Save Location'}
      </button>
    </div>
  );
}

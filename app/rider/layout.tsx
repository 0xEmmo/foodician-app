export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, overflowY: 'auto', background: '#050505', color: '#F5F5F5' }}>
      {children}
    </div>
  );
}

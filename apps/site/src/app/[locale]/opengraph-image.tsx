import { ImageResponse } from 'next/og';

export const alt = 'Nodexa RMM unified device operations platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#061525',
        color: '#ffffff',
        fontFamily: 'sans-serif',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 540,
          height: 540,
          right: -150,
          top: -190,
          borderRadius: '50%',
          border: '2px solid rgba(68, 139, 255, 0.26)',
          boxShadow: '0 0 120px rgba(40, 108, 255, 0.24)',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', width: 980 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 48, fontWeight: 750 }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 14,
              background: '#286cff',
              boxShadow: '0 16px 44px rgba(40, 108, 255, 0.42)',
            }}
          >
            N
          </div>
          Nodexa RMM
        </div>
        <div
          style={{ marginTop: 58, fontSize: 66, lineHeight: 1.08, fontWeight: 760, maxWidth: 900 }}
        >
          Every device. Clear and under control.
        </div>
        <div style={{ marginTop: 28, color: '#9fb4c8', fontSize: 25 }}>
          Monitoring, secure access, automation, and governance in one workspace.
        </div>
      </div>
    </div>,
    size,
  );
}

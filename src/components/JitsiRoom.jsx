import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';

export function slugifyRoom(title) {
  return 'nursefaculty-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Full-screen Jitsi Meet modal — shared by VirtualClassroom and InstructorTools
export function JitsiRoom({ session, onClose }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [audioOnly, setAudioOnly] = useState(false);

  const configuredUrl = session.meeting_url || '';
  const configuredJitsiRoom = configuredUrl.match(/^https:\/\/meet\.jit\.si\/([^?#]+)/i)?.[1];
  const roomName = session.jitsi_room ?? configuredJitsiRoom ?? slugifyRoom(session.title);
  const jitsiUrl = configuredUrl || `https://meet.jit.si/${roomName}`;

  useEffect(() => {
    function mount() {
      if (!window.JitsiMeetExternalAPI || !containerRef.current) {
        setStatus('error');
        return;
      }
      try {
        apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: audioOnly,
            disableSimulcast: false,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_BRAND_WATERMARK: false,
            DEFAULT_BACKGROUND: '#17313a',
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop',
              'chat', 'raisehand', 'videoquality', 'fullscreen', 'hangup',
            ],
          },
        });
        apiRef.current.addEventListener('videoConferenceJoined', () => setStatus('ready'));
        apiRef.current.addEventListener('readyToClose', onClose);
        apiRef.current.addEventListener('errorOccurred', () => setStatus('error'));
        // Fallback: mark ready after 8s if event doesn't fire
        setTimeout(() => setStatus((s) => s === 'loading' ? 'ready' : s), 8000);
      } catch {
        setStatus('error');
      }
    }

    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = mount;
      script.onerror = () => setStatus('error');
      document.head.appendChild(script);
    } else {
      mount();
    }

    return () => { apiRef.current?.dispose(); };
  }, [roomName, audioOnly]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,28,32,0.97)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: '#17313a', color: '#fff', flexShrink: 0, flexWrap: 'wrap' }}>
        <Video size={17} color="#29b7a3" />
        <span style={{ fontWeight: 700, fontSize: '0.96rem', flex: 1 }}>{session.title}</span>

        {/* Audio-only toggle */}
        <button
          onClick={() => { apiRef.current?.dispose(); apiRef.current = null; setStatus('loading'); setAudioOnly((v) => !v); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.2)', background: audioOnly ? '#29b7a3' : 'transparent', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
          title="Toggle audio-only mode"
        >
          {audioOnly ? <MicOff size={14} /> : <Mic size={14} />}
          {audioOnly ? 'Audio Only' : 'Video + Audio'}
        </button>

        {/* Fallback: open in new tab */}
        <a href={jitsiUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.2)', color: '#fff', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          <ExternalLink size={13} /> Open in Tab
        </a>

        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.75, display: 'flex' }}>
          <X size={20} />
        </button>
      </div>

      {/* Loading overlay */}
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, top: 45, display: 'grid', placeItems: 'center', background: '#17313a', zIndex: 1 }}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ width: 44, height: 44, border: '4px solid rgba(255,255,255,0.15)', borderTopColor: '#29b7a3', borderRadius: '50%', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ margin: 0, opacity: 0.75, fontSize: '0.92rem' }}>Setting up your meeting room…</p>
            <p style={{ margin: '6px 0 0', opacity: 0.45, fontSize: '0.78rem' }}>Room: {roomName}</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, top: 45, display: 'grid', placeItems: 'center', background: '#17313a', zIndex: 1 }}>
          <div style={{ textAlign: 'center', color: '#fff', padding: 24, maxWidth: 360 }}>
            <VideoOff size={40} color="#e85d4f" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px' }}>Could not load the video room</h3>
            <p style={{ margin: '0 0 20px', opacity: 0.65, fontSize: '0.88rem', lineHeight: 1.5 }}>
              Your browser may be blocking the video room. Try opening it in a new tab instead.
            </p>
            <a href={jitsiUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', background: '#29b7a3', color: '#fff', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '0.92rem' }}>
              <ExternalLink size={15} /> Open in New Tab
            </a>
          </div>
        </div>
      )}

      {/* Jitsi container */}
      <div ref={containerRef} style={{ flex: 1, width: '100%' }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

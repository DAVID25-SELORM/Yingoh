import React, { useEffect, useRef } from 'react';
import { Video, X } from 'lucide-react';

export function slugifyRoom(title) {
  return 'yingoh-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Full-screen Jitsi Meet modal — shared by VirtualClassroom and InstructorTools
export function JitsiRoom({ session, onClose }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const roomName = session.jitsi_room ?? slugifyRoom(session.title);

  useEffect(() => {
    function mount() {
      if (!window.JitsiMeetExternalAPI || !containerRef.current) return;
      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName,
        parentNode: containerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: { startWithAudioMuted: false, startWithVideoMuted: false },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          TOOLBAR_BUTTONS: ['microphone', 'camera', 'closedcaptions', 'desktop', 'chat', 'raisehand', 'videoquality', 'fullscreen', 'hangup'],
        },
      });
      apiRef.current.addEventListener('readyToClose', onClose);
    }

    if (!window.JitsiMeetExternalAPI) {
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = mount;
      document.head.appendChild(script);
    } else {
      mount();
    }

    return () => { apiRef.current?.dispose(); };
  }, [roomName]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,28,32,0.95)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', background: '#17313a', color: '#fff', flexShrink: 0 }}>
        <Video size={18} color="#29b7a3" />
        <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1 }}>{session.title}</span>
        <span style={{ fontSize: '0.78rem', opacity: 0.55, marginRight: 8 }}>Room: {roomName}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4, opacity: 0.8, display: 'flex' }}>
          <X size={20} />
        </button>
      </div>
      <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../services/supabase';

const DEMO_NOTIFICATIONS = [
  { id: 'n1', title: 'Welcome to NurseFaculty!', message: 'Your account is ready. Start with the Study Planner to set your exam date.', type: 'success', is_read: false, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: 'n2', title: 'New session scheduled', message: 'NGN Case Study Review is coming up in 2 days. Click to add to your calendar.', type: 'info', is_read: false, created_at: new Date(Date.now() - 3600000 * 5).toISOString() },
  { id: 'n3', title: 'Study streak — keep it up! 🔥', message: 'You\'ve studied 5 days in a row. Stay consistent to earn your streak certificate.', type: 'success', is_read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
];

const TYPE_ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  alert: AlertTriangle,
};
const TYPE_COLORS = { info: '#2b8a7d', success: '#29b7a3', warning: '#e3a72f', alert: '#e94868' };

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso);
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  return `${mins}m ago`;
}

export default function NotificationsBell({ session }) {
  const [notifs, setNotifs] = useState(supabase ? [] : DEMO_NOTIFICATIONS);
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) return;
    supabase.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20).then(({ data }) => {
      setNotifs(data ?? []);
    });

    // Real-time updates
    const channel = supabase.channel('notifs').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, ({ new: n }) => {
      setNotifs((prev) => [n, ...prev]);
    }).subscribe();

    return () => supabase.removeChannel(channel);
  }, [session]);

  const unread = notifs.filter((n) => !n.is_read).length;

  async function markRead(id) {
    if (supabase && session?.user?.id) await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    if (supabase && session?.user?.id) await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false);
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function dismiss(id) {
    if (supabase && session?.user?.id) await supabase.from('notifications').delete().eq('id', id);
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="ghost-btn"
        style={{ position: 'relative', padding: '7px 10px' }}
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#e94868', color: '#fff', fontSize: '0.62rem', fontWeight: 900, display: 'grid', placeItems: 'center', lineHeight: 1 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', width: 340, background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid #e1ebe9', zIndex: 500, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5eeec', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '0.95rem' }}>Notifications</strong>
            {unread > 0 && (
              <button className="ghost-btn" style={{ fontSize: '0.76rem', padding: '4px 10px' }} onClick={markAllRead}>
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {notifs.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#8a999c', fontSize: '0.88rem' }}>
                <Bell size={28} color="#dbe6e4" style={{ margin: '0 auto 8px' }} />
                <p style={{ margin: 0 }}>No notifications</p>
              </div>
            )}
            {notifs.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Info;
              const color = TYPE_COLORS[n.type] ?? '#607478';
              return (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: '1px solid #f0f5f4', background: n.is_read ? '#fff' : '#f4faf9', cursor: 'pointer', transition: 'background 0.15s' }}
                >
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: color + '22', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Icon size={14} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: n.is_read ? 400 : 700, fontSize: '0.86rem', marginBottom: 2 }}>{n.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#607478', lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ fontSize: '0.74rem', color: '#8a999c', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
                  </div>
                  <button className="icon-btn" style={{ alignSelf: 'flex-start', flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}>
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

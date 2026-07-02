import React, { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Edit3, PlusCircle, Save, Search, Trash2, X } from 'lucide-react';
import { deleteNote, getAllNotes, saveItem, saveNote, supabase } from '../services/supabase';

const DEMO_NOTES = [
  {
    id: 'demo1', title: 'Digoxin toxicity signs', topic: 'Pharmacology',
    content: 'Hold if apical HR < 60\nWatch for: yellow-green halos, nausea, bradycardia\nMonitor K+ — hypokalemia increases toxicity\nAntidote: Digibind\nTherapeutic level: 0.5–2.0 ng/mL',
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 'demo2', title: 'C. diff contact precautions', topic: 'Safety and Infection Control',
    content: 'Gown + gloves required when entering room\nAlcohol-based hand rub does NOT kill C. diff spores!\nMust use soap and water for hand hygiene\nNo N95 required (not airborne)',
    updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'demo3', title: 'DKA vs HHS comparison', topic: 'Medical-Surgical',
    content: 'DKA: Type 1, BG >250, KETONES PRESENT, pH <7.35, Kussmaul respirations, fruity breath\nHHS: Type 2 elderly, BG >600, MINIMAL ketones, extreme dehydration\nBoth: IV fluids FIRST, then insulin, then K+ replacement\nMonitor K+ closely during treatment',
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'demo4', title: 'APGAR scoring reminder', topic: 'Maternal and Newborn',
    content: 'A - Appearance (color): 0=blue/pale, 1=acrocyanosis, 2=pink all over\nP - Pulse: 0=absent, 1=<100, 2=>100\nG - Grimace (reflex): 0=none, 1=grimace, 2=cough/sneeze\nA - Activity (muscle tone): 0=none, 1=some flexion, 2=active\nR - Respirations: 0=absent, 1=slow/irregular, 2=good cry\nScore 7-10=normal, 4-6=moderate depression, 0-3=severe',
    updated_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'demo5', title: 'Sepsis Hour-1 Bundle', topic: 'Medical-Surgical',
    content: '1. Blood cultures × 2 BEFORE antibiotics\n2. Broad-spectrum antibiotics immediately\n3. 30 mL/kg IV crystalloid if hypotensive\n4. Vasopressors (norepinephrine 1st line) if MAP <65\n5. Repeat lactate if initial >2\nSeptic shock = sepsis + vasopressors needed + lactate >2 mmol/L',
    updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

const TOPICS = ['All', 'Pharmacology', 'Safety and Infection Control', 'Medical-Surgical', 'NGN Case Studies', 'Maternal and Newborn', 'Mental Health', 'Pediatrics', 'Leadership and Management'];

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotebookView({ session }) {
  const [notes, setNotes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('All');
  const [editing, setEditing] = useState(null); // null | note object
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [savedNotes, setSavedNotes] = useState(new Set());
  const textareaRef = useRef(null);

  const userId = session?.user?.id;

  useEffect(() => {
    async function load() {
      if (userId) {
        const { data } = await getAllNotes(userId);
        setNotes(data ?? []);
      } else {
        setNotes(supabase ? [] : DEMO_NOTES);
      }
    }
    load();
  }, [userId]);

  useEffect(() => {
    let result = notes;
    if (topicFilter !== 'All') result = result.filter((n) => n.topic === topicFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((n) =>
        n.title?.toLowerCase().includes(q) ||
        n.content?.toLowerCase().includes(q) ||
        n.topic?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [notes, search, topicFilter]);

  function openNew() {
    setEditing({ id: null, title: '', content: '', topic: 'Pharmacology' });
    setEditTitle('');
    setEditContent('');
    setEditTopic('Pharmacology');
    setIsNew(true);
  }

  function openEdit(note) {
    setEditing(note);
    setEditTitle(note.title ?? '');
    setEditContent(note.content ?? '');
    setEditTopic(note.topic ?? '');
    setIsNew(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function closeEditor() {
    setEditing(null);
    setIsNew(false);
  }

  async function handleSave() {
    if (!editContent.trim()) return;
    setSaving(true);
    const noteData = {
      id: isNew ? null : editing.id,
      title: editTitle || editContent.split('\n')[0].slice(0, 60),
      content: editContent,
      topic: editTopic,
    };

    if (userId) {
      const { data } = await saveNote(userId, noteData);
      if (data) {
        setNotes((prev) =>
          isNew
            ? [data, ...prev]
            : prev.map((n) => (n.id === data.id ? data : n))
        );
      }
    } else {
      const updated = {
        ...editing,
        ...noteData,
        id: noteData.id ?? `demo-${Date.now()}`,
        updated_at: new Date().toISOString(),
      };
      setNotes((prev) =>
        isNew ? [updated, ...prev] : prev.map((n) => (n.id === updated.id ? updated : n))
      );
    }

    setSaving(false);
    closeEditor();
  }

  async function handleDelete(note) {
    if (!window.confirm('Delete this note?')) return;
    if (userId) await deleteNote(userId, note.id);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
  }

  async function saveNoteToItems(note) {
    if (!userId) return;
    const { error } = await saveItem(userId, {
      item_type: 'note',
      item_id: note.id,
      title: note.title || 'Study note',
      summary: note.content?.slice(0, 220),
      metadata: { topic: note.topic },
    });
    if (!error) setSavedNotes((prev) => new Set([...prev, note.id]));
  }

  const grouped = {};
  filtered.forEach((n) => {
    const t = n.topic ?? 'General';
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(n);
  });

  return (
    <section className="content-band">
      <div className="section-title">
        <h2>My Notebook</h2>
        <button className="primary-btn" onClick={openNew} style={{ minHeight: 36, padding: '0 14px', fontSize: '0.9rem' }}>
          <PlusCircle size={16} /> New Note
        </button>
      </div>

      {/* Editor overlay */}
      {editing && (
        <div className="notebook-editor">
          <div className="editor-header">
            <input
              className="editor-title-input"
              placeholder="Note title…"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <select value={editTopic} onChange={(e) => setEditTopic(e.target.value)} className="editor-topic-select">
              {TOPICS.filter((t) => t !== 'All').map((t) => <option key={t}>{t}</option>)}
            </select>
            <button className="icon-btn" onClick={closeEditor}><X size={18} /></button>
          </div>
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            placeholder="Write your notes here…"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={14}
          />
          <div className="editor-footer">
            <button className="ghost-btn" onClick={closeEditor}>Cancel</button>
            <button className="primary-btn" onClick={handleSave} disabled={saving || !editContent.trim()}>
              <Save size={16} /> {saving ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="notebook-filters">
        <div className="search-box">
          <Search size={15} />
          <input
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
          {TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
        <span style={{ color: '#607478', fontSize: '0.88rem', marginLeft: 'auto' }}>{filtered.length} notes</span>
      </div>

      {/* Notes grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#607478' }}>
          <Edit3 size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p>{search || topicFilter !== 'All' ? 'No notes match your search.' : 'No notes yet — create your first note!'}</p>
          <button className="primary-btn" onClick={openNew}><PlusCircle size={16} /> Create Note</button>
        </div>
      ) : (
        Object.entries(grouped).map(([topic, topicNotes]) => (
          <div key={topic} className="notebook-group">
            <h3 className="notebook-group-title">{topic}</h3>
            <div className="notebook-grid">
              {topicNotes.map((note) => (
                <div key={note.id} className="note-card">
                  <div className="note-card-header">
                    <strong className="note-title">{note.title || 'Untitled'}</strong>
                    <div className="note-actions">
                      <button className="icon-btn note-btn" onClick={() => openEdit(note)} title="Edit">
                        <Edit3 size={14} />
                      </button>
                      <button className="icon-btn note-btn" onClick={() => saveNoteToItems(note)} disabled={!userId} title={userId ? 'Save item' : 'Sign in to save'}>
                        {savedNotes.has(note.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </button>
                      <button className="icon-btn note-btn note-delete" onClick={() => handleDelete(note)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <pre className="note-preview">{note.content}</pre>
                  <div className="note-footer">
                    <span className="note-time">{timeAgo(note.updated_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

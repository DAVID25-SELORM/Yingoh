import React, { useEffect, useMemo, useState } from 'react';
import { BookmarkCheck, Brain, FileText, Film, Layers, Search, Trash2 } from 'lucide-react';
import { getSavedItems, unsaveItem } from '../services/supabase';

const TYPE_LABELS = {
  ai_answer: 'AI Answers',
  correction_plan: 'Correction Plans',
  question: 'Questions',
  flashcard: 'Flashcards',
  video: 'Videos',
  resource: 'Resources',
  note: 'Study Notes',
};

const TYPE_ICONS = {
  ai_answer: Brain,
  correction_plan: FileText,
  question: BookmarkCheck,
  flashcard: Layers,
  video: Film,
  resource: FileText,
  note: FileText,
};

export default function SavedItemsView({ session }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const userId = session?.user?.id;

  useEffect(() => {
    async function load() {
      if (!userId) return;
      const { data } = await getSavedItems(userId);
      setItems(data ?? []);
    }
    load();
  }, [userId]);

  const types = useMemo(() => ['all', ...Object.keys(TYPE_LABELS)], []);
  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    return (filter === 'all' || item.item_type === filter) &&
      (!q || item.title?.toLowerCase().includes(q) || item.summary?.toLowerCase().includes(q));
  });

  async function remove(item) {
    if (!userId) return;
    await unsaveItem(userId, item.item_type, item.item_id);
    setItems((prev) => prev.filter((x) => x.id !== item.id));
  }

  if (!userId) {
    return (
      <section className="content-band">
        <div className="saved-empty">
          <BookmarkCheck size={34} />
          <h3>Sign in to view saved items</h3>
          <p>Your saved AI answers, questions, flashcards, videos, resources, and notes will appear here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="content-band">
      <div className="section-title">
        <div>
          <h2>Saved Items</h2>
          <p style={{ margin: '4px 0 0', color: '#607478', fontSize: '0.88rem' }}>{items.length} saved learning items</p>
        </div>
      </div>

      <div className="saved-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search saved items..." />
        </div>
        <div className="tab-bar">
          {types.map((type) => (
            <button key={type} className={`tab-btn ${filter === type ? 'tab-active' : ''}`} onClick={() => setFilter(type)}>
              {type === 'all' ? 'All' : TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="saved-empty">
          <BookmarkCheck size={34} />
          <h3>No saved items yet</h3>
          <p>Use the save buttons across Yingoh to collect things you want to review later.</p>
        </div>
      ) : (
        <div className="saved-grid">
          {filtered.map((item) => {
            const Icon = TYPE_ICONS[item.item_type] ?? BookmarkCheck;
            return (
              <article key={item.id} className="saved-card">
                <div className="saved-card-head">
                  <span><Icon size={15} /> {TYPE_LABELS[item.item_type] ?? item.item_type}</span>
                  <button className="icon-btn" onClick={() => remove(item)} title="Remove saved item"><Trash2 size={14} /></button>
                </div>
                <h3>{item.title}</h3>
                {item.summary && <p>{item.summary}</p>}
                <small>{new Date(item.created_at).toLocaleDateString()}</small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

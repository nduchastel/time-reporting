// frontend/src/components/manager/EditTimeCardModal.jsx
import { useEffect, useRef, useState } from 'react';

export default function EditTimeCardModal({ card, onClose, onSave }) {
  const [hours, setHours] = useState(card.hours ?? '');
  const [date,  setDate ] = useState(card.date ?? '');
  const [start, setStart] = useState(card.start_time ?? '');
  const [end,   setEnd  ] = useState(card.end_time ?? '');
  const [notes, setNotes] = useState(card.notes ?? '');
  const firstFieldRef = useRef(null);

  // Esc closes; first input gets focus on mount.
  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = (e) => {
    e.preventDefault();
    onSave({
      hours: hours === '' ? null : Number(hours),
      date, start_time: start || null, end_time: end || null, notes,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-time-card-title"
    >
      <form onSubmit={save} className="bg-white rounded-lg p-5 w-full max-w-md" onClick={(e)=>e.stopPropagation()}>
        <h3 id="edit-time-card-title" className="text-lg font-bold mb-3">Edit time card</h3>
        <label className="block text-sm">Hours<input ref={firstFieldRef} type="number" step="0.25" value={hours} onChange={(e)=>setHours(e.target.value)} className="w-full border rounded px-2 py-1 mb-2" /></label>
        <label className="block text-sm">Date<input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="w-full border rounded px-2 py-1 mb-2" /></label>
        <label className="block text-sm">Start<input type="time" value={start} onChange={(e)=>setStart(e.target.value)} className="w-full border rounded px-2 py-1 mb-2" /></label>
        <label className="block text-sm">End<input type="time" value={end} onChange={(e)=>setEnd(e.target.value)} className="w-full border rounded px-2 py-1 mb-2" /></label>
        <label className="block text-sm">Notes<textarea value={notes} onChange={(e)=>setNotes(e.target.value)} className="w-full border rounded px-2 py-1 mb-3" /></label>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 bg-gray-200 py-2 rounded">Cancel</button>
          <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded font-semibold">Save</button>
        </div>
      </form>
    </div>
  );
}

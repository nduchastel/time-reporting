// frontend/src/components/manager/TimeCardCard.jsx
import { useState } from 'react';

export default function TimeCardCard({ card, onApprove, onEdit, onFlag }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold px-2 py-0.5 bg-gray-200 rounded">{card.action_type}</span>
        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">{card.status}</span>
        <span className="text-sm text-gray-700 font-medium ml-1">{card.workers?.name}</span>
        <span className="text-xs text-gray-500 ml-auto">{new Date(card.created_at).toLocaleString()}</span>
      </div>
      <p className="text-sm mb-1">
        {card.date}{card.hours != null && <> · {card.hours}h</>}{card.worksites?.name && <> · {card.worksites.name}</>}
      </p>
      <button className="text-xs text-blue-600 underline" onClick={() => setExpanded(v=>!v)}>
        {expanded ? 'Hide' : 'Show'} transcription
      </button>
      {expanded && <p className="text-sm bg-gray-50 mt-2 p-2 rounded">{card.transcription}</p>}
      {card.audio_url && <audio controls src={card.audio_url} className="w-full mt-2" />}
      <div className="flex gap-2 mt-3">
        <button onClick={() => onApprove(card)} className="flex-1 bg-green-600 text-white py-2 rounded font-semibold">Approve</button>
        <button onClick={() => onEdit(card)}    className="flex-1 bg-blue-600  text-white py-2 rounded font-semibold">Edit</button>
        <button onClick={() => onFlag(card)}    className="flex-1 bg-red-600   text-white py-2 rounded font-semibold">Flag</button>
      </div>
    </div>
  );
}

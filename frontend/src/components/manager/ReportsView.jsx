// frontend/src/components/manager/ReportsView.jsx
import { useEffect, useState } from 'react';
import { apiFetch, getManagerSession } from '../../lib/auth';

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); };
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ReportsView() {
  const [startDate, setStart] = useState(weekAgo());
  const [endDate,   setEnd]   = useState(today());
  const [data, setData] = useState(null);
  const session = getManagerSession();

  useEffect(() => {
    apiFetch(`/api/manager/reports/summary?startDate=${startDate}&endDate=${endDate}`, { token: session.token })
      .then(setData);
  }, [startDate, endDate]);

  const downloadCsv = () => {
    const url = `${API_URL}/api/manager/reports/csv?startDate=${startDate}&endDate=${endDate}`;
    fetch(url, { headers: { Authorization: `Bearer ${session.token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `time-cards-${startDate}_to_${endDate}.csv`;
        a.click();
      });
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Reports</h2>
      <div className="flex gap-2 items-end mb-4">
        <label className="text-sm">Start<input type="date" value={startDate} onChange={(e)=>setStart(e.target.value)} className="block border rounded px-2 py-1" /></label>
        <label className="text-sm">End<input type="date" value={endDate}   onChange={(e)=>setEnd(e.target.value)}   className="block border rounded px-2 py-1" /></label>
        <button onClick={downloadCsv} className="ml-auto bg-blue-600 text-white px-3 py-1 rounded">Export CSV</button>
      </div>
      {data && (
        <>
          <p className="text-sm text-gray-600 mb-3">{data.count} entries · {data.total.toFixed(2)} total hours · {data.flaggedCount} flagged</p>
          <h3 className="font-semibold mt-4 mb-2">By worker</h3>
          <table className="w-full bg-white shadow rounded mb-4"><tbody>
            {data.byWorker.map((r) => (<tr key={r.name} className="border-t"><td className="p-2">{r.name}</td><td className="p-2 text-right">{r.hours.toFixed(2)}h</td></tr>))}
          </tbody></table>
          <h3 className="font-semibold mt-4 mb-2">By worksite</h3>
          <table className="w-full bg-white shadow rounded"><tbody>
            {data.byWorksite.map((r) => (<tr key={r.name} className="border-t"><td className="p-2">{r.name}</td><td className="p-2 text-right">{r.hours.toFixed(2)}h</td></tr>))}
          </tbody></table>
        </>
      )}
    </div>
  );
}

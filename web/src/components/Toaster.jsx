import { useEffect, useState } from 'react';

export default function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const h = (e) => {
      const id = Math.random();
      setItems((p) => [...p, { id, ...e.detail }]);
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 4000);
    };
    window.addEventListener('toast', h);
    return () => window.removeEventListener('toast', h);
  }, []);
  return <div className="toasts" aria-live="polite">{items.map((t) => <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>)}</div>;
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function LoketDetailPage() {
  const params = useParams();
  const loketId = params.id as string;
  
  const [queueComplete, setQueueComplete] = useState(1);
  const [queueWaiting, setQueueWaiting] = useState(120);
  const [currentQueue, setCurrentQueue] = useState('A-001');
  const [nextQueue, setNextQueue] = useState('A-002');

  const handleCallNext = () => {
    // Logika untuk memanggil antrian berikutnya
    const currentNum = parseInt(currentQueue.split('-')[1]);
    const nextNum = currentNum + 1;
    setCurrentQueue(`A-${String(nextNum).padStart(3, '0')}`);
    setNextQueue(`A-${String(nextNum + 1).padStart(3, '0')}`);
    setQueueComplete(queueComplete + 1);
    setQueueWaiting(queueWaiting - 1);
  };

  const handleRecall = () => {
    // Logika untuk memanggil ulang antrian saat ini
    alert(`Memanggil ulang antrian: ${currentQueue}`);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="bg-linear-to-r from-blue-600 to-blue-500 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <Link href="/staff" className="inline-flex items-center gap-3 hover:opacity-80 transition">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-white font-semibold drop-shadow">Portal Staff</p>
              <p className="text-xs text-blue-100">Kembali ke Pilihan Loket</p>
            </div>
          </Link>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-white drop-shadow-lg">LOKET {loketId}</h1>
            <p className="text-sm text-blue-100">Manajemen Antrian</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 text-center border-3 border-blue-200 shadow-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Antrian Selesai</h3>
            <p className="text-5xl font-bold text-blue-600">{queueComplete}</p>
          </div>
          <div className="bg-white rounded-xl p-6 text-center border-3 border-blue-200 shadow-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Antrian Menunggu</h3>
            <p className="text-5xl font-bold text-blue-600">{queueWaiting}</p>
          </div>
          <div className="bg-white rounded-xl p-6 text-center border-3 border-blue-200 shadow-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Antrian Sekarang</h3>
            <p className="text-5xl font-bold text-blue-600">{currentQueue}</p>
          </div>
          <div className="bg-white rounded-xl p-6 text-center border-3 border-blue-200 shadow-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Antrian Berikutnya</h3>
            <p className="text-5xl font-bold text-blue-600">{nextQueue}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-6">
          <button
            onClick={handleRecall}
            className="bg-white rounded-xl p-12 text-center border-3 border-blue-200 hover:bg-blue-50 transition-all hover:shadow-xl shadow-lg"
          >
            <h3 className="text-4xl font-bold text-blue-900">Ulangi</h3>
          </button>
          <button
            onClick={handleCallNext}
            className="bg-white rounded-xl p-12 text-center border-3 border-blue-200 hover:bg-blue-50 transition-all hover:shadow-xl shadow-lg"
          >
            <h3 className="text-4xl font-bold text-blue-900">Panggil Berikutnya</h3>
          </button>
        </div>

      </main>
    </div>
  );
}

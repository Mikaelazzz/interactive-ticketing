'use client';

import { useState, useEffect } from 'react';

export default function MonitorPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentQueue, setCurrentQueue] = useState('A-001');
  const [currentLoket, setCurrentLoket] = useState('1');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const queueTimer = setInterval(() => {
      const letters = ['A', 'B', 'C', 'D'];
      const randomLetter = letters[Math.floor(Math.random() * letters.length)];
      const randomNum = Math.floor(Math.random() * 50) + 1;
      setCurrentQueue(`${randomLetter}-${String(randomNum).padStart(3, '0')}`);
    }, 20000);
    return () => clearInterval(queueTimer);
  }, []);

  const counters = [
    { id: 1, name: 'LOKET 1', number: 'A-001' },
    { id: 2, name: 'LOKET 2', number: 'B-001' },
    { id: 3, name: 'LOKET 3', number: 'C-001' },
    { id: 4, name: 'LOKET 4', number: 'D-001' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-white flex flex-col">
      {/* Header */}
      <header className="bg-linear-to-r from-blue-600 to-blue-500 px-8 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Rumah Sakit</h1>
                <p className="text-sm text-gray-500"></p>
              </div>
            </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white drop-shadow-lg">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-sm text-blue-100">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        
        {/* Featured Loket - Top */}
        <div className="bg-white rounded-2xl shadow-xl border-3 border-blue-200 overflow-hidden">
          <div className="bg-linear-to-r from-blue-600 to-blue-500 px-6 py-3 border-b-4 border-blue-700">
            <h2 className="text-3xl font-bold text-white text-center drop-shadow-lg">
              LOKET {currentLoket}
            </h2>
          </div>
          <div className="px-8 py-6">
            <p className="text-2xl font-bold text-center text-blue-900 mb-3">NOMOR ANTRIAN</p>
            <div className="bg-linear-to-br from-blue-100 to-blue-50 rounded-2xl py-12 px-8 shadow-inner border-3 border-blue-300">
              <p className="text-8xl font-bold text-center text-blue-600 tracking-wider" style={{ textShadow: '4px 4px 0px rgba(59, 130, 246, 0.2)' }}>
                {currentQueue}
              </p>
            </div>
          </div>
        </div>

        {/* All Counters Grid - Bottom */}
        <div>
          <div className="grid grid-cols-4 gap-5">
            {counters.map((counter) => (
              <div key={counter.id} className="bg-white rounded-xl shadow-lg border-3 border-blue-200 overflow-hidden hover:shadow-xl transition-shadow">
                <div className="bg-linear-to-r from-blue-500 to-blue-400 px-4 py-3 border-b-3 border-blue-600">
                  <h3 className="text-xl font-bold text-white text-center drop-shadow">
                    {counter.name}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="bg-linear-to-br from-blue-100 to-blue-50 rounded-lg py-8 px-4 shadow-inner border-2 border-blue-300">
                    <p className="text-4xl font-bold text-center text-blue-600 tracking-wide">
                      {counter.number}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {/* <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-lg"></div> */}
                    {/* <span className="text-sm font-bold text-blue-800">Melayani</span> */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Footer Marquee */}
      <footer className="bg-linear-to-r from-blue-600 to-blue-500 py-3 overflow-hidden mt-auto">
        <div className="animate-marquee whitespace-nowrap">
          <span className="text-lg font-bold text-white inline-block px-4 drop-shadow">
            🏥 Selamat datang di Rumah Sakit Umum 
          </span>
        </div>
      </footer>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}

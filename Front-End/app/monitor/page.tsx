'use client';

import { useState, useEffect, useRef } from 'react';

const WS_URL = 'ws://localhost:8080/ws';

interface Patient {
  id: string;
  queueNumber: string;
  fullName: string;
  specialist: string;
  doctor: string;
  status: string;
  loketNumber: string;
  createdAt?: string;
}

interface LoketData {
  loketNumber: string;
  currentQueue: Patient | null;
}

export default function MonitorPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loketData, setLoketData] = useState<LoketData[]>([
    { loketNumber: '1', currentQueue: null },
    { loketNumber: '2', currentQueue: null },
    { loketNumber: '3', currentQueue: null },
    { loketNumber: '4', currentQueue: null },
  ]);
  const [featuredLoket, setFeaturedLoket] = useState<LoketData | null>(null);
  const [lastCalledQueue, setLastCalledQueue] = useState<string>(''); // Track last called queue
  const [isSoundEnabled, setIsSoundEnabled] = useState(true); // Sound toggle
  const [isSpeaking, setIsSpeaking] = useState(false); // Speaking indicator
  
  const wsRefs = useRef<WebSocket[]>([]);
  const ttsQueueRef = useRef<Array<{queueNumber: string, loketNumber: string}>>([]);
  const isProcessingRef = useRef(false);

  // Process TTS queue one by one
  const processTTSQueue = () => {
    if (isProcessingRef.current || ttsQueueRef.current.length === 0 || !isSoundEnabled) {
      return;
    }

    isProcessingRef.current = true;
    const { queueNumber, loketNumber } = ttsQueueRef.current.shift()!;

    // Check if browser supports Speech Synthesis
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      // Format queue number: A-001 -> A 001 atau A001 -> A 001
      const formattedQueue = queueNumber.replace('-', ' ').split('').join(' ');
      
      // Create speech text
      const text = `Nomor antrian ${formattedQueue} di Loket ${loketNumber}`;
      
      // Create utterance
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID'; // Indonesian language
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Event handlers
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        isProcessingRef.current = false;
        // Process next in queue after a short delay
        setTimeout(() => {
          processTTSQueue();
        }, 500);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        isProcessingRef.current = false;
        // Process next in queue on error
        setTimeout(() => {
          processTTSQueue();
        }, 500);
      };
      
      // Speak
      window.speechSynthesis.speak(utterance);
      
      console.log('TTS:', text);
    } else {
      console.warn('Text-to-Speech not supported in this browser');
      isProcessingRef.current = false;
    }
  };

  // Text-to-Speech function - now adds to queue
  const speakQueueNumber = (queueNumber: string, loketNumber: string) => {
    if (!isSoundEnabled) return; // Skip if sound is disabled
    
    // Add to queue
    ttsQueueRef.current.push({ queueNumber, loketNumber });
    
    // Start processing if not already processing
    processTTSQueue();
  };

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Setup WebSocket connections untuk semua loket
  useEffect(() => {
    const lokets = ['1', '2', '3', '4'];
    const reconnectTimeouts: NodeJS.Timeout[] = [];
    
    const connectLoket = (loketNumber: string, index: number) => {
      try {
        const ws = new WebSocket(`${WS_URL}/loket/${loketNumber}`);
        
        ws.onopen = () => {
          console.log(`WebSocket connected for loket ${loketNumber}`);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle recall message
            if (data.type === 'recall') {
              const patient: Patient = data.patient;
              
              // Add to TTS queue (will wait if another is speaking)
              speakQueueNumber(patient.queueNumber, loketNumber);
              
              console.log(`Recall triggered for ${patient.queueNumber}`);
            }
            
            // Handle initial and update messages
            else if (data.type === 'initial' || data.type === 'update') {
              const patients: Patient[] = data.patients || [];
              
              // Find patient yang sedang dipanggil (status 'called')
              const calledPatient = patients.find((p: Patient) => p.status === 'called');
              
              // Jika tidak ada yang 'called', ambil patient terakhir dengan status 'completed'
              const lastPatient = calledPatient || 
                patients.filter((p: Patient) => p.status === 'completed')
                  .sort((a, b) => {
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeB - timeA;
                  })[0];
              
              setLoketData(prev => {
                const updated = [...prev];
                updated[index] = {
                  loketNumber: loketNumber,
                  currentQueue: lastPatient || null
                };
                return updated;
              });

              // Update featured loket jika ada antrian yang dipanggil
              if (calledPatient) {
                const queueKey = `${calledPatient.queueNumber}-${loketNumber}`;
                
                // Only speak if this is a new call (not initial load or same queue)
                if (data.type === 'update' && lastCalledQueue !== queueKey) {
                  setLastCalledQueue(queueKey);
                  
                  // Add to TTS queue (will wait if another is speaking)
                  speakQueueNumber(calledPatient.queueNumber, loketNumber);
                }
                
                setFeaturedLoket({
                  loketNumber: loketNumber,
                  currentQueue: calledPatient
                });
              }
            }
          } catch (err) {
            console.error(`Error parsing WebSocket message for loket ${loketNumber}:`, err);
          }
        };
        
        ws.onerror = () => {
          // Silent error - will be handled by onclose with reconnect
        };
        
        ws.onclose = () => {
          console.log(`WebSocket disconnected for loket ${loketNumber}, reconnecting...`);
          // Reconnect after 3 seconds
          const timeout = setTimeout(() => {
            connectLoket(loketNumber, index);
          }, 3000);
          reconnectTimeouts.push(timeout);
        };
        
        wsRefs.current[index] = ws;
      } catch (error) {
        console.error(`Failed to create WebSocket for loket ${loketNumber}:`, error);
        // Retry after 3 seconds
        const timeout = setTimeout(() => {
          connectLoket(loketNumber, index);
        }, 3000);
        reconnectTimeouts.push(timeout);
      }
    };
    
    // Connect all lokets
    lokets.forEach((loketNumber, index) => {
      connectLoket(loketNumber, index);
    });

    // Cleanup on unmount
    return () => {
      // Clear all reconnect timeouts
      reconnectTimeouts.forEach(timeout => clearTimeout(timeout));
      
      // Close all WebSocket connections
      wsRefs.current.forEach(ws => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      
      // Cancel any ongoing speech and clear queue
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      ttsQueueRef.current = [];
      isProcessingRef.current = false;
    };
  }, []);

  // Handle sound toggle - clear queue when disabled
  useEffect(() => {
    if (!isSoundEnabled) {
      // Cancel any ongoing speech and clear queue
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      ttsQueueRef.current = [];
      isProcessingRef.current = false;
      setIsSpeaking(false);
    }
  }, [isSoundEnabled]);

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
          
          {/* Right - Time and Sound Toggle */}
          <div className="flex items-center gap-4">
            {/* Sound Toggle Button */}
            <button
              onClick={() => setIsSoundEnabled(!isSoundEnabled)}
              className="bg-white/20 hover:bg-white/30 p-3 rounded-lg transition-colors"
              title={isSoundEnabled ? 'Matikan Suara' : 'Aktifkan Suara'}
            >
              {isSoundEnabled ? (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              )}
            </button>
            
            {/* Time Display */}
            <div className="text-right">
              <div className="text-2xl font-bold text-white drop-shadow-lg">
                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-sm text-blue-100">
                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
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
              {featuredLoket ? `LOKET ${featuredLoket.loketNumber}` : 'MENUNGGU PANGGILAN'}
            </h2>
          </div>
          <div className="px-8 py-6">
            <p className="text-2xl font-bold text-center text-blue-900 mb-3">NOMOR ANTRIAN</p>
            <div className="bg-linear-to-br from-blue-100 to-blue-50 rounded-2xl py-12 px-8 shadow-inner border-3 border-blue-300">
              <p className="text-8xl font-bold text-center text-blue-600 tracking-wider" style={{ textShadow: '4px 4px 0px rgba(59, 130, 246, 0.2)' }}>
                {featuredLoket?.currentQueue?.queueNumber || '---'}
              </p>
              {featuredLoket?.currentQueue && (
                <p className="text-2xl font-semibold text-center text-blue-800 mt-4">
                  {featuredLoket.currentQueue.fullName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* All Counters Grid - Bottom */}
        <div>
          <div className="grid grid-cols-4 gap-5">
            {loketData.map((loket) => (
              <div key={loket.loketNumber} className="bg-white rounded-xl shadow-lg border-3 border-blue-200 overflow-hidden hover:shadow-xl transition-shadow">
                <div className="bg-linear-to-r from-blue-500 to-blue-400 px-4 py-3 border-b-3 border-blue-600">
                  <h3 className="text-xl font-bold text-white text-center drop-shadow">
                    LOKET {loket.loketNumber}
                  </h3>
                </div>
                <div className="p-4">
                  <div className="bg-linear-to-br from-blue-100 to-blue-50 rounded-lg py-8 px-4 shadow-inner border-2 border-blue-300">
                    <p className="text-4xl font-bold text-center text-blue-600 tracking-wide">
                      {loket.currentQueue?.queueNumber || '---'}
                    </p>
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

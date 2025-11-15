'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const API_URL = 'http://localhost:8080/api';
const WS_URL = 'ws://localhost:8080/ws';

interface Patient {
  id: string;
  queueNumber: string;
  fullName: string;
  specialist: string;
  doctor: string;
  complaint: string;
  status: string;
  loketNumber: string;
  createdAt: string;
}

export default function LoketDetailPage() {
  const params = useParams();
  const loketId = params.id as string;
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [nextPatient, setNextPatient] = useState<Patient | null>(null);
  const [queueComplete, setQueueComplete] = useState(0);
  const [queueWaiting, setQueueWaiting] = useState(0);
  const [queueCalled, setQueueCalled] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);

  // Update statistik dari data patients
  const updateStatistics = (patientsData: Patient[]) => {
    const completed = patientsData.filter((p: Patient) => p.status === 'completed').length;
    const waiting = patientsData.filter((p: Patient) => p.status === 'waiting').length;
    const called = patientsData.filter((p: Patient) => p.status === 'called').length;
    
    setQueueComplete(completed);
    setQueueWaiting(waiting);
    setQueueCalled(called);
    
    // Set current patient (yang statusnya 'called')
    const current = patientsData.find((p: Patient) => p.status === 'called');
    setCurrentPatient(current || null);
    
    // Set next patient (yang statusnya 'waiting' paling awal)
    const waitingPatients = patientsData.filter((p: Patient) => p.status === 'waiting');
    setNextPatient(waitingPatients[0] || null);
  };

  // Setup WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`${WS_URL}/loket/${loketId}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
        setIsLoading(false);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WebSocket message:', data);
        
        if (data.type === 'initial' || data.type === 'update') {
          const patientsData = data.patients || [];
          setPatients(patientsData);
          updateStatistics(patientsData);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };
      
      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
      
      wsRef.current = ws;
    };

    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [loketId]);

  const handleCallNext = async () => {
    if (!nextPatient) {
      alert('Tidak ada antrian berikutnya');
      return;
    }

    try {
      // Update current patient to completed
      if (currentPatient) {
        await fetch(`${API_URL}/patients/${currentPatient.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...currentPatient, status: 'completed' }),
        });
      }

      // Update next patient to called
      await fetch(`${API_URL}/patients/${nextPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nextPatient, status: 'called' }),
      });

      // WebSocket akan otomatis update data
    } catch (error) {
      console.error('Error calling next patient:', error);
      alert('Gagal memanggil antrian berikutnya');
    }
  };

  const handleRecall = async () => {
    if (!currentPatient) {
      alert('Tidak ada antrian yang sedang dipanggil');
      return;
    }

    try {
      // Trigger recall via API
      const response = await fetch(`${API_URL}/patients/${currentPatient.id}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Success feedback (optional)
        console.log(`Recalled: ${currentPatient.queueNumber}`);
      } else {
        const error = await response.text();
        alert(`Gagal memanggil ulang: ${error}`);
      }
    } catch (error) {
      console.error('Error recalling patient:', error);
      alert('Gagal memanggil ulang antrian');
    }
  };

  const handleComplete = async () => {
    if (!currentPatient) {
      alert('Tidak ada antrian yang sedang dipanggil');
      return;
    }

    const confirmComplete = confirm(`Selesaikan antrian ${currentPatient.queueNumber} - ${currentPatient.fullName}?`);
    if (!confirmComplete) return;

    try {
      // Update current patient to completed
      await fetch(`${API_URL}/patients/${currentPatient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentPatient, status: 'completed' }),
      });

      // WebSocket akan otomatis update data
      console.log(`Completed: ${currentPatient.queueNumber}`);
    } catch (error) {
      console.error('Error completing patient:', error);
      alert('Gagal menyelesaikan antrian');
    }
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
            <div className="flex items-center justify-end gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">LOKET {loketId}</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Memuat data...</p>
          </div>
        ) : (
          <>
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
                <p className="text-5xl font-bold text-blue-600">
                  {currentPatient ? currentPatient.queueNumber : '-'}
                </p>
              </div>
              <div className="bg-white rounded-xl p-6 text-center border-3 border-blue-200 shadow-lg">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Antrian Berikutnya</h3>
                <p className="text-5xl font-bold text-blue-600">
                  {nextPatient ? nextPatient.queueNumber : '-'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <button
                onClick={handleRecall}
                disabled={!currentPatient}
                className="bg-white rounded-xl p-12 text-center border-3 border-orange-200 hover:bg-orange-50 transition-all hover:shadow-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-16 h-16 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <h3 className="text-3xl font-bold text-orange-900">Ulangi</h3>
                  <p className="text-sm text-orange-700">Panggil ulang antrian saat ini</p>
                </div>
              </button>
              <button
                onClick={handleComplete}
                disabled={!currentPatient}
                className="bg-white rounded-xl p-12 text-center border-3 border-green-200 hover:bg-green-50 transition-all hover:shadow-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-3xl font-bold text-green-900">Selesai</h3>
                  <p className="text-sm text-green-700">Tandai antrian selesai</p>
                </div>
              </button>
              <button
                onClick={handleCallNext}
                disabled={!nextPatient}
                className="bg-white rounded-xl p-12 text-center border-3 border-blue-200 hover:bg-blue-50 transition-all hover:shadow-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-16 h-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <h3 className="text-3xl font-bold text-blue-900">Panggil Berikutnya</h3>
                  <p className="text-sm text-blue-700">Panggil antrian selanjutnya</p>
                </div>
              </button>
            </div>

            {/* Tabel Informasi Pasien */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-blue-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white">Daftar Antrian Loket {loketId}</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-blue-50 border-b-2 border-blue-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-blue-900">Nomor</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-blue-900">Nama</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-blue-900">Poli</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-blue-900">Dokter</th>
                      <th className="px-6 py-4 text-center text-sm font-semibold text-blue-900">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {patients.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          Tidak ada antrian untuk loket ini
                        </td>
                      </tr>
                    ) : (
                      patients.map((patient, index) => (
                        <tr 
                          key={patient.id}
                          className={`hover:bg-blue-50 transition-colors ${
                            patient.status === 'called' ? 'bg-blue-100' : ''
                          }`}
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {patient.queueNumber}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {patient.fullName}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {patient.specialist}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">
                            {patient.doctor}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                              patient.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                              patient.status === 'called' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {patient.status === 'waiting' ? 'Menunggu' :
                               patient.status === 'called' ? 'Dipanggil' :
                               'Selesai'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

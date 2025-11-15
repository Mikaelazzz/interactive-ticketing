'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';

const API_URL = 'http://localhost:8080/api';
const WS_URL = 'ws://localhost:8080/ws';

// Mapping dokter berdasarkan poli
const doctorsBySpecialist: { [key: string]: string[] } = {
  'Poli Umum': [
    'dr. Budi Santoso, Sp.PD',
    'dr. Ahmad Fauzi, Sp.PD',
    'dr. Rina Wijaya, Sp.PD',
  ],
  'Poli Gigi': [
    'drg. Siti Nurhaliza, Sp.KG',
    'drg. Dedi Kurniawan, Sp.KG',
    'drg. Maya Safitri',
  ],
  'Poli Anak': [
    'dr. Dewi Lestari, Sp.A',
    'dr. Rizki Pratama, Sp.A',
    'dr. Wati Kusuma, Sp.A',
  ],
  'Poli Kandungan': [
    'dr. Andi Wijaya, Sp.OG',
    'dr. Sri Rahayu, Sp.OG',
    'dr. Diana Putri, Sp.OG',
  ],
};

export default function PatientPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    specialist: '',
    doctor: '',
    complaint: '',
  });

  const [availableDoctors, setAvailableDoctors] = useState<string[]>([]);

  const [queueNumber, setQueueNumber] = useState('');
  const [loketNumber, setLoketNumber] = useState('');
  const [patientId, setPatientId] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingQueue, setIsCheckingQueue] = useState(true);
  const [error, setError] = useState('');
  const [currentStatus, setCurrentStatus] = useState('waiting'); // Track current status
  
  const wsRef = useRef<WebSocket | null>(null);

  // Load data dari localStorage saat component mount
  useEffect(() => {
    const checkExistingQueue = async () => {
      setIsCheckingQueue(true);
      
      // Cek localStorage untuk data antrian yang sudah di-submit
      const savedQueue = localStorage.getItem('patientQueue');
      
      if (savedQueue) {
        try {
          const queueData = JSON.parse(savedQueue);
          
          // Pastikan data lengkap sebelum validasi ke backend
          if (queueData.fullName && queueData.queueNumber) {
            // Validasi dengan backend apakah antrian masih aktif
            const checkResponse = await fetch(`${API_URL}/patients/check/${encodeURIComponent(queueData.fullName)}`);
            
            if (checkResponse.ok) {
              const existingPatient = await checkResponse.json();
              
              if (existingPatient && (existingPatient.status === 'waiting' || existingPatient.status === 'called')) {
                // Restore state dari data yang ada
                setFormData({
                  fullName: queueData.fullName,
                  specialist: queueData.specialist,
                  doctor: queueData.doctor,
                  complaint: queueData.complaint,
                });
                setQueueNumber(existingPatient.queueNumber);
                setLoketNumber(existingPatient.loketNumber);
                setPatientId(existingPatient.id);
                setCurrentStatus(existingPatient.status); // Set status dari backend
                setIsSubmitted(true);
              } else {
                // Antrian sudah selesai, hapus dari localStorage
                localStorage.removeItem('patientQueue');
              }
            } else {
              // Data tidak ditemukan di server, hapus dari localStorage
              localStorage.removeItem('patientQueue');
            }
          } else {
            // Data tidak lengkap, hapus dari localStorage
            localStorage.removeItem('patientQueue');
          }
        } catch (err) {
          console.error('Error checking queue:', err);
          localStorage.removeItem('patientQueue');
        }
      }
      
      // Cek data form yang sedang diisi (belum submit) - hanya restore tanpa validasi backend
      const savedFormData = localStorage.getItem('patientFormData');
      if (savedFormData && !savedQueue) {
        try {
          const formDataParsed = JSON.parse(savedFormData);
          setFormData(formDataParsed);
          
          // Set available doctors jika specialist sudah dipilih
          if (formDataParsed.specialist) {
            setAvailableDoctors(doctorsBySpecialist[formDataParsed.specialist] || []);
          }
        } catch (err) {
          console.error('Error parsing saved form data:', err);
          localStorage.removeItem('patientFormData');
        }
      }
      
      setIsCheckingQueue(false);
    };

    checkExistingQueue();
  }, []);

  // WebSocket untuk monitor status antrian
  useEffect(() => {
    if (!isSubmitted || !loketNumber || !patientId) return;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`${WS_URL}/loket/${loketNumber}`);
        
        ws.onopen = () => {
          console.log(`Patient WebSocket connected for loket ${loketNumber}`);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'initial' || data.type === 'update') {
              const patients = data.patients || [];
              
              // Cari patient dengan ID yang sama
              const myPatient = patients.find((p: any) => p.id === patientId);
              
              if (myPatient) {
                setCurrentStatus(myPatient.status);
                
                // Update queue number dan loket jika ada perubahan
                setQueueNumber(myPatient.queueNumber);
                setLoketNumber(myPatient.loketNumber);
                
                // Jika status completed, hapus localStorage dan reset
                if (myPatient.status === 'completed') {
                  localStorage.removeItem('patientQueue');
                  localStorage.removeItem('patientFormData');
                  
                  // Delay untuk memberikan waktu user melihat status completed
                  setTimeout(() => {
                    setIsSubmitted(false);
                    setFormData({
                      fullName: '',
                      specialist: '',
                      doctor: '',
                      complaint: '',
                    });
                    setAvailableDoctors([]);
                    setQueueNumber('');
                    setLoketNumber('');
                    setPatientId('');
                    setCurrentStatus('waiting');
                  }, 5000); // 5 detik delay
                }
              }
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };
        
        ws.onerror = () => {
          // Silent error
        };
        
        ws.onclose = () => {
          console.log('Patient WebSocket disconnected, reconnecting...');
          // Reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
        
        wsRef.current = ws;
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    // Cleanup
    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [isSubmitted, loketNumber, patientId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    let updatedFormData;
    
    // Reset doctor when specialist changes
    if (name === 'specialist') {
      updatedFormData = {
        ...formData,
        [name]: value,
        doctor: '', // Reset doctor selection
      };
      setFormData(updatedFormData);
      // Update available doctors
      setAvailableDoctors(doctorsBySpecialist[value] || []);
    } else {
      updatedFormData = {
        ...formData,
        [name]: value,
      };
      setFormData(updatedFormData);
    }
    
    // Simpan form data ke localStorage setiap kali ada perubahan
    localStorage.setItem('patientFormData', JSON.stringify(updatedFormData));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Check if patient already has active queue
      const checkResponse = await fetch(`${API_URL}/patients/check/${encodeURIComponent(formData.fullName)}`);
      
      if (checkResponse.ok) {
        const existingPatient = await checkResponse.json();
        // Backend returns null if no active queue found
        if (existingPatient && (existingPatient.status === 'waiting' || existingPatient.status === 'called')) {
          setError(`Anda masih memiliki antrian aktif dengan nomor ${existingPatient.queueNumber}. Mohon selesaikan proses pemeriksaan terlebih dahulu.`);
          setIsLoading(false);
          return;
        }
      } else {
        console.error('Error checking patient:', checkResponse.status);
      }
      // Lanjutkan membuat antrian baru

      // Create new patient
      const response = await fetch(`${API_URL}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create patient');
      }

      const data = await response.json();
      setQueueNumber(data.queueNumber);
      setLoketNumber(data.loketNumber);
      setPatientId(data.id);
      setIsSubmitted(true);
      
      // Simpan ke localStorage
      localStorage.setItem('patientQueue', JSON.stringify({
        id: data.id,
        fullName: formData.fullName,
        specialist: formData.specialist,
        doctor: formData.doctor,
        complaint: formData.complaint,
        queueNumber: data.queueNumber,
        loketNumber: data.loketNumber,
      }));
      
      // Hapus form data yang belum di-submit karena sudah berhasil submit
      localStorage.removeItem('patientFormData');
    } catch (err) {
      setError('Gagal membuat antrian. Pastikan server backend berjalan.');
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewQueue = () => {
    // Hapus semua data dari localStorage
    localStorage.removeItem('patientQueue');
    localStorage.removeItem('patientFormData');
    
    setIsSubmitted(false);
    setError('');
    setQueueNumber('');
    setLoketNumber('');
    setPatientId('');
    setFormData({
      fullName: '',
      specialist: '',
      doctor: '',
      complaint: '',
    });
    setAvailableDoctors([]);
  };

  // Tampilkan loading saat cek antrian
  if (isCheckingQueue) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Memeriksa status antrian...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-cyan-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Portal Patient</h1>
                <p className="text-xs text-gray-500">Ambil Nomor Antrian</p>
              </div>
            </Link>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {!isSubmitted ? (
          <>
            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                Ambil Nomor Antrian
              </h2>
              <p className="text-gray-600">
                Silakan isi form di bawah untuk mendapatkan nomor antrian Anda
              </p>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 border border-gray-100">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Patient Info Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Data Pasien
                  </h3>
                  
                  <div>
                    {/* Patient Name */}
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="fullName"
                        name="fullName"
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border text-black placeholder-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                        placeholder="Masukkan nama lengkap"
                      />
                    </div>
                  </div>
                </div>

                {/* Medical Info Section */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Informasi Medis
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Specialization */}
                    <div>
                      <label htmlFor="specialist" className="block text-sm font-medium text-gray-700 mb-2">
                        Poli/Spesialisasi <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="specialist"
                        name="specialist"
                        required
                        value={formData.specialist}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border text-black placeholder-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      >
                        <option value="">Pilih Poli</option>
                        <option value="Poli Umum">Poli Umum</option>
                        <option value="Poli Gigi">Poli Gigi</option>
                        <option value="Poli Anak">Poli Anak</option>
                        <option value="Poli Kandungan">Poli Kandungan</option>
                      </select>
                    </div>

                    {/* Doctor */}
                    <div>
                      <label htmlFor="doctor" className="block text-sm font-medium text-gray-700 mb-2">
                        Pilih Dokter <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="doctor"
                        name="doctor"
                        required
                        value={formData.doctor}
                        onChange={handleChange}
                        disabled={!formData.specialist}
                        className="w-full px-4 py-3 border text-black placeholder-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">{formData.specialist ? 'Pilih Dokter' : 'Pilih Poli Terlebih Dahulu'}</option>
                        {availableDoctors.map((doctor, index) => (
                          <option key={index} value={doctor}>
                            {doctor}
                          </option>
                        ))}
                      </select>
                      {!formData.specialist && (
                        <p className="mt-1 text-xs text-gray-500">Silakan pilih poli terlebih dahulu untuk melihat daftar dokter</p>
                      )}
                    </div>
                  </div>

                  {/* Complaint/Diagnosis */}
                  <div className="mt-4">
                    <label htmlFor="complaint" className="block text-sm font-medium text-gray-700 mb-2">
                      Keluhan / Diagnosa Penyakit <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="complaint"
                      name="complaint"
                      required
                      rows={4}
                      value={formData.complaint}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border text-black placeholder-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                      placeholder="Jelaskan keluhan atau gejala yang Anda alami..."
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Jelaskan keluhan Anda dengan detail untuk membantu dokter memberikan pelayanan terbaik
                    </p>
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                    <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex gap-4 pt-4">
                  <Link
                    href="/"
                    className="flex-1 py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition text-center"
                  >
                    Batal
                  </Link>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Memproses...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Ambil Nomor Antrian
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <>
            {/* Success State */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center border border-gray-100">
                {/* Success Icon */}
                <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>

                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                  Antrian Berhasil Dibuat!
                </h2>
                <p className="text-gray-600 mb-8">
                  Nomor antrian Anda telah berhasil dibuat
                </p>

                {/* Queue Number Display */}
                <div className="bg-linear-to-br from-blue-500 to-blue-600 rounded-2xl p-8 mb-8 shadow-lg">
                  <p className="text-blue-100 text-sm font-medium mb-2">Nomor Antrian Anda</p>
                  <p className="text-6xl md:text-7xl font-bold text-white mb-2">{queueNumber}</p>
                  <p className="text-blue-100 text-sm">Loket {loketNumber}</p>
                </div>

                {/* Queue Info */}
                <div className="bg-gray-50 rounded-xl p-6 mb-8 text-left space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Nama Pasien:</span>
                    <span className="font-semibold text-gray-900">{formData.fullName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Poli:</span>
                    <span className="font-semibold text-gray-900">{formData.specialist}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Dokter:</span>
                    <span className="font-semibold text-gray-900">{formData.doctor}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Loket:</span>
                    <span className="font-semibold text-gray-900">Loket {loketNumber}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Status:</span>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      currentStatus === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                      currentStatus === 'called' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      <span className={`w-2 h-2 rounded-full mr-2 ${
                        currentStatus === 'waiting' ? 'bg-yellow-500' :
                        currentStatus === 'called' ? 'bg-blue-500 animate-pulse' :
                        'bg-green-500'
                      }`}></span>
                      {currentStatus === 'waiting' ? 'Menunggu' :
                       currentStatus === 'called' ? 'Dipanggil - Silakan ke Loket' :
                       'Selesai'}
                    </span>
                  </div>
                </div>

                {/* Additional Info */}
                <div className={`border rounded-lg p-4 mb-8 text-left ${
                  currentStatus === 'called' 
                    ? 'bg-blue-100 border-blue-300 animate-pulse' 
                    : currentStatus === 'completed'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  {currentStatus === 'called' ? (
                    <>
                      <p className="text-lg font-bold text-blue-900 mb-2 flex items-center">
                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Nomor Anda Dipanggil!
                      </p>
                      <p className="text-sm text-blue-800">
                        🎯 Silakan segera menuju ke <strong>Loket {loketNumber}</strong>
                      </p>
                    </>
                  ) : currentStatus === 'completed' ? (
                    <>
                      <p className="text-lg font-bold text-green-900 mb-2">✅ Pemeriksaan Selesai</p>
                      <p className="text-sm text-green-800">
                        Terima kasih telah menggunakan layanan kami. Halaman akan reset dalam 5 detik...
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-blue-900 mb-2">Informasi Penting:</p>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Data antrian Anda telah tersimpan, Anda dapat meninggalkan halaman ini</li>
                        <li>• Harap datang ke loket saat nomor Anda dipanggil</li>
                        <li>• Status akan berubah otomatis saat Anda dipanggil</li>
                      </ul>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/"
                    className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition text-center"
                  >
                    Kembali ke Beranda
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

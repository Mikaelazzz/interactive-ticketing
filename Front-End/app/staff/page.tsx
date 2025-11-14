import Link from 'next/link';

export default function StaffPage() {
  const lokets = [
    { id: 1, name: 'LOKET 1', color: 'from-blue-600 to-blue-500', icon: '1' },
    { id: 2, name: 'LOKET 2', color: 'from-blue-600 to-blue-500', icon: '2' },
    { id: 3, name: 'LOKET 3', color: 'from-blue-600 to-blue-500', icon: '3' },
    { id: 4, name: 'LOKET 4', color: 'from-blue-600 to-blue-500', icon: '4' },
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-white">
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
                <h1 className="text-lg font-bold text-gray-900">Portal Staff</h1>
                <p className="text-xs text-gray-500">Kelola Antrian Pasien</p>
              </div>
            </Link>
            </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-blue-900 mb-4">Pilih Loket</h2>
          <p className="text-lg text-blue-700">Silakan pilih loket yang akan Anda kelola</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {lokets.map((loket) => (
            <Link
              key={loket.id}
              href={`/staff/loket/${loket.id}`}
              className="group"
            >
              <div className="bg-white rounded-xl shadow-lg border-3 border-blue-200 overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                <div className={`bg-linear-to-r ${loket.color} px-6 py-8 text-center border-b-4 border-blue-700`}>
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-5xl font-bold text-blue-600">{loket.icon}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white drop-shadow-lg">
                    {loket.name}
                  </h3>
                </div>
                <div className="p-6 text-center">
                  <p className="text-blue-700 mb-4 font-medium">Klik untuk mengelola loket ini</p>
                  <div className="inline-flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all">
                    <span>Masuk</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

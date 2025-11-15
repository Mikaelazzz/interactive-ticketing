package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/rs/cors"
)

// Patient struktur data pasien
type Patient struct {
	ID          string    `json:"id"`
	QueueNumber string    `json:"queueNumber"`
	FullName    string    `json:"fullName"`
	Email       string    `json:"email"`
	DateOfBirth string    `json:"dateOfBirth"`
	Address     string    `json:"address"`
	Specialist  string    `json:"specialist"`
	Doctor      string    `json:"doctor"`
	Complaint   string    `json:"complaint"`
	Status      string    `json:"status"` // "waiting", "called", "completed"
	LoketNumber string    `json:"loketNumber"`
	CreatedAt   time.Time `json:"createdAt"`
}

// QueueStats struktur statistik antrian
type QueueStats struct {
	Total     int `json:"total"`
	Waiting   int `json:"waiting"`
	Completed int `json:"completed"`
	Called    int `json:"called"`
}

var (
	patients   []Patient
	patientsMu sync.RWMutex
	queueCount = map[string]int{
		"A": 0,
		"B": 0,
		"C": 0,
		"D": 0,
	}
	queueCountMu sync.Mutex
	upgrader     = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for development
		},
	}
	wsClients   = make(map[*websocket.Conn]string) // map connection to loket number
	wsClientsMu sync.RWMutex
)

const dataFile = "patients.json"

// Broadcast update to all WebSocket clients for specific loket
func broadcastToLoket(loketNumber string) {
	wsClientsMu.RLock()
	defer wsClientsMu.RUnlock()

	patientsMu.RLock()
	loketPatients := []Patient{}
	for _, p := range patients {
		if p.LoketNumber == loketNumber {
			loketPatients = append(loketPatients, p)
		}
	}
	patientsMu.RUnlock()

	message, _ := json.Marshal(map[string]interface{}{
		"type":     "update",
		"loket":    loketNumber,
		"patients": loketPatients,
	})

	for client, loket := range wsClients {
		if loket == loketNumber {
			if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Error sending message to client: %v", err)
				client.Close()
				delete(wsClients, client)
			}
		}
	}
}

// Broadcast recall to all WebSocket clients for specific loket
func broadcastRecall(loketNumber string, patient Patient) {
	wsClientsMu.RLock()
	defer wsClientsMu.RUnlock()

	message, _ := json.Marshal(map[string]interface{}{
		"type":    "recall",
		"loket":   loketNumber,
		"patient": patient,
	})

	for client, loket := range wsClients {
		if loket == loketNumber {
			if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Error sending recall message to client: %v", err)
				client.Close()
				delete(wsClients, client)
			}
		}
	}
}

// Data alamat Indonesia yang akurat
var indonesianAddresses = []string{
	"Jl. Sudirman No. 45, Karet Tengsin, Tanah Abang, Jakarta Pusat, DKI Jakarta 10220",
	"Jl. Gatot Subroto Kav. 32-34, Kuningan Barat, Mampang Prapatan, Jakarta Selatan, DKI Jakarta 12710",
	"Jl. Thamrin No. 59, Gondangdia, Menteng, Jakarta Pusat, DKI Jakarta 10350",
	"Jl. Ahmad Yani No. 28, Kauman, Klojen, Kota Malang, Jawa Timur 65119",
	"Jl. Diponegoro No. 156, Citarum, Bandung Wetan, Kota Bandung, Jawa Barat 40115",
	"Jl. Veteran No. 12, Ketawanggede, Lowokwaru, Kota Malang, Jawa Timur 65145",
	"Jl. Gajah Mada No. 89, Peterongan, Semarang Tengah, Kota Semarang, Jawa Tengah 50134",
	"Jl. Imam Bonjol No. 207, Pendrikan Kidul, Semarang Tengah, Kota Semarang, Jawa Tengah 50131",
	"Jl. Pemuda No. 142, Sekayu, Semarang Tengah, Kota Semarang, Jawa Tengah 50132",
	"Jl. Pahlawan No. 76, Sawahan, Kota Surabaya, Jawa Timur 60251",
	"Jl. Basuki Rahmat No. 98-104, Embong Kaliasin, Genteng, Kota Surabaya, Jawa Timur 60271",
	"Jl. Raya Darmo No. 135, Wonokromo, Kota Surabaya, Jawa Timur 60241",
	"Jl. Malioboro No. 60, Sosromenduran, Gedong Tengen, Kota Yogyakarta, DI Yogyakarta 55271",
	"Jl. Solo No. 19, Kotabaru, Gondokusuman, Kota Yogyakarta, DI Yogyakarta 55224",
	"Jl. Kaliurang KM 5, Caturtunggal, Depok, Sleman, DI Yogyakarta 55281",
	"Jl. Teuku Umar No. 23, Denpasar Barat, Kota Denpasar, Bali 80114",
	"Jl. Hayam Wuruk No. 188, Dauh Puri Klod, Denpasar Barat, Kota Denpasar, Bali 80114",
	"Jl. Sunset Road No. 86, Kuta, Badung, Bali 80361",
	"Jl. Ahmad Dahlan No. 66, Panjang Utara, Pekalongan Utara, Kota Pekalongan, Jawa Tengah 51141",
	"Jl. Jenderal Sudirman No. 333, Purwanegara, Purwokerto Utara, Banyumas, Jawa Tengah 53116",
}

// Generate random email
func generateEmail(name string) string {
	domains := []string{"gmail.com", "yahoo.com"}
	randomDomain := domains[rand.Intn(len(domains))]
	randomNum := rand.Intn(999)
	// Simplified name for email
	simpleName := name
	if len(name) > 10 {
		simpleName = name[:10]
	}
	return fmt.Sprintf("%s%d@%s", simpleName, randomNum, randomDomain)
}

// Generate random date of birth (18-70 years old)
func generateDateOfBirth() string {
	yearsAgo := rand.Intn(53) + 18 // 18 to 70 years
	month := rand.Intn(12) + 1
	day := rand.Intn(28) + 1 // Safe for all months
	year := time.Now().Year() - yearsAgo
	return fmt.Sprintf("%04d-%02d-%02d", year, month, day)
}

// Generate random Indonesian address
func generateAddress() string {
	return indonesianAddresses[rand.Intn(len(indonesianAddresses))]
}

// Load data dari file JSON
func loadData() error {
	patientsMu.Lock()
	defer patientsMu.Unlock()

	data, err := os.ReadFile(dataFile)
	if err != nil {
		if os.IsNotExist(err) {
			patients = []Patient{}
			return nil
		}
		return err
	}

	return json.Unmarshal(data, &patients)
}

// Save data ke file JSON
func saveData() error {
	patientsMu.RLock()
	defer patientsMu.RUnlock()

	data, err := json.Marshal(patients)
	if err != nil {
		return err
	}

	return os.WriteFile(dataFile, data, 0644)
}

// Generate nomor antrian
func generateQueueNumber(specialist string) string {
	queueCountMu.Lock()
	defer queueCountMu.Unlock()

	var prefix string
	switch specialist {
	case "Poli Umum":
		prefix = "A"
	case "Poli Gigi":
		prefix = "B"
	case "Poli Anak":
		prefix = "C"
	case "Poli Kandungan":
		prefix = "D"
	default:
		prefix = "A"
	}

	queueCount[prefix]++
	return fmt.Sprintf("%s-%03d", prefix, queueCount[prefix])
}

// Handler: Get all patients
func getPatients(w http.ResponseWriter, r *http.Request) {
	patientsMu.RLock()
	defer patientsMu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(patients)
}

// Handler: Get patient by ID
func getPatientByID(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	patientsMu.RLock()
	defer patientsMu.RUnlock()

	for _, patient := range patients {
		if patient.ID == id {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(patient)
			return
		}
	}

	http.Error(w, "Patient not found", http.StatusNotFound)
}

// Handler: Check if patient has active queue
func checkActiveQueue(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	fullName := params["name"]

	patientsMu.RLock()
	defer patientsMu.RUnlock()

	// Find most recent patient with this name that has active status
	for i := len(patients) - 1; i >= 0; i-- {
		patient := patients[i]
		if patient.FullName == fullName && (patient.Status == "waiting" || patient.Status == "called") {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(patient)
			return
		}
	}

	// No active queue found - return 200 with null instead of 404
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(nil)
}

// Handler: Create new patient
func createPatient(w http.ResponseWriter, r *http.Request) {
	var newPatient Patient
	if err := json.NewDecoder(r.Body).Decode(&newPatient); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	patientsMu.Lock()
	newPatient.ID = fmt.Sprintf("P%d", time.Now().Unix())
	newPatient.QueueNumber = generateQueueNumber(newPatient.Specialist)
	newPatient.Status = "waiting"
	newPatient.CreatedAt = time.Now()

	// Auto-generate email, dateOfBirth, and address
	if newPatient.Email == "" {
		newPatient.Email = generateEmail(newPatient.FullName)
	}
	if newPatient.DateOfBirth == "" {
		newPatient.DateOfBirth = generateDateOfBirth()
	}
	if newPatient.Address == "" {
		newPatient.Address = generateAddress()
	}

	// Assign loket berdasarkan specialist
	switch newPatient.Specialist {
	case "Poli Umum":
		newPatient.LoketNumber = "1"
	case "Poli Gigi":
		newPatient.LoketNumber = "2"
	case "Poli Anak":
		newPatient.LoketNumber = "3"
	case "Poli Kandungan":
		newPatient.LoketNumber = "4"
	default:
		newPatient.LoketNumber = "1"
	}

	patients = append(patients, newPatient)
	patientsMu.Unlock()

	if err := saveData(); err != nil {
		log.Printf("Error saving data: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(newPatient)
}

// Handler: Update patient status
func updatePatientStatus(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	var updateData struct {
		Status string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	patientsMu.Lock()
	defer patientsMu.Unlock()

	for i := range patients {
		if patients[i].ID == id {
			patients[i].Status = updateData.Status

			if err := saveData(); err != nil {
				log.Printf("Error saving data: %v", err)
			}

			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(patients[i])
			return
		}
	}

	http.Error(w, "Patient not found", http.StatusNotFound)
}

// Handler: Recall patient (trigger TTS again without changing status)
func recallPatient(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	patientsMu.RLock()
	var patient Patient
	found := false
	for _, p := range patients {
		if p.ID == id && p.Status == "called" {
			patient = p
			found = true
			break
		}
	}
	patientsMu.RUnlock()

	if !found {
		http.Error(w, "Patient not found or not in called status", http.StatusNotFound)
		return
	}

	// Broadcast recall to WebSocket clients
	go broadcastRecall(patient.LoketNumber, patient)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Recall triggered",
		"patient": patient,
	})
}

// Handler: Update entire patient object (for WebSocket updates)
func updatePatient(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	id := params["id"]

	var updatedPatient Patient
	if err := json.NewDecoder(r.Body).Decode(&updatedPatient); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	patientsMu.Lock()
	found := false
	var loketNumber string
	for i := range patients {
		if patients[i].ID == id {
			loketNumber = patients[i].LoketNumber
			updatedPatient.ID = id
			updatedPatient.CreatedAt = patients[i].CreatedAt
			patients[i] = updatedPatient
			found = true
			break
		}
	}
	patientsMu.Unlock()

	if !found {
		http.Error(w, "Patient not found", http.StatusNotFound)
		return
	}

	if err := saveData(); err != nil {
		log.Printf("Error saving data: %v", err)
	}

	// Broadcast update to WebSocket clients
	go broadcastToLoket(loketNumber)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updatedPatient)
}

// Handler: WebSocket for loket real-time updates
func handleLoketWebSocket(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	loketNumber := params["loket"]

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}
	defer conn.Close()

	// Register client
	wsClientsMu.Lock()
	wsClients[conn] = loketNumber
	wsClientsMu.Unlock()

	log.Printf("WebSocket client connected for loket %s", loketNumber)

	// Send initial data
	patientsMu.RLock()
	loketPatients := []Patient{}
	for _, p := range patients {
		if p.LoketNumber == loketNumber {
			loketPatients = append(loketPatients, p)
		}
	}
	patientsMu.RUnlock()

	initialMessage, _ := json.Marshal(map[string]interface{}{
		"type":     "initial",
		"loket":    loketNumber,
		"patients": loketPatients,
	})
	conn.WriteMessage(websocket.TextMessage, initialMessage)

	// Keep connection alive and listen for client messages
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket client disconnected: %v", err)
			wsClientsMu.Lock()
			delete(wsClients, conn)
			wsClientsMu.Unlock()
			break
		}
	}
}

// Handler: Get queue statistics
func getQueueStats(w http.ResponseWriter, r *http.Request) {
	patientsMu.RLock()
	defer patientsMu.RUnlock()

	stats := QueueStats{
		Total:     len(patients),
		Waiting:   0,
		Completed: 0,
		Called:    0,
	}

	for _, patient := range patients {
		switch patient.Status {
		case "waiting":
			stats.Waiting++
		case "completed":
			stats.Completed++
		case "called":
			stats.Called++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// Handler: Get patients by loket
func getPatientsByLoket(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	loketNumber := params["loket"]

	patientsMu.RLock()
	defer patientsMu.RUnlock()

	var loketPatients []Patient
	for _, patient := range patients {
		if patient.LoketNumber == loketNumber {
			loketPatients = append(loketPatients, patient)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(loketPatients)
}

// Handler: Get next queue for loket
func getNextQueue(w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)
	loketNumber := params["loket"]

	patientsMu.RLock()
	defer patientsMu.RUnlock()

	for _, patient := range patients {
		if patient.LoketNumber == loketNumber && patient.Status == "waiting" {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(patient)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "No waiting queue"})
}

// Handler: Reset all data
func resetData(w http.ResponseWriter, r *http.Request) {
	patientsMu.Lock()
	patients = []Patient{}
	patientsMu.Unlock()

	queueCountMu.Lock()
	for key := range queueCount {
		queueCount[key] = 0
	}
	queueCountMu.Unlock()

	if err := saveData(); err != nil {
		log.Printf("Error saving data: %v", err)
		http.Error(w, "Failed to reset data", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Data reset successfully"})
}

func main() {
	// Initialize random seed
	rand.Seed(time.Now().UnixNano())

	// Load existing data
	if err := loadData(); err != nil {
		log.Printf("Error loading data: %v", err)
	}

	// Setup router
	router := mux.NewRouter()

	// Routes
	router.HandleFunc("/api/patients", getPatients).Methods("GET")
	router.HandleFunc("/api/patients", createPatient).Methods("POST")
	router.HandleFunc("/api/patients/{id}", getPatientByID).Methods("GET")
	router.HandleFunc("/api/patients/{id}", updatePatient).Methods("PUT")
	router.HandleFunc("/api/patients/check/{name}", checkActiveQueue).Methods("GET")
	router.HandleFunc("/api/patients/{id}/status", updatePatientStatus).Methods("PUT")
	router.HandleFunc("/api/patients/{id}/recall", recallPatient).Methods("POST")
	router.HandleFunc("/api/patients/loket/{loket}", getPatientsByLoket).Methods("GET")
	router.HandleFunc("/api/patients/loket/{loket}/next", getNextQueue).Methods("GET")
	router.HandleFunc("/api/stats", getQueueStats).Methods("GET")
	router.HandleFunc("/api/reset", resetData).Methods("POST")

	// WebSocket route
	router.HandleFunc("/ws/loket/{loket}", handleLoketWebSocket)

	// CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	handler := c.Handler(router)

	// Start server
	port := ":8080"
	fmt.Printf("Server running on http://localhost%s\n", port)
	log.Fatal(http.ListenAndServe(port, handler))
}


#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>  // For persistent storage (survives power loss)

// ===== Forward Declarations =====
String sendScanToServer(String registrationNo, unsigned long timestamp = 0);
String cleanScannedData(String rawData);
void logAttendance(String studentID);
String extractErrorMessage(String json);
bool addToOfflineQueue(String registrationNo, unsigned long timestamp);
void processOfflineQueue();
void compactOfflineQueue();
void saveOfflineQueue();
void loadOfflineQueue();
void clearOfflineQueue();
bool ensureWiFi(uint32_t timeoutMs);
void processID(String rawData);

// LCD I2C address (0x27 or 0x3F, உங்கள் module-க்கு எந்த address இருக்குனு I2C Scanner code run பண்ணி check பண்ணுங்க)
// For ESP32 compatibility, install "LiquidCrystal I2C" by Marco Schwartz from Library Manager
// Alternative: Use "LiquidCrystal_I2C" by Frank de Brabander (ESP32 compatible)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Initialize HardwareSerial for GM65 Scanner (UART2)
// ESP32-WROOM-32: RX=16, TX=17 for UART2
// Alternative: UART1 with RX=9, TX=10
HardwareSerial GM65Serial(2);

// ===== Network & API Config =====
// TODO: fill these with your actual Wi-Fi and device/API details
const char* WIFI_SSID = "RAJ";
const char* WIFI_PASSWORD = "20001432002";
const char* API_BASE = "https://attendance-management-uere.vercel.app";
// const char* API_BASE = "https://192.168.43.214:5000";
const char* DEVICE_KEY = "esp32-dev-key";      // auto-created on backend startup

// Endpoint path
const char* SCAN_ENDPOINT = "/api/scans/ingest";

// Attendance tracking (local buffer for debug/log display)
String attendanceLog[50]; // Store up to 50 attendance records
int attendanceCount = 0;
unsigned long lastScanTime = 0;
unsigned long lastWiFiCheck = 0;
unsigned long lastLEDBlinkTime = 0; // For WiFi status LED blinking
bool wifiConnected = false; // Track WiFi connection status

// ===== Offline Queue System =====
// Structure to store offline scans with timestamp
struct OfflineScan {
  String registrationNo;
  unsigned long timestamp;  // millis() when scanned
  bool processed;           // Flag to track if sent to server
  int retryCount;           // Number of retry attempts
};

#define MAX_OFFLINE_QUEUE 20  // Maximum offline scans to store (adjust based on RAM)
#define MAX_RETRY_ATTEMPTS 3  // Maximum retry attempts before giving up
OfflineScan offlineQueue[MAX_OFFLINE_QUEUE];
int offlineQueueCount = 0;
Preferences preferences;  // For persistent storage across reboots
unsigned long lastQueueProcessTime = 0;  // Track when queue was last processed
#define QUEUE_PROCESS_INTERVAL 30000  // Process queue every 30 seconds (not 5 seconds)

// ===== Buzzer (Active buzzer recommended) =====//18
// Wiring: Buzzer (+) → GPIO 25 → 220Ω Resistor → Buzzer (-) → GND
//        OR: Buzzer (+) → GPIO 25 → 220Ω Resistor → GND
//            Buzzer (-) → GND
#define BUZZER_PIN 25

void buzz(uint16_t onMs, uint16_t offMs, uint8_t repeats) {
  // Error handling: Validate buzzer pin is configured
  if (BUZZER_PIN < 0) {
    Serial.println("ERROR: Buzzer pin not configured");
    return;
  }
  
  for (uint8_t i = 0; i < repeats; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(onMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (i + 1 < repeats) delay(offMs);
  }
}

// ===== LED/Bulb Indicator =====
// Wiring Details:
//   Blue LED: D2 (GPIO 2) → 220Ω Resistor → Blue LED Anode (+) → Blue LED Cathode (-) → GND
//   Red LED: D4 (GPIO 4) → 220Ω Resistor → Red LED Anode (+) → Red LED Cathode (-) → GND
//   Note: Red LED will be kept OFF. Only Blue LED is used for WiFi status indication.
//   Current wiring: D2 (GPIO 2) → 220Ω Resistor → Blue LED Anode(+) → Blue LED Cathode(-) → GND ✓
//   Current Calculation with 220Ω resistor:
//     - ESP32 GPIO: 3.3V, LED Forward Voltage: ~2.0V
//     - Current = (3.3V - 2.0V) / 220Ω ≈ 5.9mA (SAFE - well below 20mA LED limit)
//     - The 220Ω resistor protects the LED from overcurrent damage
#define BLUE_LED_PIN 2   // Blue LED - WiFi status indicator
#define RED_LED_PIN 4    // Red LED - Keep OFF (not used)
#define LED_BLINK_INTERVAL 500  // Blink interval in milliseconds

// Use BLUE_LED_PIN as the main LED_PIN for compatibility
#define LED_PIN BLUE_LED_PIN

void ledOn() {
  // Turn ON Blue LED only
  if (BLUE_LED_PIN >= 0) {
    digitalWrite(BLUE_LED_PIN, HIGH);
  }
  // Ensure Red LED is OFF
  digitalWrite(RED_LED_PIN, LOW);
}

void ledOff() {
  // Turn OFF Blue LED
  if (BLUE_LED_PIN >= 0) {
    digitalWrite(BLUE_LED_PIN, LOW);
  }
  // Ensure Red LED is OFF
  digitalWrite(RED_LED_PIN, LOW);
}

void ledBlink(uint16_t onMs, uint16_t offMs, uint8_t repeats) {
  if (BLUE_LED_PIN < 0) {
    Serial.println("ERROR: LED pin not configured");
    return;
  }
  
  // Ensure Red LED stays OFF during blinking
  digitalWrite(RED_LED_PIN, LOW);
  
  // Blink only Blue LED
  for (uint8_t i = 0; i < repeats; i++) {
    digitalWrite(BLUE_LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(BLUE_LED_PIN, LOW);
    if (i + 1 < repeats) delay(offMs);
  }
}

void ledBlinkContinuous(uint16_t intervalMs) {
  static unsigned long lastBlinkTime = 0;
  static bool ledState = false;
  
  // Ensure Red LED stays OFF
  digitalWrite(RED_LED_PIN, LOW);
  
  if (millis() - lastBlinkTime >= intervalMs) {
    ledState = !ledState;
    digitalWrite(BLUE_LED_PIN, ledState ? HIGH : LOW);
    lastBlinkTime = millis();
  }
}

// ===== Wi-Fi helpers =====
void printWiFiStatus(const char* prefix) {
  Serial.print(prefix);
  Serial.print(" status=");
  Serial.print(WiFi.status());
  Serial.print(" ip=");
  Serial.print(WiFi.localIP());
  Serial.print(" rssi=");
  Serial.println(WiFi.RSSI());
}

bool ensureWiFi(uint32_t timeoutMs) {
  // Error handling: Check if already connected
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi: Already connected");
    return true;
  }

  // Error handling: Validate credentials
  if (strlen(WIFI_SSID) == 0) {
    Serial.println("ERROR: WiFi SSID is empty");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Config Error");
    lcd.setCursor(0, 1);
    lcd.print("No WiFi SSID");
    return false;
  }

  Serial.println("WiFi: Attempting connection...");
  
  // Hard reset Wi‑Fi state
  WiFi.persistent(false);
  WiFi.disconnect(true, true);
  delay(100);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  wl_status_t res = WL_IDLE_STATUS;
  int dotCount = 0;
  
  while ((millis() - start) < timeoutMs) {
    res = WiFi.status();
    if (res == WL_CONNECTED) break;
    
    // Keep Blue LED ON (steady) during connection attempt - no blinking until connected
    // Red LED stays OFF
    digitalWrite(BLUE_LED_PIN, HIGH);
    digitalWrite(RED_LED_PIN, LOW);
    
    // Update LCD with connection progress
    if (dotCount % 4 == 0) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Connecting WiFi");
      lcd.setCursor(0, 1);
      for (int i = 0; i < (dotCount / 4) % 4; i++) {
        lcd.print(".");
      }
    }
    dotCount++;
    
    delay(250);
    Serial.print(".");
  }
  
  // If connection failed, ensure Blue LED stays ON (steady) - no blinking
  // Red LED stays OFF
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(BLUE_LED_PIN, HIGH); // Blue LED ON (steady) when not connected
    digitalWrite(RED_LED_PIN, LOW);   // Red LED OFF
  }

  if (WiFi.status() == WL_CONNECTED) {
    printWiFiStatus("WiFi: Connected");
    Serial.println("WiFi: Connection successful");
    return true;
  }

  // Error handling: Connection failed - provide detailed diagnostics
  Serial.println("\nERROR: WiFi connection failed");
  Serial.print("Final status code: ");
  Serial.println(res);
  
  // Scan for networks to help diagnose the issue
  Serial.println("WiFi: Scanning for available networks...");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Failed");
  lcd.setCursor(0, 1);
  lcd.print("Scanning...");
  
  int n = WiFi.scanNetworks(true /* async */, true /* show hidden */);
  unsigned long scanStart = millis();
  while (n == WIFI_SCAN_RUNNING && millis() - scanStart < 8000) {
    delay(200);
    n = WiFi.scanComplete();
  }
  
  if (n <= 0) {
    Serial.println("ERROR: No networks found - check antenna/hardware");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("No Networks");
    lcd.setCursor(0, 1);
    lcd.print("Check Hardware");
  } else {
    Serial.print("Found ");
    Serial.print(n);
    Serial.println(" networks:");
    
    bool targetFound = false;
    for (int i = 0; i < n; i++) {
      Serial.print(i + 1);
      Serial.print(") ");
      Serial.print(WiFi.SSID(i));
      Serial.print("  RSSI:");
      Serial.print(WiFi.RSSI(i));
      Serial.print("  ENC:");
      Serial.println(WiFi.encryptionType(i));
      
      if (WiFi.SSID(i) == String(WIFI_SSID)) {
        targetFound = true;
      }
    }
    
    if (!targetFound) {
      Serial.println("ERROR: Target SSID not found - check SSID name");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("SSID Not Found");
      lcd.setCursor(0, 1);
      lcd.print("Check Config");
    } else {
      Serial.println("ERROR: SSID found but connection failed - check password");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Auth Failed");
      lcd.setCursor(0, 1);
      lcd.print("Check Password");
    }
  }
  
  return false;
}

void setup() {
  // Debugging Serial
  Serial.begin(115200);
  delay(1000); // Wait for serial to initialize
  Serial.println("\n\n=== ESP32 Attendance System Starting ===");
  
  // Initialize persistent storage
  Serial.println("Initializing persistent storage...");
  preferences.begin("attendance", false);  // namespace: "attendance", read-write mode
  
  // Load offline queue from storage (survives power loss)
  loadOfflineQueue();
  Serial.print("Loaded ");
  Serial.print(offlineQueueCount);
  Serial.println(" offline scans from storage");
  
  // LCD init with error handling
  Serial.println("Initializing LCD...");
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Starting");
  lcd.setCursor(0, 1);
  lcd.print("Please Wait...");
  delay(1500);
  
  // Display system info
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Attendance Mgmt");
  lcd.setCursor(0, 1);
  lcd.print("System v1.0");
  delay(2000);
  Serial.println("LCD: Initialized successfully");

  // Buzzer init with error handling
  Serial.println("Initializing buzzer...");
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  // LED init with error handling - Blue LED ON, Red LED OFF
  Serial.println("Initializing LED indicator...");
  pinMode(BLUE_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  
  // Red LED - Keep OFF (not used)
  digitalWrite(RED_LED_PIN, LOW);
  
  // Blue LED - Turn ON immediately when power is on (power indicator)
  ledOn(); // Blue LED ON (steady) - will blink when WiFi connects
  Serial.println("Blue LED: Power indicator ON (system powered)");
  Serial.println("Red LED: OFF (disabled)");
  
  // Test buzzer
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Testing Devices");
  buzz(100, 0, 1); // Single beep to confirm buzzer works
  delay(300);
  Serial.println("Buzzer: Initialized successfully");

  // ===== Wi-Fi =====
  Serial.println("Connecting to WiFi...");
  Serial.print("SSID: ");
  Serial.println(WIFI_SSID);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  lcd.setCursor(0, 1);
  lcd.print(String(WIFI_SSID).substring(0, 16));
  
  // LED blinks during WiFi connection (shows system is working)
  // This will happen inside ensureWiFi function
  bool ok = ensureWiFi(30000);
  lcd.clear();
  
  if (ok) {
    lcd.setCursor(0, 0);
    lcd.print("WiFi: Connected");
    lcd.setCursor(0, 1);
    String ip = WiFi.localIP().toString();
    lcd.print(ip.length() > 16 ? ip.substring(0, 16) : ip);
    Serial.println("WiFi: Connection successful");
    wifiConnected = true; // Set WiFi connected status
    // LED will start blinking continuously in main loop (WiFi connected)
    buzz(50, 50, 2); // Success beeps
  } else {
    lcd.setCursor(0, 0);
    lcd.print("WiFi: Failed!");
    lcd.setCursor(0, 1);
    lcd.print("Check Config");
    Serial.println("ERROR: WiFi connection failed");
    Serial.println("Hint: Ensure 2.4GHz SSID, correct password, and proximity to router.");
    wifiConnected = false; // Set WiFi disconnected status
    digitalWrite(BLUE_LED_PIN, HIGH); // Blue LED ON (steady) when WiFi not connected
    digitalWrite(RED_LED_PIN, LOW);   // Red LED OFF
    buzz(200, 100, 3); // Error beeps
  }
  delay(2500);

  // Scanner init (UART2 → RX=16, TX=17)
  Serial.println("Initializing barcode scanner...");
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Init Scanner...");
  
  GM65Serial.begin(9600, SERIAL_8N1, 16, 17);
  delay(1000);
  
  // Error handling: Test scanner communication
  if (!GM65Serial) {
    Serial.println("ERROR: Scanner UART initialization failed");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Scanner Error");
    lcd.setCursor(0, 1);
    lcd.print("Check Wiring");
    buzz(200, 100, 3);
    delay(3000);
  } else {
    Serial.println("Scanner: Initialized successfully");
  }
  
  // Ready state with welcoming message
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Welcome!");
  lcd.setCursor(0, 1);
  lcd.print("Scan Your ID");
  // LED status depends on WiFi: ON if disconnected, will blink if connected (handled in loop)
  if (!wifiConnected) {
    digitalWrite(BLUE_LED_PIN, HIGH); // Blue LED ON (steady) when WiFi not connected
    digitalWrite(RED_LED_PIN, LOW);   // Red LED OFF
  }
  // If WiFi connected, LED will blink continuously in loop()
  
  // Show queue status if there are pending scans
  if (offlineQueueCount > 0) {
    Serial.print("⚠️  ");
    Serial.print(offlineQueueCount);
    Serial.println(" offline scans pending sync");
  }
  
  Serial.println("=== System Ready - Waiting for scans ===");
  Serial.println("💡 TIP: To clear offline queue, send 'CLEAR' via Serial Monitor\n");
}

void loop() {
  // Check for Serial commands (for debugging/maintenance)
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    cmd.toUpperCase();
    
    if (cmd == "CLEAR" || cmd == "CLEAR QUEUE") {
      Serial.println("\n🗑️  Clearing offline queue...");
      clearOfflineQueue();
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Queue Cleared!");
      lcd.setCursor(0, 1);
      lcd.print("All Data Removed");
      buzz(100, 100, 2);
      delay(2000);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Ready");
      lcd.setCursor(0, 1);
      lcd.print("Scan Your ID");
      Serial.println("✅ Queue cleared successfully\n");
    } else if (cmd == "STATUS" || cmd == "QUEUE") {
      Serial.println("\n📊 Queue Status:");
      Serial.print("   Count: ");
      Serial.println(offlineQueueCount);
      for (int i = 0; i < offlineQueueCount; i++) {
        Serial.print("   [");
        Serial.print(i);
        Serial.print("] ");
        Serial.print(offlineQueue[i].registrationNo);
        Serial.print(" - Retries: ");
        Serial.print(offlineQueue[i].retryCount);
        Serial.print(" - Processed: ");
        Serial.println(offlineQueue[i].processed ? "Yes" : "No");
      }
      Serial.println();
    } else if (cmd == "SYNC" || cmd == "SYNC NOW") {
      Serial.println("\n🔄 Forcing queue sync...");
      lastQueueProcessTime = 0; // Reset cooldown
      processOfflineQueue();
    } else if (cmd == "HELP") {
      Serial.println("\n📖 Available Commands:");
      Serial.println("   CLEAR - Clear offline queue");
      Serial.println("   STATUS - Show queue status");
      Serial.println("   SYNC - Force sync now");
      Serial.println("   HELP - Show this help\n");
    }
  }
  
  // Error handling: Check for scanner data
  if (GM65Serial.available()) {
    String scannedData = "";
    unsigned long readStart = millis();
    
    // Read all available data with timeout protection
    while (GM65Serial.available() && (millis() - readStart < 1000)) {
      char c = GM65Serial.read();
      if (c != '\n' && c != '\r' && c != 0) {
        scannedData += c;
      }
      delay(10); // Small delay to prevent buffer overflow
    }
    
    scannedData.trim(); // remove spaces, CRLF
    
    // Error handling: Validate scanned data
    if (scannedData.length() == 0) {
      Serial.println("WARNING: Empty scan data received");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Scan Failed");
      lcd.setCursor(0, 1);
      lcd.print("Please Try Again");
      buzz(100, 100, 1);
      delay(1500);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Ready");
      lcd.setCursor(0, 1);
      lcd.print("Scan Your ID");
      return;
    }
    
    // Error handling: Check data length
    if (scannedData.length() > 100) {
      Serial.println("ERROR: Scanned data too long (>100 chars)");
      Serial.print("Data: ");
      Serial.println(scannedData);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Invalid ID Card");
      lcd.setCursor(0, 1);
      lcd.print("Check Your Card");
      buzz(200, 100, 2);
      delay(2000);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Ready");
      lcd.setCursor(0, 1);
      lcd.print("Scan Your ID");
      return;
    }
    
    // Prevent duplicate scans within 3 seconds
    if (millis() - lastScanTime > 3000) {
      Serial.print("Scan received: ");
      Serial.println(scannedData);
      processID(scannedData);
      lastScanTime = millis();
    } else {
      Serial.println("WARNING: Duplicate scan ignored (within 3s cooldown)");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Please Wait...");
      lcd.setCursor(0, 1);
      lcd.print("Too Fast!");
      ledBlink(100, 100, 1); // Quick blink for warning
      buzz(50, 50, 1);
      delay(1000);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Ready");
      lcd.setCursor(0, 1);
      lcd.print("Scan Your ID");
      // LED will return to WiFi status (blink if connected, ON if not) in loop
    }
  }
  
  // LED Status Control: 
  //   - WiFi CONNECTED: Blue LED blinks continuously (500ms interval)
  //   - WiFi DISCONNECTED: Blue LED stays ON (steady) - NO blinking
  //   - Red LED: Always OFF (disabled)
  // This runs continuously in main loop and controls LED based on WiFi status
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    // WiFi is connected - blink Blue LED continuously
    if (millis() - lastLEDBlinkTime >= 500) {
      static bool ledState = false;
      ledState = !ledState;
      digitalWrite(BLUE_LED_PIN, ledState ? HIGH : LOW);
      lastLEDBlinkTime = millis();
    }
    // Ensure Red LED stays OFF
    digitalWrite(RED_LED_PIN, LOW);
  } else {
    // WiFi is NOT connected - Blue LED must stay ON (steady), absolutely NO blinking
    wifiConnected = false;
    digitalWrite(BLUE_LED_PIN, HIGH); // Force Blue LED ON immediately - no blinking allowed
    lastLEDBlinkTime = millis(); // Reset blink timer to prevent accidental blinking
    // Ensure Red LED stays OFF
    digitalWrite(RED_LED_PIN, LOW);
  }
  
  // Background WiFi keep-alive with error handling
  if (millis() - lastWiFiCheck > 5000) {
    lastWiFiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WARNING: WiFi disconnected, attempting reconnection...");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WiFi Lost");
      lcd.setCursor(0, 1);
      lcd.print("Reconnecting...");
      
      bool reconnected = ensureWiFi(15000);
      if (reconnected) {
        Serial.println("WiFi: Reconnected successfully");
        wifiConnected = true;
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("WiFi Restored");
        // LED will start blinking automatically in main loop (WiFi connected)
        buzz(50, 50, 2);
        delay(1500);
        
        // Process offline queue when WiFi is restored
        processOfflineQueue();
      } else {
        Serial.println("ERROR: WiFi reconnection failed");
        wifiConnected = false;
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("WiFi Failed");
        lcd.setCursor(0, 1);
        lcd.print("Check Network");
        digitalWrite(BLUE_LED_PIN, HIGH); // Blue LED ON (steady) when WiFi not connected
        digitalWrite(RED_LED_PIN, LOW);   // Red LED OFF
        buzz(200, 100, 2);
        delay(2000);
      }
      
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Ready");
      lcd.setCursor(0, 1);
      lcd.print("Scan Your ID");
      // LED will be controlled by WiFi status (blink if connected, ON if not)
    } else {
      // WiFi is connected - check if there are pending offline scans
      // Only process if cooldown period has passed (prevent recursive loop)
      if (offlineQueueCount > 0 && (millis() - lastQueueProcessTime >= QUEUE_PROCESS_INTERVAL)) {
        processOfflineQueue();
      }
    }
  }
}

// === ID Processing Function ===
void processID(String rawData) {
  Serial.println("\n--- Processing ID ---");
  Serial.print("Raw data: ");
  Serial.println(rawData);
  
  // Error handling: Validate input
  if (rawData.length() == 0) {
    Serial.println("ERROR: Empty raw data");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("No Data Found");
    lcd.setCursor(0, 1);
    lcd.print("Scan Again");
    ledBlink(200, 100, 2); // Red blinks for error
    buzz(200, 100, 2);
    delay(2000);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Ready");
      lcd.setCursor(0, 1);
      lcd.print("Scan Your ID");
      // LED will return to WiFi status (blink if connected, ON if not) in loop
      return;
  }
  
  // Clean the data - remove any unwanted characters
  String cleanData = cleanScannedData(rawData);
  
  // Error handling: Check if cleaning removed all data
  if (cleanData.length() == 0) {
    Serial.println("ERROR: No valid data after cleaning");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Invalid Format");
    lcd.setCursor(0, 1);
    lcd.print("Check ID Card");
    ledBlink(200, 100, 2); // Red blinks for invalid format
    buzz(200, 100, 2);
    delay(2500);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("System Ready!");
    lcd.setCursor(0, 1);
    lcd.print("Scan ID Card");
    ledOn(); // Keep LED ON as power indicator
    return;
  }
  
  Serial.print("Cleaned data: ");
  Serial.println(cleanData);

  // Show Scanned ID on LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ID Scanned:");
  lcd.setCursor(0, 1);
  
  String displayData = cleanData;
  if (displayData.length() > 16) {
    displayData = displayData.substring(0, 13) + "...";
  }
  lcd.print(displayData);
  ledBlink(100, 0, 1); // Quick LED flash for scan confirmation
  buzz(50, 0, 1); // Quick beep for scan confirmation
  delay(1500);

  // Show processing status
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Processing...");
  lcd.setCursor(0, 1);
  lcd.print("Please Wait");
  digitalWrite(BLUE_LED_PIN, HIGH); // Blue LED ON during processing
  digitalWrite(RED_LED_PIN, LOW);   // Red LED OFF

  // Check WiFi status before sending
  String statusMsg;
  if (WiFi.status() == WL_CONNECTED) {
    // WiFi available - send to server immediately (timestamp = 0 for live scans)
    statusMsg = sendScanToServer(cleanData, 0);
  } else {
    // WiFi not available - store in offline queue
    Serial.println("WiFi not available - storing scan offline");
    bool stored = addToOfflineQueue(cleanData, millis());
    
    if (stored) {
      statusMsg = "OK:Stored Offline";
      Serial.print("Scan stored offline. Queue size: ");
      Serial.println(offlineQueueCount);
    } else {
      statusMsg = "ERR:Queue Full";
      Serial.println("ERROR: Offline queue is full!");
    }
  }
  
  Serial.print("Server response: ");
  Serial.println(statusMsg);

  lcd.clear();
  // Stop processing indicator - LED will be controlled by status messages below
  if (statusMsg == "OK:Stored Offline") {
    // Stored offline - waiting for WiFi
    lcd.setCursor(0, 0);
    lcd.print("Saved Offline");
    lcd.setCursor(0, 1);
    lcd.print("Will Sync Later");
    Serial.print("Result: Stored offline (Queue: ");
    Serial.print(offlineQueueCount);
    Serial.println(")");
    ledBlink(100, 100, 3); // Medium blinks for offline storage
    buzz(100, 100, 2); // Two beeps for offline
    // LED will return to WiFi status (ON steady when disconnected) in loop
  } else if (statusMsg == "ERR:Queue Full") {
    // Queue is full - cannot store more
    lcd.setCursor(0, 0);
    lcd.print("Storage Full!");
    lcd.setCursor(0, 1);
    lcd.print("Try Again Later");
    Serial.println("Result: Offline queue full - cannot store");
    ledBlink(250, 150, 4); // Slow red blinks for error
    buzz(200, 150, 3);
    // LED will return to WiFi status in loop
  } else if (statusMsg.startsWith("DUP:")) {
    // Duplicate entry - already marked attendance
    String label = statusMsg.substring(4);
    lcd.setCursor(0, 0);
    lcd.print("Already Marked!");
    lcd.setCursor(0, 1);
    lcd.print("Thank You");
    Serial.println("Result: Duplicate entry - " + label);
    ledBlink(150, 150, 2); // Medium yellow blinks for duplicate
    buzz(100, 100, 2); // Two short beeps for duplicate
    // LED will return to WiFi status (blink if connected, ON if not) in loop
  } else if (statusMsg.startsWith("OK:")) {
    // Success - attendance marked
    String label = statusMsg.substring(3);
    logAttendance(cleanData);
    lcd.setCursor(0, 0);
    lcd.print("Attendance Done");
    lcd.setCursor(0, 1);
    
    // Display meaningful status for common people
    if (label == "present") {
      lcd.print("Welcome!");
    } else if (label == "late") {
      lcd.print("You Are Late");
    } else if (label.indexOf("present") >= 0 || label.indexOf("Present") >= 0) {
      lcd.print("Welcome!");
    } else if (label.indexOf("late") >= 0 || label.indexOf("Late") >= 0) {
      lcd.print("You Are Late");
    } else if (label.length() > 16) {
      lcd.print(label.substring(0, 16));
    } else {
      lcd.print(label);
    }
    
    Serial.println("Result: Success - " + label);
    ledBlink(80, 50, 5); // Fast green blinks for success
    buzz(80, 80, 3); // Three beeps for success
    // LED will return to WiFi status (blink if connected, ON if not) in loop
  } else if (statusMsg.startsWith("ERR:")) {
    // Error occurred - show user-friendly messages
    String errText = statusMsg.substring(4);
    
    // Check for specific error messages and make them user-friendly
    if (errText.indexOf("No active") >= 0 || errText.indexOf("no active") >= 0 || 
        errText.indexOf("session") >= 0 || errText.indexOf("Session") >= 0) {
      // No active session error
      lcd.setCursor(0, 0);
      lcd.print("No Class Today");
      lcd.setCursor(0, 1);
      lcd.print("Contact Teacher");
      Serial.println("Result: No active session found");
      ledBlink(200, 200, 3); // Slow red blinks for error
      buzz(150, 100, 2);
      // LED will return to WiFi status (blink if connected, ON if not) in loop
    } else if (errText.indexOf("Student not") >= 0 || errText.indexOf("not found") >= 0 || 
               errText.indexOf("Invalid") >= 0 || errText.indexOf("invalid") >= 0) {
      // Student not found or invalid ID
      lcd.setCursor(0, 0);
      lcd.print("ID Not Found");
      lcd.setCursor(0, 1);
      lcd.print("Check Your ID");
      Serial.println("Result: Student not found - " + errText);
      ledBlink(250, 150, 4); // Slow red blinks for invalid ID
      buzz(200, 150, 3);
      // LED will return to WiFi status (blink if connected, ON if not) in loop
    } else if (errText.indexOf("WiFi") >= 0 || errText.indexOf("Network") >= 0 || 
               errText.indexOf("Connection") >= 0 || errText.indexOf("Timeout") >= 0) {
      // Network related errors
      lcd.setCursor(0, 0);
      lcd.print("Network Error");
      lcd.setCursor(0, 1);
      lcd.print("Try Again");
      Serial.println("Result: Network error - " + errText);
      ledBlink(200, 200, 3); // Slow red blinks for network error
      buzz(200, 150, 2);
      // LED will return to WiFi status (blink if connected, ON if not) in loop
    } else if (errText.indexOf("Server") >= 0 || errText.indexOf("Unavailable") >= 0) {
      // Server errors
      lcd.setCursor(0, 0);
      lcd.print("No active ");
      lcd.setCursor(0, 1);
      lcd.print("session found");
      Serial.println("Result: Server error - " + errText);
      ledBlink(200, 200, 3); // Slow red blinks for server error
      buzz(200, 150, 2);
      // LED will return to WiFi status (blink if connected, ON if not) in loop
    } else {
      // Generic error - show simplified message
      lcd.setCursor(0, 0);
      lcd.print("Error Occurred");
      lcd.setCursor(0, 1);
      lcd.print("Contact Admin");
      Serial.println("Result: Error - " + errText);
      ledBlink(250, 150, 4); // Slow red blinks for generic error
      buzz(200, 150, 3);
      // LED will return to WiFi status (blink if connected, ON if not) in loop
    }
  } else {
    // Unknown response format
    lcd.setCursor(0, 0);
    lcd.print("System Error");
    lcd.setCursor(0, 1);
    lcd.print("Contact Admin");
    Serial.println("ERROR: Unknown response format - " + statusMsg);
    ledBlink(250, 150, 5); // Slow red blinks for system error
    buzz(200, 150, 3);
    // LED will return to WiFi status (blink if connected, ON if not) in loop
  }

  delay(3500);

  // Reset to ready state with user-friendly message
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Ready");
  lcd.setCursor(0, 1);
  lcd.print("Scan Your ID");
  // Restore LED to WiFi status: blink if connected, ON if disconnected (handled in loop)
  // LED will be controlled by WiFi status in main loop
  Serial.println("--- Ready for next scan ---\n");
}

// === Data Cleaning Function ===
String cleanScannedData(String rawData) {
  // Error handling: Check for null/empty input
  if (rawData.length() == 0) {
    Serial.println("ERROR: cleanScannedData received empty string");
    return String("");
  }
  
  String cleaned = "";
  int validChars = 0;
  
  for (int i = 0; i < rawData.length(); i++) {
    char c = rawData.charAt(i);
    // Keep only alphanumeric characters, forward slashes, and common symbols
    if (isalnum(c) || c == '/' || c == '-' || c == '_' || c == '.') {
      cleaned += c;
      validChars++;
    }
  }
  
  // Error handling: Log if significant data was removed
  if (validChars < rawData.length() / 2) {
    Serial.print("WARNING: Significant data removed during cleaning. Original: ");
    Serial.print(rawData.length());
    Serial.print(" chars, Cleaned: ");
    Serial.print(validChars);
    Serial.println(" chars");
  }
  
  return cleaned;
}

// === Attendance Logging Function ===
void logAttendance(String studentID) {
  // Error handling: Validate input
  if (studentID.length() == 0) {
    Serial.println("ERROR: Cannot log empty student ID");
    return;
  }
  
  // Error handling: Check buffer capacity
  if (attendanceCount >= 50) {
    Serial.println("WARNING: Attendance log buffer full (50/50)");
    // Shift array to make room (remove oldest entry)
    for (int i = 0; i < 49; i++) {
      attendanceLog[i] = attendanceLog[i + 1];
    }
    attendanceCount = 49;
  }
  
  String timestamp = String(millis() / 1000); // Simple timestamp in seconds
  attendanceLog[attendanceCount] = studentID + " @ " + timestamp + "s";
  attendanceCount++;
  
  Serial.print("Logged attendance: ");
  Serial.print(studentID);
  Serial.print(" (Total: ");
  Serial.print(attendanceCount);
  Serial.println(")");
}

// === Backend POST helper ===
String sendScanToServer(String registrationNo, unsigned long timestamp) {
  Serial.println("Sending scan to server...");
  if (timestamp > 0) {
    Serial.print("📤 OFFLINE SYNC - Original scan time: ");
    Serial.print(timestamp);
    Serial.println("ms");
  } else {
    Serial.println("📡 LIVE SCAN");
  }
  
  // Error handling: Validate input
  if (registrationNo.length() == 0) {
    Serial.println("ERROR: Empty registration number");
    return String("ERR:No ID Data");
  }
  
  // Error handling: Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WARNING: WiFi not connected, attempting reconnection...");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Lost");
    lcd.setCursor(0, 1);
    lcd.print("Reconnecting...");
    
    bool ok = ensureWiFi(15000);
    if (!ok) {
      Serial.println("ERROR: WiFi reconnection failed");
      return String("ERR:No WiFi");
    }
    Serial.println("WiFi reconnected successfully");
  }

  WiFiClientSecure client;
  HTTPClient http;
  
  // Error handling: Validate API configuration
  if (strlen(API_BASE) == 0) {
    Serial.println("ERROR: API_BASE not configured");
    return String("ERR:No API Config");
  }
  
  if (strlen(DEVICE_KEY) == 0) {
    Serial.println("WARNING: DEVICE_KEY not configured");
  }
  
  // Use HTTPS with certificate validation disabled for ESP32 (use with caution in production)
  client.setInsecure(); // Skip certificate validation
  
  String url = String(API_BASE) + String(SCAN_ENDPOINT);
  
  http.setTimeout(10000); // 10 second timeout
  http.setReuse(true); // Reuse connection for efficiency
  
  // Error handling: Check if HTTP client initialization succeeds
  bool began = http.begin(client, url);
  if (!began) {
    Serial.println("ERROR: HTTP client initialization failed");
    Serial.print("URL: ");
    Serial.println(url);
    return String("ERR:HTTP Init Fail");
  }
  
  // Set headers
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  // Build JSON body with optional timestamp for offline scans
  String body;
  if (timestamp > 0) {
    // For offline scans, send millis() timestamp
    // Backend will detect this and use current date for the scan
    // This allows offline scans to be processed even if they're from yesterday
    body = String("{\"registrationNo\":\"") + registrationNo + 
           String("\",\"timestamp\":") + String(timestamp) + 
           String(",\"offline\":true}");
  } else {
    // Live scan - no timestamp
    body = String("{\"registrationNo\":\"") + registrationNo + String("\"}");
  }

  Serial.print("POST URL: ");
  Serial.println(url);
  Serial.print("Request Body: ");
  Serial.println(body);
  Serial.print("Device Key: ");
  Serial.println(DEVICE_KEY);

  // Send POST request
  int code = http.POST(body);
  String resp = http.getString();
  http.end();

  Serial.print("HTTP Status Code: ");
  Serial.println(code);
  Serial.print("Response Body: ");
  Serial.println(resp);

  // Error handling: Check for empty response
  if (resp.length() == 0 && code > 0) {
    Serial.println("WARNING: Empty response from server");
    return String("ERR:Empty Response");
  }

  // Handle successful response (2xx)
  if (code == 200 || code == 201) {
    // Parse the JSON response properly
    int successPos = resp.indexOf("\"success\":true");
    if (successPos >= 0) {
      Serial.println("Server returned success:true");
      
      // First try to get the message field (preferred)
      int messageKey = resp.indexOf("\"message\":");
      String message = "";
      if (messageKey >= 0) {
        int q1 = resp.indexOf('"', messageKey + 10);
        int q2 = resp.indexOf('"', q1 + 1);
        if (q1 >= 0 && q2 > q1) {
          message = resp.substring(q1 + 1, q2);
        }
      }
      
      // Look for status in the data object (fallback)
      int statusKey = resp.indexOf("\"status\":");
      String status = "";
      if (statusKey >= 0) {
        int q1 = resp.indexOf('"', statusKey + 9);
        int q2 = resp.indexOf('"', q1 + 1);
        if (q1 >= 0 && q2 > q1) {
          status = resp.substring(q1 + 1, q2);
        }
      }
      
      // Check for duplicate
      int dupKey = resp.indexOf("\"duplicate\":");
      bool duplicate = false;
      if (dupKey >= 0) {
        int tPos = resp.indexOf("true", dupKey);
        if (tPos > dupKey && tPos < dupKey + 20) duplicate = true;
      }
      
      // Use message if available, otherwise use status
      String displayText = message.length() > 0 ? message : (status.length() > 0 ? status : "Marked");
      
      if (duplicate) {
        Serial.println("Result: Duplicate entry detected");
        return String("DUP:") + displayText;
      } else {
        Serial.println("Result: Attendance marked successfully");
        return String("OK:") + displayText;
      }
    } else {
      // success:false - extract error message
      Serial.println("Server returned success:false");
      String errorMsg = extractErrorMessage(resp);
      if (errorMsg.length() > 0) {
        return String("ERR:") + errorMsg;
      }
      return String("ERR:Request Failed");
    }
  } 
  // Handle redirects (301, 302, 307, 308)
  else if (code == 301 || code == 302 || code == 307 || code == 308) {
    Serial.println("ERROR: Server returned redirect - check API_BASE URL");
    return String("ERR:Wrong URL");
  }
  // Handle client errors (4xx)
  else if (code >= 400 && code < 500) {
    Serial.print("ERROR: Client error ");
    Serial.println(code);
    
    String errorMsg = extractErrorMessage(resp);
    if (errorMsg.length() > 0) {
      return String("ERR:") + errorMsg;
    }
    
    if (code == 400) return String("ERR:Bad Request");
    if (code == 401) return String("ERR:Unauthorized");
    if (code == 403) return String("ERR:Forbidden");
    if (code == 404) return String("ERR:Not Found");
    if (code == 409) return String("ERR:Conflict");
    return String("ERR:Error ") + String(code);
  }
  // Handle server errors (5xx)
  else if (code >= 500) {
    Serial.print("ERROR: Server error ");
    Serial.println(code);
    if (code == 500) return String("ERR:Server Error");
    if (code == 502) return String("ERR:Bad Gateway");
    if (code == 503) return String("ERR:Unavailable");
    if (code == 504) return String("ERR:Timeout");
    return String("ERR:Server ") + String(code);
  }
  // Handle connection errors (ESP32 HTTPClient error codes)
  else if (code < 0) {
    Serial.print("ERROR: Connection error code ");
    Serial.println(code);
    
    // ESP32 HTTPClient error codes
    if (code == HTTPC_ERROR_CONNECTION_REFUSED) return String("ERR:Conn Refused");
    if (code == HTTPC_ERROR_CONNECTION_LOST) return String("ERR:Conn Lost");
    if (code == HTTPC_ERROR_READ_TIMEOUT) return String("ERR:Timeout");
    if (code == HTTPC_ERROR_NO_HTTP_SERVER) return String("ERR:No Server");
    if (code == HTTPC_ERROR_NO_STREAM) return String("ERR:No Stream");
    if (code == HTTPC_ERROR_TOO_LESS_RAM) return String("ERR:Low Memory");
    if (code == HTTPC_ERROR_ENCODING) return String("ERR:Encoding");
    if (code == HTTPC_ERROR_STREAM_WRITE) return String("ERR:Write Error");
    
    // Generic errors
    if (code == -1) return String("ERR:Timeout");
    if (code == -11) return String("ERR:DNS Failed");
    
    return String("ERR:Net ") + String(code);
  }
  // Unknown error
  else {
    Serial.print("ERROR: Unknown HTTP code ");
    Serial.println(code);
    return String("ERR:Unknown ") + String(code);
  }
}

// === Extract Error Message from JSON ===
String extractErrorMessage(String json) {
  // Error handling: Check for empty JSON
  if (json.length() == 0) {
    Serial.println("ERROR: extractErrorMessage received empty JSON");
    return String("");
  }
  
  Serial.println("Extracting error message from JSON...");
  
  // Try to find "message" field
  int msgKey = json.indexOf("\"message\":");
  if (msgKey >= 0) {
    int q1 = json.indexOf('"', msgKey + 10);
    int q2 = json.indexOf('"', q1 + 1);
    if (q1 >= 0 && q2 > q1) {
      String msg = json.substring(q1 + 1, q2);
      Serial.print("Found message field: ");
      Serial.println(msg);
      
      // Limit message length for LCD (max 16 chars for single line)
      if (msg.length() > 16) {
        msg = msg.substring(0, 13) + "...";
      }
      return msg;
    }
  }
  
  // Try to find "error" field
  int errKey = json.indexOf("\"error\":");
  if (errKey >= 0) {
    int q1 = json.indexOf('"', errKey + 8);
    int q2 = json.indexOf('"', q1 + 1);
    if (q1 >= 0 && q2 > q1) {
      String err = json.substring(q1 + 1, q2);
      Serial.print("Found error field: ");
      Serial.println(err);
      
      if (err.length() > 16) {
        err = err.substring(0, 13) + "...";
      }
      return err;
    }
  }
  
  Serial.println("No error message found in JSON");
  return String("");
}

// ===== Offline Queue Management Functions =====

// Add scan to offline queue
bool addToOfflineQueue(String registrationNo, unsigned long timestamp) {
  // Check if queue is full
  if (offlineQueueCount >= MAX_OFFLINE_QUEUE) {
    Serial.println("ERROR: Offline queue is full!");
    return false;
  }
  
  // Check for duplicate in queue (prevent same ID within 5 seconds)
  for (int i = 0; i < offlineQueueCount; i++) {
    if (offlineQueue[i].registrationNo == registrationNo && 
        !offlineQueue[i].processed &&
        (timestamp - offlineQueue[i].timestamp) < 5000) {
      Serial.println("WARNING: Duplicate scan in offline queue (within 5s)");
      return false;
    }
  }
  
  // Add to queue
  offlineQueue[offlineQueueCount].registrationNo = registrationNo;
  offlineQueue[offlineQueueCount].timestamp = timestamp;
  offlineQueue[offlineQueueCount].processed = false;
  offlineQueue[offlineQueueCount].retryCount = 0;
  offlineQueueCount++;
  
  // Save to persistent storage
  saveOfflineQueue();
  
  Serial.print("Added to offline queue: ");
  Serial.print(registrationNo);
  Serial.print(" at ");
  Serial.println(timestamp);
  
  return true;
}

// Process offline queue when WiFi is available
void processOfflineQueue() {
  if (offlineQueueCount == 0) {
    return;  // Nothing to process
  }
  
  // Prevent processing too frequently (avoid recursive loop)
  if (millis() - lastQueueProcessTime < QUEUE_PROCESS_INTERVAL) {
    Serial.println("⏳ Queue processing cooldown active, skipping...");
    return;
  }
  
  lastQueueProcessTime = millis();
  
  Serial.println("\n=== Processing Offline Queue ===");
  Serial.print("Queue size: ");
  Serial.println(offlineQueueCount);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Syncing Data...");
  lcd.setCursor(0, 1);
  lcd.print("Please Wait");
  
  int successCount = 0;
  int failCount = 0;
  
  // Process each unprocessed scan
  for (int i = 0; i < offlineQueueCount; i++) {
    if (offlineQueue[i].processed) {
      continue;  // Skip already processed
    }
    
    // Check WiFi before each attempt
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi lost during queue processing");
      break;
    }
    
    Serial.print("Processing offline scan ");
    Serial.print(i + 1);
    Serial.print("/");
    Serial.print(offlineQueueCount);
    Serial.print(": ");
    Serial.println(offlineQueue[i].registrationNo);
    
    lcd.setCursor(0, 1);
    lcd.print("Sync ");
    lcd.print(i + 1);
    lcd.print("/");
    lcd.print(offlineQueueCount);
    lcd.print("     ");
    
    // Send to server with original timestamp
    String statusMsg = sendScanToServer(offlineQueue[i].registrationNo, offlineQueue[i].timestamp);
    
    // Increment retry count
    offlineQueue[i].retryCount++;
    
    // Check result
    if (statusMsg.startsWith("OK:") || statusMsg.startsWith("DUP:")) {
      // Success or duplicate (both are acceptable)
      offlineQueue[i].processed = true;
      successCount++;
      Serial.println("✓ Offline scan processed successfully");
    } else {
      // Failed - check if we should retry or give up
      failCount++;
      Serial.print("✗ Offline scan failed (attempt ");
      Serial.print(offlineQueue[i].retryCount);
      Serial.print("/");
      Serial.print(MAX_RETRY_ATTEMPTS);
      Serial.print("): ");
      Serial.println(statusMsg);
      
      // Show error on LCD briefly (only on first failure)
      if (offlineQueue[i].retryCount == 1) {
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Sync Failed:");
        lcd.setCursor(0, 1);
        String errMsg = statusMsg.substring(4); // Remove "ERR:" prefix
        if (errMsg.length() > 16) {
          lcd.print(errMsg.substring(0, 16));
        } else {
          lcd.print(errMsg);
        }
        delay(1500);
      }
      
      // Check if we should give up on this scan
      bool shouldGiveUp = false;
      
      // Give up if max retries reached
      if (offlineQueue[i].retryCount >= MAX_RETRY_ATTEMPTS) {
        Serial.println("⚠️  Max retries reached, giving up on this scan");
        shouldGiveUp = true;
      }
      
      // Give up immediately for certain errors (no point retrying)
      if (statusMsg.indexOf("No session") >= 0 || 
          statusMsg.indexOf("No active") >= 0 ||
          statusMsg.indexOf("No Class") >= 0 ||
          statusMsg.indexOf("Session ended") >= 0 ||
          statusMsg.indexOf("not found") >= 0 ||
          statusMsg.indexOf("Not Found") >= 0 ||
          statusMsg.indexOf("ID") >= 0) {
        Serial.println("⚠️  Permanent error detected, giving up on this scan");
        shouldGiveUp = true;
      }
      
      if (shouldGiveUp) {
        offlineQueue[i].processed = true;
        successCount++; // Count as "success" to remove from queue
        failCount--; // Don't count as failure
      }
    }
    
    delay(500);  // Small delay between requests
  }
  
  // Remove processed scans from queue
  compactOfflineQueue();
  
  // Save updated queue
  saveOfflineQueue();
  
  // Show result
  Serial.println("=== Queue Processing Complete ===");
  Serial.print("Success: ");
  Serial.print(successCount);
  Serial.print(", Failed: ");
  Serial.print(failCount);
  Serial.print(", Remaining: ");
  Serial.println(offlineQueueCount);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  if (offlineQueueCount == 0) {
    lcd.print("Sync Complete!");
    lcd.setCursor(0, 1);
    lcd.print("All Data Sent");
    buzz(80, 80, 2);
  } else {
    lcd.print("Partial Sync");
    lcd.setCursor(0, 1);
    lcd.print(offlineQueueCount);
    lcd.print(" Pending");
    buzz(150, 100, 1);
  }
  
  delay(2000);
}

// Remove processed scans from queue
void compactOfflineQueue() {
  int writeIndex = 0;
  
  for (int readIndex = 0; readIndex < offlineQueueCount; readIndex++) {
    if (!offlineQueue[readIndex].processed) {
      // Keep unprocessed scans
      if (writeIndex != readIndex) {
        offlineQueue[writeIndex] = offlineQueue[readIndex];
      }
      writeIndex++;
    }
  }
  
  offlineQueueCount = writeIndex;
  Serial.print("Queue compacted. New size: ");
  Serial.println(offlineQueueCount);
}

// Save offline queue to persistent storage (survives power loss)
void saveOfflineQueue() {
  preferences.putInt("queueCount", offlineQueueCount);
  
  for (int i = 0; i < offlineQueueCount; i++) {
    String keyReg = "reg" + String(i);
    String keyTime = "time" + String(i);
    String keyProc = "proc" + String(i);
    String keyRetry = "retry" + String(i);
    
    preferences.putString(keyReg.c_str(), offlineQueue[i].registrationNo);
    preferences.putULong(keyTime.c_str(), offlineQueue[i].timestamp);
    preferences.putBool(keyProc.c_str(), offlineQueue[i].processed);
    preferences.putInt(keyRetry.c_str(), offlineQueue[i].retryCount);
  }
  
  Serial.println("Offline queue saved to storage");
}

// Load offline queue from persistent storage
void loadOfflineQueue() {
  offlineQueueCount = preferences.getInt("queueCount", 0);
  
  // Validate queue count
  if (offlineQueueCount > MAX_OFFLINE_QUEUE) {
    Serial.println("WARNING: Stored queue count exceeds max, resetting");
    offlineQueueCount = 0;
    return;
  }
  
  for (int i = 0; i < offlineQueueCount; i++) {
    String keyReg = "reg" + String(i);
    String keyTime = "time" + String(i);
    String keyProc = "proc" + String(i);
    String keyRetry = "retry" + String(i);
    
    offlineQueue[i].registrationNo = preferences.getString(keyReg.c_str(), "");
    offlineQueue[i].timestamp = preferences.getULong(keyTime.c_str(), 0);
    offlineQueue[i].processed = preferences.getBool(keyProc.c_str(), false);
    offlineQueue[i].retryCount = preferences.getInt(keyRetry.c_str(), 0);
    
    // Validate loaded data
    if (offlineQueue[i].registrationNo.length() == 0) {
      Serial.print("WARNING: Invalid data at queue index ");
      Serial.println(i);
      offlineQueueCount = i;  // Truncate queue at invalid entry
      break;
    }
  }
  
  Serial.print("Loaded ");
  Serial.print(offlineQueueCount);
  Serial.println(" scans from storage");
}

// Clear all offline queue data (for maintenance/debugging)
void clearOfflineQueue() {
  offlineQueueCount = 0;
  preferences.clear();
  Serial.println("Offline queue cleared");
}

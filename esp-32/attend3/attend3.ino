#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>

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
const char* WIFI_SSID = "Raj-Kenu";
const char* WIFI_PASSWORD = "prolink12345";
const char* API_BASE = "http://192.168.1.11:5000";
const char* DEVICE_KEY = "esp32-dev-key";      // auto-created on backend startup

// Endpoint path
const char* SCAN_ENDPOINT = "/api/scans/ingest";

// Attendance tracking (local buffer for debug/log display)
String attendanceLog[50]; // Store up to 50 attendance records
int attendanceCount = 0;
unsigned long lastScanTime = 0;
unsigned long lastWiFiCheck = 0;

// ===== Buzzer (Active buzzer recommended) =====//18
#define BUZZER_PIN 25

void buzz(uint16_t onMs, uint16_t offMs, uint8_t repeats) {
  for (uint8_t i = 0; i < repeats; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(onMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (i + 1 < repeats) delay(offMs);
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
  if (WiFi.status() == WL_CONNECTED) return true;

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
  while ((millis() - start) < timeoutMs) {
    res = WiFi.status();
    if (res == WL_CONNECTED) break;
    delay(250);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    printWiFiStatus("Connected");
    return true;
  }

  // On failure, scan and print nearby SSIDs for debugging
  Serial.println("\nWiFi connect failed, scanning networks...");
  int n = WiFi.scanNetworks(true /* async */, true /* show hidden */);
  unsigned long scanStart = millis();
  while (n == WIFI_SCAN_RUNNING && millis() - scanStart < 8000) {
    delay(200);
    n = WiFi.scanComplete();
  }
  if (n <= 0) {
    Serial.println("No networks found");
  } else {
    for (int i = 0; i < n; i++) {
      Serial.print(i + 1);
      Serial.print(") ");
      Serial.print(WiFi.SSID(i));
      Serial.print("  RSSI:");
      Serial.print(WiFi.RSSI(i));
      Serial.print("  ENC:");
      Serial.println(WiFi.encryptionType(i));
    }
  }
  return false;
}

void setup() {
  // Debugging Serial
  Serial.begin(115200);
  delay(1000); // Wait for serial to initialize
  
  // LCD init with error handling
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Attendance Sys");
  lcd.setCursor(0, 1);
  lcd.print("Ready to Scan");
  delay(2000);

  // Buzzer init
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // ===== Wi-Fi =====
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connecting");
  bool ok = ensureWiFi(30000);
  lcd.clear();
  if (ok) {
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
  } else {
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed");
    Serial.println("Hint: Ensure 2.4GHz SSID, correct password, and proximity to router.");
  }
  delay(1500);

  // Scanner init (UART2 → RX=16, TX=17)
  GM65Serial.begin(9600, SERIAL_8N1, 16, 17);
  delay(1000);
  
  // Test scanner connection
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scanner Ready");
  lcd.setCursor(0, 1);
  lcd.print("Scan Student ID");
}

void loop() {
  // Check for scanner data
  if (GM65Serial.available()) {
    String scannedData = "";
    
    // Read all available data
    while (GM65Serial.available()) {
      char c = GM65Serial.read();
      if (c != '\n' && c != '\r' && c != 0) {
        scannedData += c;
      }
      delay(10); // Small delay to prevent buffer overflow
    }
    
    scannedData.trim(); // remove spaces, CRLF
    
    if (scannedData.length() > 0) {
      // Prevent duplicate scans within 3 seconds
      if (millis() - lastScanTime > 3000) {
        processID(scannedData);
        lastScanTime = millis();
      }
    }
  }
  
  // Background WiFi keep-alive
  if (millis() - lastWiFiCheck > 5000) {
    lastWiFiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      ensureWiFi(15000);
    }
  }
}

// === ID Processing Function ===
void processID(String rawData) {
  // Clean the data - remove any unwanted characters
  String cleanData = cleanScannedData(rawData);

  // Show Scanned ID on LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Scanned:");
  lcd.setCursor(0, 1);
  
  String displayData = cleanData;
  if (displayData.length() > 16) {
    displayData = displayData.substring(0, 16);
  }
  lcd.print(displayData);
  delay(2000);

  // Send to backend for validation and attendance save
  String statusMsg = sendScanToServer(cleanData);

  lcd.clear();
  if (statusMsg.startsWith("DUP:")) {
    String label = statusMsg.substring(4);
    lcd.setCursor(0, 0);
    lcd.print("Already Entered");
    lcd.setCursor(0, 1);
    lcd.print(label + String(" (dup)"));
    Serial.println("SERVER DUP: " + label);
    buzz(20, 40, 1); // short single beep for duplicate
  } else if (statusMsg.startsWith("OK:")) {
    // Example: OK:present or OK:late
    String label = statusMsg.substring(3);
    logAttendance(cleanData);
    lcd.setCursor(0, 0);
    lcd.print("Allowed (" + label + ")");
    lcd.setCursor(0, 1);
    lcd.print("Attendance Saved");
    Serial.println("SERVER OK: " + label);
    buzz(60, 60, 2); // double short beep for success
  } else {
    // Error message
    lcd.setCursor(0, 0);
    lcd.print("Denied");
    lcd.setCursor(0, 1);
    String err = statusMsg.length() > 16 ? statusMsg.substring(0, 16) : statusMsg;
    lcd.print(err);
    Serial.println("SERVER ERR: " + statusMsg);
    buzz(200, 100, 2); // error tone
  }

  delay(3000);

  // Reset message
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Attendance Sys");
  lcd.setCursor(0, 1);
  lcd.print("Scan Next ID");
}

// === Data Cleaning Function ===
String cleanScannedData(String rawData) {
  String cleaned = "";
  for (int i = 0; i < rawData.length(); i++) {
    char c = rawData.charAt(i);
    // Keep only alphanumeric characters, forward slashes, and common symbols
    if (isalnum(c) || c == '/' || c == '-' || c == '_' || c == '.') {
      cleaned += c;
    }
  }
  return cleaned;
}

// === Attendance Logging Function ===
void logAttendance(String studentID) {
  if (attendanceCount < 50) {
    String timestamp = String(millis() / 1000); // Simple timestamp
    attendanceLog[attendanceCount] = studentID + " - " + timestamp;
    attendanceCount++;
  }
}


// === Backend POST helper ===
// === Backend POST helper ===
String sendScanToServer(String registrationNo) {
  if (WiFi.status() != WL_CONNECTED) {
    bool ok = ensureWiFi(15000);
    if (!ok) return String("WiFi not connected");
  }

  WiFiClient client;
  HTTPClient http;
  String url = String(API_BASE) + String(SCAN_ENDPOINT);
  http.setTimeout(8000);
  bool began = http.begin(client, url);
  if (!began) {
    return String("Begin failed");
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  String body = String("{\"registrationNo\":\"") + registrationNo + String("\"}");

  int code = http.POST(body);
  String resp = http.getString();
  http.end();

  Serial.print("HTTP Code: ");
  Serial.println(code);
  Serial.print("Response: ");
  Serial.println(resp);

  if (code == 200) {
    // Parse the JSON response properly
    int successPos = resp.indexOf("\"success\":true");
    if (successPos >= 0) {
      // Look for status in the data object
      int statusKey = resp.indexOf("\"status\":");
      if (statusKey >= 0) {
        int q1 = resp.indexOf('"', statusKey + 9);
        int q2 = resp.indexOf('"', q1 + 1);
        if (q1 >= 0 && q2 > q1) {
          String status = resp.substring(q1 + 1, q2);
          
          // Check for duplicate
          int dupKey = resp.indexOf("\"duplicate\":");
          bool duplicate = false;
          if (dupKey >= 0) {
            int tPos = resp.indexOf("true", dupKey);
            if (tPos > dupKey) duplicate = true;
          }
          
          return duplicate ? String("DUP:") + status : String("OK:") + status;
        }
      }
      return String("OK:present"); // fallback
    } else {
      // success:false - extract error message
      int msgKey = resp.indexOf("\"message\":");
      if (msgKey >= 0) {
        int q1 = resp.indexOf('"', msgKey + 10);
        int q2 = resp.indexOf('"', q1 + 1);
        if (q1 >= 0 && q2 > q1) {
          return resp.substring(q1 + 1, q2);
        }
      }
      return String("Server error");
    }
  } else if (code > 0) {
    return String("HTTP ") + String(code);
  } else {
    return String("HTTP Error ") + String(code);
  }
}

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

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

// ===== Buzzer (Active buzzer recommended) =====//18
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
  
  // Test buzzer
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Testing Buzzer");
  buzz(100, 0, 1); // Single beep to confirm buzzer works
  delay(500);
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
  
  bool ok = ensureWiFi(30000);
  lcd.clear();
  
  if (ok) {
    lcd.setCursor(0, 0);
    lcd.print("WiFi: Connected");
    lcd.setCursor(0, 1);
    String ip = WiFi.localIP().toString();
    lcd.print(ip.length() > 16 ? ip.substring(0, 16) : ip);
    Serial.println("WiFi: Connection successful");
    buzz(50, 50, 2); // Success beeps
  } else {
    lcd.setCursor(0, 0);
    lcd.print("WiFi: Failed!");
    lcd.setCursor(0, 1);
    lcd.print("Check Config");
    Serial.println("ERROR: WiFi connection failed");
    Serial.println("Hint: Ensure 2.4GHz SSID, correct password, and proximity to router.");
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
  Serial.println("=== System Ready - Waiting for scans ===\n");
}

void loop() {
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
      buzz(50, 50, 1);
      delay(1000);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Ready");
      lcd.setCursor(0, 1);
      lcd.print("Scan Your ID");
    }
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
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("WiFi Restored");
        buzz(50, 50, 2);
        delay(1500);
      } else {
        Serial.println("ERROR: WiFi reconnection failed");
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("WiFi Failed");
        lcd.setCursor(0, 1);
        lcd.print("Check Network");
        buzz(200, 100, 2);
        delay(2000);
      }
      
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Ready");
      lcd.setCursor(0, 1);
      lcd.print("Scan Your ID");
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
    buzz(200, 100, 2);
    delay(2000);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Ready");
    lcd.setCursor(0, 1);
    lcd.print("Scan Your ID");
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
    buzz(200, 100, 2);
    delay(2500);
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("System Ready!");
    lcd.setCursor(0, 1);
    lcd.print("Scan ID Card");
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
  buzz(50, 0, 1); // Quick beep for scan confirmation
  delay(1500);

  // Show processing status
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Processing...");
  lcd.setCursor(0, 1);
  lcd.print("Please Wait");

  // Send to backend for validation and attendance save
  String statusMsg = sendScanToServer(cleanData);
  
  Serial.print("Server response: ");
  Serial.println(statusMsg);

  lcd.clear();
  if (statusMsg.startsWith("DUP:")) {
    // Duplicate entry - already marked attendance
    String label = statusMsg.substring(4);
    lcd.setCursor(0, 0);
    lcd.print("Already Marked!");
    lcd.setCursor(0, 1);
    lcd.print("Thank You");
    Serial.println("Result: Duplicate entry - " + label);
    buzz(100, 100, 2); // Two short beeps for duplicate
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
    buzz(80, 80, 3); // Three beeps for success
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
      buzz(150, 100, 2);
    } else if (errText.indexOf("Student not") >= 0 || errText.indexOf("not found") >= 0 || 
               errText.indexOf("Invalid") >= 0 || errText.indexOf("invalid") >= 0) {
      // Student not found or invalid ID
      lcd.setCursor(0, 0);
      lcd.print("ID Not Found");
      lcd.setCursor(0, 1);
      lcd.print("Check Your ID");
      Serial.println("Result: Student not found - " + errText);
      buzz(200, 150, 3);
    } else if (errText.indexOf("WiFi") >= 0 || errText.indexOf("Network") >= 0 || 
               errText.indexOf("Connection") >= 0 || errText.indexOf("Timeout") >= 0) {
      // Network related errors
      lcd.setCursor(0, 0);
      lcd.print("Network Error");
      lcd.setCursor(0, 1);
      lcd.print("Try Again");
      Serial.println("Result: Network error - " + errText);
      buzz(200, 150, 2);
    } else if (errText.indexOf("Server") >= 0 || errText.indexOf("Unavailable") >= 0) {
      // Server errors
      lcd.setCursor(0, 0);
      lcd.print("No active ");
      lcd.setCursor(0, 1);
      lcd.print("session found");
      Serial.println("Result: Server error - " + errText);
      buzz(200, 150, 2);
    } else {
      // Generic error - show simplified message
      lcd.setCursor(0, 0);
      lcd.print("Error Occurred");
      lcd.setCursor(0, 1);
      lcd.print("Contact Admin");
      Serial.println("Result: Error - " + errText);
      buzz(200, 150, 3);
    }
  } else {
    // Unknown response format
    lcd.setCursor(0, 0);
    lcd.print("System Error");
    lcd.setCursor(0, 1);
    lcd.print("Contact Admin");
    Serial.println("ERROR: Unknown response format - " + statusMsg);
    buzz(200, 150, 3);
  }

  delay(3500);

  // Reset to ready state with user-friendly message
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Ready");
  lcd.setCursor(0, 1);
  lcd.print("Scan Your ID");
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
String sendScanToServer(String registrationNo) {
  Serial.println("Sending scan to server...");
  
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

  // Build JSON body
  String body = String("{\"registrationNo\":\"") + registrationNo + String("\"}");

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

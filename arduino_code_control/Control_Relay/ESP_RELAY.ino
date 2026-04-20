#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

// --- KONFIGURASI WIFI ---
const char* ssid = "robotic-local"; 
const char* password = "12345678";

// --- KONFIGURASI RELAY (ESP32-S3 SAFE PINS) ---
// PIN 1-11 untuk channel angka 1-11
// Menghindari 9-13 karena pin Flash/PSRAM
const int relayPins[] = {4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14};
const int numRelays = 11;

// PIN khusus untuk channel bertipe string "switch"
const int relayPinSwitch = 15;

// Konfigurasi Active High (Sesuai Permintaan)
#define RELAY_ON HIGH
#define RELAY_OFF LOW

WebServer server(80);

void handleStatus() {
  StaticJsonDocument<1024> doc; // Buffer lebih besar untuk 12 channel
  JsonArray relays = doc.createNestedArray("relays");
  
  // 1. Ambil status 11 relay utama
  for (int i = 0; i < numRelays; i++) {
    JsonObject relay = relays.createNestedObject();
    relay["channel"] = i + 1;
    relay["state"] = (digitalRead(relayPins[i]) == RELAY_ON) ? "ON" : "OFF";
  }

  // 2. Ambil status relay khusus "switch"
  JsonObject sw = relays.createNestedObject();
  sw["channel"] = "switch";
  sw["state"] = (digitalRead(relayPinSwitch) == RELAY_ON) ? "ON" : "OFF";
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleControl() {
  if (server.hasArg("plain") == false) {
    server.send(400, "application/json", "{\"error\":\"Body empty\"}");
    return;
  }

  StaticJsonDocument<500> doc;
  DeserializationError error = deserializeJson(doc, server.arg("plain"));
  if (error) {
    server.send(400, "application/json", "{\"error\":\"JSON parse error\"}");
    return;
  }

  // Cek apakah ada field 'channel' dan 'state'
  if (!doc.containsKey("channel") || !doc.containsKey("state")) {
    server.send(400, "application/json", "{\"error\":\"Missing parameters\"}");
    return;
  }

  String stateStr = doc["state"];
  int targetState = (stateStr == "ON") ? RELAY_ON : RELAY_OFF;
  bool success = false;

  // LOGIKA DUAL-TYPE CHANNEL
  if (doc["channel"].is<int>()) {
    int ch = doc["channel"].as<int>();
    if (ch >= 1 && ch <= numRelays) {
      digitalWrite(relayPins[ch - 1], targetState);
      Serial.printf("[API] Numeric Channel %d set to %s\n", ch, stateStr.c_str());
      success = true;
    }
  } 
  else if (doc["channel"].is<const char*>()) {
    String chStr = doc["channel"].as<String>();
    if (chStr == "switch") {
      digitalWrite(relayPinSwitch, targetState);
      Serial.printf("[API] String Channel 'switch' set to %s\n", stateStr.c_str());
      success = true;
    }
  }

  if (success) {
    server.send(200, "application/json", "{\"status\":\"success\"}");
  } else {
    server.send(400, "application/json", "{\"error\":\"Invalid channel ID or type\"}");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000); 
  Serial.println("\n[SYSTEM] ESP32-S3 12-Ch Relay Controller Starting...");

  // Inisialisasi 11 relay utama
  for (int i = 0; i < numRelays; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], RELAY_OFF); 
  }

  // Inisialisasi relay switch
  pinMode(relayPinSwitch, OUTPUT);
  digitalWrite(relayPinSwitch, RELAY_OFF);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control", HTTP_POST, handleControl);

  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  server.handleClient();
}
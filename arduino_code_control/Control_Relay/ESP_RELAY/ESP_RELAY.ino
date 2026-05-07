#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>

// --- KONFIGURASI WIFI ---
const char* ssid = "Indicator@IOT-Supp"; 
const char* password = "!ndicator@2017";

// --- KONFIGURASI RELAY (ESP32-S3 SAFE PINS) ---
// PIN 1-11 untuk channel angka 1-11
// Menghindari 9-13 karena pin Flash/PSRAM
const int relayPins[] = {4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16};
const int numRelays = 12;

// Konfigurasi Active High (Sesuai Permintaan)
#define RELAY_ON LOW
#define RELAY_OFF HIGH

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
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleControl() {
  if (server.hasArg("plain") == false) {
    server.send(400, "application/json", "{\"error\":\"Body empty\"}");
    return;
  }

  StaticJsonDocument<1024> doc; 
  DeserializationError error = deserializeJson(doc, server.arg("plain"));
  if (error) {
    server.send(400, "application/json", "{\"error\":\"JSON parse error\"}");
    return;
  }

  if (!doc.containsKey("state")) {
    server.send(400, "application/json", "{\"error\":\"Missing state parameter\"}");
    return;
  }

  String stateStr = doc["state"];
  int targetState = (stateStr == "ON") ? RELAY_ON : RELAY_OFF;
  bool success = false;

  // BULK CHANNELS SUPPORT
  if (doc.containsKey("channels") && doc["channels"].is<JsonArray>()) {
    JsonArray channels = doc["channels"];
    for (int ch : channels) {
      if (ch >= 1 && ch <= numRelays) {
        digitalWrite(relayPins[ch - 1], targetState);
        success = true;
      }
    }
    Serial.printf("[API] Bulk Channels set to %s\n", stateStr.c_str());
  } 
  // SINGLE CHANNEL (LEGACY SUPPORT)
  else if (doc.containsKey("channel")) {
    int ch = doc["channel"];
    if (ch >= 1 && ch <= numRelays) {
      digitalWrite(relayPins[ch - 1], targetState);
      success = true;
    Serial.printf("[API] Channel %d set to %s\n", ch, stateStr.c_str());
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

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
  Serial.println("[WiFi] Mac Address: ");
  Serial.println(WiFi.macAddress());

  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control", HTTP_POST, handleControl);

  server.begin();
  Serial.println("HTTP server started");

  // --- KONFIGURASI OTA ---
  ArduinoOTA.setHostname("ESP32-Relay-12Ch"); // Nama perangkat di jaringan
  // ArduinoOTA.setPassword("admin"); // Opsional: Tambahkan password jika perlu

  ArduinoOTA.onStart([]() {
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) type = "sketch";
    else type = "filesystem";
    Serial.println("Start updating " + type);
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("\nEnd");
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("Progress: %u%%\r", (progress / (total / 100)));
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("Error[%u]: ", error);
    if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR) Serial.println("End Failed");
  });

  ArduinoOTA.begin();
  Serial.println("[SYSTEM] OTA Service Ready");
}

void loop() {
  server.handleClient();
  ArduinoOTA.handle();
}
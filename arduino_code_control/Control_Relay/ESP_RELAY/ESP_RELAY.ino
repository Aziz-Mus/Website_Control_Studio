#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <Preferences.h>

// ============================================================
//  KONFIGURASI WIFI
// ============================================================
const char* ssid     = "Indicator@IOT-Supp";
const char* password = "!ndicator@2017";

// ============================================================
//  KONFIGURASI RELAY
// ============================================================
#define NUM_RELAYS 12
const int relayPins[NUM_RELAYS] = {4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16};

// Active HIGH
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// ============================================================
//  CASCADE STATE MACHINE (NON-BLOCKING)
// ============================================================
struct CascadeJob {
  int  channels[NUM_RELAYS]; 
  int  count;                
  int  current;              
  int  targetState;          
  int  delayMs;              
  bool active;               
  unsigned long lastTick;    
};

CascadeJob cascadeJob = {.active = false};

void startCascade(const int* channels, int count, int state, int delayMs) {
  if (cascadeJob.active) {
    for (int i = cascadeJob.current; i < cascadeJob.count; i++) {
      digitalWrite(relayPins[cascadeJob.channels[i]], cascadeJob.targetState);
    }
  }

  memcpy(cascadeJob.channels, channels, count * sizeof(int));
  cascadeJob.count       = count;
  cascadeJob.current     = 0;
  cascadeJob.targetState = state;
  cascadeJob.delayMs     = delayMs;
  cascadeJob.active      = true;
  cascadeJob.lastTick    = 0; 
}

void tickCascade() {
  if (!cascadeJob.active) return;

  unsigned long now = millis();

  if (cascadeJob.lastTick == 0 || (now - cascadeJob.lastTick >= (unsigned long)cascadeJob.delayMs)) {
    int idx = cascadeJob.channels[cascadeJob.current];
    digitalWrite(relayPins[idx], cascadeJob.targetState);
    Serial.printf("[CASCADE] ch%d (GPIO%d) -> %s\n",
                  idx + 1, relayPins[idx],
                  (cascadeJob.targetState == RELAY_ON) ? "ON" : "OFF");

    cascadeJob.lastTick = now;
    cascadeJob.current++;

    if (cascadeJob.current >= cascadeJob.count) {
      cascadeJob.active = false;
      Serial.println("[CASCADE] Selesai.");
    }
  }
}

// ============================================================
//  KONFIGURASI CASCADE DELAY
// ============================================================
Preferences prefs;
int cascadeDelayMs = 100; 

void loadPrefs() {
  prefs.begin("relay-cfg", true); 
  cascadeDelayMs = prefs.getInt("cascade_ms", 100);
  prefs.end();
  Serial.printf("[PREFS] cascade_delay_ms = %dms\n", cascadeDelayMs);
}

void savePrefs() {
  prefs.begin("relay-cfg", false); 
  prefs.putInt("cascade_ms", cascadeDelayMs);
  prefs.end();
}

// ============================================================
//  WEB SERVER
// ============================================================
WebServer server(80);

// ------------------------------------------------------------
//  Helper: validasi Content-Type JSON
// ------------------------------------------------------------
bool isJsonRequest() {
  String ct = server.header("Content-Type");
  return ct.indexOf("application/json") >= 0 || ct.isEmpty();
}

// ------------------------------------------------------------
//  Helper: parse body JSON dengan validasi standar
// ------------------------------------------------------------
template<size_t N>
bool parseBody(StaticJsonDocument<N>& doc) {
  if (!server.hasArg("plain") || server.arg("plain").length() == 0) {
    server.send(400, "application/json", "{\"error\":\"Body kosong\"}");
    return false;
  }
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    server.send(400, "application/json", "{\"error\":\"JSON tidak valid\"}");
    return false;
  }
  return true;
}

// ------------------------------------------------------------
//  GET /status
// ------------------------------------------------------------
void handleStatus() {
  StaticJsonDocument<1024> doc;
  JsonArray relays = doc.createNestedArray("relays");

  for (int i = 0; i < NUM_RELAYS; i++) {
    JsonObject r = relays.createNestedObject();
    r["channel"] = i + 1;
    r["pin"]     = relayPins[i];
    r["state"]   = (digitalRead(relayPins[i]) == RELAY_ON) ? "ON" : "OFF";
  }

  doc["cascade_delay_ms"]  = cascadeDelayMs;
  doc["cascade_active"]    = cascadeJob.active;
  doc["cascade_progress"]  = cascadeJob.active
                               ? String(cascadeJob.current) + "/" + String(cascadeJob.count)
                               : "idle";

  String resp;
  serializeJson(doc, resp);
  server.send(200, "application/json", resp);
}

void handleControl() {
  StaticJsonDocument<1024> doc;
  if (!parseBody(doc)) return;

  if (!doc.containsKey("state")) {
    server.send(400, "application/json", "{\"error\":\"Parameter 'state' wajib ada\"}");
    return;
  }

  String stateStr = doc["state"].as<String>();
  stateStr.toUpperCase();
  if (stateStr != "ON" && stateStr != "OFF") {
    server.send(400, "application/json", "{\"error\":\"'state' harus ON atau OFF\"}");
    return;
  }
  int targetState = (stateStr == "ON") ? RELAY_ON : RELAY_OFF;

  int reqDelay = doc.containsKey("delay_ms")
                   ? constrain(doc["delay_ms"].as<int>(), 0, 5000)
                   : cascadeDelayMs;

  int idxArr[NUM_RELAYS];
  int count = 0;
  bool useCascade = false;

  // ---- ALL channels ----
  if (doc.containsKey("all") && doc["all"].as<bool>()) {
    for (int i = 0; i < NUM_RELAYS; i++) idxArr[i] = i;
    count      = NUM_RELAYS;
    useCascade = true;
    Serial.printf("[API] ALL channels -> %s (cascade %dms)\n", stateStr.c_str(), reqDelay);
  }
  // ---- BULK channels ----
  else if (doc.containsKey("channels") && doc["channels"].is<JsonArray>()) {
    JsonArray channels = doc["channels"];
    for (JsonVariant v : channels) {
      int ch = v.as<int>();
      if (ch >= 1 && ch <= NUM_RELAYS && count < NUM_RELAYS) {
        idxArr[count++] = ch - 1;
      }
    }
    useCascade = (count > 1);
    Serial.printf("[API] Bulk %d channels -> %s (cascade %dms)\n",
                  count, stateStr.c_str(), reqDelay);
  }
  // ---- SINGLE channel ----
  else if (doc.containsKey("channel")) {
    int ch = doc["channel"].as<int>();
    if (ch >= 1 && ch <= NUM_RELAYS) {
      idxArr[0] = ch - 1;
      count     = 1;
    }
    Serial.printf("[API] Channel %d -> %s (direct)\n", ch, stateStr.c_str());
  }

  if (count == 0) {
    server.send(400, "application/json", "{\"error\":\"Channel tidak valid\"}");
    return;
  }

  if (useCascade) {
    server.send(200, "application/json",
      "{\"status\":\"queued\",\"message\":\"Cascade dimulai di background\"}");
    startCascade(idxArr, count, targetState, reqDelay);
  } else {
    digitalWrite(relayPins[idxArr[0]], targetState);
    server.send(200, "application/json", "{\"status\":\"success\"}");
  }
}

void handleToggle() {
  StaticJsonDocument<256> doc;
  if (!parseBody(doc)) return;

  if (!doc.containsKey("channel")) {
    server.send(400, "application/json", "{\"error\":\"Parameter 'channel' wajib ada\"}");
    return;
  }

  int ch = doc["channel"].as<int>();
  if (ch < 1 || ch > NUM_RELAYS) {
    server.send(400, "application/json", "{\"error\":\"Channel tidak valid\"}");
    return;
  }

  int newState = (digitalRead(relayPins[ch - 1]) == RELAY_ON) ? RELAY_OFF : RELAY_ON;
  digitalWrite(relayPins[ch - 1], newState);
  String newStr = (newState == RELAY_ON) ? "ON" : "OFF";
  Serial.printf("[API] Channel %d TOGGLED -> %s\n", ch, newStr.c_str());

  StaticJsonDocument<128> resp;
  resp["status"]  = "success";
  resp["channel"] = ch;
  resp["state"]   = newStr;
  String respStr;
  serializeJson(resp, respStr);
  server.send(200, "application/json", respStr);
}

void handleConfig() {
  StaticJsonDocument<256> doc;
  if (!parseBody(doc)) return;

  if (!doc.containsKey("cascade_delay_ms")) {
    server.send(400, "application/json", "{\"error\":\"Parameter tidak dikenali\"}");
    return;
  }

  int newDelay = doc["cascade_delay_ms"].as<int>();
  if (newDelay < 0 || newDelay > 5000) {
    server.send(400, "application/json", "{\"error\":\"Nilai delay harus 0–5000 ms\"}");
    return;
  }

  cascadeDelayMs = newDelay;
  savePrefs(); 
  Serial.printf("[CONFIG] cascade_delay_ms diubah -> %dms (tersimpan)\n", cascadeDelayMs);

  StaticJsonDocument<128> resp;
  resp["status"]           = "success";
  resp["cascade_delay_ms"] = cascadeDelayMs;
  resp["saved"]            = true;
  String respStr;
  serializeJson(resp, respStr);
  server.send(200, "application/json", respStr);
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='UTF-8'>"
                "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                "<title>ESP32-S3 Relay</title></head><body>"
                "<h2>ESP32-S3 12-Ch Relay Controller</h2>";
  html += "<p>IP: "  + WiFi.localIP().toString()       + "</p>";
  html += "<p>MAC: " + WiFi.macAddress()               + "</p>";
  html += "<p>Cascade Delay: " + String(cascadeDelayMs) + " ms (tersimpan di flash)</p>";
  html += "<h3>Endpoints:</h3><ul>"
          "<li>GET  /status</li>"
          "<li>POST /control  { \"channel\":1, \"state\":\"ON\" }  — single (langsung)</li>"
          "<li>POST /control  { \"channels\":[1,2,3], \"state\":\"ON\" }  — bulk (cascade bg)</li>"
          "<li>POST /control  { \"all\":true, \"state\":\"ON\" }  — semua (cascade bg)</li>"
          "<li>POST /control  { \"all\":true, \"state\":\"ON\", \"delay_ms\":200 }  — override delay</li>"
          "<li>POST /toggle   { \"channel\":1 }</li>"
          "<li>POST /config   { \"cascade_delay_ms\":150 }  — tersimpan permanen</li>"
          "</ul></body></html>";
  server.send(200, "text/html", html);
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("\n========================================");
  Serial.println(" ESP32-S3 Relay Controller");
  Serial.println("========================================");

  loadPrefs();

  Serial.print("[RELAY] Init pin: ");
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], RELAY_OFF);
    Serial.printf("GPIO%d ", relayPins[i]);
  }
  Serial.println("\n[RELAY] Semua channel OFF");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.printf("[WiFi] Menghubungkan ke '%s'", ssid);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[WiFi] GAGAL KONEK!");
    Serial.printf("[WiFi] Status code: %d\n", WiFi.status());
    Serial.println("       1 = SSID tidak ditemukan");
    Serial.println("       4 = Password salah");
    Serial.println("[WiFi] Restart dalam 5 detik...");
    delay(5000);
    ESP.restart();
  }

  Serial.println("\n[WiFi] Terhubung!");
  Serial.println("[WiFi] IP      : " + WiFi.localIP().toString());
  Serial.println("[WiFi] MAC     : " + WiFi.macAddress());
  Serial.printf("[WiFi] RSSI    : %d dBm\n", WiFi.RSSI());

  const char* headerKeys[] = {"Content-Type"};
  server.collectHeaders(headerKeys, 1);

  // Register endpoint
  server.on("/",        HTTP_GET,  handleRoot);
  server.on("/status",  HTTP_GET,  handleStatus);
  server.on("/control", HTTP_POST, handleControl);
  server.on("/toggle",  HTTP_POST, handleToggle);
  server.on("/config",  HTTP_POST, handleConfig);
  server.begin();
  Serial.println("[HTTP] Server berjalan di port 80");

  // OTA
  ArduinoOTA.setHostname("ESP32-S3");
  ArduinoOTA.onStart([]() {
    Serial.println("[OTA] Mulai update...");
    cascadeJob.active = false;
    for (int i = 0; i < NUM_RELAYS; i++) {
      digitalWrite(relayPins[i], RELAY_OFF);
    }
  });
  ArduinoOTA.onEnd([]() {
    Serial.println("\n[OTA] Selesai.");
  });
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    Serial.printf("[OTA] Progress: %u%%\r", (progress / (total / 100)));
  });
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("[OTA] Error[%u]: ", error);
    if      (error == OTA_AUTH_ERROR)    Serial.println("Auth Failed");
    else if (error == OTA_BEGIN_ERROR)   Serial.println("Begin Failed");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
    else if (error == OTA_END_ERROR)     Serial.println("End Failed");
  });
  ArduinoOTA.begin();
  Serial.println("[OTA]  Service siap");

  Serial.println("========================================");
  Serial.println(" Sistem siap!");
  Serial.println("========================================\n");
}

// ============================================================
//  LOOP
// ============================================================

unsigned long lastWifiCheck  = 0;
unsigned long lastReconnectAt = 0;
bool reconnecting = false;
#define WIFI_CHECK_INTERVAL   5000 
#define WIFI_RECONNECT_TIMEOUT 10000 

void handleWifiReconnect() {
  unsigned long now = millis();

  if (!reconnecting) {
    if (now - lastWifiCheck < WIFI_CHECK_INTERVAL) return;
    lastWifiCheck = now;

    if (WiFi.status() == WL_CONNECTED) return;

    Serial.println("[WiFi] Koneksi terputus, memulai reconnect...");
    WiFi.disconnect();
    WiFi.begin(ssid, password);
    reconnecting    = true;
    lastReconnectAt = now;

  } else {
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("[WiFi] Reconnect berhasil! IP: " + WiFi.localIP().toString());
      reconnecting = false;
      return;
    }

    // Timeout reconnect
    if (now - lastReconnectAt > WIFI_RECONNECT_TIMEOUT) {
      Serial.println("[WiFi] Reconnect timeout, akan coba lagi...");
      WiFi.disconnect();
      reconnecting = false;
      lastWifiCheck = now; 
    }
  }
}

void loop() {
  server.handleClient();   
  ArduinoOTA.handle();     
  tickCascade();           
  handleWifiReconnect();   
}

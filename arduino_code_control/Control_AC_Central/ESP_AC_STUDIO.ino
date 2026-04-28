#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <IRac.h>

// --- WIFI CONFIG ---
// const char* ssid = "IOT";
// const char* password = "123456789";
const char* ssid = "Indicator@IOT-Supp";
const char* password = "!ndicator@2017";

const uint16_t kIrLed = 4;     // Pin IR LED (D2 di Wemos/NodeMCU)
const uint16_t BUTTON_PIN = 0; // Tombol BOOT/FLASH (D3 di Wemos/NodeMCU)

IRac ac(kIrLed);
ESP8266WebServer server(80);

bool acState = false;      // Status Power (false = OFF, true = ON)
bool lastButton = HIGH;    // Status terakhir tombol
int currentTemp = 24;      // Suhu default awal

void sendACCommand() {
  // Menggunakan protokol Haier 176-bit (ID 83)
  ac.next.protocol = decode_type_t::HAIER_AC176; 
  ac.next.power = acState;
  ac.next.mode = stdAc::opmode_t::kCool;
  ac.next.celsius = true;
  ac.next.degrees = currentTemp;
  ac.next.fanspeed = stdAc::fanspeed_t::kAuto;

  Serial.println("\n--- MENGIRIM SINYAL IR (HAIER 176) ---");
  Serial.print("Status Power : "); Serial.println(acState ? "ON" : "OFF");
  Serial.print("Suhu Target  : "); Serial.print(currentTemp); Serial.println(" C");
  Serial.println("--------------------------");

  // Kirim sinyal burst 3x agar lebih stabil menjangkau plafon
  for (int i = 0; i < 3; i++) {
    ac.sendAc();
    delay(150); // Jeda antar burst
  }
}

void handleStatus() {
  StaticJsonDocument<200> doc;
  doc["status"] = "online";
  doc["device"] = "Haier_Central_AC";
  doc["power"] = acState ? "ON" : "OFF";
  doc["temp"] = currentTemp;
  
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

  // Update State from API
  if (doc.containsKey("power")) {
    String power = doc["power"];
    acState = (power == "ON");
  }

  if (doc.containsKey("temperature")) {
    currentTemp = doc["temperature"].as<int>();
  }

  sendACCommand();
  server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"IR Sent\"}");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("[WIFI] Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] WiFi connected.");
  Serial.print("[WIFI] IP address: ");
  Serial.println(WiFi.localIP());
  Serial.print("[WIFI] IP address: ");
  Serial.println(WiFi.macAddress());

  // Setup API Handlers
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control", HTTP_POST, handleControl);
  server.begin();

  Serial.println("\n======================================");
  Serial.println("KONTROL AC HAIER CENTRAL ESP8266");
  Serial.println("1. HTTP POST /control {\"power\":\"ON\",\"temperature\":24}");
  Serial.println("2. Tekan tombol BOOT untuk Power ON/OFF");
  Serial.println("3. Ketik 'on', 'off', atau angka (16-30) di Serial untuk kontrol");
  Serial.println("======================================");
}

void loop() {
  // 1. Logika Tombol Fisik (Power Toggle)
  bool currentButton = digitalRead(BUTTON_PIN);

  if (lastButton == HIGH && currentButton == LOW) {
    delay(50); // Debounce sederhana
    acState = !acState; // Balikkan status power
    sendACCommand();
  }
  lastButton = currentButton;

  // 2. Logika Input Serial (Atur Suhu / Power)
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.equalsIgnoreCase("on")) {
      acState = true;
      sendACCommand();
    } else if (input.equalsIgnoreCase("off")) {
      acState = false;
      sendACCommand();
    } else if (input.length() > 0) {
      int newTemp = input.toInt();
      if (newTemp >= 16 && newTemp <= 30) {
        currentTemp = newTemp;
        Serial.print(">> Input Suhu Diterima: ");
        Serial.print(currentTemp);
        Serial.println(" C");

        if (acState) {
          sendACCommand();
        } else {
          Serial.println("(Suhu disimpan, akan aktif saat AC dinyalakan)");
        }
      } else {
        Serial.println("!! Error: Masukkan suhu antara 16 sampai 30, atau 'on' / 'off'.");
      }
    }
  }

  // 3. Handle Web Server
  server.handleClient();
}

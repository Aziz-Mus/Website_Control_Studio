#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ArduinoJson.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Kelvinator.h>

const char* ssid = "Indicator@IOT-Supp";
const char* password = "!ndicator@2017";

const uint16_t kIrLed = 4;     // D2
const uint16_t BUTTON_PIN = 0; // D3

IRKelvinatorAC greeAC(kIrLed);
ESP8266WebServer server(80);

bool acState = false;
bool lastButton = HIGH;
int currentTemp = 22;

void handleStatus() {
  StaticJsonDocument<200> doc;
  doc["status"] = "online";
  doc["device"] = "Gree_AC";
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

  if (doc.containsKey("power")) {
    String powerStr = doc["power"];
    acState = (powerStr == "ON");
  }

  if (doc.containsKey("temperature")) {
    int temp = doc["temperature"].as<int>();
    if (temp >= 16 && temp <= 30) {
      currentTemp = temp;
      greeAC.setTemp(currentTemp);
    }
  }

  if (acState) {
    greeAC.on();
  } else {
    greeAC.off();
  }
  greeAC.send();

  server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"IR Sent\"}");
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  greeAC.begin();
  greeAC.setMode(kKelvinatorCool); 
  greeAC.setTemp(currentTemp);
  greeAC.setFan(kKelvinatorFanAuto);
  greeAC.setSwingVertical(false, 0);
  greeAC.setSwingHorizontal(false);
  greeAC.setXFan(false);
  greeAC.setLight(true);
  
  greeAC.off();
  acState = false;
  
  Serial.println("\n[WIFI] Connecting to Gree AC Controller...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Connected!");
  Serial.print("[WIFI] IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println("[WiFi] Mac Address: ");
  Serial.println(WiFi.macAddress());
  
  server.on("/status", HTTP_GET, handleStatus);
  server.on("/control", HTTP_POST, handleControl);
  server.begin();
}

void loop() {
  server.handleClient();

  bool currentButton = digitalRead(BUTTON_PIN);
  if (lastButton == HIGH && currentButton == LOW) {
    delay(50);
    acState = !acState;
    if (acState) {
      greeAC.on();
    } else {
      greeAC.off();
    }
    greeAC.send();
  }
  lastButton = currentButton;

  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input.equalsIgnoreCase("on") && !acState) {
      acState = true;
      greeAC.on();
      greeAC.send();
    } else if (input.equalsIgnoreCase("off") && acState) {
      acState = false;
      greeAC.off();
      greeAC.send();
    } else {
      int temp = input.toInt();
      if (temp >= 16 && temp <= 30) {
        currentTemp = temp;
        greeAC.setTemp(currentTemp);
        if (!acState) {
          acState = true;
          greeAC.on();
        }
        greeAC.send();
      }
    }
  }
}

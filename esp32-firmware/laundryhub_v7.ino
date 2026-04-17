/*
 * LaundryHub ESP32 firmware v7
 *
 * Changes from v6:
 *   - No longer runs its own session timer. The Oracle poller decides ON/OFF
 *     based on ConnectLife state + admin config.
 *   - Reads /relay_command/on (bool) from Firebase RTDB.
 *   - On network loss, fails CLOSED (relay OFF = power cut) after 30s.
 *
 * Wiring (unchanged):
 *   - Relay signal: GPIO 26, active-low (LOW = relay closed = power to washer ON)
 *
 * Dependencies: none beyond ESP32 Arduino core + WiFiClientSecure + HTTPClient.
 * We use Firebase's REST API directly via HTTPS, so no Mobizt library needed —
 * keeps zero external libraries, matching your v6 philosophy.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ---- Credentials (pre-filled per your memory) ----
const char* WIFI_SSID     = "Stechbahn 18 01";
const char* WIFI_PASSWORD = "Stechbahn1801!";
const char* FIREBASE_HOST = "laundryhub-4e35b-default-rtdb.europe-west1.firebasedatabase.app";
const char* FIREBASE_AUTH = "AIzaSyANBaOBmrvo3KuXPl9cjYpmRrFwFz78MYc";

// ---- Hardware ----
const int RELAY_PIN   = 26;
const int RELAY_ON_LEVEL  = LOW;   // active-low
const int RELAY_OFF_LEVEL = HIGH;

// ---- Timing ----
const unsigned long POLL_INTERVAL_MS = 3000;     // poll Firebase every 3s
const unsigned long NETWORK_LOSS_FAILSAFE_MS = 30000; // if we can't reach Firebase for 30s, cut power

unsigned long lastPollMs = 0;
unsigned long lastSuccessMs = 0;
bool currentRelayOn = false;

void setRelay(bool on) {
  digitalWrite(RELAY_PIN, on ? RELAY_ON_LEVEL : RELAY_OFF_LEVEL);
  if (on != currentRelayOn) {
    Serial.printf("[relay] %s\n", on ? "ON (power to washer)" : "OFF (power cut)");
    currentRelayOn = on;
  }
}

void connectWiFi() {
  Serial.printf("[wifi] connecting to %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] connected ip=%s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("[wifi] connect timeout — will retry");
  }
}

bool fetchRelayCommand(bool& outOn, String& outReason) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure(); // Firebase cert validation skipped — matches v6 approach

  HTTPClient https;
  String url = "https://";
  url += FIREBASE_HOST;
  url += "/relay_command.json?auth=";
  url += FIREBASE_AUTH;

  if (!https.begin(client, url)) return false;
  int code = https.GET();
  if (code != 200) {
    Serial.printf("[firebase] GET failed code=%d\n", code);
    https.end();
    return false;
  }
  String payload = https.getString();
  https.end();

  // Minimal JSON parse — we know the shape: {"on":true,"reason":"...","updated_at":123}
  int onIdx = payload.indexOf("\"on\":");
  if (onIdx < 0) return false;
  outOn = (payload.indexOf("true", onIdx) >= 0 &&
           payload.indexOf("true", onIdx) < payload.indexOf(",", onIdx));

  int rIdx = payload.indexOf("\"reason\":\"");
  if (rIdx >= 0) {
    int rStart = rIdx + 10;
    int rEnd = payload.indexOf("\"", rStart);
    if (rEnd > rStart) outReason = payload.substring(rStart, rEnd);
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n[LaundryHub ESP32 v7]");

  pinMode(RELAY_PIN, OUTPUT);
  setRelay(false); // start with power OFF — fail-safe

  connectWiFi();
  lastSuccessMs = millis();
}

void loop() {
  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(2000);
    return;
  }

  if (millis() - lastPollMs >= POLL_INTERVAL_MS) {
    lastPollMs = millis();

    bool wantOn = false;
    String reason;
    if (fetchRelayCommand(wantOn, reason)) {
      lastSuccessMs = millis();
      setRelay(wantOn);
      Serial.printf("[poll] ok relay=%s reason=%s\n", wantOn ? "ON" : "OFF", reason.c_str());
    } else {
      unsigned long sinceSuccess = millis() - lastSuccessMs;
      Serial.printf("[poll] failed (%lums since last success)\n", sinceSuccess);
      if (sinceSuccess > NETWORK_LOSS_FAILSAFE_MS) {
        Serial.println("[failsafe] network loss exceeded threshold — cutting power");
        setRelay(false);
      }
    }
  }

  delay(100);
}

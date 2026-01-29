#ifndef KILN_H
#define KILN_H
#define VERSION "0.1.2"
#include <Arduino.h>
#include <PID_v1.h>
#include <Adafruit_MAX31855.h>
#include <ArduinoJson.h> 
void updateLedIndicator();
void reportStatus(bool forceReport = false);
void handleCommand(JsonDocument& doc);
#if defined(ARDUINO_ARCH_SAMD)
#define Serial_ SerialUSB
#else
#define Serial_ Serial
#endif

#endif
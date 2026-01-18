/**
 * Kiln Controller
 * 
 * JSON Commands: 
 * - {"command":"start"}
 * - {"command":"stop"}
 * - {"command":"profile", "targetTemperature": 1200, "rampTime": 60, "soakDuration": 10, "coolTime": 60}
 * - {"command":"status"}
 * - {"command":"testInput", "temperature": 1200, "duration": 20, "setPoint": 1000}
 * Note: temperature in Celsius, rampRate in degrees/hour, soakDuration in minutes
 * Logging over external USB-to-Serial adapter at 9600 baud.
 * testInput allows simulating temperature readings for testing. duration and initial setpoint are optional.
 */

#include <Arduino.h>
#include <PID_v1.h>
#include <Adafruit_MAX31855.h>
#include "kiln.h"
#include <ArduinoJson.h>

// --- Hardware Pins ---
#define DO   3
#define CS   4
#define CLK  5
#define SSR_PIN_UPPER 6
#define SSR_PIN_LOWER 7
#define LED_PIN 13 // Built-in LED

// --- State Machine ---
enum KilnState { IDLE, RAMP, SOAK, COOLING, EMERGENCY_STOP };
KilnState currentState = IDLE;

// --- Thermal Variables ---
double setpoint, input, output;
double targetTemperature = 0; // Target temperature for the ramp state
double Kp=2, Ki=0.5, Kd=2; // Initial tuning values
double rampRate = 300; // degrees per hour
PID kilnPID(&input, &output, &setpoint, Kp, Ki, Kd, DIRECT);

Adafruit_MAX31855 thermocouple(CLK, CS, DO);

// --- Simulation/Test Mode ---
bool isSimulated = false;
double simulatedInput = 0.0;
unsigned long simulationStartTime = 0;
unsigned long simulationTimeout = 0;

// SSR Windowing (10-second cycle)
unsigned long windowSize = 10000;
unsigned long windowStartTime;

unsigned long soakDuration = 600000; // 10 minutes
unsigned long soakTimeElapsed = 0;
unsigned long coolRate = 300; // degrees per hour
unsigned long lastReportTime = 0;
unsigned long reportInterval = 10000; // Report every 10 seconds

// --- LED Indicator ---
unsigned long ledLastChangeTime = 0;
bool ledState = HIGH;

void updateLedIndicator();
void reportStatus();
void handleCommand(JsonDocument& doc);

void setup() {
    // Initialize the external USB-to-Serial adapter for logging
    Serial_.begin(9600); 
    while(!Serial_); // Wait for Serial to be ready
    delay(2000); // Allow time for connection
    
    JsonDocument doc;
    doc["state"] = "setup";
    doc["message"] = "Kiln controller starting up...";
    serializeJson(doc, Serial_);
    Serial_.println();

    pinMode(SSR_PIN_UPPER, OUTPUT);
    pinMode(SSR_PIN_LOWER, OUTPUT);
    pinMode(LED_PIN, OUTPUT);
    
    windowStartTime = millis();
    kilnPID.SetOutputLimits(0, windowSize);
    kilnPID.SetMode(AUTOMATIC);
}

void loop() {
    // Check for incoming serial data
    if (Serial_.available() > 0) {
        String input = Serial_.readStringUntil('\n');
        // Trim whitespace to avoid empty lines triggering parsing
        input.trim();
        if (input.length() == 0) return;

        JsonDocument doc;
        DeserializationError error = deserializeJson(doc, input);
        if (error) {
            Serial_.print(F("deserializeJson() failed: "));
            Serial_.println(error.c_str());
            return;
        }
        handleCommand(doc);
    }

    // 1. Read Temperature
    if (isSimulated && (millis() - simulationStartTime < simulationTimeout)) {
        input = simulatedInput;
    } else {
        isSimulated = false;
        input = thermocouple.readCelsius();
    }
    
    if (isnan(input)) {
        currentState = EMERGENCY_STOP;
   }

    // Check for Window Rollover (10s cycle) used for integration and PWM
    unsigned long now = millis();
    bool onWindowRollover = false;
    if (now - windowStartTime > windowSize) {
        windowStartTime += windowSize;
        onWindowRollover = true;
    }

    // 2. Logic for State Transitions (simplified example)
    switch (currentState) {
        case IDLE:
            break;
        case RAMP:
            // Increment setpoint over time based on degrees/hour
            if (input >= targetTemperature) {
                currentState = SOAK;
                soakTimeElapsed = 0;
            }
            if (onWindowRollover) {
                if (setpoint < targetTemperature) {
                    setpoint += (rampRate / 3600) * (windowSize / 1000); // Update setpoint
                    if (setpoint > targetTemperature) {
                        setpoint = targetTemperature;
                    }
                }
            }
            break;
        case SOAK:
            // Maintain setpoint for soak duration
            if(soakTimeElapsed > soakDuration) {
                currentState = COOLING;
            }
            if (onWindowRollover) {
                soakTimeElapsed += windowSize;
            }
            break;

        case COOLING:
            // Allow temperature to drop naturally
            if (input < 50) { // Arbitrary threshold to return to IDLE
                currentState = IDLE;
                isSimulated = false; // Added
            }
            if (onWindowRollover && coolRate > 0) {
                setpoint -= (coolRate / 3600) * (windowSize / 1000); // Decrease setpoint
                if (setpoint < 25) setpoint = 25; // Clamp at room temp
            } else if (coolRate == 0) {
                // Natural cooling, just update setpoint to track input so we don't fire
                // Or set it to 0. Let's set to 0.
                setpoint = 0;
            }
            break;
        case EMERGENCY_STOP:
            isSimulated = false; // Added
            digitalWrite(SSR_PIN_UPPER, LOW);
            digitalWrite(SSR_PIN_LOWER, LOW);
            // The updateLedIndicator() function will handle the blinking
            break;
        default: break;
    }


    // 3. Compute PID & Control SSR
    // Only compute PID if not in an emergency stop state or IDLE
    if (currentState != EMERGENCY_STOP && currentState != IDLE) {
        kilnPID.Compute();
        
        // Time-Proportioning (Software PWM)
        if (output > (now - windowStartTime)) {
            digitalWrite(SSR_PIN_UPPER, HIGH);
            digitalWrite(SSR_PIN_LOWER, HIGH);
        } else {
            digitalWrite(SSR_PIN_UPPER, LOW);
            digitalWrite(SSR_PIN_LOWER, LOW);
        }
    } else {
        // Force SSRs off in IDLE or EMERGENCY_STOP
        digitalWrite(SSR_PIN_UPPER, LOW);
        digitalWrite(SSR_PIN_LOWER, LOW);
    }

    // 4. Update LED Indicator
    updateLedIndicator();
    reportStatus();
}

void reportStatus() {
    // Report current status as JSON every repott interval
    if (millis() - lastReportTime >= reportInterval) {
        lastReportTime = millis();
        
        JsonDocument doc;
        switch (currentState) {
            case IDLE: doc["state"] = "IDLE"; break;
            case RAMP: doc["state"] = "RAMP"; break;
            case SOAK: doc["state"] = "SOAK"; break;
            case COOLING: doc["state"] = "COOLING"; break;
            case EMERGENCY_STOP: doc["state"] = "EMERGENCY_STOP"; break;
        }

        doc["targetTemperature"] = targetTemperature;
        doc["setpoint"] = setpoint;
        doc["input"] = input;
        doc["ssrUpper"] = digitalRead(SSR_PIN_UPPER) == HIGH;
        doc["ssrLower"] = digitalRead(SSR_PIN_LOWER) == HIGH;
        doc["output"] = output;
        doc["isSimulated"] = isSimulated;

        serializeJson(doc, Serial_);
        Serial_.println();
    }
}

void updateLedIndicator() {
    unsigned long now = millis();
    unsigned long onTime = 0;
    unsigned long offTime = 0;

    switch (currentState) {
        case RAMP:
            digitalWrite(LED_PIN, HIGH); // Solid on
            return; // Exit function, no blinking needed
        case SOAK:
            onTime = 500; // Slow flash
            offTime = 500;
            break;
        case EMERGENCY_STOP:
            onTime = 100; // Rapid flash
            offTime = 100;
            break;
        case IDLE:
        case COOLING:
        default:
            digitalWrite(LED_PIN, LOW); // Solid off
            return; // Exit function
    }

    // Blinking logic for SOAK and EMERGENCY_STOP
    if (ledState == HIGH && (now - ledLastChangeTime >= onTime)) {
        ledState = LOW;
        ledLastChangeTime = now;
        digitalWrite(LED_PIN, ledState);
    } else if (ledState == LOW && (now - ledLastChangeTime >= offTime)) {
        ledState = HIGH;
        ledLastChangeTime = now;
        digitalWrite(LED_PIN, ledState);
    }
}

void handleCommand(JsonDocument& doc) {
    const char* command = doc["command"];

    if (strcmp(command, "start") == 0) {
        currentState = RAMP;
        JsonDocument response;
        response["status"] = "ok";
        response["message"] = "Kiln started";
        serializeJson(response, Serial_);
        Serial_.println();
    } else if (strcmp(command, "stop") == 0) {
        currentState = IDLE;
        isSimulated = false; // Added
        digitalWrite(SSR_PIN_UPPER, LOW); // Ensure SSR is off
        digitalWrite(SSR_PIN_LOWER, LOW);
        JsonDocument response;
        response["status"] = "ok";
        response["message"] = "Kiln stopped";
        serializeJson(response, Serial_);
        Serial_.println();
    } else if (strcmp(command, "profile") == 0) {
        // Example of setting a profile
        // {"command":"profile", "targetTemperature": 1000, "rampTime": 60, "soakDuration": 600}
        targetTemperature = doc["targetTemperature"];
        
        // Reset the current setpoint to the current input so we ramp from here
        if (input > 0 && !isnan(input)) {
            setpoint = input;
        } else {
            setpoint = 0;
        }
        
        if (doc["rampTime"].is<double>()) {
            double rampTime = doc["rampTime"]; // in minutes
            if (rampTime > 0) {
                // Calculate rampRate in degrees per hour
                rampRate = ((targetTemperature - setpoint) / rampTime) * 60.0;
                if (rampRate < 0) rampRate = -rampRate; // Ensure positive rate
            } else {
                rampRate = 300; // Default or fallback
            }
        } else {
            rampRate = 300; // Default
        }

        if (doc["soakDuration"].is<unsigned long>()) {
            unsigned long durationMinutes = doc["soakDuration"];
            soakDuration = durationMinutes * 60000;
        } else {
            soakDuration = 600000; // Default to 10 minutes
        }

        if (doc["coolTime"].is<double>()) {
            double coolTime = doc["coolTime"]; // in minutes
            if (coolTime > 0) {
                 // Calculate coolRate in degrees per hour to get to 25C
                 // (Current Target - 25) / Hours
                coolRate = ((targetTemperature - 25) / coolTime) * 60.0;
                if (coolRate < 0) coolRate = -coolRate; 
            } else {
                coolRate = 0; // Natural cooling
            }
        } else {
            coolRate = 0; // Default to natural cooling
        }
        
        JsonDocument response;
        response["status"] = "ok";
        response["message"] = "Profile updated";
        serializeJson(response, Serial_);
        Serial_.println();
    } else if (strcmp(command, "status") == 0) {
        reportStatus();
    } else if (strcmp(command, "testInput") == 0) {
        // {"command": "testInput", "temperature": 500, "duration": 5, "setPoint": 1000}
        if (doc["temperature"].is<float>()) {
            simulatedInput = doc["temperature"];
            
            // Optional duration (default to existing timeout if not provided, or some default)
            if (doc["duration"].is<unsigned long>()) {
                unsigned long durationMinutes = doc["duration"];
                simulationTimeout = durationMinutes * 60000;
                simulationStartTime = millis();
            } else if (simulationTimeout == 0) {
                 // If no duration provided and we aren't already running, default to a safe value or infinite? 
                 // Let's say if no duration is sent, we just update the temp and keep existing timer 
                 // If timer expired or not set, default to 5 minutes for safety
                 if (!isSimulated) {
                     simulationTimeout = 5 * 60000;
                     simulationStartTime = millis();
                 }
            }

            // Optional setPoint
            if (doc["setPoint"].is<double>()) {
                setpoint = doc["setPoint"];
            }

            isSimulated = true;

            JsonDocument response;
            response["status"] = "ok";
            response["message"] = "Simulation started/updated";
            serializeJson(response, Serial_);
            Serial_.println();
        } else {
            JsonDocument response;
            response["status"] = "error";
            response["message"] = "Missing temperature";
            serializeJson(response, Serial_);
            Serial_.println();
        }
    }
}
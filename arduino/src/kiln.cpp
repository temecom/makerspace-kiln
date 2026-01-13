#include <Arduino.h>
#include <PID_v1.h>
#include <Adafruit_MAX31855.h>
#include "kiln.h"

// --- Hardware Pins ---
#define DO   3
#define CS   4
#define CLK  5
#define SSR_PIN 6
#define LED_PIN 13 // Built-in LED

// --- State Machine ---
enum KilnState { IDLE, RAMP, SOAK, COOLING, EMERGENCY_STOP };
KilnState currentState = IDLE;

// --- Thermal Variables ---
double setpoint, input, output;
double Kp=2, Ki=0.5, Kd=2; // Initial tuning values
double rampRate = 300; // degrees per hour
PID kilnPID(&input, &output, &setpoint, Kp, Ki, Kd, DIRECT);

Adafruit_MAX31855 thermocouple(CLK, CS, DO);

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

void setup() {
    // Initialize the external USB-to-Serial adapter for logging
    Serial_.begin(9600); 
    while(!Serial_); // Wait for Serial to be ready
    delay(2000); // Allow time for connection
    Serial_.println("{\"state\": \"setup\", \"message\": \"Kiln controller starting up...\"}");
    pinMode(SSR_PIN, OUTPUT);
    pinMode(LED_PIN, OUTPUT);
    
    windowStartTime = millis();
    kilnPID.SetOutputLimits(0, windowSize);
    kilnPID.SetMode(AUTOMATIC);
}

void loop() {
    // 1. Read Temperature
    input = thermocouple.readCelsius();
    
    if (isnan(input)) {
        currentState = EMERGENCY_STOP;
   }

    // 2. Logic for State Transitions (simplified example)
    switch (currentState) {
        case IDLE:
            break;
        case RAMP:
            // Increment setpoint over time based on degrees/hour
           // Hold setpoint for duration
            if (output > setpoint) {
                currentState = SOAK;
            }
            setpoint += (rampRate / 3600) * (windowSize / 1000); // Update setpoint
            break;
        case SOAK:
            // Maintain setpoint for soak duration
            if(soakTimeElapsed > soakDuration) {
                currentState = COOLING;
            }
            soakTimeElapsed += windowSize;
            break;

        case COOLING:
            // Allow temperature to drop naturally
            if (input < 50) { // Arbitrary threshold to return to IDLE
                currentState = IDLE;
            }
            setpoint -= (coolRate / 3600) * (windowSize / 1000); // Decrease setpoint
            break;
        case EMERGENCY_STOP:
            digitalWrite(SSR_PIN, LOW);
            digitalWrite(LED_PIN, LOW);
            Serial_.println("{\"state\": \"EMERGENCY_STOP\", \"message\": \"Thermocouple disconnected!\"}");
 
            // The updateLedIndicator() function will handle the blinking
            break;
        default: break;
    }


    // 3. Compute PID & Control SSR
    // Only compute PID if not in an emergency stop state
    if (currentState != EMERGENCY_STOP) {
        kilnPID.Compute();

        
        unsigned long now = millis();
        if (now - windowStartTime > windowSize) {
            windowStartTime += windowSize;
        }
        
        // Time-Proportioning (Software PWM)
        if (output > (now - windowStartTime)) {
            digitalWrite(SSR_PIN, HIGH);
        } else {
            digitalWrite(SSR_PIN, LOW);
        }
    }

    // 4. Update LED Indicator
    updateLedIndicator();
    reportStatus();
}

void reportStatus() {
    // Report current status as JSON every repott interval
    if (millis() - lastReportTime >= reportInterval) {
        lastReportTime = millis();
        Serial_.print("{\"state\": \"");
        switch (currentState) {
            case IDLE: Serial_.print("IDLE"); break;
            case RAMP: Serial_.print("RAMP"); break;
            case SOAK: Serial_.print("SOAK"); break;
        case COOLING: Serial_.print("COOLING"); break;
        case EMERGENCY_STOP: Serial_.print("EMERGENCY_STOP"); break;
        }
    Serial_.print("\", \"setpoint\": ");
    Serial_.print(setpoint);
    Serial_.print(", \"input\": ");
    Serial_.print(input);
    Serial_.print(", \"output\": ");
    Serial_.print(output);
    Serial_.println("}");
    }
}

void updateLedIndicator() {
    unsigned long now = millis();
    int onTime = 0;
    int offTime = 0;

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
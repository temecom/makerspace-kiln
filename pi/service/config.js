module.exports = {
    // Serial Port Configuration
    // On Linux/RPi this is often /dev/ttyACM0 or /dev/ttyUSB0
    // On Windows this might be COM3, COM4, etc.
    serialPort: '/dev/ttyACM0', 
    baudRate: 9600,

    // Service Configuration
    statusInterval: 10000, // Poll status every 10 seconds
    serverPort: 3000,      // Port for the Web API

    // Future: Google AppScript Configuration
    // cloudApiUrl: 'https://script.google.com/macros/s/...'
};

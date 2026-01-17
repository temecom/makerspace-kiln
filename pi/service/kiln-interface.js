const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

class KilnInterface {
    constructor(portPath, baudRate = 9600) {
        this.portPath = portPath;
        this.baudRate = baudRate;
        this.port = null;
        this.parser = null;
        this.onStatusCallback = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            this.port = new SerialPort({ path: this.portPath, baudRate: this.baudRate }, (err) => {
                if (err) {
                    return reject(err);
                }
            });

            // Handle SerialPort errors (like disconnection)
            this.port.on('error', (err) => {
                console.error('Serial Port Error:', err.message);
            });

            // Arduino println() uses \r\n, so we parse lines
            this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
            
            this.parser.on('data', (data) => {
                // Ignore empty lines
                if (!data || data.trim() === '') return;
                
                try {
                    const json = JSON.parse(data);
                    this.handleData(json);
                } catch (e) {
                    // Sometimes startup messages aren't JSON
                    console.log('Raw Serial Data:', data); 
                }
            });

            this.port.on('open', () => {
                console.log(`Connected to kiln on ${this.portPath}`);
                // Allow time for Arduino autorestart on serial connection
                setTimeout(resolve, 2000); 
            });
        });
    }

    handleData(data) {
        // If it's a status report, pass it to the callback
        if (this.onStatusCallback) {
            this.onStatusCallback(data);
        } else {
            console.log('Received:', data);
        }
    }

    onStatus(callback) {
        this.onStatusCallback = callback;
    }

    sendCommand(commandObj) {
        if (!this.port || !this.port.isOpen) {
            console.error('Port not open, cannot send command:', commandObj);
            return;
        }

        const json = JSON.stringify(commandObj);
        console.log('Sending:', json);
        this.port.write(json + '\n', (err) => {
            if (err) {
                return console.log('Error on write: ', err.message);
            }
        });
    }

    // --- High Level Commands mapping to kiln.cpp ---

    start() {
        this.sendCommand({ command: 'start' });
    }

    stop() {
        this.sendCommand({ command: 'stop' });
    }

    /**
     * Set the kiln profile
     * @param {number} targetTemperature - Target temp in Celsius
     * @param {number} rampTime - Minutes to reach target
     * @param {number} soakDuration - Minutes to hold target
     * @param {number} coolTime - Minutes to cool down (determines rate)
     */
    setProfile(targetTemperature, rampTime, soakDuration, coolTime) {
        this.sendCommand({
            command: 'profile',
            targetTemperature,
            rampTime,
            soakDuration,
            coolTime
        });
    }

    getStatus() {
        this.sendCommand({ command: 'status' });
    }

    testInput(temperature, duration, setPoint) {
        const cmd = {
            command: 'testInput',
            temperature: temperature
        };
        if (duration !== undefined) cmd.duration = duration;
        if (setPoint !== undefined) cmd.setPoint = setPoint;
        
        this.sendCommand(cmd);
    }
}

module.exports = KilnInterface;

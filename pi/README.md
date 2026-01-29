# Kiln Controller (RPi Node.js Service)

This service manages communication between the Arduino Kiln Controller and the Cloud API.

## Setup

1. Navigate to this directory:
   ```bash
   cd pi
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Serial Port:
   - The default port is `/dev/ttyACM0`.
   - To change it, create a `.env` file in this directory:
     ```
     SERIAL_PORT=/dev/ttyUSB0
     ```

## Usage

Start the service:
```bash
npm start
```

## Features

- connects to Arduino via USB Serial
- Parses JSON status updates
- Sends JSON commands (start, stop, profile settings)
- Handles graceful shutdown

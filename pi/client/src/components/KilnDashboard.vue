<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from 'axios'

const status = ref({
  state: 'UNKNOWN',
  input: 0,
  setpoint: 0,
  targetTemperature: 0,
  timestamp: 0,
  ssrUpper: false,
  ssrLower: false
})
const loading = ref(false)
const message = ref('')

let eventSource = null

// Profile Form
const profile = ref({
  targetTemperature: 1000,
  rampTime: 60,
  soakDuration: 10,
  coolTime: 60
})

// Test Mode Form
const testParams = ref({
  temperature: 25,
  duration: 5,
  setPoint: 25
})

const isStale = computed(() => {
  if (!status.value.timestamp) return true
  return (Date.now() - status.value.timestamp) > 15000 // 15 seconds
})

const startKiln = async () => {
  try {
    await axios.post('/api/start')
    message.value = 'Start command sent'
  } catch (err) {
    message.value = 'Error sending start'
  }
}

const stopKiln = async () => {
  try {
    await axios.post('/api/stop')
    message.value = 'Stop command sent'
  } catch (err) {
    message.value = 'Error sending stop'
  }
}

const updateProfile = async () => {
  try {
    await axios.post('/api/profile', profile.value)
    message.value = 'Profile updated'
  } catch (err) {
    message.value = 'Error updating profile'
  }
}

const startTest = async () => {
  try {
    await axios.post('/api/test', testParams.value)
    message.value = 'Test mode initiated'
  } catch (err) {
    message.value = 'Error initiating test mode'
  }
}

onMounted(() => {
  // Setup SSE
  eventSource = new EventSource('/api/events');
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      status.value = data;
    } catch (e) {
      console.error('Error parsing SSE data', e);
    }
  };

  eventSource.onerror = (err) => {
    console.error('EventSource error:', err);
    // EventSource will automatically try to reconnect
  };
})

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
})
</script>

<template>
  <div class="dashboard">
    <h1>Kiln Controller</h1>
    
    <div class="status-panel" :class="{ stale: isStale }">
      <h2>Status: {{ status.state }}</h2>
      <div class="readings">
        <div class="reading">
          <span class="label">Current Temp</span>
          <span class="value">{{ status.input ? status.input.toFixed(1) : '--' }} °C</span>
        </div>
        <div class="reading">
          <span class="label">Setpoint</span>
          <span class="value">{{ status.setpoint ? status.setpoint.toFixed(1) : '--' }} °C</span>
        </div>
        <div class="reading">
          <span class="label">Target</span>
          <span class="value">{{ status.targetTemperature }} °C</span>
        </div>
      </div>
      <div class="ssr-status">
        <span :class="status.ssrUpper ? 'ssr-active' : 'ssr-inactive'">Upper: {{ status.ssrUpper ? 'ON' : 'OFF' }}</span>
        <span :class="status.ssrLower ? 'ssr-active' : 'ssr-inactive'">Lower: {{ status.ssrLower ? 'ON' : 'OFF' }}</span>
      </div>
      <p v-if="isStale" class="warning">Status is stale. (Last update: {{ new Date(status.timestamp).toLocaleTimeString() }})</p>
    </div>

    <div v-if="message" class="message">{{ message }}</div>

    <div class="controls-grid">
      <div class="card control-panel">
        <h3>Controls</h3>
        <div class="buttons">
          <button @click="startKiln" class="start-btn">START</button>
          <button @click="stopKiln" class="stop-btn">STOP</button>
        </div>
      </div>

      <div class="card profile-panel">
        <h3>Firing Profile</h3>
        <div class="form-group">
          <label>Target Temp (°C)</label>
          <input v-model.number="profile.targetTemperature" type="number">
        </div>
        <div class="form-group">
          <label>Ramp Time (min)</label>
          <input v-model.number="profile.rampTime" type="number">
        </div>
        <div class="form-group">
          <label>Soak Duration (min)</label>
          <input v-model.number="profile.soakDuration" type="number">
        </div>
        <div class="form-group">
          <label>Cool Time (min)</label>
          <input v-model.number="profile.coolTime" type="number">
        </div>
        <button @click="updateProfile">Update Profile</button>
      </div>

      <div class="card test-panel">
        <h3>Test Mode</h3>
        <div class="form-group">
          <label>Simulated Temp (°C)</label>
          <input v-model.number="testParams.temperature" type="number">
        </div>
        <div class="form-group">
          <label>Duration (min)</label>
          <input v-model.number="testParams.duration" type="number">
        </div>
        <div class="form-group">
          <label>Setpoint (°C)</label>
          <input v-model.number="testParams.setPoint" type="number">
        </div>
        <button @click="startTest">Start Test Simulation</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 800px;
  margin: 0 auto;
}
.status-panel {
  background: #1a1a1a;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
  border: 1px solid #333;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
.status-panel.stale {
  border: 2px solid orange;
}
.status-panel h2 {
  margin-top: 0;
  color: #e1e1e1;
  font-size: 1.8em;
  border-bottom: 1px solid #333;
  padding-bottom: 12px;
}
.readings {
  display: flex;
  justify-content: space-around;
  margin: 30px 0;
  gap: 20px;
}
.reading {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  background: #252525;
  padding: 15px;
  border-radius: 8px;
}
.reading .label {
  color: #888;
  font-size: 0.85em;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.reading .value {
  font-size: 2.2em;
  font-weight: bold;
  color: #4cc9f0; /* Bright Cyan for high visibility */
  font-family: 'Courier New', monospace; /* Monospace for numbers */
}
.ssr-status {
  display: flex;
  gap: 30px;
  justify-content: center;
  font-weight: 600;
  background: #252525;
  padding: 15px;
  border-radius: 8px;
  margin-top: 20px;
}
.ssr-active {
  color: #4cc9f0;
  text-shadow: 0 0 8px rgba(76, 201, 240, 0.4);
}
.ssr-inactive {
  color: #555;
}
.warning {
  color: #ff9f43;
  font-weight: bold;
  margin-top: 15px;
}
.message {
  padding: 12px;
  background: #2c3e50;
  color: white;
  margin-bottom: 20px;
  border-radius: 4px;
  border-left: 4px solid #3498db;
}
.controls-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}
@media (min-width: 600px) {
  .controls-grid {
    grid-template-columns: 1fr 1fr;
  }
  .profile-panel {
    grid-column: 1 / -1;
  }
}
.buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.start-btn {
  background-color: #2da44e;
  color: white;
}
.stop-btn {
  background-color: #cf222e;
  color: white;
}
.form-group {
  margin-bottom: 10px;
  text-align: left;
}
.form-group label {
  display: block;
  margin-bottom: 4px;
}
.form-group input {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
}
</style>

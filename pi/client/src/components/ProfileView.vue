<script setup>
import { ref } from 'vue'
import axios from 'axios'

const props = defineProps({
  profile: Object
})

const emit = defineEmits(['update:profile'])

const message = ref('')

const updateProfile = async () => {
  try {
    // The prop is already up-to-date thanks to the v-model binding
    await axios.post('/api/profile', props.profile)
    message.value = 'Profile updated'
  } catch (err) {
    message.value = 'Error updating profile'
  }
}

// Helper function to update a field in the profile object
const updateField = (field, value) => {
  emit('update:profile', { ...props.profile, [field]: value })
}
</script>

<template>
  <div class="card profile-panel">
    <h3>Firing Profile</h3>
    <div v-if="message" class="message">{{ message }}</div>
    <div class="form-group">
      <label>Target Temp (°C)</label>
      <input 
        :value="profile.targetTemperature" 
        @input="updateField('targetTemperature', $event.target.valueAsNumber)" 
        type="number"
      >
    </div>
    <div class="form-group">
      <label>Ramp Time (min)</label>
      <input 
        :value="profile.rampTime" 
        @input="updateField('rampTime', $event.target.valueAsNumber)" 
        type="number"
      >
    </div>
    <div class="form-group">
      <label>Soak Duration (min)</label>
      <input 
        :value="profile.soakDuration" 
        @input="updateField('soakDuration', $event.target.valueAsNumber)" 
        type="number"
      >
    </div>
    <div class="form-group">
      <label>Cool Time (min)</label>
      <input 
        :value="profile.coolTime" 
        @input="updateField('coolTime', $event.target.valueAsNumber)" 
        type="number"
      >
    </div>
    <button @click="updateProfile">Update Profile</button>
  </div>
</template>

<style scoped>
.profile-panel {
  grid-column: 1 / -1;
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
.message {
  padding: 12px;
  background: #2c3e50;
  color: white;
  margin-bottom: 20px;
  border-radius: 4px;
  border-left: 4px solid #3498db;
}
</style>

<script setup>
import { ref, computed } from 'vue'
import KilnDashboard from './components/KilnDashboard.vue'
import ProfileView from './components/ProfileView.vue'
import TestView from './components/TestView.vue'
import HistoryView from './components/HistoryView.vue'
import PreferenceView from './components/PreferenceView.vue'
import PlotView from './components/PlotView.vue'

const routes = {
  '/': KilnDashboard,
  '/profile': ProfileView,
  '/test': TestView,
  '/history': HistoryView,
  '/preferences': PreferenceView
  // PlotView is handled dynamically
}

const currentPath = ref(window.location.hash)

// Shared state for profile and test parameters
const profile = ref({
  targetTemperature: 1000,
  rampTime: 60,
  soakDuration: 10,
  coolTime: 60
})

const testParams = ref({
  temperature: 25,
  duration: 5,
  setPoint: 25
})

window.addEventListener('hashchange', () => {
  currentPath.value = window.location.hash
})

const currentView = computed(() => {
  const path = currentPath.value.slice(1) || '/';
  const mainPath = path.split('?')[0];

  if (mainPath === '/history/plot') {
    return PlotView;
  }
  // Ensure we match '/history' correctly
  return routes[mainPath] || routes['/'];
});

const currentViewProps = computed(() => {
  const path = currentPath.value.slice(1) || '/';
  const [mainPath, queryString] = path.split('?');

  if (mainPath === '/history/plot' && queryString) {
    const params = new URLSearchParams(queryString);
    const sessionId = params.get('sessionId');
    if (sessionId) {
      return { sessionId };
    }
  }

  // Default props for other views
  return {
    profile: profile.value,
    testParams: testParams.value
  };
});
</script>

<template>
  <div class="app-container">
    <header>
      <h1>Kiln Controller</h1>
      <nav>
        <a href="#/">Dashboard</a>
        <a href="#/profile">Profile</a>
        <a href="#/test">Test</a>
        <a href="#/history">History</a>
        <a href="#/preferences">Preferences</a>
      </nav>
    </header>
    <main>
      <component 
        :is="currentView" 
        v-bind="currentViewProps"
        @update:profile="Object.assign(profile, $event)"
        @update:testParams="Object.assign(testParams, $event)"
      />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
header {
  background: #1f1f1f;
  padding: 1rem;
  border-bottom: 1px solid #333;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
header h1 {
  margin: 0;
  font-size: 1.5rem;
}
nav {
  display: flex;
  gap: 1rem;
}
nav a {
  color: #ccc;
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.3s, color 0.3s;
}
nav a:hover,
nav a.router-link-active {
  background-color: #333;
  color: #fff;
}
main {
  flex: 1;
  padding: 1rem;
  overflow-y: auto;
}
</style>

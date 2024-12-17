<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Settings from './components/Settings.vue';
import List from './components/List.vue';

const route = ref('')
const enterAction = ref({})

onMounted(() => {
  window.utools.onPluginEnter((action) => {
    route.value = action.code
    enterAction.value = action
  })
  window.utools.onPluginOut((isKill) => {
    route.value = ''
  })
})
</script>

<template>
  <div class="container">
    <Settings v-if="route === 'settings'" />
    <List v-if="route === 'pass'" />
  </div>
</template>

<style scoped>
.container {
  height: 100vh;
  width: 100vw;
  background-color: #f5f5f5;
}
</style>


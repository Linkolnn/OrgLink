<template>
  <div class="app">
    <MessengerSideBar v-if="isAuthenticated"/>
    <main class="main container">
      <NuxtPage />
    </main>
  </div>
</template>

<script setup>
const authStore = useAuthStore();
const { isAuthenticated } = storeToRefs(authStore);

</script>
<style lang="sass">

*
  margin: 0
  padding: 0
  box-sizing: border-box
  font-family: "Roboto", -apple-system, BlinkMacSystemFont, "Apple Color Emoji", "Segoe UI", Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif
  touch-action: manipulation
  -webkit-user-select: none
  user-select: none
  &:focus, &:active, *:focus, *:active
    -webkit-tap-highlight-color: transparent

.app
  display: flex

.main
  flex: 1

</style>
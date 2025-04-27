<template>
  <MainLoginForm v-if="!isAuthenticated" @login-success="handleLogin"/>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

definePageMeta({
  middleware: ['auth']
});

const authStore = useAuthStore();
const router = useRouter();
const { $loader } = useNuxtApp();
const { isAuthenticated, isLoggingOut } = storeToRefs(authStore);

// Обработка успешного входа
const handleLogin = async (userData) => {
  authStore.setUser(userData);
  // Запускаем лоадер вручную 
  $loader.start();
  // Задержка перед редиректом для плавного UX
  await new Promise(resolve => setTimeout(resolve, 300));
  router.push('/messenger');
};
</script>

<style lang="sass">

</style>
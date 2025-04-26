<template>
  <main class="main container">
      <LoginForm v-if="!isAuthenticated" @login-success="handleLogin"/>
      <div v-else>
          <h1>Authenticated!</h1>
          <p>Redirecting to messenger...</p>
      </div>
  </main>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

// Получаем статус авторизации из Pinia
const authStore = useAuthStore();
const router = useRouter();
const { isAuthenticated } = storeToRefs(authStore);

// Проверяем токен при загрузке
onMounted(async () => {
  await authStore.checkAuth();
  if (isAuthenticated.value) {
    navigateToMessenger();
  }
});

// Обработка успешного входа
const handleLogin = (userData) => {
  authStore.setUser(userData);
  navigateToMessenger();
};

// Функция для перенаправления на страницу мессенджера
const navigateToMessenger = () => {
  router.push('/messenger');
};
</script>
<style lang="sass">
.main
  max-width: 1200px
  margin: 0 auto
  display: flex
  justify-content: center
  align-items: center
  min-height: 100vh
</style>
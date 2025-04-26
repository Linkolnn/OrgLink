<template>
  <main class="main container">
      <LoginForm v-if="!isAuthenticated" @login-success="handleLogin"/>
      <div v-else-if="isLoading">
          <h1>Выполняется выход из системы...</h1>
          <p>Пожалуйста, подождите...</p>
      </div>
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
const { isAuthenticated, logoutInProgress } = storeToRefs(authStore);
const isLoading = ref(false);

// Проверяем, не происходит ли выход из системы
const checkLogoutStatus = () => {
  if (process.client) {
    const logoutInProgress = localStorage.getItem('logout_in_progress');
    return logoutInProgress === 'true';
  }
  return false;
};

// Проверяем токен при загрузке
onMounted(async () => {
  isLoading.value = true;
  
  // Проверяем флаг выхода из системы
  if (checkLogoutStatus()) {
    // Если выход в процессе, ждем и не перенаправляем
    setTimeout(() => {
      isLoading.value = false;
    }, 500);
    return;
  }
  
  await authStore.checkAuth();
  
  if (isAuthenticated.value && !logoutInProgress.value) {
    navigateToMessenger();
  }
  
  isLoading.value = false;
});

// Обработка успешного входа
const handleLogin = (userData) => {
  authStore.setUser(userData);
  navigateToMessenger();
};

// Функция для перенаправления на страницу мессенджера
const navigateToMessenger = () => {
  // Проверяем, не происходит ли выход из системы
  if (!checkLogoutStatus() && !logoutInProgress.value) {
    router.push('/messenger');
  }
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
<template>
  <main class="main container">
    <LoginForm v-if="!isAuthenticated" @login-success="handleLogin"/>
    <div v-else-if="isLoggingOut" class="loading">
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

const authStore = useAuthStore();
const router = useRouter();
const { isAuthenticated, isLoggingOut } = storeToRefs(authStore);

// Проверяем токен при загрузке
onMounted(async () => {
  if (!isLoggingOut.value) {
    await authStore.checkAuth();
    if (isAuthenticated.value) {
      router.push('/messenger');
    }
  }
});

// Обработка успешного входа
const handleLogin = (userData) => {
  authStore.setUser(userData);
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

.loading
  text-align: center
  
  h1
    margin-bottom: 10px
    color: #333
    
  p
    color: #666
</style>
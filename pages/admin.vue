<template>
  <div v-if="authStore.isAdmin" class="admin-panel">
    <h1>Панель администратора</h1>
    <div class="admin-content">
      <p>Здесь будет содержимое панели администратора</p>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';

const authStore = useAuthStore();
const router = useRouter();

onMounted(async () => {
  // Если пользователь не авторизован, перенаправляем на главную страницу
  if (!authStore.isAuthenticated) {
    return router.push('/');
  }
  
  // Если пользователь не админ, перенаправляем в мессенджер
  if (authStore.user && authStore.user.role !== 'admin') {
    return router.push('/messenger');
  }
});
</script>

<style scoped>
.admin-panel {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 20px;
  color: #333;
}

.admin-content {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
</style> 
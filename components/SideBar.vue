<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="dropdown">
        <button class="dropdown-toggle" @click="toggleMenu">
          Меню
        </button>
        <div v-if="isMenuOpen" class="dropdown-menu">
          <div class="dropdown-item" @click="navigateTo('/messenger')">Мессенджер</div>
          <div v-if="authStore.isAdmin" class="dropdown-item" @click="navigateTo('/admin')">Админ панель</div>
          <div class="dropdown-item" @click="logout">Выйти</div>
        </div>
      </div>
      <h3>Чаты</h3>
    </div>
    
    <!-- Отображение информации о пользователе (добавлено для отладки) -->
    <div v-if="authStore.user" class="user-info">
      <p><strong>Пользователь:</strong> {{ authStore.user.name }}</p>
      <p><strong>Email:</strong> {{ authStore.user.email }}</p>
      <p><strong>Роль:</strong> {{ authStore.user.role }}</p>
      <p><strong>isAdmin:</strong> {{ authStore.isAdmin }}</p>
    </div>
    
    <div class="chats-list">
      <!-- Здесь будет список чатов -->
      <p>Список чатов будет здесь</p>
    </div>
  </aside>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const isMenuOpen = ref(false);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
};

const navigateTo = (path) => {
  router.push(path);
  isMenuOpen.value = false;
};

const logout = () => {
  authStore.logout();
  router.push('/');
  isMenuOpen.value = false;
};

// Закрытие меню при клике вне
const handleClickOutside = (event) => {
  const dropdown = document.querySelector('.dropdown');
  if (dropdown && !dropdown.contains(event.target)) {
    isMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.sidebar {
  width: 300px;
  height: 100vh;
  background-color: #f5f5f5;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 15px;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
}

/* Стили для блока информации о пользователе */
.user-info {
  padding: 15px;
  background-color: #e9e9e9;
  border-bottom: 1px solid #ddd;
  font-size: 14px;
}

.user-info p {
  margin: 5px 0;
}

.dropdown {
  position: relative;
  margin-right: 15px;
}

.dropdown-toggle {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.dropdown-toggle span {
  margin-left: 5px;
  font-size: 16px;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  min-width: 180px;
  z-index: 100;
}

.dropdown-item {
  padding: 10px 15px;
  cursor: pointer;
}

.dropdown-item:hover {
  background-color: #f0f0f0;
}

.chats-list {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}
</style> 
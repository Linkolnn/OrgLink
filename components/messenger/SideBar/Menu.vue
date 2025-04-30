<template>
  <div class="sidebar__dropdown dropdown">
    <button class="dropdown__toggle" @click="toggleMenu">
      Меню
    </button>
    <div v-if="isMenuOpen" class="dropdown__menu">
      <NuxtLink v-if="authStore.isAdmin" to="/admin" class="dropdown__item" @click="navigateTo('/admin')">Админ панель</NuxtLink>
      <button @click="logout" class="dropdown__item dropdown__item--logout">Выйти</button>
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const router = useRouter();

// Состояние для отображения/скрытия меню
const isMenuOpen = ref(false);

// Выход из аккаунта
function logout() {
  authStore.logout();
  router.push('/login');
  isMenuOpen.value = false;
}

// Переключение меню
function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

// Плавная навигация между страницами
function navigateTo(path) {
  // Закрываем меню
  isMenuOpen.value = false;
  
  // Получаем доступ к глобальному состоянию
  const nuxtApp = useNuxtApp();
  
  // Если мы на мобильном устройстве, скрываем боковую панель
  if (window.innerWidth <= 859) {
    setTimeout(() => {
      if (nuxtApp.$sidebarVisible) {
        nuxtApp.$sidebarVisible.value = false;
      }
    }, 50);
  }
  
  // Проверяем, что мы не находимся на той же странице
  if (router.currentRoute.value.path !== path) {
    // Добавляем плавный переход
    document.body.classList.add('page-transition');
    
    // Задержка перед навигацией для анимации
    setTimeout(() => {
      router.push(path);
      
      // Удаляем класс перехода после завершения навигации
      setTimeout(() => {
        document.body.classList.remove('page-transition');
      }, 300);
    }, 150);
  }
}
</script>

<style lang="sass" scoped>
@import '~/assets/styles/variables'

// Дропдаун
.dropdown
  position: relative
  
  &__toggle
    background-color: transparent
    color: $white
    border: none
    cursor: pointer
    padding: 6px 0
    font-size: 14px
    
    &:hover
      text-decoration: underline
  
  &__menu
    position: absolute
    top: 100%
    left: 0
    background-color: $header-bg
    border: 1px solid rgba($white, 0.1)
    border-radius: $scrollbar-radius
    z-index: 10
    min-width: 160px
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2)
  
  &__item
    display: block
    padding: 10px 16px
    color: $white
    text-decoration: none
    cursor: pointer
    border: none
    background: none
    width: 100%
    text-align: left
    font-size: 14px
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: rgba($white, 0.1)
    
    &--logout
      color: #ff6b6b
</style>

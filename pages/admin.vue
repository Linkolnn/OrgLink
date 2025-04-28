<template>
  <div class="admin-panel">
    <div class="admin-panel__header">
      <!-- Кнопка переключения боковой панели для мобильных устройств -->
      <button class="toggle-sidebar-btn" @click="toggleSidebar">
        <i class="fas fa-bars"></i>
      </button>
      <h1 class="admin-panel__title">Панель администратора</h1>
    </div>
    <div class="admin-panel__content">
      <AdminUserManagment />
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { ref, computed } from 'vue';
import { useNuxtApp } from '#app';
import AdminUserManagment from '~/components/admin/AdminUserManagment.vue';

definePageMeta({
  middleware: ['auth'],
  requiresAuth: true,
  requiresAdmin: true
});

// Функция для переключения боковой панели на мобильных устройствах
const toggleSidebar = () => {
  // Получаем доступ к глобальному состоянию видимости боковой панели
  const nuxtApp = useNuxtApp();
  
  // Если есть доступ к глобальному состоянию
  if (nuxtApp && nuxtApp.$sidebarVisible !== undefined) {
    nuxtApp.$sidebarVisible.value = !nuxtApp.$sidebarVisible.value;
  } else {
    // Фоллбэк: прямое переключение класса в DOM
    const app = document.querySelector('.app');
    if (app) {
      app.classList.toggle('sidebar-visible');
    }
  }
  
  // Принудительно обновляем состояние приложения
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 100);
};
</script>

<style lang="sass">
@import '~/assets/styles/variables'

.admin-panel
  padding: 20px
  height: 100%
  display: flex
  flex-direction: column
  
  &__header
    display: flex
    align-items: center
    padding: 10px 0
    margin-bottom: 20px
    background-color: $header-bg
    border-radius: $radius
    padding: 15px 20px
    
    // Кнопка переключения боковой панели
    .toggle-sidebar-btn
      display: none
      background: transparent
      border: none
      color: $white
      font-size: 20px
      cursor: pointer
      padding: 5px 10px
      margin-right: 15px
      transition: all 0.2s ease
      
      &:hover
        color: rgba(255, 255, 255, 0.8)
      
      @include tablet
        display: block
  
  &__title
    color: $white
    margin: 0
    font-size: 20px
    
  &__content
    flex: 1
    overflow-y: auto
    @include custom-scrollbar
    
  @include tablet
    padding: 10px

.access-denied
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  height: 100vh
  text-align: center
  
  h1
    color: #e74c3c
    margin-bottom: 10px
  
  p
    color: #666
    margin-bottom: 20px
  
  .back-btn
    padding: 8px 16px
    background-color: #3498db
    color: white
    border: none
    border-radius: 4px
    cursor: pointer
    
    &:hover
      background-color: #2980b9

.logout-progress
  display: flex
  flex-direction: column
  justify-content: center
  align-items: center
  height: 100vh
  
  h2
    color: #666
    margin-bottom: 10px
    
  p
    color: #999
    margin-bottom: 20px
</style> 
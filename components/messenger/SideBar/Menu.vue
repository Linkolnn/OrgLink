<template>
  <div class="sidebar__dropdown dropdown">
    <!-- Бургер-кнопка, которая превращается в крестик -->
    <button class="hamburger hamburger--slider" :class="{ 'is-active': isMenuOpen }" @click="toggleMenu" type="button">
      <span class="hamburger-box">
        <span class="hamburger-inner"></span>
      </span>
    </button>
    
    <!-- Оверлей для закрытия меню -->
    <div v-if="isMenuOpen" class="dropdown__overlay" @click="toggleMenu"></div>
    
    <!-- Меню -->
    <div v-if="isMenuOpen" class="dropdown__menu">
      <button @click="showUserProfile" class="dropdown__item">Мой профиль</button>
      <NuxtLink v-if="authStore.isAdmin" to="/admin" class="dropdown__item" @click="navigateTo('/admin')">Админ панель</NuxtLink>
      <button @click="logout" class="dropdown__item dropdown__item--logout">Выйти</button>
    </div>
  </div>
  
  <!-- Модальное окно профиля пользователя -->
  <div v-if="isProfileModalOpen" class="profile-modal-overlay" @click.self="closeUserProfile">
    <div class="profile-modal-content">
      <button class="profile-modal-close" @click="closeUserProfile">×</button>
      <MessengerUserProfile />
    </div>
  </div>
</template>

<script setup>
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const router = useRouter();

// Состояние для отображения/скрытия меню
const isMenuOpen = ref(false);

// Состояние для модального окна профиля
const isProfileModalOpen = ref(false);

// Выход из аккаунта
function logout() {
  authStore.logout();
  router.push('/');
  isMenuOpen.value = false;
}

// Переключение меню
function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

// Показать профиль пользователя
function showUserProfile() {
  isProfileModalOpen.value = true;
  isMenuOpen.value = false; // Закрываем меню при открытии профиля
}

// Закрыть профиль пользователя
function closeUserProfile() {
  isProfileModalOpen.value = false;
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

<style lang="sass">
@import '@variables'

// Дропдаун
.dropdown
  position: relative
  display: flex
  align-items: center
  
  &__toggle
    background-color: transparent
    color: $white
    border: none
    cursor: pointer
    padding: 6px 0
    font-size: 14px
    
  // Бургер-кнопка (используем проверенный подход)
  .hamburger
    padding: 0
    display: inline-block
    cursor: pointer
    transition-property: opacity, filter
    transition-duration: 0.15s
    transition-timing-function: linear
    font: inherit
    color: inherit
    text-transform: none
    background-color: transparent
    border: 0
    margin: 0
    overflow: visible
    
    &:hover
      opacity: 0.8
    
    &.is-active
      &:hover
        opacity: 0.8
      
      .hamburger-inner,
      .hamburger-inner::before,
      .hamburger-inner::after
        background-color: $white
  
  .hamburger-box
    width: 16px  // Уменьшаем с 20px до 16px
    height: 14px  // Уменьшаем с 16px до 14px
    display: inline-block
    position: relative
  
  .hamburger-inner
    display: block
    top: 50%
    margin-top: -1px
    
    &, &::before, &::after
      width: 16px  // Уменьшаем с 20px до 16px
      height: 2px  // Уменьшаем с 2px до 1.5px
      background-color: $white
      border-radius: 1.3px  // Уменьшаем радиус с 2px до 1px
      position: absolute
      transition-property: transform
      transition-duration: 0.15s
      transition-timing-function: ease
    
    &::before, &::after
      content: ""
      display: block
    
    &::before
      top: -6px  // Уменьшаем расстояние с 7px до 6px
    
    &::after
      bottom: -6px  // Уменьшаем расстояние с 7px до 6px
  
  // Анимация слайдера для бургер-кнопки
  .hamburger--slider
    .hamburger-inner
      top: 1px
      
      &::before
        top: 6px
        transition-property: transform, opacity
        transition-timing-function: ease
        transition-duration: 0.2s
      
      &::after
        top: 12px
        transition-property: transform, opacity
        transition-timing-function: ease
        transition-duration: 0.2s
    
    &.is-active
      .hamburger-inner
        // Средняя линия сдвигается вправо и поворачивается
        transform: translate3d(0, 6px, 0) rotate(45deg)
        
        &::before
          // Верхняя линия исчезает
          transform: rotate(-45deg) translate3d(-4px, -2px, 0)
          opacity: 0
        
        &::after
          // Нижняя линия сдвигается вниз и поворачивается
          transform: translate3d(0, -12px, 0) rotate(-90deg)
  
  // Оверлей для закрытия меню
  &__overlay
    position: fixed
    top: 0
    left: 0
    right: 0
    bottom: 0
    background-color: rgba(0, 0, 0, 0.1)
    z-index: 5
  
  &__menu
    position: absolute
    top: 145%
    left: -5px
    background-color: $header-bg
    border: 1px solid rgba($white, 0.1)
    border-radius: $scrollbar-radius
    z-index: 10
    min-width: 180px
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2)
    animation: fadeIn 0.2s ease-in-out
    
    @keyframes fadeIn
      from
        opacity: 0
        transform: translateY(-10px)
      to
        opacity: 1
        transform: translateY(0)
  
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

// Модальное окно профиля
.profile-modal-overlay
  position: fixed
  top: 0
  left: 0
  right: 0
  bottom: 0
  background-color: rgba(0, 0, 0, 0.7)
  display: flex
  align-items: center
  justify-content: center
  z-index: 100
  animation: fadeIn $transition-speed $transition-function

.profile-modal-content
  position: relative
  width: 90%
  max-width: 500px
  max-height: 90vh
  overflow-y: auto
  animation: slideIn $transition-speed $transition-function
  @include custom-scrollbar

.profile-modal-close
  position: absolute
  top: 10px
  right: 10px
  background: transparent
  border: none
  color: $white
  font-size: 24px
  cursor: pointer
  z-index: 101
  width: 30px
  height: 30px
  display: flex
  align-items: center
  justify-content: center
  border-radius: 50%
  transition: background-color $transition-speed $transition-function
  
  &:hover
    background-color: rgba($white, 0.1)

@keyframes fadeIn
  from
    opacity: 0
  to
    opacity: 1

@keyframes slideIn
  from
    transform: translateY(20px)
    opacity: 0
  to
    transform: translateY(0)
    opacity: 1
</style>

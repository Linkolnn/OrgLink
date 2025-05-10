<template>
  <div class="admin-page">
    <div class="admin-page__content">
      <AdminPanel />
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
import { ref, computed } from 'vue';
import { useNuxtApp } from '#app';
import AdminPanel from '~/components/admin/AdminPanel.vue';

definePageMeta({
  middleware: ['auth'],
  requiresAuth: true,
  requiresAdmin: true
});

</script>

<style lang="sass">
@import '~/assets/styles/variables'

.admin-page
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
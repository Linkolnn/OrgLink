<template>
  <div class="admin-panel">
    <h1 class="admin-panel__title">Панель администратора</h1>
    <div class="admin-panel__content">
      <AdminUserManagment />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: ['auth'],
  requiresAuth: true,
  requiresAdmin: true
});
</script>

<style lang="sass">
.admin-panel
  padding: 20px

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
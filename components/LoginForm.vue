<template>
    <section class="login-section">
        <h1>Вход в систему</h1>
        <Form :login="true" @submit="handleFormSubmit"/>
        <p v-if="error" class="error-message">{{ error }}</p>
    </section>
</template>
<script setup>
const emit = defineEmits(['login-success']);
const error = ref('');

const handleFormSubmit = async ({ email, password }) => {
  try {
    const response = await $fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { email, password },
    });
    
    localStorage.setItem('token', response.token);
    emit('login-success', response);
  } catch (err) {
    console.error('Ошибка входа:', err);
    error.value = 'Неверный email или пароль';
  }
};
</script>
<style lang="sass">
</style>
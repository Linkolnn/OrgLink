<template>
    <section class="login-section">
        <h1>Вход в систему</h1>
        <Form :login="true" @submit="handleFormSubmit"/>
        <p v-if="error" class="error-message">{{ error }}</p>
    </section>
</template>
<script setup>
const config = useRuntimeConfig();
const emit = defineEmits(['login-success']);
const error = ref('');

const handleFormSubmit = async ({ email, password }) => {
  try {
    const response = await $fetch(`${config.public.backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { email, password },
      credentials: 'include',
    });
    
    emit('login-success', response);
  } catch (err) {
    console.error('Ошибка входа:', err);
    error.value = 'Неверный email или пароль';
  }
};
</script>
<style lang="sass">
</style>
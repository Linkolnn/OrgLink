<template>
  <section class="login">
    <div class="login__container">
      <h1 class="login__title">
        <IconLogoLight class="login__logo" filled/>
        OrgLink
      </h1>
      <Form :login="true" @submit="handleFormSubmit" class="login__form"/>
      <p v-if="error" class="login__error">{{ error }}</p>
    </div>
  </section>
</template>
<script setup>
import { useAuthStore } from '~/stores/auth';

const config = useRuntimeConfig();
const authStore = useAuthStore();
const router = useRouter();
const emit = defineEmits(['login-success']);
const error = ref('');

const handleFormSubmit = async ({ email, password }) => {
  try {
    const response = await $fetch(`${config.public.backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: { email, password },
      credentials: 'include',
    });
        
    // Сохраняем токен в хранилище
    if (response.token) {
      // Сохраняем в хранилище аутентификации
      authStore.setUser({
        _id: response._id,
        name: response.name,
        email: response.email,
        role: response.role,
        token: response.token
      });
      
      // Дублируем в cookie для надежности
      const tokenCookie = useCookie('token');
      tokenCookie.value = response.token;      
    }
    
    emit('login-success', response);
    router.push('/messenger');
  } catch (err) {
    console.error('Ошибка входа:', err);
    error.value = 'Неверный email или пароль';
  }
};
</script>
<style lang="sass">
@import '~/assets/styles/variables'

.login
  height: 100vh
  display: flex
  flex-direction: column
  justify-content: center
  align-items: center
  position: relative
  overflow: hidden

  &__logo
    width: 60px
    height: 80px

  &__container
    width: 100%
    max-width: 480px
    display: flex
    flex-direction: column
    align-items: center
    padding: 0 20px
    z-index: 1

  &__title
    color: $white
    font-size: 32px
    font-weight: 700
    margin-bottom: 24px
    text-align: center

  &__form
    width: 100%
    margin-bottom: 16px

  &__error
    color: #ff5252
    background-color: rgba($white, 0.9)
    padding: 8px 16px
    border-radius: $scrollbar-radius
    font-size: 14px
    text-align: center
    width: 100%
    max-width: 400px
    margin-top: 8px

  @include mobile
    &__container
      padding: 0 16px

    &__title
      font-size: 30px
      margin-bottom: 16px

</style>
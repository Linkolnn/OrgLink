<script setup>
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';
import { useChatStore } from '~/stores/chat';

const router = useRouter();
const authStore = useAuthStore();
const { isAuthenticated } = storeToRefs(authStore);

const chatStore = useChatStore();

onMounted(async () => {
  try {
    // Проверяем аутентификацию
    if (!authStore.isAuthenticated) {
      await authStore.checkAuth();
      
      if (!authStore.isAuthenticated) {
        // Если пользователь не авторизован, перенаправляем на главную
        router.push('/');
        return; // Прерываем выполнение, если пользователь не авторизован
      }
    }
    
    // Загружаем список чатов только если пользователь авторизован
    if (authStore.isAuthenticated) {
      await chatStore.fetchChats();
    }
  } catch (error) {
    console.error('Ошибка при инициализации страницы мессенджера:', error);
    router.push('/');
  }
});

// Добавляем слежение за изменением статуса аутентификации
watch(() => authStore.isAuthenticated, async (isAuth) => {
  if (isAuth) {
    // Если пользователь только что авторизовался, загружаем чаты
    await chatStore.fetchChats();
  }
});
</script>
<template>  
    <div class="messenger-container" v-if="isAuthenticated">
        <Chat />
    </div>
</template>
<style lang="sass">
@import '~/assets/styles/variables'

.messenger-container
  display: flex
  width: 100%
  height: 100vh
  overflow: hidden
  position: relative
  
  @include tablet
    // В мобильной версии не меняем направление, чтобы сохранить анимацию сдвига

.loading-container
  display: flex
  flex-direction: column
  align-items: center
  justify-content: center
  height: 100vh
  background: $primary-bg
  color: $white
  
  .spinner
    width: 40px
    height: 40px
    border: 3px solid rgba(255, 255, 255, 0.3)
    border-radius: 50%
    border-top-color: $white
    animation: spin 1s ease-in-out infinite
    margin-bottom: 15px

@keyframes spin
  0%
    transform: rotate(0deg)
  100%
    transform: rotate(360deg)
</style>
<script setup>
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';
import { useChatStore } from '~/stores/chat';

const router = useRouter();
const authStore = useAuthStore();
const { isAuthenticated } = storeToRefs(authStore);

const chatStore = useChatStore();

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    try {
      await authStore.checkAuth();
      
      if (!authStore.isAuthenticated) {
        // Если пользователь не авторизован, перенаправляем на главную
        router.push('/');
      }
    } catch (error) {
      console.error('Ошибка аутентификации:', error);
      router.push('/');
    }
  }

  await chatStore.fetchChats();
});
</script>
<template>  
    <div class="messenger-container" v-if="isAuthenticated">
        <Chat />
    </div>
</template>
<style lang="sass">
.messenger-container
  display: flex
  width: 100%
  height: 100vh
  overflow: hidden
  
  @media (max-width: 768px)
    flex-direction: column
</style>
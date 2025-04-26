<template>
    <div class="messenger-page" v-if="isAuthenticated && !isLogoutInProgress">
        <SideBar />
        <div class="chat-area">
            <h2>Выберите чат для начала общения</h2>
        </div>
    </div>
    <div v-else-if="isLogoutInProgress" class="logout-progress">
        <h2>Выполняется выход из системы...</h2>
        <p>Пожалуйста, подождите...</p>
    </div>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const { isAuthenticated, user, logoutInProgress } = storeToRefs(authStore);
const isLogoutInProgress = ref(false);

// Проверяем, не происходит ли выход из системы
const checkLogoutStatus = () => {
  if (process.client) {
    const logoutInProgress = localStorage.getItem('logout_in_progress');
    return logoutInProgress === 'true';
  }
  return false;
};

// Перенаправление на главную страницу, если пользователь не авторизован
onMounted(async () => {
    // Сначала проверяем, не происходит ли выход
    isLogoutInProgress.value = checkLogoutStatus() || logoutInProgress.value;
    
    if (isLogoutInProgress.value) {
        // Если выход происходит, не проверяем авторизацию сразу
        setTimeout(() => {
            // Повторно проверяем через небольшую задержку
            if (!isAuthenticated.value && !checkLogoutStatus()) {
                router.push('/');
            }
            isLogoutInProgress.value = false;
        }, 500);
        return;
    }
    
    await authStore.checkAuth();
    
    if (!isAuthenticated.value && !checkLogoutStatus()) {
        console.log('Пользователь не авторизован, перенаправление на главную');
        router.push('/');
    }
});

</script>

<style lang="sass">
.messenger-page
    display: flex
    height: 100vh
    overflow: hidden

.chat-area
    flex: 1
    padding: 20px
    display: flex
    flex-direction: column
    justify-content: center
    align-items: center
    background-color: #f9f9f9
    
    h2
        color: #666
        font-weight: normal
        
.logout-progress
    display: flex
    flex-direction: column
    justify-content: center
    align-items: center
    height: 100vh
    background-color: #f9f9f9
    
    h2
        color: #666
        margin-bottom: 10px
        
    p
        color: #999
</style>
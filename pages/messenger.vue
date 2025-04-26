<template>
    <div class="messenger-page" v-if="isAuthenticated">
        <SideBar />
        <div class="chat-area">
            <h2>Выберите чат для начала общения</h2>
        </div>
    </div>
</template>

<script setup>
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const { isAuthenticated, user } = storeToRefs(authStore);

// Перенаправление на главную страницу, если пользователь не авторизован
onMounted(async () => {
    await authStore.checkAuth();
    
    if (!isAuthenticated.value) {
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
</style>
<template>
    <form class="form" @submit.prevent="handleSubmit" :class="['form', login ? '--login' : '--adminRegister']">
        <template v-if="login">
            <input class="inp inp--login"
                type="email"
                v-model="form.email"
                name="email" 
                id="email" 
                placeholder="E-mail"
            >
            <input class="inp inp--login"
                type="password"
                v-model="form.password" 
                name="password" 
                id="password" 
                placeholder="Пароль"
            >
        </template>
        <template v-if="adminRegister">
            <input class="inp inp--adminRegister"
                type="text"
                v-model="form.name"
                name="name" 
                id="name" 
                placeholder="Имя"
            >
            <input class="inp inp--adminRegister"
                type="email"
                v-model="form.email"
                name="email" 
                id="email" 
                placeholder="E-mail"
            >
            <input class="inp inp--adminRegister"
                type="tel"
                v-model="form.number"
                name="number" 
                id="number" 
                placeholder="Номер телефона"
            >
            <input class="inp inp--adminRegister"
                type="password"
                v-model="form.password"
                name="password" 
                id="password" 
                placeholder="Пароль"
            >
        </template>
        <button class="btn" :class="['btn',login ? '--login' : '--adminRegister']" type="submit">{{ login ? 'Войти' : 'Зарегистрироваться'}}</button>
    </form>
</template>
<script setup>

defineProps(['login', 'adminRegister']);
const emit = defineEmits(['submit']);

const form = ref({
    email: '',
    password: '',
    name: '',
    number: ''
});

const handleSubmit = () => {
    emit('submit', form.value);
}

</script>
<style lang="sass">

.form
    display: flex
    flex-direction: column
    gap: 10px
    width: 100%
    max-width: 400px
    margin: 0 auto

    &--login

    &--adminRegister
 
.inp
    
    &--login

    &--adminRegister

.btn

    &--login

    &--adminRegister

</style>
<template>
    <form class="form" @submit.prevent="handleSubmit" :class="['form', login ? '--login' : '--adminRegister']">
        <template v-if="login">
            <input class="inp inp--login"
                type="email"
                v-model="form.email"
                name="email" 
                id="email" 
                placeholder="E-mail"
                required
            >
            <input class="inp inp--login"
                type="password"
                v-model="form.password" 
                name="password" 
                id="password" 
                placeholder="Пароль"
                required
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
                :placeholder="isEdit ? 'Оставьте пустым, чтобы не менять' : 'Пароль'"
            >
        </template>
        <button class="btn" :class="['btn',login ? '--login' : '--adminRegister']" type="submit">{{ login ? 'Войти' : (isEdit ? 'Сохранить' : 'Зарегистрироваться') }}</button>
    </form>
</template>
<script setup>
const props = defineProps(['login', 'adminRegister', 'initialData']);
const emit = defineEmits(['submit']);

const isEdit = computed(() => {
    return props.initialData && Object.keys(props.initialData).length > 0;
});

const form = ref({
    email: '',
    password: '',
    name: '',
    number: ''
});

// При изменении initialData обновляем форму
watch(() => props.initialData, (newValue) => {
    if (newValue && Object.keys(newValue).length > 0) {
        form.value = { ...newValue, password: '' };
    }
}, { immediate: true, deep: true });

const handleSubmit = () => {
    emit('submit', form.value);
    
    form.value = {
        email: '',
        password: '',
        name: '',
        number: ''
    };
};
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
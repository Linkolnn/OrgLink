<template>
    <form class="form" @submit.prevent="handleSubmit" :class="{'form--login': login, 'form--admin': adminRegister}">
        <template v-if="login">
            <div class="form__field">
                <input class="inp form__input"
                    type="email"
                    v-model="form.email"
                    name="email" 
                    id="email" 
                    placeholder="E-mail"
                    required
                >
            </div>
            <div class="form__field">
                <input class="inp form__input"
                    type="password"
                    v-model="form.password" 
                    name="password" 
                    id="password" 
                    placeholder="Пароль"
                    required
                >
            </div>
        </template>
        <template v-if="adminRegister">
            <div class="form__field">
                <input class="inp form__input"
                    type="text"
                    v-model="form.name"
                    name="name" 
                    id="name" 
                    placeholder="Имя"
                >
            </div>
            <div class="form__field">
                <input class="inp form__input"
                    type="email"
                    v-model="form.email"
                    name="email" 
                    id="email" 
                    placeholder="E-mail"
                >
            </div>
            <div class="form__field">
                <input class="inp form__input"
                    type="tel"
                    v-model="form.number"
                    name="number" 
                    id="number" 
                    placeholder="Номер телефона"
                >
            </div>
            <div class="form__field">
                <input class="inp form__input"
                    type="password"
                    v-model="form.password"
                    name="password" 
                    id="password" 
                    :placeholder="isEdit ? 'Оставьте пустым, чтобы не менять' : 'Пароль'"
                >
            </div>
        </template>
        <div class="form__actions">
            <button class="form__button" type="submit">{{ login ? 'Войти' : (isEdit ? 'Сохранить' : 'Зарегистрироваться') }}</button>
        </div>
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
@import '~/assets/styles/variables'

.form
    display: flex
    flex-direction: column
    gap: 16px
    width: 100%
    max-width: 400px
    margin: 0 auto
    // padding: 24px
    border-radius: $radius
    background-color: $form-bg

    &--login
        padding-top: 0px
        padding-bottom: 0px
        background: transparent

    &--admin
        padding-top: 24px
        padding-bottom: 24px

    &__field
        position: relative
        width: 100%

    &__input
        background-color: $white
        color: $text-color
        border: 1px solid rgba($service-color, 0.3)
        
        &::placeholder
            color: $service-color

    &__actions
        margin-top: 8px

    &__button
        width: 100%
        padding: 12px 24px
        border: none
        border-radius: $radius
        background: #00000021
        color: $purple
        font-size: 16px
        font-weight: 600
        cursor: pointer
        transition: background-color $transition-speed $transition-function

        &:hover
            background-color: rgba($purple, 0.1)

        &:active
            background-color: rgba($purple, 0.1)

</style>
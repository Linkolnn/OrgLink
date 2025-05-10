<template>
  <div class="user-management">
    <div class="user-management__header">
      <h2 class="user-management__title">Управление пользователями</h2>
    </div>
    
    <!-- Таблица пользователей -->
    <div class="user-management__table-container">
      <table class="user-management__table">
        <thead>
          <tr>
            <th>Имя</th>
            <th>Email</th>
            <th>Роль</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user._id" @click="selectUser(user)" class="user-management__table-row">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ user.role }}</td>
            <td class="user-management__actions">
              <div class="user-management__actions-container">
                <button class="user-management__action-btn user-management__action-btn--edit" @click.stop="editUser(user)">
                  <i class="fas fa-edit"></i> Редактировать
                </button>
                <button class="user-management__action-btn user-management__action-btn--delete" @click.stop="deleteUser(user._id)">
                  <i class="fas fa-trash"></i> Удалить
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Форма добавления/редактирования пользователя -->
    <div v-if="showAddUserForm || editingUser" class="user-form-overlay">
      <div class="user-form">
        <div class="user-form__header">
          <h3>{{ editingUser ? 'Редактировать пользователя' : 'Добавить пользователя' }}</h3>
          <button class="user-form__close-btn" @click="closeForm">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <form @submit.prevent="submitUserForm">
          <div class="user-form__field">
            <label for="name">Имя</label>
            <input 
              id="name" 
              v-model="userForm.name" 
              class="inp" 
              type="text" 
              required
            />
          </div>
          <div class="user-form__field">
            <label for="email">Email</label>
            <input 
              id="email" 
              v-model="userForm.email" 
              class="inp" 
              type="email" 
              required
            />
          </div>
          <div class="user-form__field">
            <label for="password">Пароль {{ editingUser ? '(оставьте пустым, чтобы не менять)' : '' }}</label>
            <input 
              id="password" 
              v-model="userForm.password" 
              class="inp" 
              type="password" 
              :required="!editingUser"
            />
          </div>
          <div class="user-form__field">
            <label for="role">Роль</label>
            <select id="role" v-model="userForm.role" class="inp">
              <option value="user">Пользователь</option>
              <option value="admin">Администратор</option>
            </select>
          </div>
          <div class="user-form__actions">
            <button 
              type="button" 
              class="user-form__btn user-form__btn--cancel" 
              @click="closeForm"
            >
              Отмена
            </button>
            <button 
              type="submit" 
              class="user-form__btn user-form__btn--submit"
            >
              {{ editingUser ? 'Сохранить' : 'Добавить' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, defineEmits } from 'vue';
import { useRuntimeConfig } from '#app';

const emit = defineEmits(['user-selected']);
const config = useRuntimeConfig();

// Функция для отображения уведомлений
const showNotification = (message, type = 'success') => {
  if (window.$showNotification) {
    window.$showNotification(message, type);
  } else {
    console.log(`${type.toUpperCase()}: ${message}`);
  }
};

// Состояние компонента
const users = ref([]);
const showAddUserForm = ref(false);
const editingUser = ref(null);
const userForm = reactive({
  name: '',
  email: '',
  password: '',
  role: 'user'
});

// Загрузка пользователей при монтировании компонента
onMounted(async () => {
  await loadUsers();
});

// Функция загрузки пользователей
const loadUsers = async () => {
  try {
    const response = await $fetch(`${config.public.backendUrl}/api/auth/users`, {
      credentials: 'include',
    });
    users.value = response;
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error);
    showNotification('Не удалось загрузить список пользователей', 'error');
  }
};

// Функция для выбора пользователя
const selectUser = (user) => {
  emit('user-selected', user);
};

// Функция для редактирования пользователя
const editUser = (user) => {
  editingUser.value = user;
  userForm.name = user.name;
  userForm.email = user.email;
  userForm.password = ''; // Не отображаем пароль
  userForm.role = user.role;
  showAddUserForm.value = false;
};

// Функция для удаления пользователя
const deleteUser = async (userId) => {
  if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
    return;
  }
  
  try {
    await $fetch(`${config.public.backendUrl}/api/auth/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    showNotification('Пользователь успешно удален');
    await loadUsers();
  } catch (error) {
    console.error('Ошибка удаления пользователя:', error);
    showNotification('Не удалось удалить пользователя', 'error');
  }
};

// Функция для отправки формы
const submitUserForm = async () => {
  try {
    if (editingUser.value) {
      // Обновление существующего пользователя
      const updateData = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role
      };
      
      // Добавляем пароль только если он был введен
      if (userForm.password) {
        updateData.password = userForm.password;
      }
      
      await $fetch(`${config.public.backendUrl}/api/auth/users/${editingUser.value._id}`, {
        method: 'PUT',
        body: updateData,
        credentials: 'include',
      });
      
      showNotification('Пользователь успешно обновлен');
      
      // Обновляем пользователя в списке
      const index = users.value.findIndex(u => u._id === editingUser.value._id);
      if (index !== -1) {
        users.value[index] = {
          ...users.value[index],
          name: userForm.name,
          email: userForm.email,
          role: userForm.role
        };
      }
    } else {
      // Создание нового пользователя
      const newUser = await $fetch(`${config.public.backendUrl}/api/auth/register`, {
        method: 'POST',
        body: {
          name: userForm.name,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role
        },
        credentials: 'include',
      });
      
      // Добавляем нового пользователя в список
      if (newUser._id) {
        users.value.push(newUser);
      }
      
      showNotification('Пользователь успешно добавлен');
    }
    
    closeForm();
  } catch (error) {
    console.error('Ошибка при сохранении пользователя:', error);
    showNotification('Не удалось сохранить пользователя', 'error');
  }
};

// Функция для закрытия формы
const closeForm = () => {
  showAddUserForm.value = false;
  editingUser.value = null;
  userForm.name = '';
  userForm.email = '';
  userForm.password = '';
  userForm.role = 'user';
};
</script>

<style lang="sass">
@import '@variables'

.user-management
  width: 100%
  
  &__header
    display: flex
    align-items: center
    justify-content: space-between
    margin-bottom: 20px
    
    @include mobile
      flex-direction: column
      align-items: flex-start
      gap: 10px
  
  &__title
    color: $white
    margin: 0
    font-size: 18px
  
  &__add-btn
    padding: 8px 16px
    background-color: $purple
    color: $white
    border: none
    border-radius: $radius
    cursor: pointer
    display: flex
    align-items: center
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: darken($purple, 10%)
  
  &__table-container
    width: 100%
    overflow-x: auto
    @include custom-scrollbar
    background-color: $header-bg
    border-radius: $radius
    padding: 5px
  
  &__table
    width: 100%
    border-collapse: collapse
    color: $white
    
    th, td
      padding: 12px 15px
      text-align: left
      border-bottom: 1px solid rgba(255, 255, 255, 0.1)
    
    th
      font-weight: 600
      color: rgba(255, 255, 255, 0.7)
    
    tr:last-child td
      border-bottom: none
      
  &__table-row
    cursor: pointer
    transition: background-color $transition-speed $transition-function
    
    &:hover
      background-color: rgba(255, 255, 255, 0.05)
  
  &__actions
    min-width: 160px
    
  &__actions-container
    display: flex
    flex-direction: column
    gap: 8px
  
  &__action-btn
    background: transparent
    border: 1px solid rgba(255, 255, 255, 0.2)
    color: $white
    cursor: pointer
    padding: 6px 12px
    border-radius: $radius
    margin-right: 8px
    font-size: 12px
    display: inline-flex
    justify-content: center
    align-items: center
    gap: 5px
    transition: all $transition-speed $transition-function
    
    i
      font-size: 14px
    
    &--edit
      &:hover
        background-color: rgba($purple, 0.2)
        border-color: $purple
    
    &--delete
      &:hover
        background-color: rgba(#e74c3c, 0.2)
        color: #e74c3c
        border-color: #e74c3c

// Стили для формы пользователя
.user-form-overlay
  position: fixed
  top: 0
  left: 0
  right: 0
  bottom: 0
  background-color: rgba(0, 0, 0, 0.5)
  display: flex
  align-items: center
  justify-content: center
  z-index: 1000

.user-form
  background-color: $header-bg
  border-radius: $radius
  width: 90%
  max-width: 500px
  padding: 20px
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2)
  
  &__header
    display: flex
    justify-content: space-between
    align-items: center
    margin-bottom: 20px
    
    h3
      color: $white
      margin: 0
  
  &__close-btn
    background: transparent
    border: none
    color: $white
    font-size: 18px
    cursor: pointer
    padding: 5px
    
    &:hover
      color: rgba(255, 255, 255, 0.7)
  
  &__field
    margin-bottom: 15px
    
    label
      display: block
      color: $white
      margin-bottom: 5px
      font-size: 14px
  
  &__actions
    display: flex
    justify-content: flex-end
    gap: 10px
    margin-top: 20px
  
  &__btn
    padding: 8px 16px
    border: none
    border-radius: $radius
    cursor: pointer
    font-weight: 500
    transition: background-color $transition-speed $transition-function
    
    &--cancel
      background-color: transparent
      color: $white
      border: 1px solid rgba(255, 255, 255, 0.3)
      
      &:hover
        background-color: rgba(255, 255, 255, 0.1)
    
    &--submit
      background-color: $purple
      color: $white
      
      &:hover
        background-color: darken($purple, 10%)

// Адаптивность для мобильных устройств
@include mobile
  .user-management
    &__table
      th, td
        padding: 10px
      
      th:nth-child(3), td:nth-child(3)
        display: none
</style>

<template>
    <div class="user-managment">
        <div class="user-list">
            <table class="user-list__table">
                <thead class="user-list__table-head">
                    <tr class="user-list__table-row">
                        <th class="user-list__table-cell">ID</th>
                        <th class="user-list__table-cell">Имя</th>
                        <th class="user-list__table-cell">Номер</th>
                        <th class="user-list__table-cell">Email</th>
                        <th class="user-list__table-cell">Пароль</th>
                        <th class="user-list__table-cell">Роль</th>
                        <th class="user-list__table-cell">Действия</th>
                    </tr>
                </thead>
                <tbody class="user-list__table-body">
                    <tr class="user-list__table-row" v-for="user in users" :key="user._id">
                        <td class="user-list__table-cell">{{ user._id }}</td>
                        <td class="user-list__table-cell">{{ user.name || 'Не указано' }}</td>
                        <td class="user-list__table-cell">{{ user.number || 'Не указан' }}</td>
                        <td class="user-list__table-cell">{{ user.email || 'Не указан' }}</td>
                        <td class="user-list__table-cell">
                            <span class="hashed-password-label">Пароль хеширован</span> 
                        </td>
                        <td class="user-list__table-cell">
                            <select v-model="user.role" @change="changeUserRole(user)">
                                <option value="user">Пользователь</option>
                                <option value="admin">Администратор</option>
                            </select>
                        </td>
                        <td class="user-list__table-cell">
                            <button class="edit-button" @click="editUser(user)">Изменить</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="create-users">
            <h2 class="create-users__title">{{ isEditing ? 'Редактирование пользователя' : 'Создать пользователя' }}</h2>
            <Form :adminRegister="true" @submit="onFormSubmit" :initialData="formData" />
            <button v-if="isEditing" @click="cancelEdit" class="cancel-button">Отменить</button>
            <p v-if="error" class="create-users__error">{{ error }}</p>
            <p v-if="success" class="create-users__success">{{ success }}</p> 
        </div>
    </div>
</template>

<script setup>
const users = ref([]);
const error = ref(null);
const success = ref(null);
const config = useRuntimeConfig();
const isEditing = ref(false);
const currentEditId = ref(null);
const formData = ref({});

onMounted(() => {
    loadUsers();
});

const loadUsers = async () => {
    try {
        const responce = await $fetch(`${config.public.backendUrl}/api/auth/users`, {
            credentials: 'include',
        });
        users.value = responce;
    }
    catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
    }
};

const editUser = (user) => {
    isEditing.value = true;
    currentEditId.value = user._id;
    
    // Заполняем данные для формы
    formData.value = {
        name: user.name,
        email: user.email,
        number: user.number
    };
    
    // Информируем пользователя о редактировании
    success.value = `Редактирование пользователя ${user.name}. Введите новые данные и нажмите "Сохранить".`;
    error.value = null;
    
    // Прокручиваем страницу к форме
    setTimeout(() => {
        document.querySelector('.create-users').scrollIntoView({ behavior: 'smooth' });
    }, 100);
};

const cancelEdit = () => {
    isEditing.value = false;
    currentEditId.value = null;
    formData.value = {};
    error.value = null;
    success.value = null;
};

const onFormSubmit = async (userData) => {
    if (isEditing.value) {
        await handleUpdateUser(userData);
    } else {
        await handleCreateUser(userData);
    }
};

const handleCreateUser = async (userData) => {
    try {
        await $fetch(`${config.public.backendUrl}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: userData,
            credentials: 'include'
        });
        success.value = 'Пользователь успешно создан';
        error.value = null;
        await loadUsers();
    }
    catch (err) {
        console.error('Ошибка создания пользователя:', err);
        error.value = `Ошибка создания пользователя, статус (${err.response?.status || 'неизвестен'})`;
        success.value = null;
    }
};

const handleUpdateUser = async (userData) => {
    if (!currentEditId.value) return;
    
    try {
        // Создаем копию данных формы
        const updateData = { ...userData };
        
        // Если пароль пустой, удаляем его из запроса
        if (!updateData.password) {
            delete updateData.password;
        }
        
        // Проверяем формат ID и убираем возможные пробелы
        const userId = currentEditId.value.trim();
        
        // Выполняем запрос
        await $fetch(`${config.public.backendUrl}/api/auth/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: updateData,
            credentials: 'include'
        });
        
        success.value = 'Пользователь успешно обновлен';
        error.value = null;
        isEditing.value = false;
        currentEditId.value = null;
        formData.value = {};
        await loadUsers();
    }
    catch (err) {
        console.error('Ошибка обновления пользователя:', err);
        console.error('Детали ошибки:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            url: err.request?.url || `${config.public.backendUrl}/api/auth/users/${currentEditId.value}`,
            userId: currentEditId.value
        });
        
        // Более информативное сообщение об ошибке
        if (err.response?.status === 404) {
            error.value = `Пользователь с ID ${currentEditId.value} не найден на сервере`;
        } else {
            error.value = `Ошибка обновления пользователя: ${err.message || err}. Статус: ${err.response?.status || 'неизвестен'}`;
        }
        success.value = null;
    }
};

const changeUserRole = async (user) => {
    try {
        // Логируем ID пользователя для отладки
        console.log('Изменение роли пользователя с ID:', user._id);
        
        // Проверяем формат ID и убираем возможные пробелы
        const userId = user._id.trim();
        
        // Формируем полный URL для запроса
        const url = `${config.public.backendUrl}/api/auth/users/${userId}`;
        console.log('URL запроса:', url);
        console.log('Новая роль:', user.role);
        
        // Выполняем запрос
        await $fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: { role: user.role },
            credentials: 'include'
        });
        
        success.value = `Роль пользователя ${user.name} изменена на ${user.role === 'admin' ? 'Администратор' : 'Пользователь'}`;
        error.value = null;
    }
    catch (err) {
        console.error('Ошибка изменения роли пользователя:', err);
        console.error('Детали ошибки:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            url: err.request?.url || `${config.public.backendUrl}/api/auth/users/${user._id}`,
            userId: user._id
        });
        
        // Более информативное сообщение об ошибке
        if (err.response?.status === 404) {
            error.value = `Пользователь с ID ${user._id} не найден на сервере`;
        } else {
            error.value = `Ошибка изменения роли пользователя: ${err.message || err}. Статус: ${err.response?.status || 'неизвестен'}`;
        }
        success.value = null;
        // Возвращаем прежнее значение в случае ошибки
        await loadUsers();
    }
};

// Функция для генерации случайного пароля
const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

// Функция для сброса пароля пользователя
const resetPassword = async (user) => {
    try {
        // Генерируем новый случайный пароль
        const newPassword = generateRandomPassword();
        
        // Проверяем формат ID и убираем возможные пробелы
        const userId = user._id.trim();
        
        // Формируем полный URL для запроса
        const url = `${config.public.backendUrl}/api/auth/users/${userId}`;
        
        // Выполняем запрос на обновление пароля
        await $fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: { password: newPassword },
            credentials: 'include'
        });
        
        // Сохраняем новый пароль в объекте пользователя для отображения
        user.newPassword = newPassword;
        
        success.value = `Пароль пользователя ${user.name} успешно сброшен`;
        error.value = null;
    }
    catch (err) {
        console.error('Ошибка сброса пароля:', err);
        error.value = `Ошибка сброса пароля: ${err.message || err}. Статус: ${err.response?.status || 'неизвестен'}`;
        success.value = null;
    }
};
</script>

<style scoped>
.user-managment {
    display: flex;
    flex-direction: column;
    gap: 30px;
    padding: 20px;
}

.user-list__table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
}

.user-list__table-cell {
    border: 1px solid #ddd;
    padding: 8px;
    text-align: left;
}

.user-list__table-head {
    background-color: #f2f2f2;
}

.user-list__table-row:hover {
    background-color: #f5f5f5;
}

.create-users {
    max-width: 600px;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 5px;
}

.create-users__title {
    margin-bottom: 20px;
}

.edit-button {
    background-color: #3498db;
    color: white;
    border: none;
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
}

.edit-button:hover {
    background-color: #2980b9;
}

.reset-password-button {
    background-color: #e67e22;
    color: white;
    border: none;
    padding: 3px 6px;
    margin-top: 5px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
}

.reset-password-button:hover {
    background-color: #d35400;
}

.new-password {
    margin-top: 5px;
    padding: 5px;
    background-color: #f1c40f;
    color: #333;
    border-radius: 4px;
    font-size: 12px;
}

.cancel-button {
    margin-top: 10px;
    background-color: #95a5a6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
}

.cancel-button:hover {
    background-color: #7f8c8d;
}

.create-users__error {
    color: #e74c3c;
    margin-top: 10px;
}

.create-users__success {
    color: #2ecc71;
    margin-top: 10px;
}

.hashed-password-label {
    font-size: 12px;
    color: #e74c3c;
    font-weight: bold;
    display: block;
}

.hashed-password {
    font-size: 11px;
    color: #7f8c8d;
    word-break: break-all;
}
</style>
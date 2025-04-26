import fetch from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import { promisify } from 'util';
import cookieJar from 'fetch-cookie';

// URL API
const API_URL = 'http://localhost:5000/api';

// Создаем jar для cookies и настраиваем fetch с поддержкой cookies
const jar = new CookieJar();
const fetchWithCookies = cookieJar(fetch, jar);

// Проверка существования администратора или его создание
async function testCreateAdmin() {
  try {
    console.log('Пробуем создать администратора...');
    
    const adminData = {
      name: 'Admin',
      email: 'admin@orglink.com',
      password: 'admin123456'
    };
    
    const response = await fetchWithCookies(`${API_URL}/auth/create-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adminData)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Администратор успешно создан!');
      console.log('Данные пользователя:', data);
      return true;
    } else {
      console.log('Не удалось создать администратора:', data.error);
      return false;
    }
  } catch (error) {
    console.error('Ошибка при создании администратора:', error);
    return false;
  }
}

// Тест входа в систему
async function testLogin() {
  try {
    console.log('Пробуем войти в систему...');
    
    const loginData = {
      email: 'admin@orglink.com',
      password: 'admin123456'
    };
    
    const response = await fetchWithCookies(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(loginData),
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('Вход выполнен успешно!');
      console.log('Данные пользователя:', data);
      
      // Получаем все cookies
      const cookies = await promisify(jar.getCookies.bind(jar))(`${API_URL}`);
      console.log('Полученные cookies:', cookies);
      
      return true;
    } else {
      console.log('Не удалось войти:', data.error);
      return false;
    }
  } catch (error) {
    console.error('Ошибка при входе:', error);
    return false;
  }
}

// Тест запроса защищенного ресурса
async function testProtectedEndpoint() {
  try {
    console.log('Пробуем получить данные пользователя...');
    
    const response = await fetchWithCookies(`${API_URL}/auth/me`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Профиль пользователя получен:', data);
      return true;
    } else {
      console.log('Не удалось получить профиль:', await response.json());
      return false;
    }
  } catch (error) {
    console.error('Ошибка при получении профиля:', error);
    return false;
  }
}

// Тест выхода из системы
async function testLogout() {
  try {
    console.log('Выходим из системы...');
    
    const response = await fetchWithCookies(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (response.ok) {
      console.log('Выход выполнен успешно:', await response.json());
      
      // Проверяем, что токен удален из cookies
      const cookies = await promisify(jar.getCookies.bind(jar))(`${API_URL}`);
      console.log('Cookies после выхода:', cookies);
      
      return true;
    } else {
      console.log('Не удалось выйти:', await response.json());
      return false;
    }
  } catch (error) {
    console.error('Ошибка при выходе:', error);
    return false;
  }
}

// Выполняем тесты
async function runTests() {
  console.log('===== НАЧАЛО ТЕСТИРОВАНИЯ COOKIE-АУТЕНТИФИКАЦИИ =====');
  
  // Создаем админа (если не существует)
  await testCreateAdmin();
  
  // Входим
  const loginSuccess = await testLogin();
  
  if (loginSuccess) {
    // Получаем защищенные данные
    await testProtectedEndpoint();
    
    // Выходим
    await testLogout();
    
    // Проверяем, что выход действительно произошел
    console.log('Пробуем получить защищенные данные после выхода:');
    const accessAfterLogout = await testProtectedEndpoint();
    console.log('Доступ к защищенным данным после выхода:', accessAfterLogout ? 'ПОЛУЧЕН (ОШИБКА!)' : 'ЗАПРЕЩЕН (ОК)');
  }
  
  console.log('===== ОКОНЧАНИЕ ТЕСТИРОВАНИЯ COOKIE-АУТЕНТИФИКАЦИИ =====');
}

runTests().catch(console.error); 
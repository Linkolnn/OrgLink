# Голосовые сообщения в OrgLink

В приложении OrgLink добавлена поддержка голосовых сообщений. Эта функция позволяет записывать и отправлять аудиосообщения в чатах.

## Как использовать голосовые сообщения

### Запись голосового сообщения

1. **Начало записи**: 
   - На мобильных устройствах: нажмите и удерживайте кнопку микрофона в поле ввода сообщения.
   - На десктопах: нажмите на кнопку микрофона в поле ввода сообщения.

2. **Во время записи**:
   - Индикатор записи показывает текущую продолжительность записи.
   - Вы можете отменить запись, нажав на кнопку "Отмена" (крестик).
   - Вы можете завершить запись и отправить сообщение, нажав на кнопку "Отправить" (галочка).

3. **Завершение записи**:
   - На мобильных устройствах: отпустите кнопку микрофона для завершения записи и отправки сообщения.
   - На десктопах: нажмите на кнопку "Отправить" для завершения записи и отправки сообщения.

### Прослушивание голосовых сообщений

1. **Воспроизведение**: Нажмите на кнопку воспроизведения в голосовом сообщении.
2. **Пауза**: Нажмите на кнопку паузы во время воспроизведения, чтобы приостановить прослушивание.
3. **Перемотка**: Нажмите на любую точку аудиоволны, чтобы перемотать к этому моменту.
4. **Время воспроизведения**: Под аудиоволной отображается текущее время воспроизведения и общая продолжительность сообщения.

## Технические детали

### Компоненты

- `AudioPlayer.vue` - компонент для воспроизведения аудиосообщений
- `InputArea.vue` - компонент с функциональностью записи голосовых сообщений
- `Message.vue` - компонент, отображающий сообщения, включая голосовые

### Формат файлов

Голосовые сообщения записываются в формате WebM (audio/webm) и сохраняются на сервере. Имена файлов начинаются с префикса `voice_message_` и содержат временную метку.

### Совместимость

Функция записи голосовых сообщений работает в современных браузерах, поддерживающих MediaRecorder API:
- Chrome (desktop и mobile)
- Firefox (desktop и mobile)
- Safari (iOS 14.3+ и macOS 14.3+)
- Edge (на базе Chromium)

## Устранение неполадок

### Нет доступа к микрофону

Если при попытке записи голосового сообщения вы не видите запрос на доступ к микрофону или получаете ошибку:

1. Убедитесь, что вы дали разрешение на использование микрофона в настройках браузера.
2. Проверьте, что микрофон правильно подключен и работает.
3. Попробуйте обновить страницу и повторить попытку.

### Проблемы с воспроизведением

Если у вас возникают проблемы с воспроизведением голосовых сообщений:

1. Убедитесь, что звук на устройстве включен.
2. Проверьте, что голосовое сообщение было успешно загружено (нет иконки загрузки).
3. Попробуйте обновить страницу и повторить попытку воспроизведения.

## Тестирование

Для тестирования функциональности голосовых сообщений можно использовать скрипт `test-audio.js`:

```javascript
// В консоли браузера
import { testAudioMessage, testAudioPlayer } from './test-audio.js';

// Тестирование записи голосового сообщения
testAudioMessage();

// Тестирование компонента воспроизведения
testAudioPlayer();
``` 
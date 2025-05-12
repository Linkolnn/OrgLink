import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['default', 'service'],
      default: 'default'
    },
    media_type: {
      type: String,
      enum: ['none', 'image', 'video', 'video_message', 'sticker', 'file'],
      default: 'none'
    },
    file: {
      type: String,
      default: null
    },
    thumbnail: {
      type: String,
      default: null
    },
    mime_type: {
      type: String,
      default: null
    },
    file_name: {
      type: String,
      default: null
    },
    // Массив файлов для поддержки нескольких файлов в одном сообщении
    files: [{
      file_url: {
        type: String,
        required: true
      },
      file_name: {
        type: String,
        default: 'Файл'
      },
      mime_type: {
        type: String,
        default: 'application/octet-stream'
      },
      media_type: {
        type: String,
        enum: ['image', 'video', 'file'],
        default: 'file'
      },
      thumbnail: {
        type: String,
        default: null
      },
      size: {
        type: Number,
        default: 0
      }
    }],
    read_by: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    edited: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Добавляем индексы для ускорения запросов
// Составной индекс по чату и времени создания
messageSchema.index({ chat: 1, createdAt: -1 });

// Индекс для поиска непрочитанных сообщений
messageSchema.index({ chat: 1, sender: 1, read_by: 1 });

// Виртуальное поле для даты (для совместимости с фронтендом)
messageSchema.virtual('date').get(function() {
  return this.createdAt;
});

// Обеспечиваем, чтобы виртуальные поля были включены при преобразовании в JSON
messageSchema.set('toJSON', { virtuals: true });
messageSchema.set('toObject', { virtuals: true });

const Message = mongoose.model('Message', messageSchema);

export default Message;

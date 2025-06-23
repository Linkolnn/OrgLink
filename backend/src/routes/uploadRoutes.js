import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { uploadMessageFile, handleUploadError, getFileUrl } from '../middleware/uploadMiddleware.js';
import path from 'path';

const router = express.Router();

// Маршрут для загрузки одного файла
router.post('/', protect, uploadMessageFile.single('file'), handleUploadError, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    
    // Получаем URL загруженного файла
    const fileUrl = getFileUrl(req.file.filename, 'message-file');
    
    // Проверяем, есть ли информация о длительности для аудиофайлов
    let duration = 0;
    if (req.file.mimetype.startsWith('audio/') && req.body.duration) {
      duration = parseInt(req.body.duration) || 0;
      console.log('Получена длительность аудио:', duration, 'секунд');
    }
    
    // Возвращаем информацию о загруженном файле
    res.status(200).json({
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      duration: duration
    });
  } catch (error) {
    console.error('Ошибка при загрузке файла:', error);
    res.status(500).json({ error: 'Ошибка при загрузке файла' });
  }
});

// Маршрут для загрузки нескольких файлов одновременно
router.post('/multiple', protect, uploadMessageFile.array('files', 10), handleUploadError, (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Файлы не были загружены' });
    }
    
    // Обрабатываем каждый загруженный файл
    const uploadedFiles = req.files.map(file => {
      const fileUrl = getFileUrl(file.filename, 'message-file');
      return {
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype
      };
    });
    
    // Возвращаем информацию о загруженных файлах
    res.status(200).json({ files: uploadedFiles });
  } catch (error) {
    console.error('Ошибка при загрузке файлов:', error);
    res.status(500).json({ error: 'Ошибка при загрузке файлов' });
  }
});

export default router;

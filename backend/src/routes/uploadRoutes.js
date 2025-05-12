import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { uploadMessageFile, handleUploadError, getFileUrl } from '../middleware/uploadMiddleware.js';
import path from 'path';

const router = express.Router();

// Маршрут для загрузки файла
router.post('/', protect, uploadMessageFile.single('file'), handleUploadError, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    
    // Получаем URL загруженного файла
    const fileUrl = getFileUrl(req.file.filename, 'message-file');
    
    // Возвращаем информацию о загруженном файле
    res.status(200).json({
      fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Ошибка при загрузке файла:', error);
    res.status(500).json({ error: 'Ошибка при загрузке файла' });
  }
});

export default router;

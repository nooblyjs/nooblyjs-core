/**
 * @fileoverview Filing Service Demo
 * Example showing how to use the NooblyJS Filing Service
 * @author NooblyJS Team
 * @version 1.0.0
 */

const express = require('express');
const multer = require('multer');
const serviceRegistry = require('../index');
const path = require('path');
const fs = require('fs');

const app = express();

// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the service registry
const eventEmitter = require('events');
const globalEventEmitter = new eventEmitter();

serviceRegistry.initialize(app, globalEventEmitter, {
  // Optional API key authentication
  // apiKeys: ['your-api-key-here'],
  // requireApiKey: false
});

// Example 1: Using local file storage (default)
const localFiles = serviceRegistry.filing('local', {
  basePath: './uploads',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.doc', '.docx']
});

// Example 2: Using AWS S3 storage (requires AWS credentials)
/*
const s3Files = serviceRegistry.filing('s3', {
  bucket: 'your-bucket-name',
  region: 'us-east-1',
  // accessKeyId: 'your-access-key', // Optional if using IAM roles
  // secretAccessKey: 'your-secret-key'
});
*/

// Example 3: Using cloud storage with specific configuration
const cloudFiles = serviceRegistry.filing('local', {
  basePath: './cloud-uploads',
  createThumbnails: true,
  thumbnailSize: { width: 200, height: 200 },
  organizeByDate: true // Creates YYYY/MM/DD folder structure
});

// Setup multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed`), false);
    }
  }
});

// File upload routes
app.post('/upload/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileInfo = {
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      size: req.file.size,
      metadata: {
        uploadedBy: req.body.uploadedBy || 'anonymous',
        description: req.body.description || '',
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : []
      }
    };

    const result = await localFiles.store(fileInfo);

    res.json({
      success: true,
      file: {
        id: result.id,
        filename: result.filename,
        originalName: fileInfo.originalName,
        size: fileInfo.size,
        mimeType: fileInfo.mimeType,
        uploadedAt: result.uploadedAt,
        path: result.path,
        url: `/files/${result.filename}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/upload/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const results = [];
    const uploadedBy = req.body.uploadedBy || 'anonymous';

    for (const file of req.files) {
      try {
        const fileInfo = {
          originalName: file.originalname,
          buffer: file.buffer,
          mimeType: file.mimetype,
          size: file.size,
          metadata: {
            uploadedBy: uploadedBy,
            description: req.body.description || '',
            tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : []
          }
        };

        const result = await localFiles.store(fileInfo);

        results.push({
          success: true,
          file: {
            id: result.id,
            filename: result.filename,
            originalName: fileInfo.originalName,
            size: fileInfo.size,
            mimeType: fileInfo.mimeType,
            uploadedAt: result.uploadedAt,
            url: `/files/${result.filename}`
          }
        });
      } catch (error) {
        results.push({
          success: false,
          filename: file.originalname,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results: results,
      totalFiles: req.files.length,
      successfulUploads: results.filter(r => r.success).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File management routes
app.get('/files', async (req, res) => {
  try {
    const { page = 1, limit = 10, type, uploadedBy } = req.query;
    const files = await localFiles.list({
      page: parseInt(page),
      limit: parseInt(limit),
      type: type,
      uploadedBy: uploadedBy
    });

    res.json({
      files: files.map(file => ({
        ...file,
        url: `/files/${file.filename}`,
        downloadUrl: `/download/${file.id}`
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: files.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/files/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const fileStream = await localFiles.getStream(filename);

    if (!fileStream) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Get file info for proper headers
    const fileInfo = await localFiles.getInfo(filename);

    res.set({
      'Content-Type': fileInfo.mimeType,
      'Content-Length': fileInfo.size,
      'Cache-Control': 'public, max-age=3600'
    });

    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const file = await localFiles.getById(id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileStream = await localFiles.getStream(file.filename);

    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': file.size,
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
      'Cache-Control': 'public, max-age=3600'
    });

    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/info/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const file = await localFiles.getById(id);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      file: {
        ...file,
        url: `/files/${file.filename}`,
        downloadUrl: `/download/${file.id}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await localFiles.delete(id);

    if (!success) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      success: true,
      message: `File ${id} deleted successfully`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Advanced file operations
app.post('/files/:id/copy', async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;

    const copiedFile = await localFiles.copy(id, newName);

    res.json({
      success: true,
      originalFile: id,
      copiedFile: {
        ...copiedFile,
        url: `/files/${copiedFile.filename}`,
        downloadUrl: `/download/${copiedFile.id}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/files/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPath } = req.body;

    const movedFile = await localFiles.move(id, newPath);

    res.json({
      success: true,
      file: {
        ...movedFile,
        url: `/files/${movedFile.filename}`,
        downloadUrl: `/download/${movedFile.id}`
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Image processing (if supported)
app.get('/thumbnail/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { width = 200, height = 200 } = req.query;

    const thumbnail = await cloudFiles.generateThumbnail(id, {
      width: parseInt(width),
      height: parseInt(height)
    });

    if (!thumbnail) {
      return res.status(404).json({ error: 'Thumbnail not available' });
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400' // 24 hours
    });

    thumbnail.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Storage statistics
app.get('/storage/stats', async (req, res) => {
  try {
    const stats = await localFiles.getStorageStats();

    res.json({
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners
globalEventEmitter.on('filing:uploaded', (data) => {
  console.log(`File uploaded: ${data.originalName} (${data.size} bytes) -> ${data.filename}`);
});

globalEventEmitter.on('filing:deleted', (data) => {
  console.log(`File deleted: ${data.filename} (ID: ${data.id})`);
});

globalEventEmitter.on('filing:accessed', (data) => {
  console.log(`File accessed: ${data.filename} by ${data.userAgent || 'unknown'}`);
});

// Error handling for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n📁 Filing Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Filing Interface: http://localhost:3000/services/filing/');
  console.log('- Swagger API Docs: http://localhost:3000/services/filing/swagger');
  console.log('- Service Status: http://localhost:3000/services/filing/api/status');
  console.log('- Upload Single File: POST http://localhost:3000/upload/single');
  console.log('- Upload Multiple Files: POST http://localhost:3000/upload/multiple');
  console.log('- List Files: GET http://localhost:3000/files');
  console.log('- Get File: GET http://localhost:3000/files/{filename}');
  console.log('- Download File: GET http://localhost:3000/download/{id}');
  console.log('- File Info: GET http://localhost:3000/info/{id}');
  console.log('- Delete File: DELETE http://localhost:3000/files/{id}');
  console.log('- Copy File: POST http://localhost:3000/files/{id}/copy');
  console.log('- Move File: POST http://localhost:3000/files/{id}/move');
  console.log('- Thumbnail: GET http://localhost:3000/thumbnail/{id}?width=200&height=200');
  console.log('- Storage Stats: GET http://localhost:3000/storage/stats');
  console.log('\nExample file upload (using curl):');
  console.log('curl -X POST -F "file=@/path/to/your/file.jpg" -F "uploadedBy=demo" -F "description=Test file" http://localhost:3000/upload/single');
  console.log('\nSupported file types: .jpg, .jpeg, .png, .gif, .pdf, .txt, .doc, .docx');
  console.log('Maximum file size: 10MB');
});
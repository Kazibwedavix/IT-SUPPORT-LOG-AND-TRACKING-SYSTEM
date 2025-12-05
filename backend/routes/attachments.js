const express = require('express');
const upload = require('../middleware/upload');
const Attachment = require('../models/Attachment');
const { auth } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Upload attachment
router.post('/:ticketId', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const attachment = new Attachment({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      ticketId: req.params.ticketId,
      uploadedBy: req.user.userId
    });

    await attachment.save();

    res.status(201).json({
      message: 'File uploaded successfully',
      attachment: {
        id: attachment._id,
        originalName: attachment.originalName,
        size: attachment.size,
        uploadedAt: attachment.createdAt
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Get ticket attachments
router.get('/ticket/:ticketId', auth, async (req, res) => {
  try {
    const attachments = await Attachment.find({ ticketId: req.params.ticketId })
      .populate('uploadedBy', 'username')
      .sort({ createdAt: -1 });

    res.json(attachments);
  } catch (error) {
    console.error('Get attachments error:', error);
    res.status(500).json({ message: 'Error fetching attachments' });
  }
});

// Download attachment
router.get('/download/:id', auth, async (req, res) => {
  try {
    const attachment = await Attachment.findById(req.params.id);
    if (!attachment) {
      return res.status(404).json({ message: 'File not found' });
    }

    const filePath = path.join(__dirname, '../', attachment.path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    res.setHeader('Content-Type', attachment.mimetype);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Error downloading file' });
  }
});

// Delete attachment
router.delete('/:id', auth, async (req, res) => {
  try {
    const attachment = await Attachment.findById(req.params.id);
    if (!attachment) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if user owns the attachment or has permission
    if (attachment.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this file' });
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, '../', attachment.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Attachment.findByIdAndDelete(req.params.id);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ message: 'Error deleting file' });
  }
});

module.exports = router;
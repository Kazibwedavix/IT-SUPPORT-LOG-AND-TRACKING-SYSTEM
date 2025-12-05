const express = require('express');
const UserPreferences = require('../models/UserPreferences');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get user preferences
router.get('/', auth, async (req, res) => {
  try {
    let preferences = await UserPreferences.findOne({ userId: req.user.userId });
    
    if (!preferences) {
      // Create default preferences
      preferences = new UserPreferences({
        userId: req.user.userId,
        emailNotifications: {
          ticketAssigned: true,
          statusUpdated: true,
          newComment: true
        },
        dataMinimization: true
      });
      await preferences.save();
    }

    res.json(preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ message: 'Error fetching preferences' });
  }
});

// Update user preferences
router.put('/', auth, async (req, res) => {
  try {
    const preferences = await UserPreferences.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: req.body },
      { new: true, upsert: true }
    );

    res.json(preferences);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Error updating preferences' });
  }
});

module.exports = router;
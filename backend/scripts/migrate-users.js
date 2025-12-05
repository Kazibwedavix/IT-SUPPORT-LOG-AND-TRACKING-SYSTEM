// backend/scripts/migrate-users.js
/**
 * User Migration Script
 * 
 * Migrates existing users from old schema to new production schema
 * Run: node scripts/migrate-users.js
 * 
 * @version 1.0.0
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

// Import new User model
const User = require('../src/models/User');

// Import old User model (if different file)
// If using same file, skip this
// const OldUser = require('./old-models/User');

class UserMigration {
  constructor() {
    this.updatedCount = 0;
    this.errorCount = 0;
    this.skippedCount = 0;
  }

  async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('✅ Connected to MongoDB');
      return true;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      return false;
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }

  async migrateAllUsers() {
    try {
      console.log('🚀 Starting user migration...\n');
      
      // Find all existing users
      const users = await mongoose.connection.db.collection('users').find({}).toArray();
      
      if (!users || users.length === 0) {
        console.log('📭 No users found in database');
        return;
      }

      console.log(`📊 Found ${users.length} users to migrate\n`);

      for (let i = 0; i < users.length; i++) {
        const oldUser = users[i];
        await this.migrateUser(oldUser, i + 1, users.length);
      }

      console.log('\n' + '='.repeat(50));
      console.log('🎉 MIGRATION SUMMARY');
      console.log('='.repeat(50));
      console.log(`✅ Successfully migrated: ${this.updatedCount}`);
      console.log(`⚠️  Skipped: ${this.skippedCount}`);
      console.log(`❌ Failed: ${this.errorCount}`);
      console.log(`📊 Total processed: ${users.length}`);
      console.log('='.repeat(50));

    } catch (error) {
      console.error('❌ Migration failed:', error);
    }
  }

  async migrateUser(oldUser, current, total) {
    try {
      console.log(`[${current}/${total}] Processing: ${oldUser.email || oldUser.username}`);
      
      // Check if user already exists in new format (by email)
      const existingUser = await User.findOne({ email: oldUser.email });
      
      if (existingUser) {
        console.log(`   ⚠️  Already migrated, skipping...`);
        this.skippedCount++;
        return;
      }

      // Build new user object
      const newUserData = this.transformUserData(oldUser);
      
      // Create new user document
      const newUser = new User(newUserData);
      
      // Preserve original password if exists
      if (oldUser.password) {
        newUser.password = oldUser.password;
      }

      // Set metadata
      newUser.metadata = {
        registrationSource: 'migration',
        migrationDate: new Date().toISOString(),
        originalId: oldUser._id.toString()
      };

      // Save new user
      await newUser.save();
      
      console.log(`   ✅ Migrated successfully`);
      this.updatedCount++;

    } catch (error) {
      console.error(`   ❌ Migration failed: ${error.message}`);
      this.errorCount++;
    }
  }

  transformUserData(oldUser) {
    const newUser = {
      username: oldUser.username || this.generateUsername(oldUser.email),
      email: oldUser.email,
      role: oldUser.role || 'student',
      isEmailVerified: oldUser.isVerified || false,
      isActive: oldUser.isActive !== false,
      createdAt: oldUser.createdAt || new Date(),
      updatedAt: oldUser.updatedAt || new Date()
    };

    // Profile information
    if (oldUser.name) {
      const nameParts = oldUser.name.split(' ');
      newUser.profile = {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        fullName: oldUser.name
      };
    }

    // Academic information for students
    if (oldUser.role === 'student' || oldUser.academicInfo) {
      newUser.academicInfo = {
        studentId: oldUser.studentId || oldUser.academicInfo?.studentId,
        department: oldUser.department || oldUser.academicInfo?.department,
        campus: oldUser.academicInfo?.campus || 'BU',
        yearOfEntry: oldUser.academicInfo?.yearOfEntry,
        semester: oldUser.academicInfo?.semester,
        academicStatus: 'active'
      };
    }

    // Phone
    if (oldUser.phone) {
      newUser.profile = newUser.profile || {};
      newUser.profile.phone = oldUser.phone.replace(/\D/g, '');
    }

    // Department (if not in academicInfo)
    if (oldUser.department && oldUser.role !== 'student') {
      newUser.professionalInfo = {
        department: oldUser.department
      };
    }

    // Preferences
    newUser.preferences = {
      notifications: {
        email: {
          ticketUpdates: true,
          announcements: true,
          securityAlerts: true
        },
        push: {
          ticketUpdates: true,
          announcements: false
        }
      },
      theme: 'light',
      language: 'en',
      timezone: 'Africa/Kampala'
    };

    return newUser;
  }

  generateUsername(email) {
    if (!email) return `user_${Date.now()}`;
    return email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }

  async backupOldUsers() {
    try {
      console.log('💾 Creating backup of old users...');
      
      const users = await mongoose.connection.db.collection('users').find({}).toArray();
      
      // Create backup collection
      await mongoose.connection.db.collection('users_backup').insertMany(users);
      
      console.log(`✅ Backup created: ${users.length} users backed up`);
      console.log('📁 Collection: users_backup');
      
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
    }
  }
}

// Main execution
(async () => {
  const migration = new UserMigration();
  
  try {
    // Connect to database
    const connected = await migration.connect();
    if (!connected) process.exit(1);

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will migrate all users to the new schema.');
    console.log('   Make sure you have a backup before proceeding.\n');
    
    // Uncomment to create backup first
    // await migration.backupOldUsers();
    
    // Start migration
    await migration.migrateAllUsers();
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
  } finally {
    await migration.disconnect();
    process.exit(0);
  }
})();
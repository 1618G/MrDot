const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const DataManager = require('../utils/dataManager');
const { auth, generateToken } = require('../middleware/auth');

// Register new user
router.post('/register', [
    body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { firstName, lastName, email, password } = req.body;

        // Check if user already exists
        const existingUser = await DataManager.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                error: 'User already exists with this email'
            });
        }

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create user
        const userData = {
            firstName,
            lastName,
            email,
            password: hashedPassword,
            role: 'customer',
            isVerified: false,
            preferences: {
                newsletter: true,
                orderUpdates: true
            }
        };

        const user = await DataManager.createUser(userData);

        // Generate token
        const token = generateToken(user.id);

        // Remove password from response
        const { password: _, ...userResponse } = user;

        res.status(201).json({
            message: 'User registered successfully',
            user: userResponse,
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            error: 'Failed to register user'
        });
    }
});

// Login user
router.post('/login', [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { email, password } = req.body;

        // Find user
        const user = await DataManager.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                error: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(user.id);

        // Update last login
        await DataManager.updateUser(user.id, {
            lastLogin: new Date().toISOString()
        });

        // Remove password from response
        const { password: _, ...userResponse } = user;

        res.json({
            message: 'Login successful',
            user: userResponse,
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Failed to login'
        });
    }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            user: req.user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            error: 'Failed to get user profile'
        });
    }
});

// Update user profile
router.put('/profile', auth, [
    body('firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { firstName, lastName, email, phone, preferences } = req.body;
        const updateData = {};

        // Only update provided fields
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (phone) updateData.phone = phone;
        if (preferences) updateData.preferences = { ...req.user.preferences, ...preferences };

        // Check if email is being changed and if it's already taken
        if (email && email !== req.user.email) {
            const existingUser = await DataManager.getUserByEmail(email);
            if (existingUser) {
                return res.status(400).json({
                    error: 'Email already in use'
                });
            }
            updateData.email = email;
        }

        const updatedUser = await DataManager.updateUser(req.user.id, updateData);
        
        // Remove password from response
        const { password: _, ...userResponse } = updatedUser;

        res.json({
            message: 'Profile updated successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            error: 'Failed to update profile'
        });
    }
});

// Change password
router.put('/change-password', auth, [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('Passwords do not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        // Get user with password
        const user = await DataManager.getUserById(req.user.id);
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({
                error: 'Current password is incorrect'
            });
        }

        // Hash new password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update password
        await DataManager.updateUser(req.user.id, {
            password: hashedPassword
        });

        res.json({
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            error: 'Failed to change password'
        });
    }
});

// Request password reset (simplified - in production would send email)
router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { email } = req.body;

        // Check if user exists
        const user = await DataManager.getUserByEmail(email);
        
        // Always return success to prevent email enumeration
        res.json({
            message: 'If an account with this email exists, a password reset link has been sent'
        });

        // In production, you would:
        // 1. Generate a password reset token
        // 2. Store it with expiration time
        // 3. Send email with reset link
        // For now, just log the reset request
        if (user) {
            console.log(`Password reset requested for user: ${user.email}`);
        }

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            error: 'Failed to process password reset request'
        });
    }
});

// Logout (client-side token removal)
router.post('/logout', auth, (req, res) => {
    // In a more complex setup, you might maintain a blacklist of tokens
    // For now, just return success - client will remove token
    res.json({
        message: 'Logged out successfully'
    });
});

// Delete account
router.delete('/account', auth, [
    body('password').notEmpty().withMessage('Password is required to delete account')
], async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { password } = req.body;

        // Get user with password
        const user = await DataManager.getUserById(req.user.id);
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({
                error: 'Password is incorrect'
            });
        }

        // Instead of actually deleting, mark as deleted (for data retention)
        await DataManager.updateUser(req.user.id, {
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            email: `deleted_${Date.now()}_${user.email}` // Prevent email conflicts
        });

        res.json({
            message: 'Account deleted successfully'
        });

    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            error: 'Failed to delete account'
        });
    }
});

// Verify token (for client-side auth check)
router.get('/verify', auth, (req, res) => {
    res.json({
        valid: true,
        user: req.user
    });
});

module.exports = router; 
const jwt = require('jsonwebtoken');
const DataManager = require('../utils/dataManager');

// Middleware to verify JWT token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await DataManager.getUserById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid token. User not found.' });
        }

        // Remove password from user object
        const { password, ...userWithoutPassword } = user;
        req.user = userWithoutPassword;
        next();
        
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        
        res.status(500).json({ error: 'Server error during authentication.' });
    }
};

// Middleware to check if user is admin
const adminAuth = async (req, res, next) => {
    try {
        // First run the regular auth middleware
        await new Promise((resolve, reject) => {
            auth(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error during admin authentication.' });
    }
};

// Optional auth middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await DataManager.getUserById(decoded.userId);
            
            if (user) {
                const { password, ...userWithoutPassword } = user;
                req.user = userWithoutPassword;
            }
        }
        
        next();
    } catch (error) {
        // Continue without authentication if token is invalid
        next();
    }
};

// Generate JWT token
const generateToken = (userId) => {
    return jwt.sign(
        { userId }, 
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

module.exports = {
    auth,
    adminAuth,
    optionalAuth,
    generateToken
}; 
const express = require('express');
const multer = require('multer');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();
const DataManager = require('../utils/dataManager');
const { adminAuth } = require('../middleware/auth');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', 'uploads', 'products');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Admin dashboard overview
router.get('/dashboard', adminAuth, async (req, res) => {
    try {
        const [orders, products, users] = await Promise.all([
            DataManager.getOrders(),
            DataManager.getProducts(),
            DataManager.getUsers()
        ]);

        // Calculate key metrics
        const totalRevenue = orders
            .filter(order => order.paymentStatus === 'paid')
            .reduce((sum, order) => sum + order.totalAmount, 0);

        const activeProducts = products.filter(p => p.available).length;
        const totalCustomers = users.filter(u => u.role === 'customer' && !u.isDeleted).length;

        // Recent activity
        const recentOrders = orders
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
            .map(order => ({
                id: order.id,
                orderNumber: order.orderNumber,
                customerEmail: order.customerEmail,
                totalAmount: order.totalAmount,
                status: order.status,
                createdAt: order.createdAt
            }));

        // Low stock products
        const lowStockProducts = products
            .filter(p => p.stock <= 5 && p.available)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 10)
            .map(p => ({
                id: p.id,
                name: p.name,
                stock: p.stock,
                category: p.category
            }));

        // Monthly sales for the last 6 months
        const monthlyStats = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const month = date.toISOString().slice(0, 7);
            
            const monthOrders = orders.filter(order => order.createdAt.startsWith(month));
            const monthRevenue = monthOrders
                .filter(order => order.paymentStatus === 'paid')
                .reduce((sum, order) => sum + order.totalAmount, 0);
            
            monthlyStats.push({
                month,
                revenue: monthRevenue,
                orders: monthOrders.length,
                customers: new Set(monthOrders.map(o => o.userId)).size
            });
        }

        const dashboard = {
            overview: {
                totalRevenue,
                totalOrders: orders.length,
                activeProducts,
                totalCustomers,
                pendingOrders: orders.filter(o => o.status === 'pending').length,
                processingOrders: orders.filter(o => o.status === 'processing').length
            },
            recentOrders,
            lowStockProducts,
            monthlyStats
        };

        res.json({ dashboard });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            error: 'Failed to load dashboard'
        });
    }
});

// Get all users (admin only)
router.get('/users', adminAuth, [
    query('role').optional().isIn(['customer', 'admin']).withMessage('Invalid role'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().withMessage('Search must be a string')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { role, page = 1, limit = 20, search } = req.query;
        let users = await DataManager.getUsers();

        // Filter out deleted users
        users = users.filter(user => !user.isDeleted);

        // Filter by role
        if (role) {
            users = users.filter(user => user.role === role);
        }

        // Search functionality
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(user => {
                const nameMatch = `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchLower);
                const emailMatch = user.email.toLowerCase().includes(searchLower);
                return nameMatch || emailMatch;
            });
        }

        // Remove passwords from response
        users = users.map(({ password, ...user }) => user);

        // Sort by creation date (newest first)
        users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedUsers = users.slice(startIndex, endIndex);

        res.json({
            users: paginatedUsers,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(users.length / limit),
                totalItems: users.length,
                itemsPerPage: parseInt(limit),
                hasNext: endIndex < users.length,
                hasPrev: startIndex > 0
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            error: 'Failed to get users'
        });
    }
});

// Update user role (admin only)
router.patch('/users/:id/role', adminAuth, [
    body('role').isIn(['customer', 'admin']).withMessage('Invalid role')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { id } = req.params;
        const { role } = req.body;

        const user = await DataManager.getUserById(id);
        if (!user || user.isDeleted) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const updatedUser = await DataManager.updateUser(id, { role });
        
        // Remove password from response
        const { password, ...userResponse } = updatedUser;

        res.json({
            message: 'User role updated successfully',
            user: userResponse
        });

    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({
            error: 'Failed to update user role'
        });
    }
});

// Upload product images
router.post('/upload/images', adminAuth, upload.array('images', 5), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                error: 'No files uploaded'
            });
        }

        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            url: `/uploads/products/${file.filename}`
        }));

        res.json({
            message: 'Files uploaded successfully',
            files: uploadedFiles
        });

    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({
            error: 'Failed to upload files'
        });
    }
});

// Get site settings
router.get('/settings', adminAuth, async (req, res) => {
    try {
        const settings = await DataManager.getSettings();
        res.json({ settings });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            error: 'Failed to get settings'
        });
    }
});

// Update site settings
router.put('/settings', adminAuth, [
    body('siteName').optional().trim().isLength({ min: 1 }).withMessage('Site name is required'),
    body('siteDescription').optional().trim().isLength({ min: 1 }).withMessage('Site description is required'),
    body('currency').optional().isIn(['GBP', 'USD', 'EUR']).withMessage('Invalid currency'),
    body('taxRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Tax rate must be between 0 and 1'),
    body('shipping.freeShippingThreshold').optional().isFloat({ min: 0 }).withMessage('Free shipping threshold must be positive'),
    body('shipping.standardShipping').optional().isFloat({ min: 0 }).withMessage('Standard shipping cost must be positive'),
    body('shipping.expressShipping').optional().isFloat({ min: 0 }).withMessage('Express shipping cost must be positive')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const updatedSettings = await DataManager.updateSettings(req.body);

        res.json({
            message: 'Settings updated successfully',
            settings: updatedSettings
        });

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            error: 'Failed to update settings'
        });
    }
});

// Get sales analytics
router.get('/analytics/sales', adminAuth, [
    query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        const { period = '30d', startDate, endDate } = req.query;
        const orders = await DataManager.getOrders();

        // Filter orders by date range
        let filteredOrders = orders.filter(order => order.paymentStatus === 'paid');

        if (startDate && endDate) {
            filteredOrders = filteredOrders.filter(order => {
                const orderDate = new Date(order.createdAt);
                return orderDate >= new Date(startDate) && orderDate <= new Date(endDate);
            });
        } else {
            // Use period for filtering
            const days = parseInt(period.replace('d', '').replace('y', '') * 365);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            
            filteredOrders = filteredOrders.filter(order => {
                return new Date(order.createdAt) >= cutoffDate;
            });
        }

        // Calculate analytics
        const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const averageOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

        // Revenue by product category
        const products = await DataManager.getProducts();
        const categoryRevenue = {};
        
        filteredOrders.forEach(order => {
            order.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                    const category = product.category;
                    categoryRevenue[category] = (categoryRevenue[category] || 0) + (item.quantity * product.price);
                }
            });
        });

        // Top selling products
        const productSales = {};
        filteredOrders.forEach(order => {
            order.items.forEach(item => {
                productSales[item.productId] = (productSales[item.productId] || 0) + item.quantity;
            });
        });

        const topProducts = Object.entries(productSales)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([productId, quantity]) => {
                const product = products.find(p => p.id === productId);
                return {
                    id: productId,
                    name: product?.name || 'Unknown Product',
                    quantity,
                    revenue: quantity * (product?.price || 0)
                };
            });

        const analytics = {
            period,
            totalRevenue,
            totalOrders: filteredOrders.length,
            averageOrderValue,
            categoryRevenue,
            topProducts
        };

        res.json({ analytics });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            error: 'Failed to get analytics'
        });
    }
});

// Backup data (export JSON files)
router.get('/backup', adminAuth, async (req, res) => {
    try {
        const [users, products, orders, categories, settings] = await Promise.all([
            DataManager.getUsers(),
            DataManager.getProducts(),
            DataManager.getOrders(),
            DataManager.getCategories(),
            DataManager.getSettings()
        ]);

        // Remove sensitive information from users
        const sanitizedUsers = users.map(({ password, ...user }) => user);

        const backup = {
            exportDate: new Date().toISOString(),
            version: '1.0.0',
            data: {
                users: sanitizedUsers,
                products,
                orders,
                categories,
                settings
            }
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="mrdot-backup-${Date.now()}.json"`);
        res.json(backup);

    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({
            error: 'Failed to create backup'
        });
    }
});

// System health check
router.get('/health', adminAuth, async (req, res) => {
    try {
        const [users, products, orders] = await Promise.all([
            DataManager.getUsers(),
            DataManager.getProducts(),
            DataManager.getOrders()
        ]);

        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            dataIntegrity: {
                users: users.length,
                products: products.length,
                orders: orders.length,
                activeProducts: products.filter(p => p.available).length,
                pendingOrders: orders.filter(o => o.status === 'pending').length
            },
            diskSpace: {
                // This would be more detailed in a production environment
                available: 'N/A (JSON storage)',
                used: 'N/A (JSON storage)'
            }
        };

        res.json({ health });

    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

module.exports = router; 
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();
const DataManager = require('../utils/dataManager');
const { auth, adminAuth } = require('../middleware/auth');

// Get user's orders
router.get('/', auth, [
    query('status').optional().isString().withMessage('Status must be a string'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
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

        const { status, page = 1, limit = 10 } = req.query;
        let orders = await DataManager.getOrdersByUserId(req.user.id);

        // Filter by status if provided
        if (status) {
            orders = orders.filter(order => order.status === status);
        }

        // Sort by creation date (newest first)
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedOrders = orders.slice(startIndex, endIndex);

        res.json({
            orders: paginatedOrders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(orders.length / limit),
                totalItems: orders.length,
                itemsPerPage: parseInt(limit),
                hasNext: endIndex < orders.length,
                hasPrev: startIndex > 0
            }
        });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            error: 'Failed to get orders'
        });
    }
});

// Get single order by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const order = await DataManager.getOrderById(id);

        if (!order) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        // Check if user owns this order or is admin
        if (order.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        res.json({ order });

    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({
            error: 'Failed to get order'
        });
    }
});

// Update order status (admin only)
router.patch('/:id/status', adminAuth, [
    body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'partially_refunded'])
        .withMessage('Invalid status'),
    body('trackingNumber').optional().isString().withMessage('Tracking number must be a string'),
    body('notes').optional().isString().withMessage('Notes must be a string')
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

        const { id } = req.params;
        const { status, trackingNumber, notes } = req.body;

        const order = await DataManager.getOrderById(id);
        if (!order) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        const updateData = { status };
        if (trackingNumber) updateData.trackingNumber = trackingNumber;
        if (notes) updateData.notes = notes;

        // Add status history
        const statusHistory = order.statusHistory || [];
        statusHistory.push({
            status,
            timestamp: new Date().toISOString(),
            updatedBy: req.user.id,
            notes
        });
        updateData.statusHistory = statusHistory;

        // If shipped, add shipping date
        if (status === 'shipped') {
            updateData.shippedDate = new Date().toISOString();
        }

        // If delivered, add delivery date
        if (status === 'delivered') {
            updateData.deliveredDate = new Date().toISOString();
        }

        const updatedOrder = await DataManager.updateOrder(id, updateData);

        res.json({
            message: 'Order status updated successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({
            error: 'Failed to update order status'
        });
    }
});

// Cancel order (customer can cancel if not shipped)
router.patch('/:id/cancel', auth, [
    body('reason').optional().isString().withMessage('Reason must be a string')
], async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const order = await DataManager.getOrderById(id);
        if (!order) {
            return res.status(404).json({
                error: 'Order not found'
            });
        }

        // Check if user owns this order
        if (order.userId !== req.user.id) {
            return res.status(403).json({
                error: 'Access denied'
            });
        }

        // Check if order can be cancelled
        if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status)) {
            return res.status(400).json({
                error: 'Order cannot be cancelled at this stage'
            });
        }

        // Update order status
        const statusHistory = order.statusHistory || [];
        statusHistory.push({
            status: 'cancelled',
            timestamp: new Date().toISOString(),
            updatedBy: req.user.id,
            notes: reason || 'Cancelled by customer'
        });

        const updatedOrder = await DataManager.updateOrder(id, {
            status: 'cancelled',
            cancelledDate: new Date().toISOString(),
            cancellationReason: reason,
            statusHistory
        });

        // Restore product stock
        const products = await DataManager.getProducts();
        for (const item of order.items) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                await DataManager.updateProduct(product.id, {
                    stock: product.stock + item.quantity
                });
            }
        }

        res.json({
            message: 'Order cancelled successfully',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({
            error: 'Failed to cancel order'
        });
    }
});

// Get order statistics (admin only)
router.get('/admin/statistics', adminAuth, async (req, res) => {
    try {
        const orders = await DataManager.getOrders();
        
        const stats = {
            totalOrders: orders.length,
            totalRevenue: orders
                .filter(order => order.paymentStatus === 'paid')
                .reduce((sum, order) => sum + order.totalAmount, 0),
            ordersByStatus: {
                pending: orders.filter(o => o.status === 'pending').length,
                processing: orders.filter(o => o.status === 'processing').length,
                shipped: orders.filter(o => o.status === 'shipped').length,
                delivered: orders.filter(o => o.status === 'delivered').length,
                cancelled: orders.filter(o => o.status === 'cancelled').length,
                refunded: orders.filter(o => o.status === 'refunded').length
            },
            recentOrders: orders
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 10)
        };

        // Calculate monthly revenue for the last 6 months
        const monthlyRevenue = [];
        for (let i = 0; i < 6; i++) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const month = date.toISOString().slice(0, 7); // YYYY-MM format
            
            const monthRevenue = orders
                .filter(order => {
                    return order.paymentStatus === 'paid' && 
                           order.createdAt.startsWith(month);
                })
                .reduce((sum, order) => sum + order.totalAmount, 0);
            
            monthlyRevenue.unshift({
                month,
                revenue: monthRevenue,
                orders: orders.filter(order => order.createdAt.startsWith(month)).length
            });
        }

        stats.monthlyRevenue = monthlyRevenue;

        res.json({ statistics: stats });

    } catch (error) {
        console.error('Get order statistics error:', error);
        res.status(500).json({
            error: 'Failed to get order statistics'
        });
    }
});

// Get all orders (admin only)
router.get('/admin/all', adminAuth, [
    query('status').optional().isString().withMessage('Status must be a string'),
    query('paymentStatus').optional().isString().withMessage('Payment status must be a string'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('sortBy').optional().isIn(['createdAt', 'totalAmount', 'status']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
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

        const {
            status,
            paymentStatus,
            page = 1,
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        let orders = await DataManager.getOrders();

        // Filter by status if provided
        if (status) {
            orders = orders.filter(order => order.status === status);
        }

        // Filter by payment status if provided
        if (paymentStatus) {
            orders = orders.filter(order => order.paymentStatus === paymentStatus);
        }

        // Sort orders
        orders.sort((a, b) => {
            let aValue = a[sortBy];
            let bValue = b[sortBy];

            if (sortBy === 'createdAt') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedOrders = orders.slice(startIndex, endIndex);

        res.json({
            orders: paginatedOrders,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(orders.length / limit),
                totalItems: orders.length,
                itemsPerPage: parseInt(limit),
                hasNext: endIndex < orders.length,
                hasPrev: startIndex > 0
            }
        });

    } catch (error) {
        console.error('Get all orders error:', error);
        res.status(500).json({
            error: 'Failed to get orders'
        });
    }
});

// Search orders (admin only)
router.get('/admin/search', adminAuth, [
    query('q').isString().isLength({ min: 1 }).withMessage('Search query is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
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

        const { q: searchQuery, page = 1, limit = 20 } = req.query;
        const orders = await DataManager.getOrders();

        // Search in order number, customer email, and status
        const searchLower = searchQuery.toLowerCase();
        const searchResults = orders.filter(order => {
            const orderNumberMatch = order.orderNumber?.toLowerCase().includes(searchLower);
            const emailMatch = order.customerEmail?.toLowerCase().includes(searchLower);
            const statusMatch = order.status?.toLowerCase().includes(searchLower);
            
            return orderNumberMatch || emailMatch || statusMatch;
        });

        // Sort by creation date (newest first)
        searchResults.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedResults = searchResults.slice(startIndex, endIndex);

        res.json({
            orders: paginatedResults,
            search: {
                query: searchQuery,
                totalResults: searchResults.length
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(searchResults.length / limit),
                totalItems: searchResults.length,
                itemsPerPage: parseInt(limit),
                hasNext: endIndex < searchResults.length,
                hasPrev: startIndex > 0
            }
        });

    } catch (error) {
        console.error('Search orders error:', error);
        res.status(500).json({
            error: 'Failed to search orders'
        });
    }
});

module.exports = router; 
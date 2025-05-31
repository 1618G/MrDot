const express = require('express');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();
const DataManager = require('../utils/dataManager');
const { auth, adminAuth, optionalAuth } = require('../middleware/auth');

// Get all products (with filtering and pagination)
router.get('/', [
    query('category').optional().isString().withMessage('Category must be a string'),
    query('collection').optional().isString().withMessage('Collection must be a string'),
    query('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
    query('available').optional().isBoolean().withMessage('Available must be a boolean'),
    query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be a positive number'),
    query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
    query('search').optional().isString().withMessage('Search must be a string'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], optionalAuth, async (req, res) => {
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
            category,
            collection,
            featured,
            available = true,
            minPrice,
            maxPrice,
            search,
            page = 1,
            limit = 20
        } = req.query;

        let products = await DataManager.getProducts();

        // Filter products
        products = products.filter(product => {
            // Only show available products to non-admin users
            if (!req.user || req.user.role !== 'admin') {
                if (!product.available) return false;
            }

            if (category && product.category !== category) return false;
            if (collection && product.collection !== collection) return false;
            if (featured !== undefined && product.featured !== (featured === 'true')) return false;
            if (available !== undefined && product.available !== (available === 'true')) return false;
            if (minPrice && product.price < parseFloat(minPrice)) return false;
            if (maxPrice && product.price > parseFloat(maxPrice)) return false;
            
            if (search) {
                const searchLower = search.toLowerCase();
                const nameMatch = product.name.toLowerCase().includes(searchLower);
                const descMatch = product.description.toLowerCase().includes(searchLower);
                const brailleMatch = product.decodedMessage?.toLowerCase().includes(searchLower);
                
                if (!nameMatch && !descMatch && !brailleMatch) return false;
            }
            
            return true;
        });

        // Sort products (featured first, then by creation date)
        products.sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedProducts = products.slice(startIndex, endIndex);

        res.json({
            products: paginatedProducts,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(products.length / limit),
                totalItems: products.length,
                itemsPerPage: parseInt(limit),
                hasNext: endIndex < products.length,
                hasPrev: startIndex > 0
            }
        });

    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({
            error: 'Failed to get products'
        });
    }
});

// Get single product by ID
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const product = await DataManager.getProductById(id);

        if (!product) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        // Only show unavailable products to admin users
        if (!product.available && (!req.user || req.user.role !== 'admin')) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        res.json({ product });

    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({
            error: 'Failed to get product'
        });
    }
});

// Create new product (admin only)
router.post('/', adminAuth, [
    body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('description').trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('category').isString().withMessage('Category is required'),
    body('collection').optional().isString().withMessage('Collection must be a string'),
    body('images').isArray({ min: 1 }).withMessage('At least one image is required'),
    body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('dimensions').optional().isString().withMessage('Dimensions must be a string'),
    body('materials').optional().isString().withMessage('Materials must be a string'),
    body('brailleMessage').optional().isString().withMessage('Braille message must be a string'),
    body('decodedMessage').optional().isString().withMessage('Decoded message must be a string')
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

        const productData = {
            ...req.body,
            available: req.body.available !== false, // Default to true
            featured: req.body.featured === true
        };

        const product = await DataManager.createProduct(productData);

        res.status(201).json({
            message: 'Product created successfully',
            product
        });

    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({
            error: 'Failed to create product'
        });
    }
});

// Update product (admin only)
router.put('/:id', adminAuth, [
    body('name').optional().trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    body('description').optional().trim().isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('category').optional().isString().withMessage('Category must be a string'),
    body('collection').optional().isString().withMessage('Collection must be a string'),
    body('images').optional().isArray({ min: 1 }).withMessage('At least one image is required'),
    body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
    body('dimensions').optional().isString().withMessage('Dimensions must be a string'),
    body('materials').optional().isString().withMessage('Materials must be a string'),
    body('brailleMessage').optional().isString().withMessage('Braille message must be a string'),
    body('decodedMessage').optional().isString().withMessage('Decoded message must be a string')
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
        const existingProduct = await DataManager.getProductById(id);

        if (!existingProduct) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        const updatedProduct = await DataManager.updateProduct(id, req.body);

        res.json({
            message: 'Product updated successfully',
            product: updatedProduct
        });

    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({
            error: 'Failed to update product'
        });
    }
});

// Delete product (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const product = await DataManager.getProductById(id);

        if (!product) {
            return res.status(404).json({
                error: 'Product not found'
            });
        }

        await DataManager.deleteProduct(id);

        res.json({
            message: 'Product deleted successfully'
        });

    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({
            error: 'Failed to delete product'
        });
    }
});

// Get product categories
router.get('/meta/categories', async (req, res) => {
    try {
        const categories = await DataManager.getCategories();
        res.json({ categories });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            error: 'Failed to get categories'
        });
    }
});

// Get featured products
router.get('/featured/list', optionalAuth, async (req, res) => {
    try {
        let products = await DataManager.getProducts();
        
        // Filter for featured and available products
        products = products.filter(product => {
            if (!req.user || req.user.role !== 'admin') {
                return product.featured && product.available;
            }
            return product.featured;
        });

        // Sort by creation date (newest first)
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ products });

    } catch (error) {
        console.error('Get featured products error:', error);
        res.status(500).json({
            error: 'Failed to get featured products'
        });
    }
});

// Search products
router.get('/search/query', [
    query('q').isString().isLength({ min: 1 }).withMessage('Search query is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], optionalAuth, async (req, res) => {
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
        let products = await DataManager.getProducts();

        // Filter for available products (unless admin)
        if (!req.user || req.user.role !== 'admin') {
            products = products.filter(product => product.available);
        }

        // Search in name, description, braille message, and decoded message
        const searchLower = searchQuery.toLowerCase();
        const searchResults = products.filter(product => {
            const nameMatch = product.name.toLowerCase().includes(searchLower);
            const descMatch = product.description.toLowerCase().includes(searchLower);
            const brailleMatch = product.decodedMessage?.toLowerCase().includes(searchLower);
            const categoryMatch = product.category.toLowerCase().includes(searchLower);
            const collectionMatch = product.collection?.toLowerCase().includes(searchLower);
            
            return nameMatch || descMatch || brailleMatch || categoryMatch || collectionMatch;
        });

        // Sort by relevance (name matches first, then description, etc.)
        searchResults.sort((a, b) => {
            const aNameMatch = a.name.toLowerCase().includes(searchLower);
            const bNameMatch = b.name.toLowerCase().includes(searchLower);
            
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedResults = searchResults.slice(startIndex, endIndex);

        res.json({
            products: paginatedResults,
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
        console.error('Search products error:', error);
        res.status(500).json({
            error: 'Failed to search products'
        });
    }
});

// Get products by collection
router.get('/collection/:collection', optionalAuth, async (req, res) => {
    try {
        const { collection } = req.params;
        let products = await DataManager.getProducts();

        // Filter by collection and availability
        products = products.filter(product => {
            if (!req.user || req.user.role !== 'admin') {
                return product.collection === collection && product.available;
            }
            return product.collection === collection;
        });

        // Sort by featured first, then by creation date
        products.sort((a, b) => {
            if (a.featured && !b.featured) return -1;
            if (!a.featured && b.featured) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        res.json({ products, collection });

    } catch (error) {
        console.error('Get collection products error:', error);
        res.status(500).json({
            error: 'Failed to get collection products'
        });
    }
});

module.exports = router; 
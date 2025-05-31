const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class DataManager {
    constructor() {
        this.dataDir = process.env.DATA_DIR || './data';
        this.uploadsDir = process.env.UPLOADS_DIR || './uploads';
        
        // Data file paths
        this.files = {
            users: path.join(this.dataDir, 'users.json'),
            products: path.join(this.dataDir, 'products.json'),
            orders: path.join(this.dataDir, 'orders.json'),
            categories: path.join(this.dataDir, 'categories.json'),
            settings: path.join(this.dataDir, 'settings.json')
        };
    }

    // Initialize directories and default data files
    async initializeDirectories() {
        try {
            // Create directories
            await fs.ensureDir(this.dataDir);
            await fs.ensureDir(this.uploadsDir);
            await fs.ensureDir(path.join(this.uploadsDir, 'products'));
            await fs.ensureDir(path.join(this.uploadsDir, 'avatars'));

            // Initialize data files with default data
            await this.initializeDataFiles();
            
            console.log('📁 Data directories and files initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing data directories:', error);
            throw error;
        }
    }

    // Initialize data files with default content
    async initializeDataFiles() {
        const defaultData = {
            users: [],
            products: this.getDefaultProducts(),
            orders: [],
            categories: this.getDefaultCategories(),
            settings: this.getDefaultSettings()
        };

        for (const [name, filePath] of Object.entries(this.files)) {
            if (!await fs.pathExists(filePath)) {
                await this.writeFile(filePath, defaultData[name]);
                console.log(`📄 Created ${name}.json with default data`);
            }
        }
    }

    // Generic file operations
    async readFile(filePath) {
        try {
            if (!await fs.pathExists(filePath)) {
                return [];
            }
            const data = await fs.readJson(filePath);
            return data || [];
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return [];
        }
    }

    async writeFile(filePath, data) {
        try {
            await fs.writeJson(filePath, data, { spaces: 2 });
            return true;
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
            throw error;
        }
    }

    // User operations
    async getUsers() {
        return await this.readFile(this.files.users);
    }

    async getUserById(id) {
        const users = await this.getUsers();
        return users.find(user => user.id === id);
    }

    async getUserByEmail(email) {
        const users = await this.getUsers();
        return users.find(user => user.email === email);
    }

    async createUser(userData) {
        const users = await this.getUsers();
        const newUser = {
            id: uuidv4(),
            ...userData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        users.push(newUser);
        await this.writeFile(this.files.users, users);
        return newUser;
    }

    async updateUser(id, updateData) {
        const users = await this.getUsers();
        const userIndex = users.findIndex(user => user.id === id);
        
        if (userIndex === -1) {
            throw new Error('User not found');
        }

        users[userIndex] = {
            ...users[userIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        await this.writeFile(this.files.users, users);
        return users[userIndex];
    }

    // Product operations
    async getProducts() {
        return await this.readFile(this.files.products);
    }

    async getProductById(id) {
        const products = await this.getProducts();
        return products.find(product => product.id === id);
    }

    async createProduct(productData) {
        const products = await this.getProducts();
        const newProduct = {
            id: uuidv4(),
            ...productData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        products.push(newProduct);
        await this.writeFile(this.files.products, products);
        return newProduct;
    }

    async updateProduct(id, updateData) {
        const products = await this.getProducts();
        const productIndex = products.findIndex(product => product.id === id);
        
        if (productIndex === -1) {
            throw new Error('Product not found');
        }

        products[productIndex] = {
            ...products[productIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        await this.writeFile(this.files.products, products);
        return products[productIndex];
    }

    async deleteProduct(id) {
        const products = await this.getProducts();
        const filteredProducts = products.filter(product => product.id !== id);
        await this.writeFile(this.files.products, filteredProducts);
        return true;
    }

    // Order operations
    async getOrders() {
        return await this.readFile(this.files.orders);
    }

    async getOrderById(id) {
        const orders = await this.getOrders();
        return orders.find(order => order.id === id);
    }

    async getOrdersByUserId(userId) {
        const orders = await this.getOrders();
        return orders.filter(order => order.userId === userId);
    }

    async createOrder(orderData) {
        const orders = await this.getOrders();
        const newOrder = {
            id: uuidv4(),
            orderNumber: this.generateOrderNumber(),
            ...orderData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        orders.push(newOrder);
        await this.writeFile(this.files.orders, orders);
        return newOrder;
    }

    async updateOrder(id, updateData) {
        const orders = await this.getOrders();
        const orderIndex = orders.findIndex(order => order.id === id);
        
        if (orderIndex === -1) {
            throw new Error('Order not found');
        }

        orders[orderIndex] = {
            ...orders[orderIndex],
            ...updateData,
            updatedAt: new Date().toISOString()
        };

        await this.writeFile(this.files.orders, orders);
        return orders[orderIndex];
    }

    // Category operations
    async getCategories() {
        return await this.readFile(this.files.categories);
    }

    // Settings operations
    async getSettings() {
        return await this.readFile(this.files.settings);
    }

    async updateSettings(updateData) {
        const settings = await this.getSettings();
        const updatedSettings = {
            ...settings,
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        await this.writeFile(this.files.settings, updatedSettings);
        return updatedSettings;
    }

    // Helper methods
    generateOrderNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `MD${timestamp}${random}`;
    }

    // Default data generators
    getDefaultProducts() {
        return [
            {
                id: uuidv4(),
                name: "Hope in Braille",
                description: "A vibrant piece expressing hope through colorful Braille dots. This artwork combines visual beauty with tactile meaning, spelling out 'HOPE' in Grade 1 Braille.",
                price: 150.00,
                category: "originals",
                collection: "journey",
                images: [
                    "/images/Mr Dot Images11.jpg"
                ],
                brailleMessage: "⠓⠕⠏⠑",
                decodedMessage: "Hope",
                stock: 1,
                dimensions: "30cm x 20cm",
                materials: "Acrylic on canvas with raised tactile elements",
                featured: true,
                available: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: uuidv4(),
                name: "Love Beyond Sight",
                description: "A beautiful representation of love that transcends visual boundaries. Created with warm colors and tactile Braille spelling 'LOVE'.",
                price: 125.00,
                category: "prints",
                collection: "vision",
                images: [
                    "/images/Mr Dot Images12.jpg"
                ],
                brailleMessage: "⠇⠕⠧⠑",
                decodedMessage: "Love",
                stock: 5,
                dimensions: "A3 (297mm x 420mm)",
                materials: "High-quality print on tactile paper",
                featured: true,
                available: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: uuidv4(),
                name: "Unity Through Touch",
                description: "A collaborative piece celebrating unity and connection. The Braille message 'UNITY' is woven throughout this colorful composition.",
                price: 200.00,
                category: "originals",
                collection: "windows",
                images: [
                    "/images/Mr Dot Images13.jpg"
                ],
                brailleMessage: "⠥⠝⠊⠞⠽",
                decodedMessage: "Unity",
                stock: 1,
                dimensions: "40cm x 30cm",
                materials: "Mixed media with tactile elements",
                featured: true,
                available: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: uuidv4(),
                name: "Mr Dot's Book Set",
                description: "The complete collection of Mr Dot and His Magical White Cane Adventures, including Braille learning cards for children.",
                price: 25.00,
                category: "books",
                collection: "education",
                images: [
                    "/images/Mr Dot Images19.jpg"
                ],
                brailleMessage: "⠗⠑⠁⠙",
                decodedMessage: "Read",
                stock: 20,
                dimensions: "210mm x 148mm",
                materials: "Full-color print with Braille elements",
                featured: false,
                available: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: uuidv4(),
                name: "Braille Pattern T-Shirt",
                description: "Wear your support for inclusive art with this stylish t-shirt featuring Mr Dot's signature Braille patterns.",
                price: 35.00,
                category: "merchandise",
                collection: "clothing",
                images: [
                    "/images/Mr Dot Images20.jpg"
                ],
                brailleMessage: "⠁⠗⠞",
                decodedMessage: "Art",
                stock: 15,
                dimensions: "Various sizes available",
                materials: "100% organic cotton",
                featured: false,
                available: true,
                variants: [
                    { size: "S", stock: 3 },
                    { size: "M", stock: 5 },
                    { size: "L", stock: 4 },
                    { size: "XL", stock: 3 }
                ],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
    }

    getDefaultCategories() {
        return [
            {
                id: uuidv4(),
                name: "Original Works",
                slug: "originals",
                description: "One-of-a-kind Braille art on wood, canvas, and mixed media",
                icon: "🎨",
                featured: true
            },
            {
                id: uuidv4(),
                name: "Braille Prints",
                slug: "prints",
                description: "High-quality, vivid reproductions with decoded messages",
                icon: "🖼️",
                featured: true
            },
            {
                id: uuidv4(),
                name: "Books & Learning",
                slug: "books",
                description: "Educational materials and Mr Dot's published works",
                icon: "📚",
                featured: true
            },
            {
                id: uuidv4(),
                name: "Merchandise",
                slug: "merchandise",
                description: "Wearable art inspired by Clarke's iconic Braille patterns",
                icon: "👕",
                featured: true
            }
        ];
    }

    getDefaultSettings() {
        return {
            siteName: "Mr Dot Art",
            siteDescription: "Braille Art by Clarke Reynolds",
            currency: "GBP",
            taxRate: 0.20, // 20% VAT for UK
            shipping: {
                freeShippingThreshold: 100,
                standardShipping: 5.99,
                expressShipping: 12.99
            },
            emails: {
                orderConfirmation: true,
                shippingNotification: true,
                newsletter: true
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }
}

module.exports = new DataManager(); 
# Mr Dot - Braille Art E-commerce Platform

A comprehensive e-commerce platform for Mr Dot (Clarke Reynolds), featuring accessible design, Stripe payment integration, and JSON-based data storage.

## 🎨 Features

- **Accessible Design**: Built with screen readers and keyboard navigation in mind
- **Braille Art Gallery**: Interactive gallery with hidden Braille messages
- **E-commerce**: Full shopping cart, checkout, and payment processing with Stripe
- **User Authentication**: JWT-based authentication with user profiles
- **Admin Dashboard**: Complete admin panel for managing products, orders, and users
- **JSON Storage**: Simple file-based data storage (easily migrated to database later)
- **Responsive Design**: Mobile-first design that works on all devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Stripe account (for payments)

### Installation

1. **Clone/Download the project**
   ```bash
   cd /path/to/your/project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Stripe Configuration (replace with your test keys)
   STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_HERE
   STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY_HERE
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

   # JWT Configuration
   JWT_SECRET=mr_dot_super_secret_key_2024_braille_art_platform
   JWT_EXPIRES_IN=7d

   # Admin Configuration
   ADMIN_EMAIL=hello@mrdot.art
   ADMIN_PASSWORD=admin123!

   # File Storage
   DATA_DIR=./data
   UPLOADS_DIR=./uploads
   ```

4. **Start the server**
   ```bash
   # Development mode (with auto-restart)
   npm run dev

   # Production mode
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
MrDot/
├── server.js                 # Main server file
├── package.json              # Dependencies and scripts
├── index.html                # Frontend HTML
├── styles.css                # Frontend CSS
├── script.js                 # Frontend JavaScript
├── images/                   # Mr Dot artwork images
├── data/                     # JSON data files (auto-created)
│   ├── users.json
│   ├── products.json
│   ├── orders.json
│   ├── categories.json
│   └── settings.json
├── uploads/                  # Uploaded files (auto-created)
│   ├── products/
│   └── avatars/
├── routes/                   # API routes
│   ├── auth.js              # Authentication
│   ├── products.js          # Product management
│   ├── orders.js            # Order management
│   ├── admin.js             # Admin functions
│   └── stripe.js            # Payment processing
├── middleware/               # Express middleware
│   └── auth.js              # JWT authentication
├── utils/                    # Utilities
│   └── dataManager.js       # JSON file operations
└── README.md                # This file
```

## 🔐 Default Admin Account

When the server starts, default data is created including an admin account:

- **Email**: hello@mrdot.art
- **Password**: admin123!

**⚠️ Change this password immediately in production!**

## 🛒 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Products
- `GET /api/products` - Get all products (with filtering)
- `GET /api/products/:id` - Get single product
- `GET /api/products/featured/list` - Get featured products
- `GET /api/products/search/query?q=term` - Search products
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Orders
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get single order
- `PATCH /api/orders/:id/cancel` - Cancel order
- `GET /api/orders/admin/all` - Get all orders (admin)
- `PATCH /api/orders/:id/status` - Update order status (admin)

### Stripe Payments
- `POST /api/stripe/create-checkout-session` - Create payment session
- `GET /api/stripe/checkout-session/:id` - Get session details
- `POST /api/stripe/webhook` - Stripe webhook handler

### Admin
- `GET /api/admin/dashboard` - Admin dashboard data
- `GET /api/admin/users` - Manage users
- `POST /api/admin/upload/images` - Upload product images
- `GET /api/admin/settings` - Get site settings
- `PUT /api/admin/settings` - Update settings

## 💳 Stripe Integration

### Test Cards

Use these test card numbers for development:

- **Successful payment**: `4242 4242 4242 4242`
- **Declined payment**: `4000 0000 0000 0002`
- **Requires authentication**: `4000 0025 0000 3155`

Use any future expiry date, any 3-digit CVC, and any postal code.

### Webhooks

For local development, use Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to your Stripe account
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## 🚀 Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
JWT_SECRET=your_super_secure_jwt_secret
```

### Deploy to Render

1. **Create a new Web Service** on [Render.com](https://render.com)

2. **Connect your repository**

3. **Set environment variables** in Render dashboard

4. **Configure build and start commands**:
   - Build Command: `npm install`
   - Start Command: `npm start`

### Deploy to Railway

1. **Connect to [Railway.app](https://railway.app)**

2. **Set environment variables**

3. **Deploy** automatically from Git

## 📱 Frontend Features

### Accessibility
- ARIA labels for screen readers
- Keyboard navigation support
- High contrast design
- Focus indicators
- Skip navigation links

### Interactive Elements
- **Braille Decoder**: Hover/click on artworks to reveal hidden messages
- **Gallery Filtering**: Filter by collection or category
- **Shopping Cart**: Add/remove items, update quantities
- **User Authentication**: Login/register with form validation
- **Contact Form**: Accessible contact form with validation

### Responsive Design
- Mobile-first approach
- CSS Grid and Flexbox layouts
- Touch-friendly buttons
- Collapsible navigation

## 🔧 Customization

### Adding Products
1. Log in as admin
2. Go to `/admin` or use API endpoints
3. Upload images via admin panel
4. Create products with Braille messages

### Updating Settings
- Shipping costs and thresholds
- Tax rates
- Currency settings
- Site information

### Custom Styling
- Edit `styles.css` for visual changes
- CSS custom properties for easy theming
- Responsive breakpoints defined

## 🐛 Troubleshooting

### Common Issues

1. **Server won't start**
   - Check Node.js version (18+)
   - Verify `.env` file exists
   - Check port availability

2. **Payments not working**
   - Verify Stripe keys in `.env`
   - Check webhook endpoint
   - Test with Stripe test cards

3. **Images not loading**
   - Check `images/` directory exists
   - Verify file permissions
   - Ensure correct image paths

### Debug Mode
Set `NODE_ENV=development` for detailed error messages.

## 📊 Data Migration

To migrate from JSON to a database later:

1. Export data using `/api/admin/backup`
2. Set up database (MongoDB, PostgreSQL, etc.)
3. Update `DataManager` to use database instead of JSON files
4. Import backed up data

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🎨 About Mr Dot

Clarke Reynolds, known as Mr Dot, is a blind British Braille artist who transforms the tactile language of Braille into vibrant, interactive art. His work bridges the gap between visual and tactile experiences, making art accessible to everyone.

## 📞 Support

For support or questions:
- Email: hello@mrdot.art
- Website: [mrdot.art](https://mrdot.art)

---

**Made with ❤️ for accessibility and inclusion** 
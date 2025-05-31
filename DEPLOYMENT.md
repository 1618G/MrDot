# 🚀 Deployment Guide for Mr Dot E-commerce Platform

## ✅ Pre-Deployment Checklist

✅ **Server tested locally** - Working perfectly!
✅ **Dependencies installed** - All Node.js packages ready
✅ **Environment variables configured** - .env file created
✅ **Stripe integration** - Test keys configured
✅ **JSON data storage** - Ready with default products
✅ **Routes and middleware** - All APIs functional

## 🌐 Deploy to Render

### 1. **Create Render Account**
- Go to [render.com](https://render.com)
- Sign up with GitHub (recommended for easy deploys)

### 2. **Connect Repository**
- Push your code to GitHub if not already there
- In Render dashboard, click "New" → "Web Service"
- Connect your GitHub repository

### 3. **Configure Build Settings**
```
Name: mr-dot-ecommerce
Environment: Node
Build Command: npm install
Start Command: npm start
```

### 4. **Set Environment Variables**
```
NODE_ENV=production
PORT=10000
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_STRIPE_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY_HERE
JWT_SECRET=mr_dot_super_secret_key_2024_braille_art_platform
DATA_DIR=./data
UPLOADS_DIR=./uploads
ADMIN_EMAIL=admin@mrdot.com
ADMIN_PASSWORD=MrDot2024Admin!
```

**🔑 Replace placeholders with actual Stripe test keys**

### 5. **Deploy**
- Click "Create Web Service"
- Render will automatically build and deploy
- Takes about 2-3 minutes

### 6. **Post-Deployment Setup**

#### Update Stripe Webhook URL
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-render-url.onrender.com/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy webhook secret and update `STRIPE_WEBHOOK_SECRET` in Render environment

#### Test the Deployment
1. Visit your Render URL
2. Test user registration and login
3. Test product browsing
4. Test shopping cart (use test card: 4242 4242 4242 4242)

## 🔧 Production Considerations

### For Live Production:
1. **Update Stripe Keys**: Replace test keys with live keys
2. **Secure JWT Secret**: Generate a strong random secret
3. **Custom Domain**: Configure your domain in Render
4. **SSL Certificate**: Automatic with Render
5. **Monitoring**: Set up Render's monitoring

### Database Migration (Future):
The current JSON storage works great for getting started. When you need to scale:
1. Export data using `/api/admin/backup`
2. Set up MongoDB or PostgreSQL
3. Update DataManager to use database
4. Import your data

## 🎯 Your Deployment URLs

After deployment, you'll have:
- **Main Site**: `https://your-app-name.onrender.com`
- **API Health**: `https://your-app-name.onrender.com/api/health`
- **Admin Panel**: `https://your-app-name.onrender.com` (login as admin)

## 🔐 Security Notes

- All environment variables are encrypted in Render
- HTTPS is automatically enabled
- Rate limiting is configured
- JWT tokens expire after 7 days
- Passwords are hashed with bcrypt

## 📊 Monitoring & Maintenance

- **Logs**: Available in Render dashboard
- **Uptime**: Render provides automatic monitoring
- **Backups**: Use `/api/admin/backup` endpoint regularly
- **Updates**: Push to GitHub, Render auto-deploys

---

**🎨 Your Mr Dot e-commerce platform is ready for the world!**

Default admin login:
- Email: hello@mrdot.art
- Password: admin123! (⚠️ Change immediately after first login)

Test customer experience with Stripe test cards:
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002 
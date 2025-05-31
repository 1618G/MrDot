#!/bin/bash

# 🎨 Mr Dot E-commerce - Quick Deployment Script
# This script helps deploy your application to GitHub and then to Render

echo "🎨 Mr Dot E-commerce - Deployment Script"
echo "========================================"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git not initialized. Run: git init"
    exit 1
fi

# Add all changes
echo "📝 Adding all changes to git..."
git add .

# Commit changes
echo "💾 Committing changes..."
git commit -m "Deploy Mr Dot e-commerce platform - $(date '+%Y-%m-%d %H:%M:%S')"

# Check if remote exists
if git remote get-url origin > /dev/null 2>&1; then
    echo "🔗 Remote origin already exists"
else
    echo "🔗 Adding GitHub remote..."
    git remote add origin https://github.com/1618G/MrDot.git
fi

# Push to GitHub
echo "🚀 Pushing to GitHub..."
echo "📍 Repository: https://github.com/1618G/MrDot"

# Set main branch
git branch -M main

# Push to origin
echo "⬆️  Pushing to origin/main..."
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Code pushed to GitHub"
    echo ""
    echo "🌐 Next Steps for Render Deployment:"
    echo "1. Go to https://render.com"
    echo "2. Click 'New +' → 'Web Service'"
    echo "3. Connect repository: 1618G/MrDot"
    echo "4. Use these settings:"
    echo "   - Build Command: npm install"
    echo "   - Start Command: npm start"
    echo "   - Health Check: /api/health"
    echo ""
    echo "📋 Don't forget to set environment variables in Render!"
    echo "   (See DEPLOYMENT_INSTRUCTIONS.md for details)"
    echo ""
    echo "🎉 Your Mr Dot e-commerce platform is ready to deploy!"
else
    echo ""
    echo "❌ Error pushing to GitHub"
    echo "💡 You may need to:"
    echo "   1. Create the repository 1618G/MrDot on GitHub first"
    echo "   2. Authenticate with GitHub (gh auth login)"
    echo "   3. Check repository permissions"
    echo ""
    echo "📦 Alternative: Use the ZIP file (MrDot-ecommerce.zip) for manual upload"
fi 
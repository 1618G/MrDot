// ===== UTILITY FUNCTIONS =====
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== NAVIGATION FUNCTIONALITY =====
class Navigation {
    constructor() {
        this.navbar = document.querySelector('.navbar');
        this.navToggle = document.querySelector('.nav-toggle');
        this.navMenu = document.querySelector('.nav-menu');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.sections = document.querySelectorAll('section[id]');
        
        this.init();
    }
    
    init() {
        this.handleScroll();
        this.handleMobileToggle();
        this.handleSmoothScrolling();
        this.handleActiveLinks();
        
        // Event listeners
        window.addEventListener('scroll', debounce(() => this.handleScroll(), 10));
        window.addEventListener('scroll', debounce(() => this.updateActiveLink(), 100));
    }
    
    handleScroll() {
        if (window.scrollY > 100) {
            this.navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            this.navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
        } else {
            this.navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            this.navbar.style.boxShadow = 'none';
        }
    }
    
    handleMobileToggle() {
        this.navToggle.addEventListener('click', () => {
            const isExpanded = this.navToggle.getAttribute('aria-expanded') === 'true';
            
            this.navToggle.setAttribute('aria-expanded', !isExpanded);
            this.navMenu.classList.toggle('active');
            
            // Animate hamburger lines
            const lines = this.navToggle.querySelectorAll('.hamburger-line');
            if (!isExpanded) {
                lines[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                lines[1].style.opacity = '0';
                lines[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                lines[0].style.transform = 'none';
                lines[1].style.opacity = '1';
                lines[2].style.transform = 'none';
            }
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.navbar.contains(e.target) && this.navMenu.classList.contains('active')) {
                this.navToggle.click();
            }
        });
    }
    
    handleSmoothScrolling() {
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                const targetId = link.getAttribute('href');
                const targetSection = document.querySelector(targetId);
                
                if (targetSection) {
                    const offsetTop = targetSection.offsetTop - 80; // Account for fixed navbar
                    
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                    
                    // Close mobile menu if open
                    if (this.navMenu.classList.contains('active')) {
                        this.navToggle.click();
                    }
                }
            });
        });
    }
    
    handleActiveLinks() {
        // Set initial active link
        this.updateActiveLink();
    }
    
    updateActiveLink() {
        const scrollPosition = window.scrollY + 150; // Offset for better UX
        
        this.sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                this.navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }
}

// ===== GALLERY FUNCTIONALITY =====
class Gallery {
    constructor() {
        this.filterButtons = document.querySelectorAll('.filter-btn');
        this.galleryItems = document.querySelectorAll('.gallery-item');
        this.decodeButtons = document.querySelectorAll('.decode-btn');
        
        this.init();
    }
    
    init() {
        this.handleFiltering();
        this.handleBrailleDecoding();
        this.handleImageLazyLoading();
    }
    
    handleFiltering() {
        this.filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const filter = button.getAttribute('data-filter');
                
                // Update active button
                this.filterButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.setAttribute('aria-selected', 'false');
                });
                button.classList.add('active');
                button.setAttribute('aria-selected', 'true');
                
                // Filter gallery items
                this.galleryItems.forEach(item => {
                    const collection = item.getAttribute('data-collection');
                    
                    if (filter === 'all' || collection === filter) {
                        item.style.display = 'block';
                        item.style.animation = 'fadeInUp 0.6s ease-out';
                    } else {
                        item.style.display = 'none';
                    }
                });
                
                // Announce filter change to screen readers
                this.announceFilterChange(button.textContent);
            });
        });
    }
    
    handleBrailleDecoding() {
        this.decodeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const brailleMessage = button.parentElement.querySelector('.braille-message');
                const brailleText = brailleMessage.getAttribute('data-braille');
                const decodedText = brailleMessage.textContent;
                
                if (brailleMessage.textContent === decodedText) {
                    // Show Braille
                    brailleMessage.textContent = brailleText;
                    button.textContent = 'Decode';
                    button.setAttribute('aria-label', 'Decode Braille message');
                } else {
                    // Show decoded text
                    brailleMessage.textContent = decodedText;
                    button.textContent = 'Show Braille';
                    button.setAttribute('aria-label', 'Show Braille text');
                }
                
                // Add visual feedback
                brailleMessage.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    brailleMessage.style.transform = 'scale(1)';
                }, 200);
            });
        });
    }
    
    handleImageLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.src || img.getAttribute('data-src');
                        img.classList.remove('lazy');
                        observer.unobserve(img);
                    }
                });
            });
            
            document.querySelectorAll('img[loading="lazy"]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }
    
    announceFilterChange(filterName) {
        const announcement = document.createElement('div');
        announcement.textContent = `Gallery filtered to show ${filterName}`;
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'sr-only';
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
}

// ===== CONTACT FORM FUNCTIONALITY =====
class ContactForm {
    constructor() {
        this.form = document.querySelector('.contact-form');
        this.inputs = this.form.querySelectorAll('input, select, textarea');
        
        this.init();
    }
    
    init() {
        this.handleFormValidation();
        this.handleFormSubmission();
    }
    
    handleFormValidation() {
        this.inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearError(input));
        });
    }
    
    validateField(field) {
        const value = field.value.trim();
        const errorElement = document.getElementById(`${field.name}-error`);
        let isValid = true;
        let errorMessage = '';
        
        // Clear previous error
        this.clearError(field);
        
        switch (field.type) {
            case 'text':
                if (value.length < 2) {
                    errorMessage = 'Name must be at least 2 characters long';
                    isValid = false;
                }
                break;
                
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    errorMessage = 'Please enter a valid email address';
                    isValid = false;
                }
                break;
                
            case 'select-one':
                if (!value) {
                    errorMessage = 'Please select a purpose for your enquiry';
                    isValid = false;
                }
                break;
                
            case 'textarea':
                if (value.length < 10) {
                    errorMessage = 'Message must be at least 10 characters long';
                    isValid = false;
                }
                break;
        }
        
        if (!isValid) {
            this.showError(field, errorMessage);
        }
        
        return isValid;
    }
    
    showError(field, message) {
        const errorElement = document.getElementById(`${field.name}-error`);
        field.style.borderColor = '#e53e3e';
        field.setAttribute('aria-invalid', 'true');
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    
    clearError(field) {
        const errorElement = document.getElementById(`${field.name}-error`);
        field.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        field.setAttribute('aria-invalid', 'false');
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
    
    handleFormSubmission() {
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Validate all fields
            let isFormValid = true;
            this.inputs.forEach(input => {
                if (!this.validateField(input)) {
                    isFormValid = false;
                }
            });
            
            if (isFormValid) {
                this.submitForm();
            } else {
                // Focus on first invalid field
                const firstError = this.form.querySelector('[aria-invalid="true"]');
                if (firstError) {
                    firstError.focus();
                }
            }
        });
    }
    
    async submitForm() {
        const submitButton = this.form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        
        // Show loading state
        submitButton.textContent = 'Sending...';
        submitButton.disabled = true;
        
        try {
            // Simulate form submission (replace with actual endpoint)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Show success message
            this.showSuccessMessage();
            this.form.reset();
            
        } catch (error) {
            this.showErrorMessage();
        } finally {
            // Reset button
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }
    
    showSuccessMessage() {
        const message = document.createElement('div');
        message.className = 'success-message';
        message.textContent = 'Thank you! Your message has been sent successfully.';
        message.style.cssText = `
            background: #48bb78;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            text-align: center;
        `;
        
        this.form.insertBefore(message, this.form.firstChild);
        
        setTimeout(() => {
            message.remove();
        }, 5000);
    }
    
    showErrorMessage() {
        const message = document.createElement('div');
        message.className = 'error-message';
        message.textContent = 'Sorry, there was an error sending your message. Please try again.';
        message.style.cssText = `
            background: #e53e3e;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            text-align: center;
        `;
        
        this.form.insertBefore(message, this.form.firstChild);
        
        setTimeout(() => {
            message.remove();
        }, 5000);
    }
}

// ===== VIDEO FUNCTIONALITY =====
class VideoPlayer {
    constructor() {
        this.playButton = document.querySelector('.play-button');
        this.videoPlaceholder = document.querySelector('.video-placeholder');
        
        this.init();
    }
    
    init() {
        if (this.playButton) {
            this.playButton.addEventListener('click', () => {
                // For now, we'll show an alert. In a real implementation,
                // you would embed the actual video player here
                this.showVideoModal();
            });
        }
    }
    
    showVideoModal() {
        // Create a simple modal for video (replace with actual video embed)
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 20px;
            text-align: center;
            max-width: 400px;
        `;
        
        content.innerHTML = `
            <h3>Video Coming Soon!</h3>
            <p>The documentary about Clarke Reynolds' journey will be available here soon.</p>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="margin-top: 1rem; padding: 0.5rem 1rem; border: none; 
                           border-radius: 5px; background: #667eea; color: white; cursor: pointer;">
                Close
            </button>
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Focus management
        content.querySelector('button').focus();
    }
}

// ===== ACCESSIBILITY ENHANCEMENTS =====
class AccessibilityEnhancements {
    constructor() {
        this.init();
    }
    
    init() {
        this.handleKeyboardNavigation();
        this.handleFocusManagement();
        this.announcePageLoad();
    }
    
    handleKeyboardNavigation() {
        // Enhanced keyboard navigation for interactive elements
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close any open modals or menus
                const activeModal = document.querySelector('.modal');
                const activeMenu = document.querySelector('.nav-menu.active');
                
                if (activeModal) {
                    activeModal.remove();
                } else if (activeMenu) {
                    document.querySelector('.nav-toggle').click();
                }
            }
        });
    }
    
    handleFocusManagement() {
        // Ensure focus is visible and logical
        const focusableElements = document.querySelectorAll(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        focusableElements.forEach(element => {
            element.addEventListener('focus', () => {
                element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            });
        });
    }
    
    announcePageLoad() {
        // Announce page load completion to screen readers
        window.addEventListener('load', () => {
            const announcement = document.createElement('div');
            announcement.textContent = 'Mr Dot website loaded successfully';
            announcement.setAttribute('aria-live', 'polite');
            announcement.className = 'sr-only';
            document.body.appendChild(announcement);
            
            setTimeout(() => {
                document.body.removeChild(announcement);
            }, 1000);
        });
    }
}

// ===== SCROLL ANIMATIONS =====
class ScrollAnimations {
    constructor() {
        this.animatedElements = document.querySelectorAll(
            '.featured-item, .stat-item, .about-story, .shop-category'
        );
        
        this.init();
    }
    
    init() {
        if ('IntersectionObserver' in window && 
            !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.setupIntersectionObserver();
        }
    }
    
    setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-up');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        this.animatedElements.forEach(element => {
            observer.observe(element);
        });
    }
}

// ===== SHOP FUNCTIONALITY =====
class Shop {
    constructor() {
        this.categoryButtons = document.querySelectorAll('.shop-category .btn');
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.products = [];
        
        this.init();
    }
    
    async init() {
        await this.loadProducts();
        this.handleCategoryClicks();
        this.createCartUI();
        this.updateCartDisplay();
    }
    
    async loadProducts() {
        try {
            const response = await fetch('/api/products?available=true');
            const data = await response.json();
            this.products = data.products || [];
            console.log('Loaded products:', this.products.length);
        } catch (error) {
            console.error('Failed to load products:', error);
            this.products = [];
        }
    }
    
    handleCategoryClicks() {
        this.categoryButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                const category = button.parentElement.querySelector('h3').textContent;
                this.showProductModal(category);
            });
        });
    }
    
    showProductModal(category) {
        // Filter products by category
        const categoryProducts = this.products.filter(product => {
            const productName = product.name.toLowerCase();
            return category.toLowerCase().includes('original') ? productName.includes('original') :
                   category.toLowerCase().includes('print') ? productName.includes('print') :
                   category.toLowerCase().includes('book') ? productName.includes('book') :
                   category.toLowerCase().includes('merchandise') ? productName.includes('merch') :
                   true; // Show all if no specific category
        });
        
        if (categoryProducts.length === 0) {
            this.showComingSoonMessage(category);
            return;
        }
        
        this.createProductModal(category, categoryProducts);
    }
    
    createProductModal(category, products) {
        // Remove existing modal
        const existingModal = document.querySelector('.product-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'product-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 15px;
            max-width: 900px;
            max-height: 80vh;
            overflow-y: auto;
            padding: 30px;
            position: relative;
        `;
        
        modalContent.innerHTML = `
            <button class="modal-close" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
            <h2>🎨 ${category}</h2>
            <div class="products-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">
                ${products.map(product => `
                    <div class="product-card" style="border: 1px solid #eee; border-radius: 10px; padding: 15px; text-align: center;">
                        <img src="${product.images?.[0] || '/images/Mr Dot Images1.jpg'}" alt="${product.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;">
                        <h3 style="margin: 10px 0; font-size: 1.1em;">${product.name}</h3>
                        <p style="color: #666; font-size: 0.9em; margin: 5px 0;">${product.description}</p>
                        <p style="font-weight: bold; color: #667eea; font-size: 1.2em;">£${product.price}</p>
                        <button class="add-to-cart-btn" data-product-id="${product._id}" style="
                            background: #667eea;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 5px;
                            cursor: pointer;
                            width: 100%;
                            font-weight: bold;
                        ">Add to Cart</button>
                    </div>
                `).join('')}
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        // Add to cart functionality
        modal.querySelectorAll('.add-to-cart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.dataset.productId;
                this.addToCart(productId);
                this.showAddedToCartMessage();
            });
        });
    }
    
    addToCart(productId) {
        const product = this.products.find(p => p._id === productId);
        if (!product) return;
        
        const existingItem = this.cart.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                productId: productId,
                name: product.name,
                price: product.price,
                quantity: 1,
                image: product.images?.[0] || '/images/Mr Dot Images1.jpg'
            });
        }
        
        localStorage.setItem('cart', JSON.stringify(this.cart));
        this.updateCartDisplay();
    }
    
    createCartUI() {
        // Add cart button to navigation
        const nav = document.querySelector('.nav-menu');
        if (nav && !document.querySelector('.cart-btn')) {
            const cartBtn = document.createElement('li');
            cartBtn.className = 'nav-item cart-btn';
            cartBtn.innerHTML = `
                <button class="nav-link cart-toggle" style="background: none; border: none; color: inherit; cursor: pointer;">
                    🛒 Cart (<span class="cart-count">0</span>)
                </button>
            `;
            nav.appendChild(cartBtn);
            
            cartBtn.querySelector('.cart-toggle').addEventListener('click', () => this.showCartModal());
        }
    }
    
    updateCartDisplay() {
        const cartCount = document.querySelector('.cart-count');
        if (cartCount) {
            const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
            cartCount.textContent = totalItems;
        }
    }
    
    showCartModal() {
        const existingModal = document.querySelector('.cart-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'cart-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 15px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            padding: 30px;
            position: relative;
        `;
        
        const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        modalContent.innerHTML = `
            <button class="modal-close" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
            <h2>🛒 Shopping Cart</h2>
            ${this.cart.length === 0 ? 
                '<p>Your cart is empty</p>' : 
                `
                <div class="cart-items">
                    ${this.cart.map(item => `
                        <div class="cart-item" style="display: flex; align-items: center; padding: 15px; border-bottom: 1px solid #eee;">
                            <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 5px; margin-right: 15px;">
                            <div style="flex: 1;">
                                <h4 style="margin: 0;">${item.name}</h4>
                                <p style="margin: 5px 0; color: #666;">£${item.price} × ${item.quantity}</p>
                            </div>
                            <button class="remove-item" data-product-id="${item.productId}" style="background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Remove</button>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee;">
                    <h3>Total: £${total.toFixed(2)}</h3>
                    <button class="checkout-btn" style="
                        background: #28a745;
                        color: white;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 5px;
                        cursor: pointer;
                        width: 100%;
                        font-size: 1.1em;
                        font-weight: bold;
                        margin-top: 10px;
                    ">Proceed to Checkout</button>
                </div>
                `
            }
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        // Remove item functionality
        modal.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.dataset.productId;
                this.cart = this.cart.filter(item => item.productId !== productId);
                localStorage.setItem('cart', JSON.stringify(this.cart));
                this.updateCartDisplay();
                modal.remove();
                this.showCartModal(); // Refresh the modal
            });
        });
        
        // Checkout functionality
        const checkoutBtn = modal.querySelector('.checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                modal.remove();
                this.initiateCheckout();
            });
        }
    }
    
    async initiateCheckout() {
        if (this.cart.length === 0) return;
        
        try {
            const response = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: this.cart.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity
                    }))
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Redirect to Stripe Checkout
                window.location.href = data.url;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            this.showErrorMessage('Checkout failed. Please try again.');
        }
    }
    
    showAddedToCartMessage() {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        toast.textContent = '✅ Added to cart!';
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
    
    showErrorMessage(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
    
    showComingSoonMessage(category) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: #667eea;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        toast.textContent = `${category} shop coming soon!`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// ===== PERFORMANCE OPTIMIZATION =====
class PerformanceOptimizer {
    constructor() {
        this.init();
    }
    
    init() {
        this.preloadCriticalImages();
        this.optimizeAnimations();
    }
    
    preloadCriticalImages() {
        // Preload hero image and other critical images
        const criticalImages = [
            'images/Mr Dot Images1.jpg', // Hero image
            'images/Mr Dot Images2.jpg'  // About preview
        ];
        
        criticalImages.forEach(src => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = src;
            document.head.appendChild(link);
        });
    }
    
    optimizeAnimations() {
        // Reduce animations on slower devices
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
            document.documentElement.style.setProperty('--animation-duration', '0.1s');
        }
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components
    new Navigation();
    new Gallery();
    new ContactForm();
    new VideoPlayer();
    new AccessibilityEnhancements();
    new ScrollAnimations();
    new Shop();
    new PerformanceOptimizer();
    
    // Add custom CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        .fade-in-up {
            animation: fadeInUp 0.8s ease-out forwards;
        }
    `;
    document.head.appendChild(style);
    
    console.log('🎨 Mr Dot website initialized successfully!');
});

// ===== ERROR HANDLING =====
window.addEventListener('error', (e) => {
    console.error('Website error:', e.error);
    // Could implement error reporting here
});

// ===== EXPORT FOR TESTING =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Navigation,
        Gallery,
        ContactForm,
        VideoPlayer,
        AccessibilityEnhancements
    };
} 
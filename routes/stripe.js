const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const DataManager = require('../utils/dataManager');
const { auth } = require('../middleware/auth');
const jwt = require('jsonwebtoken');

// Test Stripe connection
router.get('/test', async (req, res) => {
    try {
        console.log('Testing Stripe with key:', process.env.STRIPE_SECRET_KEY ? 'Key present' : 'No key');
        
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'Test Product'
                    },
                    unit_amount: 1000,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: 'http://localhost:3000',
            cancel_url: 'http://localhost:3000',
        });
        
        res.json({ success: true, sessionId: session.id });
    } catch (error) {
        console.error('Stripe test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
    try {
        const { items, shippingAddress, billingAddress, customerEmail } = req.body;
        
        // Optional user authentication - allow guest checkouts
        let user = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
                user = await DataManager.getUser(decoded.userId);
            } catch (error) {
                // Ignore auth errors for guest checkout
                console.log('Guest checkout - no authentication');
            }
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Items are required' });
        }

        // Validate email for guest checkout
        const email = user?.email || customerEmail;
        if (!email) {
            return res.status(400).json({ error: 'Email is required for checkout' });
        }

        // Get products and validate
        const products = await DataManager.getProducts();
        console.log('Available products:', products.length);
        const lineItems = [];
        let totalAmount = 0;

        for (const item of items) {
            console.log('Looking for product:', item.productId);
            const product = products.find(p => p.id === item.productId);
            console.log('Found product:', product ? product.name : 'NOT FOUND');
            
            if (!product) {
                return res.status(400).json({ error: `Product not found: ${item.productId}` });
            }

            if (!product.available || product.stock < item.quantity) {
                return res.status(400).json({ 
                    error: `Insufficient stock for ${product.name}` 
                });
            }

            const unitAmount = Math.round(product.price * 100); // Convert to pence
            totalAmount += unitAmount * item.quantity;
            
            console.log('Creating line item for:', product.name, 'at', unitAmount, 'pence');

            lineItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: product.name,
                        description: product.description,
                        metadata: {
                            productId: product.id,
                            brailleMessage: product.brailleMessage || '',
                            decodedMessage: product.decodedMessage || ''
                        }
                    },
                    unit_amount: unitAmount,
                },
                quantity: item.quantity,
            });
        }

        console.log('About to create Stripe session with', lineItems.length, 'items');

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: 'http://localhost:3000/#shop',
            cancel_url: 'http://localhost:3000/#shop',
            customer_email: email,
            metadata: {
                userId: user?.id || null,
                items: JSON.stringify(items)
            }
        });

        res.json({ 
            success: true,
            sessionId: session.id, 
            url: session.url 
        });

    } catch (error) {
        console.error('Stripe checkout error:', error);
        res.status(500).json({ 
            error: 'Failed to create checkout session',
            message: error.message 
        });
    }
});

// Get checkout session details
router.get('/checkout-session/:sessionId', auth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items', 'payment_intent']
        });

        if (session.metadata.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({
            session: {
                id: session.id,
                status: session.payment_status,
                amount_total: session.amount_total,
                currency: session.currency,
                customer_email: session.customer_email,
                payment_intent: session.payment_intent
            }
        });

    } catch (error) {
        console.error('Error retrieving checkout session:', error);
        res.status(500).json({ 
            error: 'Failed to retrieve checkout session' 
        });
    }
});

// Webhook endpoint for Stripe events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object);
                break;

            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;

            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

// Handle successful checkout session
async function handleCheckoutSessionCompleted(session) {
    console.log('Processing completed checkout session:', session.id);

    try {
        const metadata = session.metadata;
        const items = JSON.parse(metadata.items);
        const shippingAddress = JSON.parse(metadata.shippingAddress);
        const billingAddress = JSON.parse(metadata.billingAddress);

        // Create order in our system
        const orderData = {
            userId: metadata.userId,
            stripeSessionId: session.id,
            stripePaymentIntentId: session.payment_intent,
            status: 'processing',
            paymentStatus: 'paid',
            totalAmount: session.amount_total / 100, // Convert from pence
            currency: session.currency,
            customerEmail: session.customer_email,
            items: items,
            shippingAddress: shippingAddress,
            billingAddress: billingAddress,
            paymentDate: new Date().toISOString()
        };

        const order = await DataManager.createOrder(orderData);

        // Update product stock
        const products = await DataManager.getProducts();
        for (const item of items) {
            const product = products.find(p => p.id === item.productId);
            if (product) {
                await DataManager.updateProduct(product.id, {
                    stock: Math.max(0, product.stock - item.quantity)
                });
            }
        }

        console.log('Order created successfully:', order.orderNumber);

        // TODO: Send order confirmation email
        // await sendOrderConfirmationEmail(order);

    } catch (error) {
        console.error('Error processing checkout session:', error);
        throw error;
    }
}

// Handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent) {
    console.log('Payment succeeded:', paymentIntent.id);
    
    // Update order status if needed
    const orders = await DataManager.getOrders();
    const order = orders.find(o => o.stripePaymentIntentId === paymentIntent.id);
    
    if (order) {
        await DataManager.updateOrder(order.id, {
            paymentStatus: 'paid',
            status: 'processing'
        });
    }
}

// Handle failed payment intent
async function handlePaymentIntentFailed(paymentIntent) {
    console.log('Payment failed:', paymentIntent.id);
    
    // Update order status
    const orders = await DataManager.getOrders();
    const order = orders.find(o => o.stripePaymentIntentId === paymentIntent.id);
    
    if (order) {
        await DataManager.updateOrder(order.id, {
            paymentStatus: 'failed',
            status: 'cancelled'
        });
    }
}

// Get payment methods for a customer
router.get('/payment-methods', auth, async (req, res) => {
    try {
        // For demo purposes, return empty array
        // In production, you'd retrieve saved payment methods from Stripe
        res.json({ paymentMethods: [] });
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
});

// Create payment intent for custom checkout
router.post('/create-payment-intent', auth, async (req, res) => {
    try {
        const { amount, currency = 'gbp', metadata = {} } = req.body;

        if (!amount || amount < 50) { // Minimum 50p
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to pence
            currency: currency,
            metadata: {
                userId: req.user.id,
                ...metadata
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
        });

    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

// Refund a payment
router.post('/refund', auth, async (req, res) => {
    try {
        const { paymentIntentId, amount, reason = 'requested_by_customer' } = req.body;

        // Verify the payment belongs to the user (admin check in real app)
        const orders = await DataManager.getOrders();
        const order = orders.find(o => 
            o.stripePaymentIntentId === paymentIntentId && 
            (o.userId === req.user.id || req.user.role === 'admin')
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            amount: amount ? Math.round(amount * 100) : undefined, // Partial or full refund
            reason: reason
        });

        // Update order status
        await DataManager.updateOrder(order.id, {
            status: amount ? 'partially_refunded' : 'refunded',
            refundId: refund.id,
            refundAmount: refund.amount / 100,
            refundDate: new Date().toISOString()
        });

        res.json({
            refund: {
                id: refund.id,
                amount: refund.amount / 100,
                status: refund.status
            }
        });

    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({ error: 'Failed to process refund' });
    }
});

module.exports = router; 
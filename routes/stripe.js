const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();
const DataManager = require('../utils/dataManager');
const { auth } = require('../middleware/auth');

// Create checkout session
router.post('/create-checkout-session', auth, async (req, res) => {
    try {
        const { items, shippingAddress, billingAddress } = req.body;
        const user = req.user;

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items provided' });
        }

        // Get products and validate
        const products = await DataManager.getProducts();
        const lineItems = [];
        let totalAmount = 0;

        for (const item of items) {
            const product = products.find(p => p.id === item.productId);
            
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

            lineItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: product.name,
                        description: product.description,
                        images: product.images?.map(img => 
                            img.startsWith('http') ? img : `${req.protocol}://${req.get('host')}${img}`
                        ),
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

        // Calculate shipping
        const settings = await DataManager.getSettings();
        let shippingAmount = 0;
        
        if (totalAmount < settings.shipping.freeShippingThreshold * 100) {
            shippingAmount = Math.round(settings.shipping.standardShipping * 100);
            
            lineItems.push({
                price_data: {
                    currency: 'gbp',
                    product_data: {
                        name: 'Standard Shipping',
                        description: 'Standard delivery to UK addresses'
                    },
                    unit_amount: shippingAmount,
                },
                quantity: 1,
            });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/order-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/shop?cancelled=true`,
            customer_email: user.email,
            metadata: {
                userId: user.id,
                shippingAddress: JSON.stringify(shippingAddress),
                billingAddress: JSON.stringify(billingAddress),
                items: JSON.stringify(items)
            },
            shipping_address_collection: {
                allowed_countries: ['GB', 'IE', 'US', 'CA', 'AU', 'NZ']
            },
            payment_intent_data: {
                metadata: {
                    userId: user.id,
                    orderType: 'ecommerce'
                }
            }
        });

        res.json({ sessionId: session.id, url: session.url });

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
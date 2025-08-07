// Frontend Integration with Exchequer Backend API
// This file shows how to integrate the frontend with the backend for Stripe payments

class ExchequerPaymentAPI {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
        this.stripe = null;
        this.elements = null;
        this.paymentElement = null;
    }

    // Initialize Stripe
    async initializeStripe(publishableKey) {
        try {
            this.stripe = Stripe(publishableKey);
            console.log('Stripe initialized successfully');
        } catch (error) {
            console.error('Error initializing Stripe:', error);
            throw error;
        }
    }

    // Create payment intent for dues collection
    async createPaymentIntent(amount, memberId, organizationId, description) {
        try {
            const response = await fetch(`${this.baseURL}/payments/create-payment-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: Math.round(amount * 100), // Convert to cents
                    currency: 'usd',
                    memberId,
                    organizationId,
                    description
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create payment intent');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error creating payment intent:', error);
            throw error;
        }
    }

    // Setup payment form
    async setupPaymentForm(clientSecret) {
        try {
            const options = {
                clientSecret,
                appearance: {
                    theme: 'stripe',
                    variables: {
                        colorPrimary: '#fbbf24',
                        colorBackground: '#ffffff',
                        colorText: '#1f2937',
                        colorDanger: '#ef4444',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        spacingUnit: '4px',
                        borderRadius: '8px'
                    }
                }
            };

            this.elements = this.stripe.elements(options);
            this.paymentElement = this.elements.create('payment');
            this.paymentElement.mount('#payment-element');

            console.log('Payment form setup complete');
        } catch (error) {
            console.error('Error setting up payment form:', error);
            throw error;
        }
    }

    // Process payment
    async processPayment(clientSecret) {
        try {
            const { error } = await this.stripe.confirmPayment({
                elements: this.elements,
                clientSecret,
                confirmParams: {
                    return_url: `${window.location.origin}/payment-success`,
                },
            });

            if (error) {
                throw error;
            }

            return { success: true };
        } catch (error) {
            console.error('Payment failed:', error);
            throw error;
        }
    }

    // Get payment history
    async getPaymentHistory(organizationId, memberId) {
        try {
            const response = await fetch(`${this.baseURL}/payments/history/${organizationId}/${memberId}`);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch payment history');
            }

            const data = await response.json();
            return data.payments;
        } catch (error) {
            console.error('Error fetching payment history:', error);
            throw error;
        }
    }

    // Process expense reimbursement
    async processReimbursement(amount, memberId, organizationId, description, expenseId, receiptUrl = '') {
        try {
            const response = await fetch(`${this.baseURL}/expenses/process-reimbursement`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount,
                    memberId,
                    organizationId,
                    description,
                    expenseId,
                    receiptUrl
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to process reimbursement');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error processing reimbursement:', error);
            throw error;
        }
    }

    // Check server health
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseURL}/health`);
            const data = await response.json();
            return data.status === 'healthy';
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }
}

// Enhanced frontend integration functions
class ExchequerFrontendIntegration {
    constructor() {
        this.paymentAPI = new ExchequerPaymentAPI();
        this.isInitialized = false;
    }

    // Initialize the payment system
    async initialize(publishableKey) {
        try {
            await this.paymentAPI.initializeStripe(publishableKey);
            this.isInitialized = true;
            console.log('Exchequer payment system initialized');
        } catch (error) {
            console.error('Failed to initialize payment system:', error);
            throw error;
        }
    }

    // Enhanced dues payment function
    async payDues(amount, memberId, organizationId, description) {
        if (!this.isInitialized) {
            throw new Error('Payment system not initialized');
        }

        try {
            // Create payment intent
            const { clientSecret, paymentIntentId } = await this.paymentAPI.createPaymentIntent(
                amount, memberId, organizationId, description
            );

            // Setup payment form
            await this.paymentAPI.setupPaymentForm(clientSecret);

            // Show payment modal
            this.showPaymentModal();

            // Store payment intent ID for later reference
            window.currentPaymentIntentId = paymentIntentId;

            return { clientSecret, paymentIntentId };
        } catch (error) {
            console.error('Error in dues payment:', error);
            this.showError('Payment setup failed: ' + error.message);
            throw error;
        }
    }

    // Process the payment
    async confirmPayment(clientSecret) {
        try {
            const result = await this.paymentAPI.processPayment(clientSecret);
            
            if (result.success) {
                this.showSuccess('Payment processed successfully!');
                this.hidePaymentModal();
                
                // Refresh the dues display
                this.refreshDuesDisplay();
            }
        } catch (error) {
            console.error('Payment confirmation failed:', error);
            this.showError('Payment failed: ' + error.message);
        }
    }

    // Process expense reimbursement
    async reimburseExpense(amount, memberId, organizationId, description, expenseId, receiptUrl) {
        try {
            const result = await this.paymentAPI.processReimbursement(
                amount, memberId, organizationId, description, expenseId, receiptUrl
            );

            if (result.success) {
                this.showSuccess('Reimbursement processed successfully!');
                this.refreshExpensesDisplay();
                return result;
            }
        } catch (error) {
            console.error('Reimbursement failed:', error);
            this.showError('Reimbursement failed: ' + error.message);
            throw error;
        }
    }

    // UI Helper functions
    showPaymentModal() {
        const modal = document.createElement('div');
        modal.id = 'payment-modal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="close-modal absolute top-3 right-3 text-slate-500 hover:text-slate-700 text-2xl font-bold">&times;</button>
                <h3 class="text-xl font-bold text-slate-800 mb-4">Complete Payment</h3>
                <div id="payment-element" class="mb-4"></div>
                <button id="confirm-payment-btn" class="bg-amber-400 hover:bg-amber-500 text-amber-950 font-bold py-2 px-4 rounded-lg">
                    Confirm Payment
                </button>
            </div>
        `;

        document.body.appendChild(modal);
        modal.classList.remove('hidden');

        // Add event listeners
        modal.querySelector('.close-modal').addEventListener('click', () => this.hidePaymentModal());
        modal.querySelector('#confirm-payment-btn').addEventListener('click', () => {
            this.confirmPayment(window.currentClientSecret);
        });
    }

    hidePaymentModal() {
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.remove();
        }
    }

    showSuccess(message) {
        // Use the existing notification system
        if (window.showNotification) {
            window.showNotification(message, 'success');
        } else {
            alert(message);
        }
    }

    showError(message) {
        // Use the existing notification system
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            alert('Error: ' + message);
        }
    }

    refreshDuesDisplay() {
        // Trigger a refresh of the dues display
        if (window.renderDues) {
            // This would need to be implemented in the main app
            console.log('Refreshing dues display...');
        }
    }

    refreshExpensesDisplay() {
        // Trigger a refresh of the expenses display
        if (window.renderExpenses) {
            // This would need to be implemented in the main app
            console.log('Refreshing expenses display...');
        }
    }
}

// Global instance
window.exchequerPayment = new ExchequerFrontendIntegration();

// Example usage:
/*
// Initialize the payment system
await window.exchequerPayment.initialize('pk_test_your_publishable_key');

// Pay dues
await window.exchequerPayment.payDues(
    150.00, // amount
    'member-123', // memberId
    'org-456', // organizationId
    'Fall Semester Dues' // description
);

// Process reimbursement
await window.exchequerPayment.reimburseExpense(
    45.20, // amount
    'member-123', // memberId
    'org-456', // organizationId
    'Pizza for recruitment event', // description
    'expense-789', // expenseId
    'https://example.com/receipt.jpg' // receiptUrl
);
*/ 
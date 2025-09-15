/**
 * @fileoverview Workflow Service Demo
 * Example showing how to use the NooblyJS Workflow Service
 * @author NooblyJS Team
 * @version 1.0.0
 */

const express = require('express');
const serviceRegistry = require('../index');

const app = express();

// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the service registry
const eventEmitter = require('events');
const globalEventEmitter = new eventEmitter();

serviceRegistry.initialize(app, globalEventEmitter, {
  // Optional API key authentication
  // apiKeys: ['your-api-key-here'],
  // requireApiKey: false
});

// Example 1: Using memory workflow engine (default)
const memoryWorkflow = serviceRegistry.workflow('memory', {
  maxConcurrentWorkflows: 10,
  stepTimeout: 30000, // 30 seconds per step
  retryAttempts: 3
});

// Example 2: Using persistent workflow engine with database
/*
const persistentWorkflow = serviceRegistry.workflow('database', {
  connectionString: 'mongodb://localhost:27017/workflows',
  maxConcurrentWorkflows: 50
});
*/

// Example 3: Using distributed workflow engine
/*
const distributedWorkflow = serviceRegistry.workflow('distributed', {
  redis: {
    host: 'localhost',
    port: 6379
  },
  workers: 5
});
*/

// Workflow execution tracking
const workflowExecutions = [];
const maxExecutionHistory = 200;

function trackExecution(workflowId, workflowName, status, result, duration, error = null) {
  workflowExecutions.push({
    workflowId,
    workflowName,
    status,
    executedAt: new Date().toISOString(),
    duration,
    success: status === 'completed',
    result: error ? null : result,
    error: error ? error.message : null
  });

  // Keep only the last maxExecutionHistory executions
  if (workflowExecutions.length > maxExecutionHistory) {
    workflowExecutions.splice(0, workflowExecutions.length - maxExecutionHistory);
  }
}

// Define workflow step handlers
const stepHandlers = {
  // Send welcome email
  'send-welcome-email': async (input, context) => {
    const { userId, email, name } = input;
    console.log(`📧 Sending welcome email to ${email}`);

    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    // Simulate occasional failures
    if (Math.random() < 0.05) {
      throw new Error('Email service temporarily unavailable');
    }

    return {
      emailSent: true,
      messageId: `msg_${Date.now()}`,
      recipient: email,
      sentAt: new Date().toISOString()
    };
  },

  // Create user profile
  'create-user-profile': async (input, context) => {
    const { userId, userData } = input;
    console.log(`👤 Creating user profile for ${userId}`);

    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      profileCreated: true,
      userId: userId,
      profileData: {
        ...userData,
        createdAt: new Date().toISOString(),
        profileId: `profile_${Date.now()}`
      }
    };
  },

  // Setup user preferences
  'setup-preferences': async (input, context) => {
    const { userId, preferences = {} } = input;
    console.log(`⚙️ Setting up preferences for ${userId}`);

    await new Promise(resolve => setTimeout(resolve, 500));

    const defaultPreferences = {
      notifications: true,
      newsletter: false,
      theme: 'light',
      language: 'en',
      ...preferences
    };

    return {
      preferencesSet: true,
      userId: userId,
      preferences: defaultPreferences
    };
  },

  // Process payment
  'process-payment': async (input, context) => {
    const { amount, currency = 'USD', paymentMethod } = input;
    console.log(`💳 Processing payment: ${amount} ${currency}`);

    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

    // Simulate payment success/failure
    const success = Math.random() > 0.1; // 90% success rate

    if (!success) {
      throw new Error('Payment declined - insufficient funds');
    }

    return {
      paymentProcessed: true,
      transactionId: `txn_${Date.now()}`,
      amount: amount,
      currency: currency,
      status: 'completed',
      processedAt: new Date().toISOString()
    };
  },

  // Generate invoice
  'generate-invoice': async (input, context) => {
    const { orderId, items, customerInfo } = input;
    console.log(`📄 Generating invoice for order ${orderId}`);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    return {
      invoiceGenerated: true,
      invoiceId: `inv_${Date.now()}`,
      orderId: orderId,
      total: total,
      currency: 'USD',
      invoiceUrl: `https://invoices.example.com/${Date.now()}.pdf`,
      generatedAt: new Date().toISOString()
    };
  },

  // Update inventory
  'update-inventory': async (input, context) => {
    const { items } = input;
    console.log(`📦 Updating inventory for ${items.length} items`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    const updatedItems = items.map(item => ({
      ...item,
      updatedStock: Math.max(0, item.currentStock - item.quantity),
      lastUpdated: new Date().toISOString()
    }));

    return {
      inventoryUpdated: true,
      updatedItems: updatedItems,
      totalItemsUpdated: items.length
    };
  },

  // Send notification
  'send-notification': async (input, context) => {
    const { recipient, message, channel = 'email' } = input;
    console.log(`🔔 Sending ${channel} notification to ${recipient}`);

    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      notificationSent: true,
      recipient: recipient,
      channel: channel,
      message: message,
      sentAt: new Date().toISOString()
    };
  },

  // Conditional step - check user tier
  'check-user-tier': async (input, context) => {
    const { userId } = input;
    console.log(`🏆 Checking user tier for ${userId}`);

    await new Promise(resolve => setTimeout(resolve, 300));

    // Simulate different user tiers
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const userTier = tiers[Math.floor(Math.random() * tiers.length)];

    return {
      userId: userId,
      userTier: userTier,
      isPremium: ['gold', 'platinum'].includes(userTier)
    };
  },

  // Approval step
  'manual-approval': async (input, context) => {
    const { requestId, amount, reason } = input;
    console.log(`⏳ Manual approval required for request ${requestId} (${amount})`);

    // This would typically trigger a manual approval process
    // For demo purposes, we'll simulate auto-approval for small amounts
    const autoApprove = amount < 1000;

    if (autoApprove) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        approved: true,
        requestId: requestId,
        approvedBy: 'system',
        approvedAt: new Date().toISOString(),
        autoApproved: true
      };
    } else {
      // In a real system, this would pause the workflow until manual approval
      return {
        approved: false,
        requestId: requestId,
        requiresManualApproval: true,
        pendingSince: new Date().toISOString()
      };
    }
  }
};

// Define workflow templates
const workflowTemplates = {
  'user-onboarding': {
    name: 'User Onboarding',
    description: 'Complete user registration and setup process',
    steps: [
      {
        name: 'create-profile',
        handler: 'create-user-profile',
        input: '{{ input.userData }}',
        onError: 'retry'
      },
      {
        name: 'setup-preferences',
        handler: 'setup-preferences',
        input: '{{ steps.create-profile.result }}',
        onError: 'continue'
      },
      {
        name: 'send-welcome',
        handler: 'send-welcome-email',
        input: '{{ input.userData }}',
        onError: 'retry',
        retryAttempts: 2
      }
    ]
  },

  'order-processing': {
    name: 'Order Processing',
    description: 'Complete order fulfillment workflow',
    steps: [
      {
        name: 'process-payment',
        handler: 'process-payment',
        input: '{{ input.payment }}',
        onError: 'fail'
      },
      {
        name: 'update-inventory',
        handler: 'update-inventory',
        input: '{{ input.items }}',
        condition: '{{ steps.process-payment.result.paymentProcessed }}'
      },
      {
        name: 'generate-invoice',
        handler: 'generate-invoice',
        input: '{{ input }}',
        dependsOn: ['process-payment']
      },
      {
        name: 'send-confirmation',
        handler: 'send-notification',
        input: {
          recipient: '{{ input.customerEmail }}',
          message: 'Order confirmed! Invoice: {{ steps.generate-invoice.result.invoiceUrl }}',
          channel: 'email'
        },
        dependsOn: ['generate-invoice']
      }
    ]
  },

  'approval-workflow': {
    name: 'Approval Workflow',
    description: 'Multi-step approval process with conditional logic',
    steps: [
      {
        name: 'check-user-tier',
        handler: 'check-user-tier',
        input: '{{ input }}'
      },
      {
        name: 'auto-approve-premium',
        handler: 'send-notification',
        input: {
          recipient: '{{ input.requestorEmail }}',
          message: 'Your request has been auto-approved (Premium user)',
          channel: 'email'
        },
        condition: '{{ steps.check-user-tier.result.isPremium && input.amount < 5000 }}'
      },
      {
        name: 'manual-approval',
        handler: 'manual-approval',
        input: '{{ input }}',
        condition: '{{ !steps.auto-approve-premium.executed }}'
      },
      {
        name: 'approval-notification',
        handler: 'send-notification',
        input: {
          recipient: '{{ input.requestorEmail }}',
          message: 'Approval status: {{ steps.manual-approval.result.approved ? "Approved" : "Pending" }}',
          channel: 'email'
        },
        dependsOn: ['manual-approval']
      }
    ]
  }
};

// Register step handlers
Object.entries(stepHandlers).forEach(([stepName, handler]) => {
  memoryWorkflow.defineStep(stepName, handler);
});

// Register workflow templates
Object.entries(workflowTemplates).forEach(([templateName, template]) => {
  memoryWorkflow.defineWorkflow(templateName, template);
});

// API endpoints for workflow management

// Start a workflow
app.post('/workflows/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { input, options = {} } = req.body;

    if (!workflowTemplates[templateName]) {
      return res.status(400).json({
        error: `Unknown workflow template: ${templateName}`,
        availableTemplates: Object.keys(workflowTemplates)
      });
    }

    const workflow = await memoryWorkflow.start(templateName, input, {
      priority: options.priority || 0,
      timeout: options.timeout || 300000, // 5 minutes
      ...options
    });

    res.json({
      success: true,
      workflow: {
        id: workflow.id,
        template: templateName,
        status: 'running',
        input: input,
        startedAt: new Date().toISOString(),
        options: options
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get workflow status
app.get('/workflows/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const workflow = await memoryWorkflow.getWorkflow(workflowId);

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    res.json({
      workflow: {
        id: workflow.id,
        template: workflow.template,
        status: workflow.status,
        input: workflow.input,
        currentStep: workflow.currentStep,
        completedSteps: workflow.completedSteps || [],
        failedSteps: workflow.failedSteps || [],
        result: workflow.result,
        error: workflow.error,
        startedAt: workflow.startedAt,
        completedAt: workflow.completedAt,
        duration: workflow.completedAt ?
          new Date(workflow.completedAt) - new Date(workflow.startedAt) :
          Date.now() - new Date(workflow.startedAt)
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List workflows
app.get('/workflows', async (req, res) => {
  try {
    const { status, template, limit = 20, offset = 0 } = req.query;

    const workflows = await memoryWorkflow.listWorkflows({
      status: status,
      template: template,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const workflowList = workflows.map(workflow => ({
      id: workflow.id,
      template: workflow.template,
      status: workflow.status,
      currentStep: workflow.currentStep,
      startedAt: workflow.startedAt,
      completedAt: workflow.completedAt
    }));

    res.json({
      workflows: workflowList,
      count: workflowList.length,
      filters: { status, template },
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel workflow
app.delete('/workflows/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const success = await memoryWorkflow.cancelWorkflow(workflowId);

    if (!success) {
      return res.status(404).json({ error: 'Workflow not found or cannot be cancelled' });
    }

    res.json({
      success: true,
      message: `Workflow ${workflowId} cancelled successfully`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry failed workflow
app.post('/workflows/:workflowId/retry', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { fromStep } = req.body;

    const success = await memoryWorkflow.retryWorkflow(workflowId, { fromStep });

    if (!success) {
      return res.status(404).json({ error: 'Workflow not found or cannot be retried' });
    }

    res.json({
      success: true,
      message: `Workflow ${workflowId} queued for retry`,
      fromStep: fromStep
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pause workflow
app.post('/workflows/:workflowId/pause', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const success = await memoryWorkflow.pauseWorkflow(workflowId);

    if (!success) {
      return res.status(404).json({ error: 'Workflow not found or cannot be paused' });
    }

    res.json({
      success: true,
      message: `Workflow ${workflowId} paused`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resume workflow
app.post('/workflows/:workflowId/resume', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const success = await memoryWorkflow.resumeWorkflow(workflowId);

    if (!success) {
      return res.status(404).json({ error: 'Workflow not found or cannot be resumed' });
    }

    res.json({
      success: true,
      message: `Workflow ${workflowId} resumed`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get workflow templates
app.get('/templates', (req, res) => {
  const templates = Object.entries(workflowTemplates).map(([name, template]) => ({
    name: name,
    displayName: template.name,
    description: template.description,
    stepCount: template.steps.length,
    steps: template.steps.map(step => ({
      name: step.name,
      handler: step.handler,
      hasCondition: !!step.condition,
      dependsOn: step.dependsOn || []
    }))
  }));

  res.json({
    templates: templates,
    count: templates.length
  });
});

// Get workflow statistics
app.get('/workflows/stats', async (req, res) => {
  try {
    const stats = await memoryWorkflow.getStats();

    // Calculate additional stats from execution history
    const totalExecutions = workflowExecutions.length;
    const successfulExecutions = workflowExecutions.filter(exec => exec.success).length;
    const failedExecutions = totalExecutions - successfulExecutions;

    // Calculate average execution times
    const executionTimes = workflowExecutions
      .filter(exec => exec.duration)
      .map(exec => exec.duration);
    const avgExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0;

    // Get executions in the last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentExecutions = workflowExecutions.filter(
      exec => new Date(exec.executedAt) > last24Hours
    );

    res.json({
      stats: {
        activeWorkflows: stats.activeWorkflows || 0,
        completedWorkflows: stats.completedWorkflows || 0,
        failedWorkflows: stats.failedWorkflows || 0,
        pausedWorkflows: stats.pausedWorkflows || 0,
        totalExecutions: totalExecutions,
        successfulExecutions: successfulExecutions,
        failedExecutions: failedExecutions,
        successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions * 100).toFixed(2) + '%' : '0%',
        averageExecutionTime: Math.round(avgExecutionTime) + 'ms',
        executionsLast24h: recentExecutions.length,
        availableTemplates: Object.keys(workflowTemplates).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get workflow execution history
app.get('/workflows/executions/history', async (req, res) => {
  try {
    const { template, status, limit = 50 } = req.query;

    let executions = [...workflowExecutions];

    // Filter by template if provided
    if (template) {
      executions = executions.filter(exec => exec.workflowName === template);
    }

    // Filter by status if provided
    if (status) {
      executions = executions.filter(exec => exec.status === status);
    }

    // Sort by most recent first and limit results
    executions = executions
      .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
      .slice(0, parseInt(limit));

    res.json({
      executions: executions,
      count: executions.length,
      filters: { template, status },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners
globalEventEmitter.on('workflow:started', (data) => {
  console.log(`🚀 Workflow started: ${data.template} (ID: ${data.id})`);
});

globalEventEmitter.on('workflow:step-completed', (data) => {
  console.log(`✅ Step completed: ${data.stepName} in workflow ${data.workflowId}`);
});

globalEventEmitter.on('workflow:step-failed', (data) => {
  console.log(`❌ Step failed: ${data.stepName} in workflow ${data.workflowId} - ${data.error}`);
});

globalEventEmitter.on('workflow:completed', (data) => {
  console.log(`🏁 Workflow completed: ${data.template} (ID: ${data.id})`);
  trackExecution(data.id, data.template, 'completed', data.result, data.duration);
});

globalEventEmitter.on('workflow:failed', (data) => {
  console.log(`💥 Workflow failed: ${data.template} (ID: ${data.id}) - ${data.error}`);
  trackExecution(data.id, data.template, 'failed', null, data.duration, new Error(data.error));
});

// Create sample workflows for demonstration
async function createSampleWorkflows() {
  try {
    console.log('🔄 Creating sample workflows...');

    // User onboarding workflow
    await memoryWorkflow.start('user-onboarding', {
      userData: {
        userId: 'user_123',
        email: 'user@example.com',
        name: 'John Doe',
        preferences: {
          newsletter: true,
          notifications: true
        }
      }
    });

    // Order processing workflow
    setTimeout(async () => {
      await memoryWorkflow.start('order-processing', {
        orderId: 'order_456',
        customerEmail: 'customer@example.com',
        payment: {
          amount: 99.99,
          currency: 'USD',
          paymentMethod: 'credit_card'
        },
        items: [
          { id: 'item1', name: 'Widget', price: 49.99, quantity: 1, currentStock: 100 },
          { id: 'item2', name: 'Gadget', price: 50.00, quantity: 1, currentStock: 50 }
        ]
      });
    }, 3000);

    // Approval workflow
    setTimeout(async () => {
      await memoryWorkflow.start('approval-workflow', {
        userId: 'user_789',
        requestorEmail: 'requester@example.com',
        amount: 1500,
        reason: 'Equipment purchase'
      });
    }, 6000);

    console.log('✅ Sample workflows created');
  } catch (error) {
    console.error('❌ Error creating sample workflows:', error);
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🔄 Workflow Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Workflow Interface: http://localhost:3000/services/workflow/');
  console.log('- Swagger API Docs: http://localhost:3000/services/workflow/swagger');
  console.log('- Service Status: http://localhost:3000/services/workflow/api/status');
  console.log('- Start Workflow: POST http://localhost:3000/workflows/{templateName}');
  console.log('- Get Workflow: GET http://localhost:3000/workflows/{workflowId}');
  console.log('- List Workflows: GET http://localhost:3000/workflows');
  console.log('- Cancel Workflow: DELETE http://localhost:3000/workflows/{workflowId}');
  console.log('- Retry Workflow: POST http://localhost:3000/workflows/{workflowId}/retry');
  console.log('- Pause Workflow: POST http://localhost:3000/workflows/{workflowId}/pause');
  console.log('- Resume Workflow: POST http://localhost:3000/workflows/{workflowId}/resume');
  console.log('- Templates: GET http://localhost:3000/templates');
  console.log('- Statistics: GET http://localhost:3000/workflows/stats');
  console.log('- Execution History: GET http://localhost:3000/workflows/executions/history');
  console.log('\nAvailable workflow templates:');
  console.log('- user-onboarding: Complete user registration process');
  console.log('- order-processing: Order fulfillment with payment and inventory');
  console.log('- approval-workflow: Multi-step approval with conditional logic');
  console.log('\nExample workflow start:');
  console.log('{ "input": { "userData": { "userId": "123", "email": "user@example.com", "name": "John" } } }');

  // Create sample workflows for demonstration
  setTimeout(createSampleWorkflows, 2000);
});
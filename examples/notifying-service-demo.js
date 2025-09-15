/**
 * @fileoverview Notifying Service Demo
 * Example showing how to use the NooblyJS Notifying Service
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

// Example 1: Using email notifications (requires SMTP configuration)
const emailNotifier = serviceRegistry.notifying('email', {
  smtp: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER, // your-email@gmail.com
      pass: process.env.EMAIL_PASS  // your-app-password
    }
  },
  defaults: {
    from: process.env.EMAIL_USER || 'noreply@example.com',
    replyTo: process.env.EMAIL_USER || 'noreply@example.com'
  }
});

// Example 2: Using SMS notifications (requires Twilio or similar)
const smsNotifier = serviceRegistry.notifying('sms', {
  provider: 'twilio',
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_FROM_NUMBER // Your Twilio phone number
});

// Example 3: Using push notifications
const pushNotifier = serviceRegistry.notifying('push', {
  fcm: {
    serverKey: process.env.FCM_SERVER_KEY
  },
  apns: {
    keyId: process.env.APNS_KEY_ID,
    teamId: process.env.APNS_TEAM_ID,
    keyPath: process.env.APNS_KEY_PATH,
    production: false
  }
});

// Example 4: Using Slack notifications
const slackNotifier = serviceRegistry.notifying('slack', {
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  channel: '#general',
  username: 'NooblyJS Bot',
  iconEmoji: ':robot_face:'
});

// Example 5: Using Discord notifications
const discordNotifier = serviceRegistry.notifying('discord', {
  webhookUrl: process.env.DISCORD_WEBHOOK_URL,
  username: 'NooblyJS Bot',
  avatarUrl: 'https://example.com/bot-avatar.png'
});

// User notification preferences storage (in real app, this would be in a database)
const userPreferences = {
  'user123': {
    email: 'user123@example.com',
    phone: '+1234567890',
    pushToken: 'fcm-token-abc123',
    preferences: {
      email: true,
      sms: false,
      push: true,
      slack: false
    }
  },
  'admin456': {
    email: 'admin@example.com',
    phone: '+0987654321',
    slackUserId: 'U123456789',
    preferences: {
      email: true,
      sms: true,
      push: false,
      slack: true
    }
  }
};

// Send email notification
app.post('/notify/email', async (req, res) => {
  try {
    const { to, subject, message, html, attachments } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'subject', 'message']
      });
    }

    const result = await emailNotifier.send({
      to: to,
      subject: subject,
      text: message,
      html: html,
      attachments: attachments
    });

    res.json({
      success: true,
      messageId: result.messageId,
      notification: {
        type: 'email',
        to: to,
        subject: subject
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send SMS notification
app.post('/notify/sms', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'message']
      });
    }

    const result = await smsNotifier.send({
      to: to,
      body: message
    });

    res.json({
      success: true,
      sid: result.sid,
      notification: {
        type: 'sms',
        to: to,
        message: message
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send push notification
app.post('/notify/push', async (req, res) => {
  try {
    const { token, title, body, data, badge } = req.body;

    if (!token || !title || !body) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['token', 'title', 'body']
      });
    }

    const result = await pushNotifier.send({
      token: token,
      notification: {
        title: title,
        body: body
      },
      data: data,
      badge: badge
    });

    res.json({
      success: true,
      messageId: result.messageId,
      notification: {
        type: 'push',
        token: token,
        title: title,
        body: body
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send Slack notification
app.post('/notify/slack', async (req, res) => {
  try {
    const { channel, message, username, iconEmoji, attachments } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    const result = await slackNotifier.send({
      text: message,
      channel: channel,
      username: username,
      icon_emoji: iconEmoji,
      attachments: attachments
    });

    res.json({
      success: true,
      timestamp: result.ts,
      notification: {
        type: 'slack',
        channel: channel || '#general',
        message: message
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send Discord notification
app.post('/notify/discord', async (req, res) => {
  try {
    const { content, username, avatarUrl, embeds } = req.body;

    if (!content) {
      return res.status(400).json({
        error: 'Content is required'
      });
    }

    const result = await discordNotifier.send({
      content: content,
      username: username,
      avatar_url: avatarUrl,
      embeds: embeds
    });

    res.json({
      success: true,
      messageId: result.id,
      notification: {
        type: 'discord',
        content: content
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Multi-channel notification based on user preferences
app.post('/notify/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, message, priority = 'normal', category } = req.body;

    const userPref = userPreferences[userId];
    if (!userPref) {
      return res.status(404).json({ error: 'User not found' });
    }

    const notifications = [];
    const results = [];

    // Email notification
    if (userPref.preferences.email && userPref.email) {
      notifications.push(
        emailNotifier.send({
          to: userPref.email,
          subject: title,
          text: message,
          html: `<h2>${title}</h2><p>${message}</p>`
        }).then(result => ({
          type: 'email',
          success: true,
          messageId: result.messageId
        })).catch(error => ({
          type: 'email',
          success: false,
          error: error.message
        }))
      );
    }

    // SMS notification (for high priority)
    if (userPref.preferences.sms && userPref.phone && priority === 'high') {
      notifications.push(
        smsNotifier.send({
          to: userPref.phone,
          body: `${title}: ${message}`
        }).then(result => ({
          type: 'sms',
          success: true,
          sid: result.sid
        })).catch(error => ({
          type: 'sms',
          success: false,
          error: error.message
        }))
      );
    }

    // Push notification
    if (userPref.preferences.push && userPref.pushToken) {
      notifications.push(
        pushNotifier.send({
          token: userPref.pushToken,
          notification: {
            title: title,
            body: message
          },
          data: { category, priority }
        }).then(result => ({
          type: 'push',
          success: true,
          messageId: result.messageId
        })).catch(error => ({
          type: 'push',
          success: false,
          error: error.message
        }))
      );
    }

    // Slack notification
    if (userPref.preferences.slack && userPref.slackUserId) {
      const slackMessage = `<@${userPref.slackUserId}> ${title}: ${message}`;
      notifications.push(
        slackNotifier.send({
          text: slackMessage,
          channel: `@${userPref.slackUserId}` // Direct message
        }).then(result => ({
          type: 'slack',
          success: true,
          timestamp: result.ts
        })).catch(error => ({
          type: 'slack',
          success: false,
          error: error.message
        }))
      );
    }

    if (notifications.length === 0) {
      return res.status(400).json({
        error: 'No notification channels enabled for user',
        userPreferences: userPref.preferences
      });
    }

    // Wait for all notifications to complete
    const notificationResults = await Promise.all(notifications);

    res.json({
      success: true,
      userId: userId,
      notification: {
        title: title,
        message: message,
        priority: priority,
        category: category
      },
      results: notificationResults,
      sentChannels: notificationResults.filter(r => r.success).length,
      totalChannels: notificationResults.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Broadcast notification to all users
app.post('/notify/broadcast', async (req, res) => {
  try {
    const { title, message, channels = ['email'], priority = 'normal' } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        error: 'Title and message are required'
      });
    }

    const userIds = Object.keys(userPreferences);
    const broadcastResults = [];

    for (const userId of userIds) {
      try {
        const userResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/notify/user/${userId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ title, message, priority, category: 'broadcast' })
        });

        const result = await userResponse.json();
        broadcastResults.push({
          userId: userId,
          success: result.success,
          sentChannels: result.sentChannels || 0
        });

      } catch (error) {
        broadcastResults.push({
          userId: userId,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      broadcast: {
        title: title,
        message: message,
        priority: priority,
        targetUsers: userIds.length,
        successfulUsers: broadcastResults.filter(r => r.success).length
      },
      results: broadcastResults
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Template-based notifications
const notificationTemplates = {
  welcome: {
    title: 'Welcome to {{appName}}!',
    message: 'Hello {{userName}}, welcome to our platform. Get started by exploring our features.',
    html: '<h2>Welcome to {{appName}}!</h2><p>Hello {{userName}},</p><p>Welcome to our platform. Get started by exploring our features.</p>'
  },
  passwordReset: {
    title: 'Password Reset Request',
    message: 'Hello {{userName}}, click the link to reset your password: {{resetLink}}',
    html: '<h2>Password Reset Request</h2><p>Hello {{userName}},</p><p><a href="{{resetLink}}">Click here to reset your password</a></p>'
  },
  orderConfirmation: {
    title: 'Order Confirmation #{{orderNumber}}',
    message: 'Your order #{{orderNumber}} for {{totalAmount}} has been confirmed and will be delivered to {{address}}.',
    html: '<h2>Order Confirmation</h2><p>Order #: {{orderNumber}}</p><p>Total: {{totalAmount}}</p><p>Delivery Address: {{address}}</p>'
  }
};

app.post('/notify/template/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { userId, variables, channels = ['email'] } = req.body;

    const template = notificationTemplates[templateName];
    if (!template) {
      return res.status(404).json({
        error: 'Template not found',
        availableTemplates: Object.keys(notificationTemplates)
      });
    }

    // Replace template variables
    let title = template.title;
    let message = template.message;
    let html = template.html;

    for (const [key, value] of Object.entries(variables || {})) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      title = title.replace(placeholder, value);
      message = message.replace(placeholder, value);
      html = html.replace(placeholder, value);
    }

    // Send notification using the processed template
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/notify/user/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        message: message,
        category: templateName
      })
    });

    const result = await response.json();

    res.json({
      success: true,
      template: templateName,
      processedNotification: {
        title: title,
        message: message
      },
      deliveryResult: result
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user notification preferences
app.get('/users/:userId/preferences', (req, res) => {
  const { userId } = req.params;
  const userPref = userPreferences[userId];

  if (!userPref) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    userId: userId,
    preferences: userPref.preferences,
    contacts: {
      email: userPref.email,
      phone: userPref.phone ? '***-***-' + userPref.phone.slice(-4) : null,
      hasPushToken: !!userPref.pushToken,
      hasSlackId: !!userPref.slackUserId
    }
  });
});

// Update user notification preferences
app.put('/users/:userId/preferences', (req, res) => {
  const { userId } = req.params;
  const { preferences, email, phone, pushToken, slackUserId } = req.body;

  if (!userPreferences[userId]) {
    userPreferences[userId] = { preferences: {} };
  }

  if (preferences) {
    userPreferences[userId].preferences = { ...userPreferences[userId].preferences, ...preferences };
  }
  if (email) userPreferences[userId].email = email;
  if (phone) userPreferences[userId].phone = phone;
  if (pushToken) userPreferences[userId].pushToken = pushToken;
  if (slackUserId) userPreferences[userId].slackUserId = slackUserId;

  res.json({
    success: true,
    userId: userId,
    updatedPreferences: userPreferences[userId]
  });
});

// Event listeners
globalEventEmitter.on('notification:sent', (data) => {
  console.log(`📧 Notification sent via ${data.channel}: ${data.title || data.subject}`);
});

globalEventEmitter.on('notification:failed', (data) => {
  console.log(`❌ Notification failed via ${data.channel}: ${data.error}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n📧 Notifying Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Notifying Interface: http://localhost:3000/services/notifying/');
  console.log('- Swagger API Docs: http://localhost:3000/services/notifying/swagger');
  console.log('- Service Status: http://localhost:3000/services/notifying/api/status');
  console.log('- Send Email: POST http://localhost:3000/notify/email');
  console.log('- Send SMS: POST http://localhost:3000/notify/sms');
  console.log('- Send Push: POST http://localhost:3000/notify/push');
  console.log('- Send Slack: POST http://localhost:3000/notify/slack');
  console.log('- Send Discord: POST http://localhost:3000/notify/discord');
  console.log('- Notify User: POST http://localhost:3000/notify/user/{userId}');
  console.log('- Broadcast: POST http://localhost:3000/notify/broadcast');
  console.log('- Template Notification: POST http://localhost:3000/notify/template/{templateName}');
  console.log('- User Preferences: GET http://localhost:3000/users/{userId}/preferences');
  console.log('- Update Preferences: PUT http://localhost:3000/users/{userId}/preferences');
  console.log('\nExample email notification:');
  console.log('{ "to": "user@example.com", "subject": "Test", "message": "Hello World!" }');
  console.log('\nExample user notification:');
  console.log('{ "title": "New Message", "message": "You have a new message", "priority": "normal" }');
  console.log('\nAvailable users: user123, admin456');
  console.log('Available templates: welcome, passwordReset, orderConfirmation');
  console.log('\nEnvironment variables needed:');
  console.log('- EMAIL_USER, EMAIL_PASS (for email)');
  console.log('- TWILIO_* (for SMS)');
  console.log('- FCM_SERVER_KEY (for push notifications)');
  console.log('- SLACK_WEBHOOK_URL, DISCORD_WEBHOOK_URL (for chat)');
});
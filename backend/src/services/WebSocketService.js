const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const User = require('../models/User');
const EnterpriseLogger = require('./EnterpriseLoggerService');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
    this.activeConversations = new Map(); // conversationId -> Set of userIds
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupAuthentication();
    this.setupEventHandlers();
    
    EnterpriseLogger.info('WebSocket service initialized');
  }

  /**
   * Setup JWT authentication for Socket.IO
   */
  setupAuthentication() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user || !user.is_active) {
          return next(new Error('Invalid or inactive user'));
        }

        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        EnterpriseLogger.error('Socket authentication failed', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup Socket.IO event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);

      socket.on('join_conversation', (data) => this.handleJoinConversation(socket, data));
      socket.on('leave_conversation', (data) => this.handleLeaveConversation(socket, data));
      socket.on('send_message', (data) => this.handleSendMessage(socket, data));
      socket.on('message_read', (data) => this.handleMessageRead(socket, data));
      socket.on('typing_start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing_stop', (data) => this.handleTypingStop(socket, data));
      socket.on('disconnect', () => this.handleDisconnection(socket));
    });
  }

  /**
   * Handle new socket connection
   */
  async handleConnection(socket) {
    try {
      const userId = socket.userId;
      
      // Store user connection
      this.connectedUsers.set(userId, socket.id);
      this.userSockets.set(socket.id, userId);

      // Update user's last active timestamp
      await User.updateLastActive(userId);

      // Join user to their personal room
      socket.join(`user_${userId}`);

      // Emit online status to relevant users
      await this.broadcastUserStatus(userId, 'online');

      EnterpriseLogger.info('User connected to WebSocket', { userId, socketId: socket.id });

      // Send pending messages if any
      await this.sendPendingMessages(socket);

    } catch (error) {
      EnterpriseLogger.error('Socket connection handling failed', error, { socketId: socket.id });
    }
  }

  /**
   * Handle user disconnection
   */
  async handleDisconnection(socket) {
    try {
      const userId = this.userSockets.get(socket.id);
      
      if (userId) {
        // Remove from connected users
        this.connectedUsers.delete(userId);
        this.userSockets.delete(socket.id);

        // Remove from active conversations
        this.activeConversations.forEach((users, conversationId) => {
          users.delete(userId);
          if (users.size === 0) {
            this.activeConversations.delete(conversationId);
          }
        });

        // Broadcast offline status with delay (user might reconnect quickly)
        setTimeout(async () => {
          if (!this.connectedUsers.has(userId)) {
            await this.broadcastUserStatus(userId, 'offline');
          }
        }, 30000); // 30 seconds delay

        EnterpriseLogger.info('User disconnected from WebSocket', { userId, socketId: socket.id });
      }
    } catch (error) {
      EnterpriseLogger.error('Socket disconnection handling failed', error, { socketId: socket.id });
    }
  }

  /**
   * Handle joining a conversation
   */
  async handleJoinConversation(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      // Verify user has access to this conversation
      const hasAccess = await this.verifyConversationAccess(userId, conversationId);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Join conversation room
      socket.join(`conversation_${conversationId}`);

      // Track active conversation
      if (!this.activeConversations.has(conversationId)) {
        this.activeConversations.set(conversationId, new Set());
      }
      this.activeConversations.get(conversationId).add(userId);

      // Load recent messages
      const messages = await Message.getConversationMessages(conversationId, 50);
      socket.emit('conversation_messages', { conversationId, messages });

      // Notify other participants
      socket.to(`conversation_${conversationId}`).emit('user_joined_conversation', {
        conversationId,
        userId
      });

      EnterpriseLogger.info('User joined conversation', { userId, conversationId });

    } catch (error) {
      EnterpriseLogger.error('Join conversation failed', error, { userId: socket.userId, data });
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  }

  /**
   * Handle leaving a conversation
   */
  async handleLeaveConversation(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      socket.leave(`conversation_${conversationId}`);

      // Remove from active conversations
      const activeUsers = this.activeConversations.get(conversationId);
      if (activeUsers) {
        activeUsers.delete(userId);
        if (activeUsers.size === 0) {
          this.activeConversations.delete(conversationId);
        }
      }

      // Notify other participants
      socket.to(`conversation_${conversationId}`).emit('user_left_conversation', {
        conversationId,
        userId
      });

      EnterpriseLogger.info('User left conversation', { userId, conversationId });

    } catch (error) {
      EnterpriseLogger.error('Leave conversation failed', error, { userId: socket.userId, data });
    }
  }

  /**
   * Handle sending a message
   */
  async handleSendMessage(socket, data) {
    try {
      const { conversationId, content, messageType = 'text', mediaUrl } = data;
      const senderId = socket.userId;

      // Verify conversation access
      const hasAccess = await this.verifyConversationAccess(senderId, conversationId);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Create message
      const message = await Message.create({
        conversationId,
        senderId,
        content,
        messageType,
        mediaUrl,
        deliveryStatus: 'sent'
      });

      // Broadcast to conversation participants
      this.io.to(`conversation_${conversationId}`).emit('new_message', {
        message,
        conversationId
      });

      // Send push notifications to offline users
      await this.sendMessageNotifications(conversationId, senderId, message);

      // Update conversation last message timestamp
      await Message.updateConversationTimestamp(conversationId);

      EnterpriseLogger.info('Message sent', { 
        messageId: message.id, 
        conversationId, 
        senderId 
      });

    } catch (error) {
      EnterpriseLogger.error('Send message failed', error, { userId: socket.userId, data });
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  /**
   * Handle message read receipt
   */
  async handleMessageRead(socket, data) {
    try {
      const { messageId } = data;
      const userId = socket.userId;

      await Message.markAsRead(messageId, userId);

      // Get conversation ID for the message
      const message = await Message.findById(messageId);
      if (message) {
        // Notify sender about read receipt
        this.io.to(`conversation_${message.conversation_id}`).emit('message_read', {
          messageId,
          readBy: userId,
          readAt: new Date()
        });
      }

    } catch (error) {
      EnterpriseLogger.error('Message read handling failed', error, { userId: socket.userId, data });
    }
  }

  /**
   * Handle typing indicators
   */
  async handleTypingStart(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      // Broadcast typing status to other conversation participants
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        conversationId,
        userId,
        typing: true
      });

    } catch (error) {
      EnterpriseLogger.error('Typing start handling failed', error, { userId: socket.userId, data });
    }
  }

  /**
   * Handle stop typing
   */
  async handleTypingStop(socket, data) {
    try {
      const { conversationId } = data;
      const userId = socket.userId;

      // Broadcast stop typing to other conversation participants
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        conversationId,
        userId,
        typing: false
      });

    } catch (error) {
      EnterpriseLogger.error('Typing stop handling failed', error, { userId: socket.userId, data });
    }
  }

  /**
   * Send pending messages to newly connected user
   */
  async sendPendingMessages(socket) {
    try {
      const userId = socket.userId;
      const pendingMessages = await Message.getPendingMessages(userId);

      if (pendingMessages.length > 0) {
        socket.emit('pending_messages', { messages: pendingMessages });
        
        // Mark messages as delivered
        await Message.markAsDelivered(pendingMessages.map(m => m.id));
      }

    } catch (error) {
      EnterpriseLogger.error('Send pending messages failed', error, { userId: socket.userId });
    }
  }

  /**
   * Broadcast user online/offline status
   */
  async broadcastUserStatus(userId, status) {
    try {
      // Get user's matches/conversations to determine who should receive the status update
      const relevantUsers = await this.getRelevantUsers(userId);

      relevantUsers.forEach(relevantUserId => {
        const socketId = this.connectedUsers.get(relevantUserId);
        if (socketId) {
          this.io.to(socketId).emit('user_status', {
            userId,
            status,
            timestamp: new Date()
          });
        }
      });

    } catch (error) {
      EnterpriseLogger.error('Broadcast user status failed', error, { userId, status });
    }
  }

  /**
   * Send push notifications for messages to offline users
   */
  async sendMessageNotifications(conversationId, senderId, message) {
    try {
      // Get conversation participants
      const participants = await Message.getConversationParticipants(conversationId);
      const offlineUsers = participants.filter(userId => 
        userId !== senderId && !this.connectedUsers.has(userId)
      );

      // Send push notifications (integrate with your push notification service)
      if (offlineUsers.length > 0) {
        // This would integrate with Firebase Cloud Messaging or similar
        await this.sendPushNotifications(offlineUsers, {
          title: 'New Message',
          body: message.content.substring(0, 100),
          data: { conversationId, messageId: message.id }
        });
      }

    } catch (error) {
      EnterpriseLogger.error('Send message notifications failed', error);
    }
  }

  /**
   * Verify user has access to a conversation
   */
  async verifyConversationAccess(userId, conversationId) {
    try {
      const participants = await Message.getConversationParticipants(conversationId);
      return participants.includes(userId);
    } catch (error) {
      EnterpriseLogger.error('Verify conversation access failed', error);
      return false;
    }
  }

  /**
   * Get users who should receive status updates for a given user
   */
  async getRelevantUsers(userId) {
    try {
      // Get users who have active conversations with this user
      const conversationUsers = await Message.getConversationPartners(userId);
      return conversationUsers;
    } catch (error) {
      EnterpriseLogger.error('Get relevant users failed', error);
      return [];
    }
  }

  /**
   * Send push notifications (placeholder - integrate with your push service)
   */
  async sendPushNotifications(userIds, notification) {
    try {
      // This would integrate with Firebase Cloud Messaging, Apple Push Notification Service, etc.
      EnterpriseLogger.info('Push notifications would be sent', { userIds, notification });
    } catch (error) {
      EnterpriseLogger.error('Send push notifications failed', error);
    }
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Broadcast to all connected users
   */
  broadcast(event, data) {
    this.io.emit(event, data);
  }
}

module.exports = new WebSocketService();
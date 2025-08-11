const express = require('express');
const { authenticateToken } = require('../middleware/security');
const Message = require('../models/Message');

const router = express.Router();

// GET /api/v1/messaging/conversations - Get user's conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const conversations = await Message.getUserConversations(req.user.id, limit);

    res.json({
      conversations: conversations,
      totalCount: conversations.length
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/v1/messaging/conversations/:id/messages - Get messages in a conversation
router.get('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await Message.getConversationMessages(
      conversationId, 
      req.user.id, 
      parseInt(page), 
      parseInt(limit)
    );

    res.json(result);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/v1/messaging/conversations/:id/messages - Send a message
router.post('/conversations/:id/messages', authenticateToken, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { text, type = 'text' } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const newMessage = await Message.sendMessage(
      conversationId, 
      req.user.id, 
      text.trim(), 
      type
    );

    console.log('New message sent:', newMessage);

    // TODO: Emit message via Socket.IO for real-time updates
    // io.to(conversationId).emit('newMessage', newMessage);

    res.status(201).json({
      message: newMessage,
      success: true
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/v1/messaging/messages/:id/read - Mark message as read
router.put('/messages/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id: messageId } = req.params;

    const result = await Message.markMessageAsRead(messageId, req.user.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Message not found or already read' });
    }

    res.json({ success: true, message: result });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// POST /api/v1/messaging/conversations - Create conversation (when users match)
router.post('/conversations', authenticateToken, async (req, res) => {
  try {
    const { otherUserId, matchId } = req.body;
    
    if (!otherUserId) {
      return res.status(400).json({ error: 'Other user ID is required' });
    }

    const conversation = await Message.getOrCreateConversation(
      req.user.id, 
      otherUserId, 
      matchId
    );

    res.status(201).json({
      conversation: {
        id: conversation.id,
        participantIds: [conversation.participant1_id, conversation.participant2_id],
        createdAt: conversation.created_at
      },
      success: true
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// PUT /api/v1/messaging/conversations/:id/read - Mark entire conversation as read
router.put('/conversations/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id: conversationId } = req.params;

    await Message.markConversationAsRead(conversationId, req.user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Mark conversation read error:', error);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

// GET /api/v1/messaging/unread-count - Get total unread message count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await Message.getUnreadCount(req.user.id);

    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// DELETE /api/v1/messaging/messages/:id - Delete a message
router.delete('/messages/:id', authenticateToken, async (req, res) => {
  try {
    const { id: messageId } = req.params;

    const result = await Message.deleteMessage(messageId, req.user.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }

    res.json({ success: true, message: result });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// PUT /api/v1/messaging/conversations/:id/block - Block/unblock user in conversation
router.put('/conversations/:id/block', authenticateToken, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const { isBlocked = true } = req.body;

    await Message.updateBlockStatus(conversationId, req.user.id, isBlocked);

    res.json({ 
      success: true, 
      message: isBlocked ? 'User blocked' : 'User unblocked' 
    });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to update block status' });
  }
});

// GET /api/v1/messaging/conversations/:id/stats - Get conversation statistics
router.get('/conversations/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id: conversationId } = req.params;

    const stats = await Message.getConversationStats(conversationId);

    res.json(stats);
  } catch (error) {
    console.error('Get conversation stats error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation stats' });
  }
});

module.exports = router;
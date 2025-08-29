const { query } = require('../config/database-sqlite');

class Message {
  // Create messaging tables
  static async initializeTables() {
    const createConversationsTable = `
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER,
        participant1_id INTEGER NOT NULL,
        participant2_id INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (participant1_id) REFERENCES users(id),
        FOREIGN KEY (participant2_id) REFERENCES users(id),
        UNIQUE(participant1_id, participant2_id)
      )
    `;

    const createMessagesTable = `
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'video', 'audio')),
        is_read BOOLEAN DEFAULT 0,
        delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read')),
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      )
    `;

    const createConversationParticipantsTable = `
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        left_at DATETIME,
        is_blocked BOOLEAN DEFAULT 0,
        last_read_message_id INTEGER,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (last_read_message_id) REFERENCES messages(id),
        UNIQUE(conversation_id, user_id)
      )
    `;

    await query(createConversationsTable);
    await query(createMessagesTable);
    await query(createConversationParticipantsTable);
    
    console.log('✅ Messaging tables initialized');
  }

  // Create or get conversation between two users
  static async getOrCreateConversation(user1Id, user2Id, matchId = null) {
    console.log(`Creating/getting conversation between users ${user1Id} and ${user2Id}`);
    
    // Ensure consistent ordering for unique constraint
    const [participantA, participantB] = user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
    
    try {
      // Check if conversation exists
      let sql = `
        SELECT id, participant1_id, participant2_id, created_at
        FROM conversations 
        WHERE participant1_id = ? AND participant2_id = ?
      `;
      
      let result = await query(sql, [participantA, participantB]);
      
      if (result.rows.length > 0) {
        console.log('Found existing conversation:', result.rows[0]);
        return result.rows[0];
      }

      // Create new conversation
      sql = `
        INSERT INTO conversations (match_id, participant1_id, participant2_id)
        VALUES (?, ?, ?)
      `;

      await query(sql, [matchId, participantA, participantB]);
      
      // Get the inserted conversation
      const selectSql = `
        SELECT id, participant1_id, participant2_id, created_at
        FROM conversations 
        WHERE participant1_id = ? AND participant2_id = ?
        ORDER BY id DESC LIMIT 1
      `;
      
      result = await query(selectSql, [participantA, participantB]);
      const conversation = result.rows[0];
      
      console.log('Created new conversation:', conversation);

      // Add participants to conversation_participants table
      await query(`
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (?, ?), (?, ?)
      `, [conversation.id, user1Id, conversation.id, user2Id]);

      return conversation;
    } catch (error) {
      console.error('Error in getOrCreateConversation:', error);
      throw error;
    }
  }

  // Get user's conversations with last message
  static async getUserConversations(userId, limit = 20) {
    const sql = `
      SELECT 
        c.id as conversation_id,
        c.match_id,
        c.updated_at,
        CASE 
          WHEN c.participant1_id = $1 THEN c.participant2_id 
          ELSE c.participant1_id 
        END as other_user_id,
        u.first_name,
        u.last_name,
        up.photos,
        latest_msg.id as last_message_id,
        latest_msg.text as last_message_text,
        latest_msg.sender_id as last_message_sender_id,
        latest_msg.sent_at as last_message_time,
        latest_msg.is_read as last_message_read,
        unread_count.count as unread_count
      FROM conversations c
      JOIN users u ON (
        CASE 
          WHEN c.participant1_id = $1 THEN c.participant2_id 
          ELSE c.participant1_id 
        END = u.id
      )
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN (
        SELECT DISTINCT 
          m1.conversation_id,
          m1.id,
          m1.text,
          m1.sender_id,
          m1.sent_at,
          m1.is_read
        FROM messages m1
        WHERE m1.id = (
          SELECT m2.id FROM messages m2 
          WHERE m2.conversation_id = m1.conversation_id 
          ORDER BY m2.sent_at DESC 
          LIMIT 1
        )
      ) latest_msg ON c.id = latest_msg.conversation_id
      LEFT JOIN (
        SELECT 
          conversation_id,
          COUNT(*) as count
        FROM messages
        WHERE sender_id != $1 AND is_read = 0
        GROUP BY conversation_id
      ) unread_count ON c.id = unread_count.conversation_id
      WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
        AND c.is_active = 1
      ORDER BY COALESCE(latest_msg.sent_at, c.created_at) DESC
      LIMIT $2
    `;

    const result = await query(sql, [userId, limit]);
    
    return result.rows.map(row => ({
      id: row.conversation_id,
      matchId: row.match_id,
      participant: {
        id: row.other_user_id,
        name: `${row.first_name} ${row.last_name}`,
        photo: this.parseJSON(row.photos)?.[0] || 'https://via.placeholder.com/150x150?text=No+Photo'
      },
      lastMessage: row.last_message_id ? {
        id: row.last_message_id,
        text: row.last_message_text,
        senderId: row.last_message_sender_id,
        timestamp: row.last_message_time,
        isRead: row.last_message_read
      } : null,
      unreadCount: row.unread_count || 0,
      updatedAt: row.updated_at
    }));
  }

  // Send a message
  static async sendMessage(conversationId, senderId, text, messageType = 'text') {
    const sql = `
      INSERT INTO messages (conversation_id, sender_id, text, message_type)
      VALUES ($1, $2, $3, $4)
      RETURNING id, conversation_id, sender_id, text, message_type, sent_at, delivery_status
    `;

    const result = await query(sql, [conversationId, senderId, text, messageType]);
    const message = result.rows[0];

    // Update conversation timestamp
    await query(`
      UPDATE conversations 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `, [conversationId]);

    return {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      text: message.text,
      type: message.message_type,
      timestamp: message.sent_at,
      isRead: false,
      deliveryStatus: message.delivery_status
    };
  }

  // Get messages in a conversation
  static async getConversationMessages(conversationId, userId, page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    
    const sql = `
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.text,
        m.message_type,
        m.is_read,
        m.delivery_status,
        m.sent_at,
        m.read_at,
        u.first_name,
        u.last_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.sent_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [conversationId, limit, offset]);
    
    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as total FROM messages WHERE conversation_id = $1',
      [conversationId]
    );

    const messages = result.rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      senderName: `${row.first_name} ${row.last_name}`,
      text: row.text,
      type: row.message_type,
      timestamp: row.sent_at,
      isRead: row.is_read,
      readAt: row.read_at,
      deliveryStatus: row.delivery_status
    })).reverse(); // Reverse to show oldest first

    return {
      messages,
      totalCount: countResult.rows[0].total,
      page,
      hasMore: (page * limit) < countResult.rows[0].total
    };
  }

  // Mark message as read
  static async markMessageAsRead(messageId, userId) {
    const sql = `
      UPDATE messages 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP, delivery_status = 'read'
      WHERE id = $1 AND sender_id != $2
      RETURNING id, is_read, read_at
    `;

    const result = await query(sql, [messageId, userId]);
    return result.rows[0] || null;
  }

  // Mark all messages in conversation as read
  static async markConversationAsRead(conversationId, userId) {
    const sql = `
      UPDATE messages 
      SET is_read = 1, read_at = CURRENT_TIMESTAMP, delivery_status = 'read'
      WHERE conversation_id = $1 AND sender_id != $2 AND is_read = 0
    `;

    await query(sql, [conversationId, userId]);
    
    // Update last read message for user
    const lastMessageSql = `
      SELECT id FROM messages 
      WHERE conversation_id = $1 
      ORDER BY sent_at DESC 
      LIMIT 1
    `;
    
    const lastMessage = await query(lastMessageSql, [conversationId]);
    
    if (lastMessage.rows[0]) {
      await query(`
        UPDATE conversation_participants 
        SET last_read_message_id = $1 
        WHERE conversation_id = $2 AND user_id = $3
      `, [lastMessage.rows[0].id, conversationId, userId]);
    }

    return true;
  }

  // Get unread message count for user
  static async getUnreadCount(userId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
        AND m.sender_id != $1
        AND m.is_read = 0
        AND c.is_active = 1
    `;

    const result = await query(sql, [userId]);
    return result.rows[0].count || 0;
  }

  // Block/unblock user in conversation
  static async updateBlockStatus(conversationId, userId, isBlocked) {
    const sql = `
      UPDATE conversation_participants 
      SET is_blocked = $1 
      WHERE conversation_id = $2 AND user_id = $3
    `;

    await query(sql, [isBlocked ? 1 : 0, conversationId, userId]);
    return true;
  }

  // Delete message (soft delete by setting text to empty)
  static async deleteMessage(messageId, userId) {
    const sql = `
      UPDATE messages 
      SET text = '[Message deleted]'
      WHERE id = $1 AND sender_id = $2
      RETURNING id, text
    `;

    const result = await query(sql, [messageId, userId]);
    return result.rows[0] || null;
  }

  // Helper function to safely parse JSON
  static parseJSON(jsonString) {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  // Get conversation statistics
  static async getConversationStats(conversationId) {
    const sql = `
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN message_type = 'text' THEN 1 END) as text_messages,
        COUNT(CASE WHEN message_type = 'image' THEN 1 END) as image_messages,
        MIN(sent_at) as first_message_at,
        MAX(sent_at) as last_message_at
      FROM messages
      WHERE conversation_id = $1
    `;

    const result = await query(sql, [conversationId]);
    return result.rows[0];
  }
}

module.exports = Message;
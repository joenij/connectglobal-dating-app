import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'video';
  timestamp: string;
  isRead: boolean;
  deliveryStatus: 'sent' | 'delivered' | 'read';
}

interface Conversation {
  id: string;
  matchId: string;
  participant: {
    id: number;
    name: string;
    photo: string;
  };
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

interface MessagingState {
  conversations: Conversation[];
  activeConversation: string | null;
  messages: { [conversationId: string]: Message[] };
  isLoading: boolean;
  error: string | null;
}

const initialState: MessagingState = {
  conversations: [],
  activeConversation: null,
  messages: {},
  isLoading: false,
  error: null,
};

const messagingSlice = createSlice({
  name: 'messaging',
  initialState,
  reducers: {
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      state.conversations = action.payload;
    },
    addConversation: (state, action: PayloadAction<Conversation>) => {
      const existingIndex = state.conversations.findIndex(c => c.id === action.payload.id);
      if (existingIndex >= 0) {
        state.conversations[existingIndex] = action.payload;
      } else {
        state.conversations.unshift(action.payload);
      }
    },
    setActiveConversation: (state, action: PayloadAction<string | null>) => {
      state.activeConversation = action.payload;
    },
    setMessages: (state, action: PayloadAction<{ conversationId: string; messages: Message[] }>) => {
      const { conversationId, messages } = action.payload;
      state.messages[conversationId] = messages;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      const message = action.payload;
      const { conversationId } = message;
      
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      
      state.messages[conversationId].push(message);
      
      // Update conversation's last message
      const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
      if (conversationIndex >= 0) {
        state.conversations[conversationIndex].lastMessage = message;
        state.conversations[conversationIndex].updatedAt = message.timestamp;
        
        // Move conversation to top
        const conversation = state.conversations[conversationIndex];
        state.conversations.splice(conversationIndex, 1);
        state.conversations.unshift(conversation);
      }
    },
    markMessageAsRead: (state, action: PayloadAction<{ conversationId: string; messageId: string }>) => {
      const { conversationId, messageId } = action.payload;
      const messages = state.messages[conversationId];
      
      if (messages) {
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex >= 0) {
          messages[messageIndex].isRead = true;
          messages[messageIndex].deliveryStatus = 'read';
        }
      }
    },
    updateUnreadCount: (state, action: PayloadAction<{ conversationId: string; count: number }>) => {
      const { conversationId, count } = action.payload;
      const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
      
      if (conversationIndex >= 0) {
        state.conversations[conversationIndex].unreadCount = count;
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setConversations,
  addConversation,
  setActiveConversation,
  setMessages,
  addMessage,
  markMessageAsRead,
  updateUnreadCount,
  setLoading,
  setError,
  clearError,
} = messagingSlice.actions;

export default messagingSlice.reducer;
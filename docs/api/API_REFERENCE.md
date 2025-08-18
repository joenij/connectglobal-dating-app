# ConnectGlobal Dating App - API Reference

## Overview

The ConnectGlobal API is a RESTful API that powers the dating application. All endpoints are prefixed with `/api/v1` and require proper authentication unless explicitly stated otherwise.

**Base URL:** `https://api.connectglobal.app/api/v1`  
**Development URL:** `http://localhost:8000/api/v1`

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```bash
Authorization: Bearer <your_jwt_token>
```

### Rate Limits
- **Authentication endpoints:** 5 requests per 15 minutes per IP
- **General API:** 100 requests per 15 minutes per user
- **Upload endpoints:** 10 requests per hour per user

## API Endpoints

### 🔐 Authentication & Security

#### `POST /auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "phoneNumber": "+1234567890",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1995-01-01",
  "gender": "male",
  "countryCode": "US"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "accessToken": "jwt_token_here",
  "refreshToken": "refresh_token_here"
}
```

**Error Codes:**
- `400` - Validation errors
- `409` - User already exists
- `429` - Rate limit exceeded

---

#### `POST /auth/login`
Authenticate existing user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "subscriptionTier": "premium"
  },
  "accessToken": "jwt_token_here",
  "refreshToken": "refresh_token_here"
}
```

---

#### `POST /auth/logout`
🔒 **Protected** - Logout and blacklist current token.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### `POST /auth/refresh`
Refresh expired access token.

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response:**
```json
{
  "accessToken": "new_jwt_token",
  "refreshToken": "new_refresh_token"
}
```

---

#### `POST /auth/send-verification`
Send SMS verification code for phone number.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent",
  "expiresAt": "2024-01-01T12:10:00Z"
}
```

---

#### `POST /auth/verify-phone`
Verify phone number with SMS code.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone number verified successfully"
}
```

---

### 👤 User Management

#### `GET /users/profile`
🔒 **Protected** - Get current user profile.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1995-01-01",
  "gender": "male",
  "bio": "Love hiking and coffee!",
  "interests": ["hiking", "coffee", "travel"],
  "location": "San Francisco, CA",
  "profilePictureUrl": "https://...",
  "isProfileComplete": true,
  "subscriptionTier": "premium",
  "verificationLevel": 2
}
```

---

#### `PUT /users/profile`
🔒 **Protected** - Update user profile.

**Request Body:**
```json
{
  "bio": "Updated bio text",
  "interests": ["new", "interests"],
  "location": "New Location"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "bio": "Updated bio text",
    "interests": ["new", "interests"],
    "location": "New Location"
  }
}
```

---

#### `POST /users/deactivate`
🔒 **Protected** - Temporarily deactivate account.

**Response:**
```json
{
  "success": true,
  "message": "Account deactivated successfully"
}
```

---

#### `DELETE /users/account`
🔒 **Protected** - Permanently delete account.

**Response:**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

#### `GET /users/subscription`
🔒 **Protected** - Get subscription details.

**Response:**
```json
{
  "plan": "premium",
  "status": "active",
  "start": "2024-01-01T00:00:00Z",
  "end": "2024-02-01T00:00:00Z",
  "billing_cycle": "monthly"
}
```

---

#### `GET /users/settings`
🔒 **Protected** - Get user preferences.

**Response:**
```json
{
  "privacy": {
    "showAge": true,
    "showLocation": true
  },
  "notifications": {
    "matches": true,
    "messages": true,
    "marketing": false
  },
  "discovery": {
    "ageRange": [25, 35],
    "maxDistance": 50,
    "genderPreference": "all"
  }
}
```

---

#### `PUT /users/settings`
🔒 **Protected** - Update user settings.

**Request Body:**
```json
{
  "notifications": {
    "matches": false,
    "messages": true
  },
  "discovery": {
    "maxDistance": 25
  }
}
```

---

### 💕 Matching System

#### `GET /matching/discover`
🔒 **Protected** - Get potential matches using smart algorithm.

**Query Parameters:**
- `limit` (optional): Number of profiles (default: 10, max: 50)
- `cultural_weight` (optional): Cultural compatibility weight 0.0-1.0

**Response:**
```json
{
  "matches": [
    {
      "id": "uuid",
      "firstName": "Jane",
      "age": 28,
      "bio": "Adventure seeker...",
      "profilePictures": ["url1", "url2"],
      "compatibilityScore": 0.87,
      "culturalCompatibility": 0.92,
      "distance": 5.2,
      "verificationLevel": 2
    }
  ],
  "hasMore": true
}
```

---

#### `POST /matching/action`
🔒 **Protected** - Take action on a profile (like/pass/super_like).

**Request Body:**
```json
{
  "targetUserId": "uuid",
  "action": "like",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Actions:** `like`, `pass`, `super_like`, `block`

**Response:**
```json
{
  "success": true,
  "isMatch": true,
  "matchId": "uuid"
}
```

---

#### `GET /matching/matches`
🔒 **Protected** - Get user's matches.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Response:**
```json
{
  "matches": [
    {
      "id": "uuid",
      "user": {
        "id": "uuid",
        "firstName": "Jane",
        "profilePicture": "url"
      },
      "matchedAt": "2024-01-01T12:00:00Z",
      "lastMessageAt": "2024-01-01T13:00:00Z",
      "unreadCount": 3
    }
  ],
  "pagination": {
    "page": 1,
    "totalPages": 5,
    "totalMatches": 47
  }
}
```

---

### 💬 Messaging System

#### `GET /messaging/conversations`
🔒 **Protected** - Get user's conversations.

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "participants": [
        {
          "id": "uuid",
          "firstName": "Jane",
          "profilePicture": "url"
        }
      ],
      "lastMessage": {
        "id": "uuid",
        "content": "Hey there!",
        "timestamp": "2024-01-01T12:00:00Z",
        "senderId": "uuid"
      },
      "unreadCount": 2,
      "updatedAt": "2024-01-01T12:00:00Z"
    }
  ]
}
```

---

#### `GET /messaging/conversations/:conversationId/messages`
🔒 **Protected** - Get messages in a conversation.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Messages per page (default: 50)

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "content": "Hello!",
      "senderId": "uuid",
      "timestamp": "2024-01-01T12:00:00Z",
      "readAt": "2024-01-01T12:01:00Z",
      "type": "text"
    }
  ],
  "pagination": {
    "page": 1,
    "hasMore": false
  }
}
```

---

#### `POST /messaging/conversations/:conversationId/messages`
🔒 **Protected** - Send a message.

**Request Body:**
```json
{
  "content": "Hello there!",
  "type": "text"
}
```

**Message Types:** `text`, `image`, `gif`, `emoji`

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "content": "Hello there!",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

---

#### `POST /messaging/conversations/:conversationId/read`
🔒 **Protected** - Mark conversation as read.

**Response:**
```json
{
  "success": true,
  "readAt": "2024-01-01T12:00:00Z"
}
```

---

#### `GET /messaging/unread-count`
🔒 **Protected** - Get total unread message count.

**Response:**
```json
{
  "unreadCount": 5,
  "conversations": 3
}
```

---

#### `POST /messaging/block`
🔒 **Protected** - Block a user.

**Request Body:**
```json
{
  "userId": "uuid",
  "reason": "inappropriate_behavior"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User blocked successfully"
}
```

---

#### `POST /messaging/unblock`
🔒 **Protected** - Unblock a user.

**Request Body:**
```json
{
  "userId": "uuid"
}
```

---

#### `POST /messaging/report`
🔒 **Protected** - Report a user or message.

**Request Body:**
```json
{
  "userId": "uuid",
  "messageId": "uuid",
  "reason": "spam",
  "description": "Sending inappropriate content"
}
```

**Report Reasons:** `spam`, `harassment`, `inappropriate_content`, `fake_profile`, `other`

---

### 💳 Payments & Subscriptions

#### `POST /payments/create-payment-intent`
🔒 **Protected** - Create Stripe payment intent for subscription.

**Request Body:**
```json
{
  "plan": "premium",
  "billing_cycle": "monthly"
}
```

**Response:**
```json
{
  "client_secret": "pi_xxx_secret_xxx",
  "amount": 1999,
  "currency": "usd"
}
```

---

#### `GET /payments/subscription`
🔒 **Protected** - Get current subscription status.

**Response:**
```json
{
  "subscription": {
    "plan": "premium",
    "status": "active",
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-02-01T00:00:00Z",
    "billing_cycle": "monthly"
  }
}
```

---

#### `POST /payments/cancel-subscription`
🔒 **Protected** - Cancel current subscription.

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully"
}
```

---

#### `POST /payments/webhook`
**Public** - Stripe webhook endpoint for payment events.

**Headers Required:**
- `stripe-signature`: Webhook signature

---

### 📤 File Upload

#### `POST /upload/profile-image`
🔒 **Protected** - Upload profile image.

**Request:** `multipart/form-data`
- `image`: Image file (max 5MB, JPEG/PNG/WebP)

**Response:**
```json
{
  "success": true,
  "imageUrl": "https://...",
  "filename": "profile_123.jpg",
  "size": 1024000
}
```

---

#### `POST /upload/profile-video`
🔒 **Protected** - Upload profile video.

**Request:** `multipart/form-data`
- `video`: Video file (max 50MB, MP4/WebM)
- `duration`: Video duration in seconds

**Response:**
```json
{
  "success": true,
  "videoUrl": "https://...",
  "filename": "video_123.mp4",
  "size": 25600000,
  "duration": 30
}
```

---

#### `DELETE /upload/file/:filename`
🔒 **Protected** - Delete uploaded file.

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

#### `GET /upload/signed-url/:filename`
🔒 **Protected** - Get temporary signed URL for file access.

**Query Parameters:**
- `expires` (optional): Expiration time in seconds (default: 3600)

**Response:**
```json
{
  "success": true,
  "url": "https://...",
  "expiresIn": 3600
}
```

---

#### `GET /upload/health`
**Public** - Check upload service status.

**Response:**
```json
{
  "status": "healthy",
  "s3Enabled": false,
  "storageType": "Local Storage",
  "maxImageSize": "5MB",
  "maxVideoSize": "50MB"
}
```

---

### 💰 Pricing

#### `GET /pricing/tiers`
**Public** - Get pricing tiers for country.

**Query Parameters:**
- `country` (required): Country code (US, DE, IN, etc.)

**Response:**
```json
{
  "country": "US",
  "currency": "USD",
  "gdpTier": 1,
  "plans": {
    "basic": {
      "monthly": 9.99,
      "yearly": 99.99,
      "features": ["unlimited_likes", "see_who_liked_you"]
    },
    "premium": {
      "monthly": 19.99,
      "yearly": 199.99,
      "features": ["all_basic", "super_likes", "boost"]
    },
    "ultimate": {
      "monthly": 49.99,
      "yearly": 499.99,
      "features": ["all_premium", "priority_support", "advanced_filters"]
    }
  }
}
```

---

#### `GET /pricing/countries`
**Public** - Get supported countries and their GDP tiers.

**Response:**
```json
{
  "countries": [
    {
      "code": "US",
      "name": "United States",
      "gdpTier": 1,
      "currency": "USD"
    },
    {
      "code": "DE", 
      "name": "Germany",
      "gdpTier": 2,
      "currency": "EUR"
    }
  ]
}
```

---

#### `POST /pricing/calculate`
**Public** - Calculate price with modifiers.

**Request Body:**
```json
{
  "country": "US",
  "plan": "premium",
  "billing_cycle": "monthly",
  "promo_code": "WELCOME20"
}
```

**Response:**
```json
{
  "basePrice": 19.99,
  "discounts": [
    {
      "type": "promo_code",
      "amount": 4.00,
      "description": "Welcome 20% discount"
    }
  ],
  "finalPrice": 15.99,
  "currency": "USD"
}
```

---

### 🛡️ Admin Panel

#### `GET /admin/users`
🔒 **Admin Only** - Get users list with filters.

**Query Parameters:**
- `page`, `limit`: Pagination
- `status`: `active`, `banned`, `deactivated`
- `subscription`: `free`, `basic`, `premium`, `ultimate`
- `search`: Search term

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "subscriptionTier": "premium",
      "isActive": true,
      "isBanned": false,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "totalPages": 10,
    "totalUsers": 1000
  }
}
```

---

#### `GET /admin/analytics`
🔒 **Admin Only** - Get platform analytics.

**Response:**
```json
{
  "overview": {
    "totalUsers": 10000,
    "activeUsers": 8500,
    "premiumUsers": 1200,
    "totalMatches": 50000,
    "totalMessages": 250000
  },
  "growth": {
    "newUsersToday": 45,
    "newUsersThisWeek": 320,
    "newUsersThisMonth": 1200
  },
  "revenue": {
    "monthlyRecurring": 24000,
    "totalRevenue": 120000
  }
}
```

---

#### `POST /admin/users/:userId/ban`
🔒 **Admin Only** - Ban a user.

**Request Body:**
```json
{
  "reason": "Terms of service violation",
  "duration": "permanent"
}
```

---

#### `POST /admin/users/:userId/unban`
🔒 **Admin Only** - Unban a user.

---

#### `GET /admin/reports`
🔒 **Admin Only** - Get user reports.

**Response:**
```json
{
  "reports": [
    {
      "id": "uuid",
      "reporterId": "uuid",
      "reportedUserId": "uuid",
      "reason": "inappropriate_content",
      "description": "Sending offensive messages",
      "status": "pending",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### `PUT /admin/reports/:reportId`
🔒 **Admin Only** - Update report status.

**Request Body:**
```json
{
  "status": "resolved",
  "adminNotes": "User warned and content removed"
}
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error details"
  }
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created successfully
- `400` - Bad request / Validation error
- `401` - Unauthorized / Invalid token
- `403` - Forbidden / Insufficient permissions
- `404` - Resource not found
- `409` - Conflict / Resource already exists
- `429` - Rate limit exceeded
- `500` - Internal server error

### Error Codes
- `VALIDATION_ERROR` - Request validation failed
- `AUTHENTICATION_REQUIRED` - Valid token required
- `INSUFFICIENT_PERMISSIONS` - Admin access required
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `PAYMENT_REQUIRED` - Premium subscription required

## Rate Limiting Headers

All responses include rate limiting headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## Webhooks

### Stripe Payment Webhooks

The API receives Stripe webhooks at `/payments/webhook` for payment events:

- `payment_intent.succeeded` - Payment completed
- `payment_intent.payment_failed` - Payment failed
- `customer.subscription.updated` - Subscription changed
- `customer.subscription.deleted` - Subscription cancelled

## SDKs and Tools

- **Postman Collection:** [Download API Collection](./postman_collection.json)
- **OpenAPI Spec:** [View Swagger Documentation](./swagger.yaml)
- **JavaScript SDK:** Available on npm: `npm install connectglobal-api`

## Support

For API support and questions:
- **Developer Documentation:** [docs.connectglobal.app](https://docs.connectglobal.app)
- **Support Email:** developers@connectglobal.app
- **GitHub Issues:** [github.com/connectglobal/api-issues](https://github.com/connectglobal/api-issues)

---

*Last updated: December 2024*  
*API Version: v1.0.0*
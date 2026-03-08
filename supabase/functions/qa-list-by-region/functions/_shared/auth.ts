/**
 * Shared Authentication Utilities
 */ import { createSupabaseClient } from './supabase.ts';
// Use bcryptjs (pure JS implementation, no Workers needed)
import bcryptjs from "https://esm.sh/bcryptjs@2.4.3";
/**
 * Verify user token and return user data
 */ export async function verifyToken(token) {
  const supabase = createSupabaseClient();
  console.log(`🔍 Verifying token: ${token.substring(0, 30)}...`);
  // Query session first
  const { data: session, error: sessionError } = await supabase.from('user_sessions').select('user_id, expires_at').eq('token_hash', token).single();
  if (sessionError) {
    console.error(`❌ Token verification error:`, sessionError);
    throw new Error('Token non valido o scaduto');
  }
  if (!session) {
    console.error(`❌ No session found for token`);
    throw new Error('Token non valido o scaduto');
  }
  console.log(`✅ Session found for user_id: ${session.user_id}`);
  // Check expiration
  const expiresAt = new Date(session.expires_at);
  if (expiresAt < new Date()) {
    throw new Error('Token scaduto');
  }
  // Get user details separately (no join needed - avoids foreign key requirement)
  const { data: user, error: userError } = await supabase.from('users').select('user_id, email, name, role, region, is_active').eq('user_id', session.user_id).single();
  if (userError || !user) {
    console.error(`❌ User not found for user_id: ${session.user_id}`);
    throw new Error('Token non valido o scaduto');
  }
  // Check if user is active
  if (!user.is_active) {
    throw new Error('Account disattivato');
  }
  return {
    user_id: user.user_id,
    email: user.email,
    name: user.name,
    role: user.role,
    region: user.region
  };
}
/**
 * Extract token from Authorization header
 */ export function extractToken(req) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Token mancante');
  }
  return authHeader.substring(7) // Remove "Bearer " prefix
  ;
}
/**
 * Get current user from request
 */ export async function getCurrentUser(req) {
  const token = extractToken(req);
  return await verifyToken(token);
}
/**
 * Hash password using bcryptjs
 */ export async function hashPassword(password) {
  return bcryptjs.hashSync(password, 10);
}
/**
 * Verify password against hash using bcryptjs (pure JS, no Workers)
 */ export async function verifyPassword(password, passwordHash) {
  return bcryptjs.compareSync(password, passwordHash);
}
/**
 * Generate random password
 */ export function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  let password = '';
  for(let i = 0; i < length; i++){
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
/**
 * Generate user token
 */ export function generateToken(userId) {
  const timestamp = Date.now();
  const random = crypto.randomUUID();
  return `user-token-${userId}-${timestamp}-${random}`;
}

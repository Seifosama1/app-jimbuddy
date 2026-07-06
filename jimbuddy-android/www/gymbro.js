// Jim Buddy — Gymbro Social Library (Supabase Realtime API Integration)
// Relies on global variables SUPABASE_URL, SUPABASE_ANON, getAuthUser(), getAuthSession(), and toast() from app.js.

// Supabase Client instance cache
let supabaseClient = null;

/**
 * Gets or initializes the Supabase client, syncing the authentication session.
 */
async function getSupabaseClient() {
  if (!supabaseClient) {
    if (!window.supabase) {
      toast('Supabase SDK not loaded. Retrying...');
      return null;
    }
    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    } catch (e) {
      console.error('[Gymbro] Failed to create Supabase client:', e);
      toast('Failed to initialize Supabase client.');
      return null;
    }
  }

  // Synchronize session token with app.js Auth state
  if (typeof getAuthSession === 'function') {
    const session = getAuthSession();
    if (session) {
      const { data: clientSession } = await supabaseClient.auth.getSession();
      if (!clientSession || !clientSession.session || clientSession.session.access_token !== session.access_token) {
        const { error } = await supabaseClient.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token
        });
        if (error) {
          console.error('[Gymbro] Failed to sync auth session:', error);
        }
      }
    } else {
      // If no session locally, make sure Supabase client auth is cleared
      const { data: clientSession } = await supabaseClient.auth.getSession();
      if (clientSession && clientSession.session) {
        await supabaseClient.auth.signOut();
      }
    }
  }
  
  return supabaseClient;
}

/**
 * 1. Search Users
 * Queries the leaderboard table for usernames matching query (case-insensitive, ilike).
 */
async function searchUsers(query) {
  if (!query) return [];
  try {
    const client = await getSupabaseClient();
    if (!client) return [];

    const currentUser = getAuthUser();
    let q = client
      .from('leaderboard')
      .select('user_id, username, avatar, streak')
      .ilike('username', `%${query}%`)
      .limit(10);

    const { data, error } = await q;
    if (error) throw error;

    // Filter out current user
    if (currentUser) {
      return data.filter(u => u.user_id !== currentUser.id && u.user_id !== currentUser.id.toString());
    }
    return data;
  } catch (err) {
    console.error('[Gymbro] searchUsers error:', err);
    toast('Error searching users.');
    return [];
  }
}

/**
 * 2. Send Friend Request
 * Finds the user ID from the leaderboard table and inserts a request.
 */
async function sendFriendRequest(username) {
  if (!username) {
    toast('Please enter a username.');
    return false;
  }

  const currentUser = getAuthUser();
  if (!currentUser) {
    toast('Please sign in to add gymbros.');
    return false;
  }

  try {
    const client = await getSupabaseClient();
    if (!client) return false;

    // Find the target user in the leaderboard table
    const { data: userMatches, error: searchError } = await client
      .from('leaderboard')
      .select('user_id, username')
      .eq('username', username)
      .limit(1);

    if (searchError) throw searchError;

    if (!userMatches || userMatches.length === 0) {
      toast('❌ User not found. Make sure they have a profile.');
      return false;
    }

    const targetUser = userMatches[0];
    const targetUserId = targetUser.user_id;

    // Prevent adding self
    if (targetUserId === currentUser.id || targetUserId === currentUser.id.toString()) {
      toast("🙃 You can't add yourself!");
      return false;
    }

    // Check if they are already friends
    const { data: existingFriendship, error: friendError } = await client
      .from('friends')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('friend_id', targetUserId)
      .limit(1);

    if (friendError) throw friendError;

    if (existingFriendship && existingFriendship.length > 0) {
      toast(`🤝 Already friends with ${username}!`);
      return false;
    }

    // Check if a request already exists in either direction
    const { data: existingRequest, error: reqError } = await client
      .from('friend_requests')
      .select('id, sender_id, status')
      .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUser.id})`)
      .limit(1);

    if (reqError) throw reqError;

    if (existingRequest && existingRequest.length > 0) {
      const req = existingRequest[0];
      if (req.status === 'pending') {
        if (req.sender_id === currentUser.id) {
          toast('⏳ Request already sent and pending.');
        } else {
          toast('📨 They have already sent you a request! Check Requests.');
        }
      } else {
        toast(`Friend request status is: ${req.status}`);
      }
      return false;
    }

    // Insert new friend request
    const { error: insertError } = await client
      .from('friend_requests')
      .insert({
        sender_id: currentUser.id,
        receiver_id: targetUserId,
        status: 'pending'
      });

    if (insertError) throw insertError;

    toast(`📨 Request sent to ${username}!`);
    return true;
  } catch (err) {
    console.error('[Gymbro] sendFriendRequest error:', err);
    toast('Failed to send friend request.');
    return false;
  }
}

/**
 * 3. Get Friend Requests
 * Fetches all incoming pending requests.
 */
async function getFriendRequests() {
  const currentUser = getAuthUser();
  if (!currentUser) return [];

  try {
    const client = await getSupabaseClient();
    if (!client) return [];

    const { data: requests, error } = await client
      .from('friend_requests')
      .select('*')
      .eq('receiver_id', currentUser.id)
      .eq('status', 'pending');

    if (error) throw error;

    if (requests && requests.length > 0) {
      const senderIds = requests.map(r => r.sender_id);
      
      // Query leaderboard for sender info
      const { data: profiles, error: profileError } = await client
        .from('leaderboard')
        .select('user_id, username, avatar')
        .in('user_id', senderIds);

      if (profileError) throw profileError;

      const profileMap = {};
      if (profiles) {
        profiles.forEach(p => {
          profileMap[p.user_id] = p;
        });
      }

      return requests.map(r => ({
        ...r,
        sender: profileMap[r.sender_id] || { username: 'Unknown Gymbro', avatar: '👤' }
      }));
    }

    return [];
  } catch (err) {
    console.error('[Gymbro] getFriendRequests error:', err);
    return [];
  }
}

/**
 * 4. Accept Friend Request
 * Updates request status to 'accepted' and inserts friendship records for both users.
 */
async function acceptFriendRequest(requestId) {
  try {
    const client = await getSupabaseClient();
    if (!client) return false;

    const currentUser = getAuthUser();
    if (!currentUser) return false;

    // 1. Get the request to find sender_id
    const { data: reqData, error: fetchError } = await client
      .from('friend_requests')
      .select('sender_id')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;
    const senderId = reqData.sender_id;

    // 2. Update the request status
    const { error: updateError } = await client
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // 3. Create bilateral friendship records
    const { error: insertError } = await client
      .from('friends')
      .insert([
        { user_id: currentUser.id, friend_id: senderId },
        { user_id: senderId, friend_id: currentUser.id }
      ]);

    if (insertError) {
      // If bilateral constraint fails, ignore or handle duplicate gracefully
      if (!insertError.message.includes('unique')) throw insertError;
    }

    toast('🤝 Friend request accepted!');
    return true;
  } catch (err) {
    console.error('[Gymbro] acceptFriendRequest error:', err);
    toast('Failed to accept request.');
    return false;
  }
}

/**
 * 5. Decline Friend Request
 * Updates the request status to 'declined'.
 */
async function declineFriendRequest(requestId) {
  try {
    const client = await getSupabaseClient();
    if (!client) return false;

    const { error } = await client
      .from('friend_requests')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', requestId);

    if (error) throw error;

    toast('Declined friend request.');
    return true;
  } catch (err) {
    console.error('[Gymbro] declineFriendRequest error:', err);
    toast('Failed to decline request.');
    return false;
  }
}

/**
 * 6. Get Friends
 * Fetches all friends for the current user and joins online status + stats.
 */
async function getFriends() {
  const currentUser = getAuthUser();
  if (!currentUser) return [];

  try {
    const client = await getSupabaseClient();
    if (!client) return [];

    // Fetch friend IDs
    const { data: friendRows, error: friendError } = await client
      .from('friends')
      .select('friend_id')
      .eq('user_id', currentUser.id);

    if (friendError) throw friendError;

    if (!friendRows || friendRows.length === 0) return [];

    const friendIds = friendRows.map(f => f.friend_id);

    // Fetch leaderboard stats for friends
    const { data: profiles, error: profileError } = await client
      .from('leaderboard')
      .select('user_id, username, avatar, streak, pr_count, total_volume')
      .in('user_id', friendIds);

    if (profileError) throw profileError;

    // Fetch online statuses
    const { data: statuses, error: statusError } = await client
      .from('user_status')
      .select('user_id, is_online, last_seen')
      .in('user_id', friendIds);

    if (statusError) throw statusError;

    // Maps for joining
    const statusMap = {};
    if (statuses) {
      statuses.forEach(s => {
        statusMap[s.user_id] = s;
      });
    }

    const profileMap = {};
    if (profiles) {
      profiles.forEach(p => {
        profileMap[p.user_id] = p;
      });
    }

    return friendIds.map(fid => {
      const profile = profileMap[fid] || { username: 'Unknown Gymbro', avatar: '👤', streak: 0, pr_count: 0, total_volume: 0 };
      const status = statusMap[fid] || { is_online: false, last_seen: null };
      return {
        friend_id: fid,
        username: profile.username,
        avatar: profile.avatar || '👤',
        streak: profile.streak || 0,
        pr_count: profile.pr_count || 0,
        total_volume: profile.total_volume || 0,
        is_online: status.is_online || false,
        last_seen: status.last_seen
      };
    });
  } catch (err) {
    console.error('[Gymbro] getFriends error:', err);
    return [];
  }
}

/**
 * 7. Get or Create Chat
 * Retrieves or inserts a chat conversation for a friend.
 */
async function getOrCreateChat(friendId) {
  const currentUser = getAuthUser();
  if (!currentUser || !friendId) return null;

  try {
    const client = await getSupabaseClient();
    if (!client) return null;

    // Enforce user1_id < user2_id
    const user1 = currentUser.id < friendId ? currentUser.id : friendId;
    const user2 = currentUser.id < friendId ? friendId : currentUser.id;

    // Try finding existing chat
    const { data: existing, error: findError } = await client
      .from('chats')
      .select('*')
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .limit(1);

    if (findError) throw findError;

    if (existing && existing.length > 0) {
      return existing[0];
    }

    // Insert new chat
    const { data: newChat, error: createError } = await client
      .from('chats')
      .insert({
        user1_id: user1,
        user2_id: user2
      })
      .select('*')
      .single();

    if (createError) throw createError;
    return newChat;
  } catch (err) {
    console.error('[Gymbro] getOrCreateChat error:', err);
    toast('Could not open chat.');
    return null;
  }
}

/**
 * 8. Send Message
 * Inserts message and updates chat summary details.
 */
async function sendMessage(chatId, content) {
  const currentUser = getAuthUser();
  if (!currentUser || !chatId || !content.trim()) return null;

  try {
    const client = await getSupabaseClient();
    if (!client) return null;

    // 1. Insert message
    const { data: msg, error: insertError } = await client
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        content: content.trim()
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    // 2. Update chat last_message info
    await client
      .from('chats')
      .update({
        last_message: content.trim(),
        last_message_at: new Date().toISOString()
      })
      .eq('id', chatId);

    return msg;
  } catch (err) {
    console.error('[Gymbro] sendMessage error:', err);
    toast('Failed to send message.');
    return null;
  }
}

/**
 * 9. Get Messages
 * Loads chat history and updates read status.
 */
async function getMessages(chatId) {
  const currentUser = getAuthUser();
  if (!currentUser || !chatId) return [];

  try {
    const client = await getSupabaseClient();
    if (!client) return [];

    // Fetch chat history
    const { data: messages, error } = await client
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Asynchronously mark friend's messages as read
    client
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .not('sender_id', 'eq', currentUser.id)
      .is('read_at', null)
      .then(({ error: readError }) => {
        if (readError) console.error('[Gymbro] Error marking messages read:', readError);
      });

    return messages;
  } catch (err) {
    console.error('[Gymbro] getMessages error:', err);
    return [];
  }
}

/**
 * 10. Subscribe To Messages
 * Establishes Supabase Realtime channel listener for a specific chat.
 * Returns the channel for cleanup later.
 */
function subscribeToMessages(chatId, onMessage) {
  if (!supabaseClient || !chatId) return null;

  const channel = supabaseClient
    .channel(`chat:${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      (payload) => {
        if (payload.new) {
          onMessage(payload.new);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Gymbro] Chat Realtime Status for ${chatId}:`, status);
    });

  return channel;
}

/**
 * 10b. Subscribe To Message Updates (read_at changes)
 * Listens for UPDATE events on the messages table for a specific chat.
 * Used to update the seen indicator when a friend reads a message.
 * Returns the channel for cleanup later.
 */
function subscribeToMessageUpdates(chatId, onUpdate) {
  if (!supabaseClient || !chatId) return null;

  const channel = supabaseClient
    .channel(`chat_read:${chatId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new);
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * 11. Update User Status
 * Performs an upsert to keep the user's online indicator active.
 */
async function updateUserStatus(isOnline) {
  const currentUser = getAuthUser();
  if (!currentUser) return;

  try {
    const client = await getSupabaseClient();
    if (!client) return;

    const { error } = await client
      .from('user_status')
      .upsert({
        user_id: currentUser.id,
        is_online: isOnline,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('[Gymbro] updateUserStatus error:', error);
    }
  } catch (err) {
    console.error('[Gymbro] updateUserStatus exception:', err);
  }
}

/**
 * 12. Subscribe To User Status
 * Listens for updates in online states for selected user IDs.
 * Returns the channel for cleanup.
 */
function subscribeToUserStatus(userIds, onStatusChange) {
  if (!supabaseClient || !userIds || userIds.length === 0) return null;

  const channel = supabaseClient
    .channel('user_status_channel')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'user_status' },
      (payload) => {
        if (payload.new && userIds.includes(payload.new.user_id)) {
          onStatusChange(payload.new);
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * 13. Get Count of Unread Chats (not total messages)
 * Counts how many unique chats have at least one unread message sent by someone else.
 */
async function checkUnreadChatsCount() {
  const currentUser = getAuthUser();
  if (!currentUser) return 0;

  try {
    const client = await getSupabaseClient();
    if (!client) return 0;

    // Get messages sent to/in chats that are unread and not sent by the currentUser
    const { data: unreadMsgs, error } = await client
      .from('messages')
      .select('chat_id')
      .is('read_at', null)
      .not('sender_id', 'eq', currentUser.id);

    if (error) throw error;

    if (!unreadMsgs || unreadMsgs.length === 0) return 0;

    // Filter to find unique chat IDs
    const uniqueChats = new Set(unreadMsgs.map(m => m.chat_id));
    return uniqueChats.size;
  } catch (err) {
    console.error('[Gymbro] checkUnreadChatsCount error:', err);
    return 0;
  }
}

/**
 * 13b. Get Friend IDs with Unread Messages
 * Returns an array of sender_ids who have sent unread messages to the current user.
 */
async function getUnreadSenderIds() {
  const currentUser = getAuthUser();
  if (!currentUser) return [];

  try {
    const client = await getSupabaseClient();
    if (!client) return [];

    const { data: unreadMsgs, error } = await client
      .from('messages')
      .select('sender_id')
      .is('read_at', null)
      .not('sender_id', 'eq', currentUser.id);

    if (error) throw error;
    if (!unreadMsgs || unreadMsgs.length === 0) return [];

    return [...new Set(unreadMsgs.map(m => m.sender_id))];
  } catch (err) {
    console.error('[Gymbro] getUnreadSenderIds error:', err);
    return [];
  }
}

/**
 * 14. Subscribe to Unread Chats changes
 * Listens for new messages inside any conversation to update the unread chat count.
 */
function subscribeToUnreadChats(onChange) {
  if (!supabaseClient) return null;

  const channel = supabaseClient
    .channel('unread_chats_channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      () => {
        onChange();
      }
    )
    .subscribe();

  return channel;
}

/**
 * 15. Subscribe to All Incoming Messages (for background notifications)
 * Listens for INSERT events on the messages table for any messages
 * NOT sent by the current user — used for the notification sound and badge
 * when the chat modal is closed.
 * Returns the channel for cleanup later.
 */
function subscribeToIncomingMessages(currentUserId, onMessage) {
  if (!supabaseClient || !currentUserId) return null;

  const channel = supabaseClient
    .channel('incoming_msgs_channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        if (payload.new && payload.new.sender_id !== currentUserId) {
          onMessage(payload.new);
        }
      }
    )
    .subscribe();

  return channel;
}

// Export the functions to the window scope
window.checkUnreadChatsCount = checkUnreadChatsCount;
window.getUnreadSenderIds = getUnreadSenderIds;
window.subscribeToUnreadChats = subscribeToUnreadChats;
window.subscribeToIncomingMessages = subscribeToIncomingMessages;


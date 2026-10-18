// RemoteBackend implementation over Supabase RPCs. The server is authoritative for
// Birg Bucks, inventory and prices; the client (core/economy.js) applies changes
// optimistically and reconciles with the balance each RPC returns.
// All methods return Promises. See docs/ECONOMY_API.md.
import { SupabaseClient } from './supabaseClient.js';
import { CONFIG } from './config.js';

export class SupabaseBackend {
  constructor(client) { this.client = client; this.remote = true; }

  static fromConfig() {
    return new SupabaseBackend(new SupabaseClient({ url: CONFIG.supabaseUrl, anonKey: CONFIG.anonKey }));
  }
  get userId() { return this.client.user?.id || null; }
  get signedIn() { return this.client.signedIn; }

  // ---- profile / wallet ----
  loadProfile()                    { return this.client.rpc('get_my_profile'); }
  claimDailyBonus()                { return this.client.rpc('claim_daily_bonus'); }
  earn(source, amount, reason, ref) { return this.client.rpc('game_earn', { p_source: source, p_amount: amount, p_reason: reason ?? null, p_ref: ref ?? null }); }
  spend(amount, reason, ref)       { return this.client.rpc('game_spend', { p_amount: amount, p_reason: reason ?? null, p_ref: ref ?? null }); }
  purchase(itemId)                 { return this.client.rpc('buy_cosmetic', { p_item_id: itemId }); }
  saveLoadout({ equipped = null, rocketColors = null, cosmeticColors = null } = {}) {
    return this.client.rpc('save_loadout', { p_equipped: equipped, p_rocket_colors: rocketColors, p_cosmetic_colors: cosmeticColors });
  }
  saveGameData(gameId, data)       { return this.client.rpc('save_game_data', { p_game_id: gameId, p_data: data }); }
  loadGameData(gameId)             { return this.client.rpc('load_game_data', { p_game_id: gameId }); }
  buyGear(gameId, gearId)          { return this.client.rpc('buy_gear', { p_game_id: gameId, p_gear_id: gearId }); }
  ownsGear(gameId, gearId)         { return this.client.rpc('owns_gear', { p_game_id: gameId, p_gear_id: gearId }); }
  migrateLocalProfile(local)       { return this.client.rpc('migrate_local_profile', { p_local: local || {} }); }

  // ---- safe chat ----
  postChat(room, phraseId)         { return this.client.rpc('post_chat', { p_room: room, p_phrase_id: phraseId }); }
  getChat(room, afterId = 0)       { return this.client.rpc('get_chat', { p_room: room, p_after_id: afterId }); }
  chatHeartbeat(room)              { return this.client.rpc('chat_heartbeat', { p_room: room }); }
  chatLeave(room)                  { return this.client.rpc('chat_leave', { p_room: room }); }

  // ---- game stats (portal tabs) ----
  listFeatured()                   { return this.client.rpc('list_featured', {}, { anon: !this.client.signedIn }); }
  listGameStats()                  { return this.client.rpc('list_game_stats', {}, { anon: !this.client.signedIn }); }
  recordVisit(gameId)              { return this.client.rpc('record_visit', { p_game_id: gameId }); }
  gameHeartbeat(gameId)            { return this.client.rpc('game_heartbeat', { p_game_id: gameId }); }
  gameLeave()                      { return this.client.rpc('game_leave'); }

  // ---- friends ----
  listFriends()                    { return this.client.rpc('list_friends'); }
  sendFriendRequest(username)      { return this.client.rpc('send_friend_request', { p_username: username }); }
  respondFriendRequest(username, accept) { return this.client.rpc('respond_friend_request', { p_username: username, p_accept: !!accept }); }
  removeFriend(username)           { return this.client.rpc('remove_friend', { p_username: username }); }
}

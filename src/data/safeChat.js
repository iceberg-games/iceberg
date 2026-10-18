// Safe Chat phrase catalog (2006-style nested menu). Players can ONLY send these.
// Phrase ids are derived from the text (phraseId), so reordering is safe; editing a
// phrase's text makes a new id (the old one is deactivated by scripts/sync-catalog.mjs).
// Keep phrases kind, short (<= 80 chars), with no personal info / meeting / off-site asks.

export const SAFE_CHAT = [
  { id: 'hello', label: 'Hello', icon: '👋', items: [
    'Hi!', 'Hello everyone!', 'Hey there!', 'Good morning!', 'Good afternoon!', 'Good evening!',
    'Welcome to Iceberg!', 'Nice to meet you!', 'Long time no see!', 'Glad you are here!',
    { label: 'Goodbye', icon: '🚪', items: [
      'Bye!', 'See you later!', 'Gotta go!', 'Be right back!', "I'm back!", 'See you tomorrow!', 'Good night!', 'Have a great day!',
    ] },
  ] },
  { id: 'feel', label: 'Feelings', icon: '😀', items: [
    { label: 'Happy', icon: '😄', items: [
      "I'm happy!", 'This is awesome!', 'So much fun!', 'Yay!', 'Woohoo!', 'Best day ever!', 'I love this game!', 'Cool!',
    ] },
    { label: 'Other', icon: '🤔', items: [
      "I'm tired.", "I'm hungry.", "I'm bored.", "I'm confused.", 'Oops!', 'Uh oh!', 'Hmm...', 'Wow!', 'No way!', 'Brrr, it is cold!',
    ] },
    { label: 'Laugh', icon: '😂', items: ['Haha!', 'LOL!', 'That was funny!', 'You are silly!', 'Hehe!'] },
  ] },
  { id: 'qs', label: 'Questions', icon: '❓', items: [
    'How are you?', "What's up?", 'What are you doing?', 'Where are you?', 'Want to play?', 'Want to be friends?',
    'What game should we play?', 'Can you help me?', 'How do I do this?', 'Which level are you on?',
    'Do you like my outfit?', 'What is your favorite game?', 'What is your favorite color?', 'Who wants to race?',
    'Are you on my team?', 'Ready?', 'Is anyone here?', 'How did you get that?',
  ] },
  { id: 'ans', label: 'Answers', icon: '💬', items: [
    'Yes!', 'No.', 'Maybe.', 'OK!', 'Sure!', 'I don\'t know.', 'I think so.', 'Not yet.', 'Good, thanks!', "I'm great!",
    'Me too!', 'Same here!', 'Sounds good!', 'Thank you!', "You're welcome!", 'Sorry!', "That's OK!", 'No problem!', 'Wait for me!', 'Hold on!',
  ] },
  { id: 'games', label: 'Games', icon: '🎮', items: [
    { label: 'Let\'s play', icon: '▶️', items: [
      "Let's play!", "Let's play Frost Fields!", "Let's play the Rainbow Obby!", "Let's go to BIRG HQ!",
      "Let's play the Giant Rainbow Obby!", "Let's build something!", "Let's race!", "Let's explore!", 'One more round!', 'Join me!',
    ] },
    { label: 'Obby', icon: '🌈', items: [
      'I made it!', 'I fell in the lava!', 'This stage is hard!', 'Jump now!', 'You can do it!', 'Almost there!',
      'I beat the obby!', 'Which checkpoint are you at?', 'Follow me!', 'Go left!', 'Go right!', 'Watch out!',
    ] },
    { label: 'Building', icon: '🧱', items: [
      'Look what I built!', 'Nice build!', 'Help me build this!', 'Let\'s build a castle!', 'Let\'s build an igloo!',
      'I need more blocks!', 'That looks amazing!', 'Let\'s make a tower!', 'I made my own game!', 'Try my game!',
    ] },
    { label: 'Winning', icon: '🏆', items: ['Good game!', 'Great job!', 'You win!', 'I win!', 'Close one!', 'Rematch?', 'High five!', 'Nice move!'] },
  ] },
  { id: 'style', label: 'Style', icon: '🎩', items: [
    'I like your hat!', 'Cool outfit!', 'Nice wings!', 'I love your skin!', 'Check out my new item!', 'I just bought this!',
    'I am saving my Birg Bucks.', 'The Ice Rocket is so cool!', 'Want to see me fly?', 'Matching outfits!', 'I love the earmuffs!', 'Nice colors!',
  ] },
  { id: 'friends', label: 'Friends', icon: '🤝', items: [
    "You're nice!", "You're a good friend!", "Let's be friends!", 'Thanks for playing with me!', 'Thanks for helping!',
    'I sent you a friend request!', 'Welcome, friend!', 'Want to team up?', 'Come sit with me!', 'Let\'s hang out at BIRG HQ!',
  ] },
  { id: 'places', label: 'Places', icon: '🗺️', items: [
    'Meet me at the spawn!', 'Meet me by the fireplace!', 'Come upstairs!', 'Look at the icebergs!', 'Look at the snow!',
    'Over here!', 'Follow me there!', 'Come back!', 'Up here!', 'Down there!',
  ] },
  { id: 'emotes', label: 'Emotes', icon: '✨', items: [
    ':)', ':D', ';)', ':(', ':O', '<3', '!!!', '???', 'Zzz...', '*waves*', '*dances*', '*cheers*', '*claps*', '*laughs*',
  ] },
  { id: 'polite', label: 'Be kind', icon: '💙', items: [
    'Please be nice.', 'Please stop.', "Let's take turns.", 'Everyone can play!', 'Be a good sport!', "It's OK to lose.",
    'Want to join us?', 'We can share.', 'Happy birthday!', 'Happy holidays!', 'Congratulations!', 'Good luck!',
  ] },
];

/** Stable id from phrase text: lowercase, non-alphanumerics -> '_' (max 64 chars). */
export function phraseId(text) {
  const map = { ':)': 'smile', ':D': 'grin', ';)': 'wink', ':(': 'sad', ':O': 'surprised', '<3': 'heart', '!!!': 'excited', '???': 'puzzled' };
  if (map[text]) return 'emote_' + map[text];
  const s = text.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
  return s || 'phrase';
}

/** Flat list: [{ id, text, section }] where section is "Top > Sub". */
export function flattenPhrases(tree = SAFE_CHAT) {
  const out = [];
  const walk = (node, path) => {
    for (const it of node.items) {
      if (typeof it === 'string') out.push({ id: phraseId(it), text: it, section: path.join(' > ') });
      else walk(it, [...path, it.label]);
    }
  };
  for (const top of tree) walk(top, [top.label]);
  return out;
}

export const PHRASES = flattenPhrases();
export const PHRASE_BY_ID = Object.fromEntries(PHRASES.map(p => [p.id, p]));

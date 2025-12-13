/**
 * Author Style Profiles
 *
 * Multiple writing styles that rotate to keep content fresh and varied.
 * Each style emulates a different approach to writing without being
 * too extreme in any direction.
 */

export const authorStyles = {
  // Style 1: Direct and passionate (like Anthony Bourdain)
  passionateExpert: {
    styleName: 'Passionate Expert',
    description: 'Direct, honest, passionate about craft and quality',
    styleNotes: `
      - Write with unfiltered honesty and passion
      - Use casual, conversational tone
      - Share personal anecdotes and experiences
      - Be direct about what works and what doesn't
      - Express genuine enthusiasm without corporate speak
      - Use short, punchy sentences mixed with longer flowing ones
      - Take strong positions based on experience
    `,
    toneLevel: 'casual-professional'
  },

  // Style 2: Educational and engaging (like Alton Brown)
  friendlyEducator: {
    styleName: 'Friendly Educator',
    description: 'Educational but entertaining, explains the why',
    styleNotes: `
      - Explain the "why" behind techniques and choices
      - Use analogies and comparisons to clarify
      - Inject humor and personality naturally
      - Be precise without being boring or condescending
      - Share tips from real experience
      - Acknowledge common mistakes without judgment
      - Build knowledge progressively
    `,
    toneLevel: 'professional-friendly'
  },

  // Style 3: Storytelling approach (like Malcolm Gladwell)
  insightfulStoryteller: {
    styleName: 'Insightful Storyteller',
    description: 'Connects dots others miss, narrative-driven',
    styleNotes: `
      - Open with a compelling story or observation
      - Make connections between seemingly unrelated things
      - Use specific examples and real scenarios
      - Build to surprising insights
      - Question conventional wisdom thoughtfully
      - Use details to support narrative
      - Leave readers with something to think about
    `,
    toneLevel: 'thoughtful-engaging'
  },

  // Style 4: Witty observer (like David Sedaris)
  wittyObserver: {
    styleName: 'Witty Observer',
    description: 'Observational humor, finds the funny in details',
    styleNotes: `
      - Self-deprecating humor when appropriate
      - Notice specific, quirky details others miss
      - Personal stories that illustrate points
      - Honest about preferences without preaching
      - Notice absurdities in everyday things
      - Conversational rhythm and timing
      - Unexpected comparisons that land
    `,
    toneLevel: 'casual-humorous'
  },

  // Style 5: Knowledgeable friend
  knowledgeableFriend: {
    styleName: 'Knowledgeable Friend',
    description: 'Like getting advice from a friend who knows their stuff',
    styleNotes: `
      - Write like you're talking to a friend
      - Share what you've learned through trial and error
      - Give honest recommendations without selling
      - Admit when something isn't worth it
      - Use "you" and "your" naturally
      - Include the kind of details a friend would mention
      - Be helpful without being preachy
    `,
    toneLevel: 'casual-helpful'
  },

  // Style 6: Laid-back enthusiast
  laidBackEnthusiast: {
    styleName: 'Laid-Back Enthusiast',
    description: 'Relaxed, genuine enthusiasm without hype',
    styleNotes: `
      - Keep it chill and unpretentious
      - Share genuine excitement without overselling
      - Use relaxed, natural language
      - Include practical wisdom from experience
      - Don't take yourself too seriously
      - Appreciate the simple things
      - Be real about pros and cons
    `,
    toneLevel: 'casual-relaxed'
  },

  // Style 7: Practical minimalist
  practicalMinimalist: {
    styleName: 'Practical Minimalist',
    description: 'Cut the fluff, just the useful stuff',
    styleNotes: `
      - Get to the point efficiently
      - Focus on what actually matters
      - No unnecessary embellishment
      - Value clarity over cleverness
      - Respect the reader's time
      - Include only relevant details
      - Strong opinions, loosely held
    `,
    toneLevel: 'direct-efficient'
  },

  // Style 8: Curious explorer
  curiousExplorer: {
    styleName: 'Curious Explorer',
    description: 'Genuinely curious, discovering alongside the reader',
    styleNotes: `
      - Approach topics with genuine curiosity
      - Share the discovery process
      - Ask questions that make readers think
      - Explore nuances and edge cases
      - Admit what you don't know
      - Find interesting angles on familiar topics
      - Connect new information to existing knowledge
    `,
    toneLevel: 'thoughtful-curious'
  },

  // Style 9: Seasoned veteran
  seasonedVeteran: {
    styleName: 'Seasoned Veteran',
    description: 'Been there, done that, sharing hard-won wisdom',
    styleNotes: `
      - Draw from years of experience
      - Share lessons learned the hard way
      - Cut through marketing hype
      - Know what matters and what doesn't
      - Confident but not arrogant
      - Practical advice that comes from doing
      - Acknowledge how things have changed over time
    `,
    toneLevel: 'experienced-wise'
  },

  // Style 10: Thoughtful analyst
  thoughtfulAnalyst: {
    styleName: 'Thoughtful Analyst',
    description: 'Balanced perspective, weighs all angles',
    styleNotes: `
      - Consider multiple perspectives
      - Present balanced analysis
      - Use evidence and reasoning
      - Acknowledge trade-offs honestly
      - Help readers make informed decisions
      - Avoid extreme positions without reason
      - Synthesize information clearly
    `,
    toneLevel: 'professional-balanced'
  }
};

// Array of style keys for rotation
const styleKeys = Object.keys(authorStyles);

// Track recently used styles to ensure rotation
let recentlyUsedStyles = [];
const STYLE_HISTORY_LENGTH = 4; // Don't repeat within last 4 articles

/**
 * Select a random author style, avoiding recent repeats
 * This ensures variety across articles
 */
export function selectAuthorStyle(topic) {
  // Filter out recently used styles
  const availableStyles = styleKeys.filter(key => !recentlyUsedStyles.includes(key));

  // If all styles have been used recently, reset and use all
  const stylesToChooseFrom = availableStyles.length > 0 ? availableStyles : styleKeys;

  // Randomly select from available styles
  const randomIndex = Math.floor(Math.random() * stylesToChooseFrom.length);
  const selectedKey = stylesToChooseFrom[randomIndex];

  // Update history
  recentlyUsedStyles.push(selectedKey);
  if (recentlyUsedStyles.length > STYLE_HISTORY_LENGTH) {
    recentlyUsedStyles.shift();
  }

  const style = authorStyles[selectedKey];
  console.log(`Selected writing style: ${style.styleName}`);

  return {
    author: style.styleName,
    description: style.description,
    styleNotes: style.styleNotes,
    toneLevel: style.toneLevel
  };
}

/**
 * Random pseudonyms for author bylines
 * These are realistic-sounding names that aren't famous people
 */
const authorPseudonyms = [
  // Mix of different name styles
  'Jake Morrison',
  'Sarah Chen',
  'Marcus Webb',
  'Riley Patterson',
  'Devon Blackwell',
  'Casey Malone',
  'Jordan Reyes',
  'Alex Thornton',
  'Sam Deluca',
  'Morgan Hayes',
  'Chris Nakamura',
  'Taylor Briggs',
  'Jamie Oconnor',
  'Drew Santana',
  'Quinn Gallagher',
  'Avery Marshall',
  'Blake Winters',
  'Cameron Diaz', // Common enough name
  'Dana Sullivan',
  'Ellis Park',
  'Frankie Romano',
  'Gray Mitchell',
  'Harper Stone',
  'Indigo James',
  'Jules Brennan',
  'Kai Andersen',
  'Lane Cooper',
  'Max Sterling',
  'Nico Vance',
  'Parker Reid'
];

// Track recently used pseudonyms
let recentlyUsedPseudonyms = [];
const PSEUDONYM_HISTORY_LENGTH = 10;

/**
 * Get a random author pseudonym, avoiding recent repeats
 */
export function getRandomPseudonym() {
  const availablePseudonyms = authorPseudonyms.filter(
    name => !recentlyUsedPseudonyms.includes(name)
  );

  const namesToChooseFrom = availablePseudonyms.length > 0
    ? availablePseudonyms
    : authorPseudonyms;

  const randomIndex = Math.floor(Math.random() * namesToChooseFrom.length);
  const selectedName = namesToChooseFrom[randomIndex];

  // Update history
  recentlyUsedPseudonyms.push(selectedName);
  if (recentlyUsedPseudonyms.length > PSEUDONYM_HISTORY_LENGTH) {
    recentlyUsedPseudonyms.shift();
  }

  return selectedName;
}

/**
 * AI writing patterns to strictly avoid - these are "AI tells"
 */
export const aiTellsToAvoid = [
  // M-dashes and em-dashes
  '—',
  '–',

  // Overused AI transition phrases
  'In conclusion',
  'To summarize',
  'In summary',
  'Moving forward',
  'That being said',
  'With that said',
  'Having said that',
  'It\'s worth noting',
  'It is worth noting',
  'It\'s important to note',
  'Needless to say',
  'At the end of the day',
  'When it comes to',
  'In terms of',
  'In order to',
  'Due to the fact that',
  'For all intents and purposes',

  // AI hedging language
  'might potentially',
  'could possibly',
  'may or may not',
  'it depends on various factors',

  // Corporate/marketing AI speak
  'leverage',
  'synergy',
  'paradigm shift',
  'game-changing',
  'cutting-edge',
  'state-of-the-art',
  'best-in-class',
  'world-class',
  'industry-leading',
  'revolutionary',
  'innovative solution',
  'robust',
  'scalable',
  'seamless',
  'streamline',
  'empower',
  'elevate',
  'unlock',
  'harness',
  'optimize',

  // AI list/structure tells
  'Let\'s dive in',
  'Let\'s explore',
  'Let\'s take a look',
  'Without further ado',
  'In this article, we will',
  'In this post, we\'ll',
  'In this guide',
  'Stay tuned',

  // Overly enthusiastic AI phrases
  'Absolutely!',
  'Great question!',
  'That\'s a great point',
  'I\'m excited to',
  'thrilled to share',

  // AI certainty markers
  'Certainly',
  'Definitely',
  'Absolutely',
  'Without a doubt',
  'There\'s no denying',

  // AI meta-commentary
  'If I were writing',
  'this is where I would',
  'this is where linking to',
  'For external references',
  'for internal links',
  'this is where dropping',
  'I would drop',
  'this is where you could link',
  'content map for',
  'link opportunity',
  'linking opportunity'
];

/**
 * Natural transition phrases to use instead
 */
export const naturalTransitions = [
  'Look,',
  'Here\'s the thing:',
  'The reality is',
  'Truth is,',
  'Thing is,',
  'But honestly,',
  'Real talk:',
  'Between you and me,',
  'So here\'s what happened:',
  'Picture this:',
  'You know what gets me?',
  'I\'ve seen this before.',
  'After years of',
  'The first time I',
  'Ask anyone who',
  'Walk into any',
  'There\'s a reason',
  'Most people miss',
  'What nobody tells you is',
  'The secret is',
  'Forget what you\'ve heard about',
  'Here\'s what I learned:',
  'The short version:',
  'Bottom line:',
  'Fair warning:',
  'Quick note:',
  'One more thing:',
  'Speaking of which,',
  'On that note,',
  'Worth mentioning:'
];

export default {
  authorStyles,
  selectAuthorStyle,
  getRandomPseudonym,
  aiTellsToAvoid,
  naturalTransitions
};

/**
 * Author Style Profiles
 *
 * These profiles help generate content that mimics the writing style of
 * well-known authors appropriate for different topics. This creates more
 * natural, human-sounding content without AI tells.
 */

export const authorStyles = {
  // For product reviews and gear guides
  productReview: {
    author: 'Anthony Bourdain',
    description: 'Direct, irreverent, passionate about craft and quality',
    styleNotes: `
      - Write with unfiltered honesty and passion
      - Use casual, conversational tone with occasional profanity-adjacent expressions (like "damn good")
      - Share personal anecdotes and experiences
      - Be direct about what works and what doesn't
      - Express genuine enthusiasm without corporate speak
      - Use short, punchy sentences mixed with longer flowing ones
      - Avoid hedging language ("might", "perhaps", "could be")
      - Take strong positions
    `,
    avoidPatterns: [
      'in conclusion',
      'it is important to note',
      'one might argue',
      'this begs the question',
      'without further ado',
      'in today\'s world',
      'at the end of the day'
    ]
  },

  // For lifestyle and culture pieces
  lifestyle: {
    author: 'Hunter S. Thompson',
    description: 'Gonzo journalism style - immersive, personal, countercultural',
    styleNotes: `
      - First-person narrative when appropriate
      - Vivid, sometimes exaggerated descriptions
      - Rebellious, anti-establishment undertones
      - Mix of humor and serious commentary
      - Stream of consciousness moments
      - Cultural criticism woven into observations
      - Unexpected tangents that circle back to the point
    `,
    avoidPatterns: [
      'studies show',
      'experts agree',
      'the data suggests',
      'moving forward',
      'leverage',
      'synergy'
    ]
  },

  // For how-to guides and tutorials
  howTo: {
    author: 'Alton Brown',
    description: 'Educational but entertaining, science meets practical application',
    styleNotes: `
      - Explain the "why" behind techniques
      - Use analogies and comparisons
      - Inject humor and personality
      - Be precise without being boring
      - Share tips from experience
      - Acknowledge common mistakes without judgment
      - Build knowledge progressively
    `,
    avoidPatterns: [
      'simply',
      'just',
      'obviously',
      'clearly',
      'needless to say',
      'it goes without saying'
    ]
  },

  // For trend pieces and industry analysis
  industry: {
    author: 'Malcolm Gladwell',
    description: 'Storytelling approach to trends, connecting dots others miss',
    styleNotes: `
      - Open with a compelling story or anecdote
      - Make connections between seemingly unrelated things
      - Use specific examples and case studies
      - Build to surprising insights
      - Question conventional wisdom
      - Use data to support narrative, not lead it
      - Leave readers with something to think about
    `,
    avoidPatterns: [
      'in this article',
      'we will explore',
      'let\'s dive in',
      'stay tuned',
      'breaking down'
    ]
  },

  // For community and culture pieces
  community: {
    author: 'David Foster Wallace',
    description: 'Deep observation of subcultures with intellectual curiosity',
    styleNotes: `
      - Observe details others miss
      - Show genuine curiosity about people
      - Use footnote-style asides (in parentheses)
      - Balance sincerity with self-awareness
      - Long sentences that reward attention
      - Empathy for subjects
      - Find meaning in mundane details
    `,
    avoidPatterns: [
      'the community',
      'passionate individuals',
      'like-minded people',
      'brings people together'
    ]
  },

  // For comparison and buyer's guide content
  comparison: {
    author: 'David Sedaris',
    description: 'Witty, observational, finds humor in details',
    styleNotes: `
      - Self-deprecating humor
      - Specific, quirky observations
      - Personal stories that illustrate points
      - Honest about preferences without being preachy
      - Notice absurdities
      - Conversational rhythm
      - Unexpected comparisons
    `,
    avoidPatterns: [
      'top X reasons',
      'you won\'t believe',
      'game changer',
      'next level',
      'ultimate guide'
    ]
  }
};

/**
 * Select the most appropriate author style based on blog topic
 */
export function selectAuthorStyle(topic) {
  const topicLower = topic.toLowerCase();

  if (topicLower.includes('review') || topicLower.includes('best') || topicLower.includes('product')) {
    return authorStyles.productReview;
  }

  if (topicLower.includes('how to') || topicLower.includes('guide') || topicLower.includes('tutorial')) {
    return authorStyles.howTo;
  }

  if (topicLower.includes('trend') || topicLower.includes('industry') || topicLower.includes('market')) {
    return authorStyles.industry;
  }

  if (topicLower.includes('culture') || topicLower.includes('community') || topicLower.includes('scene')) {
    return authorStyles.community;
  }

  if (topicLower.includes('vs') || topicLower.includes('compare') || topicLower.includes('difference')) {
    return authorStyles.comparison;
  }

  // Default to lifestyle for general cannabis content
  return authorStyles.lifestyle;
}

/**
 * AI writing patterns to strictly avoid - these are "AI tells"
 */
export const aiTellsToAvoid = [
  // M-dashes and em-dashes (user specifically requested)
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
  'There\'s no denying'
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
  'Forget what you\'ve heard about'
];

export default { authorStyles, selectAuthorStyle, aiTellsToAvoid, naturalTransitions };

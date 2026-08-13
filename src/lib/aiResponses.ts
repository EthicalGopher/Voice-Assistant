export interface AIResponseResult {
  replyText: string;
  actionSummary?: string;
  category?: 'reminder' | 'music' | 'weather' | 'system' | 'general' | 'query';
}

export function generateAIResponse(userPrompt: string): AIResponseResult {
  const clean = userPrompt.trim().toLowerCase();

  // Reference image prompt match
  if (clean.includes('meeting with sarah') || (clean.includes('reminder') && clean.includes('focus music'))) {
    return {
      replyText: "I've scheduled your meeting with Sarah for tomorrow at 2:00 PM and started your Deep Focus playlist on spatial audio.",
      actionSummary: "Calendar reminder created & focus stream active",
      category: 'reminder',
    };
  }

  if (clean.includes('reminder') || clean.includes('schedule') || clean.includes('calendar')) {
    return {
      replyText: "I've added that to your schedule. I will notify you 15 minutes before with your briefing summary.",
      actionSummary: "New event recorded to neural calendar",
      category: 'reminder',
    };
  }

  if (clean.includes('music') || clean.includes('play') || clean.includes('song') || clean.includes('track')) {
    return {
      replyText: "Streaming ambient binaural soundscapes at 432Hz to enhance cognitive flow state.",
      actionSummary: "Audio playback initiated",
      category: 'music',
    };
  }

  if (clean.includes('weather') || clean.includes('forecast') || clean.includes('temperature')) {
    return {
      replyText: "Currently 21°C with clear atmospheric conditions. Expect a mild evening with optimal visibility.",
      actionSummary: "Atmospheric telemetry updated",
      category: 'weather',
    };
  }

  if (clean.includes('system') || clean.includes('status') || clean.includes('diagnostic') || clean.includes('diagnostics')) {
    return {
      replyText: "All Aria core sub-systems are running at optimal throughput. Latency is 12ms and quantum neural resonance is 99.4%.",
      actionSummary: "System health check passed",
      category: 'system',
    };
  }

  if (clean.includes('who are you') || clean.includes('your name') || clean.includes('aria')) {
    return {
      replyText: "I am Aria, your next-generation neural voice intelligence. How can I assist your workflow today?",
      actionSummary: "Aria neural core active",
      category: 'general',
    };
  }

  if (clean.includes('lights') || clean.includes('room') || clean.includes('home')) {
    return {
      replyText: "Adjusting ambient lighting to 40% warm luminescence and locking perimeter smart sensors.",
      actionSummary: "Smart environment updated",
      category: 'system',
    };
  }

  // Default intelligent response
  return {
    replyText: `Processing your request regarding "${userPrompt}". I have synthesized the data and synchronized your workspace.`,
    actionSummary: "Neural query resolved",
    category: 'query',
  };
}

export const SAMPLE_PROMPTS = [
  "Set a reminder for my meeting with Sarah tomorrow at 2 PM and play some focus music.",
  "What is the system diagnostic and quantum latency status?",
  "Dim the ambient lights and summarize today's priorities.",
  "Give me the atmospheric forecast for the evening.",
];

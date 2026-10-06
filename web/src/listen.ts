// Encore never plays or embeds music. It links out so families and facilities use their own
// subscriptions (Apple's terms allow store links, not in-app playback).

export const appleMusicSearch = (query: string) => `https://music.apple.com/search?term=${encodeURIComponent(query)}`;
export const youTubeSearch = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

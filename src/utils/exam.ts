export function checkMCQCorrect(
  userAnswer?: string | null,
  correctAnswer?: string | null,
  options?: string[] | null
): boolean {
  if (!userAnswer || !correctAnswer) return false;
  
  const user = userAnswer.trim();
  const correct = correctAnswer.trim();
  
  if (!user || !correct) return false;

  // 1. Direct case-insensitive match
  if (user.toLowerCase() === correct.toLowerCase()) return true;

  // Strip common option prefixes like "A)", "(A)", "A.", "Option A:", "1."
  const stripPrefix = (str: string) => {
    return str
      .replace(/^(\([A-Ea-e1-5]\)|[A-Ea-e1-5][\.\):]|\boption\s+[A-Ea-e1-5][:\.\)]?)\s*/i, '')
      .trim()
      .toLowerCase();
  };

  const cleanUser = stripPrefix(user);
  const cleanCorrect = stripPrefix(correct);

  if (cleanUser && cleanCorrect && cleanUser === cleanCorrect) {
    return true;
  }

  // Option letter detection
  if (options && Array.isArray(options) && options.length > 0) {
    const letters = ['a', 'b', 'c', 'd', 'e'];

    // Find index of user's chosen option
    const userIndex = options.findIndex(
      opt => opt.trim().toLowerCase() === user.toLowerCase() || 
             stripPrefix(opt) === cleanUser ||
             (cleanUser && stripPrefix(opt) === user.toLowerCase())
    );

    if (userIndex >= 0 && userIndex < letters.length) {
      const targetLetter = letters[userIndex];
      const correctLower = correct.toLowerCase();
      
      // If correct answer is single letter like "A" or "(A)" or "Option A"
      const matchedLetter = correctLower.match(/^(\(?([a-e])\)?|\boption\s+([a-e]))$/i);
      if (matchedLetter) {
        const letter = (matchedLetter[2] || matchedLetter[3]).toLowerCase();
        if (letter === targetLetter) return true;
      }

      // Check against options[userIndex]
      if (stripPrefix(options[userIndex]) === cleanCorrect) {
        return true;
      }
    }

    // Also check if correct answer matches an option index
    const correctIndex = options.findIndex(
      opt => opt.trim().toLowerCase() === correct.toLowerCase() ||
             stripPrefix(opt) === cleanCorrect
    );

    if (correctIndex >= 0 && correctIndex < letters.length) {
      const targetLetter = letters[correctIndex];
      const userLower = user.toLowerCase();
      const matchedUserLetter = userLower.match(/^(\(?([a-e])\)?|\boption\s+([a-e]))$/i);
      if (matchedUserLetter) {
        const letter = (matchedUserLetter[2] || matchedUserLetter[3]).toLowerCase();
        if (letter === targetLetter) return true;
      }
    }
  }

  return false;
}

/**
 * Parses a timestamp string (HH:MM:SS,mmm or HH:MM:SS.mmm) into seconds.
 * @param {string} timestamp The timestamp string.
 * @returns {number} Total seconds.
 * @throws {Error} if the timestamp format is invalid.
 */
function parseTimestampToSeconds(timestamp) {
  const parts = timestamp.split(/[:,.]/);
  if (parts.length !== 4) {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  const milliseconds = parseInt(parts[3], 10);

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(milliseconds)) {
    throw new Error(`Invalid numeric value in timestamp: ${timestamp}`);
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Parses SRT (SubRip Text) subtitle content.
 * @param {string} srtContent The string content of an SRT file.
 * @returns {Array<Object>} An array of subtitle objects, each with id, startTime, endTime, and text.
 */
export function parseSrt(srtContent) {
  const subtitles = [];
  // Normalize line endings and split into blocks
  const blocks = srtContent.replace(/\r\n/g, '\n').trim().split('\n\n');

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) { // Minimum: id, time, text
      // console.warn('Skipping malformed SRT block:', block);
      continue;
    }

    const id = lines[0].trim();
    const timeLine = lines[1].trim();
    const textLines = lines.slice(2).map(line => line.trim());

    const timeParts = timeLine.split(' --> ');
    if (timeParts.length !== 2) {
      // console.warn('Skipping SRT block with malformed time line:', block);
      continue;
    }

    try {
      const startTime = parseTimestampToSeconds(timeParts[0]);
      const endTime = parseTimestampToSeconds(timeParts[1]);
      const text = textLines.join('\n');

      subtitles.push({ id, startTime, endTime, text });
    } catch (error) {
      // console.warn(`Skipping SRT block due to time parsing error: ${error.message}`, block);
    }
  }
  return subtitles;
}

/**
 * Parses VTT (Web Video Text Tracks) subtitle content.
 * @param {string} vttContent The string content of a VTT file.
 * @returns {Array<Object>} An array of subtitle objects, each with id, startTime, endTime, and text.
 */
export function parseVtt(vttContent) {
  const subtitles = [];
  // Normalize line endings and split into blocks
  const rawBlocks = vttContent.replace(/\r\n/g, '\n').trim().split('\n\n');

  // Check and remove WEBVTT header and other metadata cues like STYLE or REGION
  let firstValidBlockIndex = 0;
  for (let i = 0; i < rawBlocks.length; i++) {
    const blockText = rawBlocks[i];
    if (i === 0 && blockText.startsWith('WEBVTT')) {
      firstValidBlockIndex++;
      continue;
    }
    // Skip common VTT metadata cues
    if (blockText.startsWith('NOTE') || blockText.startsWith('STYLE') || blockText.startsWith('REGION')) {
      firstValidBlockIndex++; // Assuming these are at the start, otherwise logic needs to be more robust
      continue;
    }
    // If a block doesn't contain '-->', it's likely not a subtitle cue or is malformed
    if (!blockText.includes('-->')) {
        // console.warn('Skipping VTT block without timestamp separator:', blockText);
        if (i === firstValidBlockIndex) firstValidBlockIndex++;
        continue;
    }
    break; // Found the start of actual cues or a cue-like block
  }
  
  const cueBlocks = rawBlocks.slice(firstValidBlockIndex);

  for (let i = 0; i < cueBlocks.length; i++) {
    const block = cueBlocks[i];
    const lines = block.split('\n');
    
    let id = String(i + 1); // Default ID based on order
    let timeLineIndex = 0;
    let textStartIndex = 1;

    // VTT cues can have an optional ID.
    // If the first line does not contain '-->', it might be an ID.
    if (lines.length > 0 && !lines[0].includes('-->')) {
      id = lines[0].trim();
      timeLineIndex = 1;
      textStartIndex = 2;
    }
    
    if (lines.length < (textStartIndex)) { // Must have at least a timeline (and optionally text)
        // console.warn('Skipping VTT block that is too short:', block);
        continue;
    }
    
    const timeLine = lines[timeLineIndex]?.trim();
    if (!timeLine || !timeLine.includes('-->')) {
      // console.warn('Skipping VTT block with missing or malformed time line:', block);
      continue;
    }

    const textLines = lines.slice(textStartIndex).map(line => line.trim());

    const timeParts = timeLine.split(' --> ');
    // Further VTT specific parsing for time settings (e.g., alignment) can be added here if needed
    const startTimeString = timeParts[0].split(' ')[0]; // Take only the time part, ignore settings
    const endTimeString = timeParts[1].split(' ')[0];   // Take only the time part, ignore settings


    try {
      const startTime = parseTimestampToSeconds(startTimeString);
      const endTime = parseTimestampToSeconds(endTimeString);
      const text = textLines.join('\n');

      // Avoid adding cues that are just metadata recognized as cues
      if (text.startsWith('NOTE') && lines.length === textStartIndex +1) continue;


      subtitles.push({ id, startTime, endTime, text });
    } catch (error) {
      // console.warn(`Skipping VTT block due to time parsing error: ${error.message}`, block);
    }
  }
  return subtitles;
}

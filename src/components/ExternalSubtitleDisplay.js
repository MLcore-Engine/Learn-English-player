import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ExternalSubtitleDisplay = ({ subtitles, currentTime }) => {
  const [activeSubtitleText, setActiveSubtitleText] = useState('');

  useEffect(() => {
    if (!subtitles || subtitles.length === 0) {
      setActiveSubtitleText('');
      return;
    }

    const activeSub = subtitles.find(
      (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
    );

    if (activeSub) {
      // Replace \n with <br /> for multiline subtitles
      setActiveSubtitleText(activeSub.text.replace(/\n/g, '<br />'));
    } else {
      setActiveSubtitleText('');
    }
  }, [subtitles, currentTime]);

  if (!activeSubtitleText) {
    return null; // Don't render anything if no subtitle is active
  }

  // Basic styling for the subtitle
  // This should be adjusted to position it correctly over/under the video
  const style = {
    position: 'absolute',
    bottom: '10%', // Adjust as needed, e.g., '20px' from bottom of its container
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '5px',
    textAlign: 'center',
    fontSize: '1.2em', // Adjust as needed
    zIndex: 1000, // Ensure it's above the video
    pointerEvents: 'none', // Allow clicks to pass through to video player controls
    // Ensure line breaks are rendered
    whiteSpace: 'pre-line',
  };

  // Use dangerouslySetInnerHTML to render <br /> tags
  return <div style={style} dangerouslySetInnerHTML={{ __html: activeSubtitleText }} />;
};

ExternalSubtitleDisplay.propTypes = {
  subtitles: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      startTime: PropTypes.number.isRequired,
      endTime: PropTypes.number.isRequired,
      text: PropTypes.string.isRequired,
    })
  ),
  currentTime: PropTypes.number.isRequired,
};

ExternalSubtitleDisplay.defaultProps = {
  subtitles: null,
};

export default React.memo(ExternalSubtitleDisplay);

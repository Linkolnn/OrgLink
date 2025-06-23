// Simple test script for audio messages

// Function to simulate recording and sending an audio message
async function testAudioMessage() {
  console.log('Testing audio message functionality...');
  
  // Check if MediaRecorder API is available
  if (!window.MediaRecorder) {
    console.error('MediaRecorder API is not available in this browser');
    return false;
  }
  
  try {
    // Request microphone access
    console.log('Requesting microphone access...');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('Microphone access granted');
    
    // Create a MediaRecorder instance
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];
    
    // Set up event handlers
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      console.log('Recording stopped');
      
      // Create audio blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('Audio blob created:', audioBlob);
      
      // Create audio file
      const audioFile = new File([audioBlob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });
      console.log('Audio file created:', audioFile);
      
      // Create audio element to test playback
      const audioURL = URL.createObjectURL(audioBlob);
      const audioElement = new Audio(audioURL);
      
      console.log('Testing audio playback...');
      audioElement.onloadedmetadata = () => {
        console.log('Audio duration:', audioElement.duration, 'seconds');
      };
      
      audioElement.oncanplaythrough = () => {
        console.log('Audio is ready to play');
        audioElement.play();
      };
      
      audioElement.onended = () => {
        console.log('Audio playback completed');
        URL.revokeObjectURL(audioURL);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        
        console.log('Test completed successfully');
      };
      
      // Test error handling
      audioElement.onerror = (error) => {
        console.error('Audio playback error:', error);
      };
    };
    
    // Start recording
    console.log('Starting recording...');
    mediaRecorder.start();
    
    // Record for 3 seconds
    setTimeout(() => {
      console.log('Stopping recording...');
      mediaRecorder.stop();
    }, 3000);
    
    return true;
  } catch (error) {
    console.error('Error testing audio message:', error);
    return false;
  }
}

// Function to test AudioPlayer component
function testAudioPlayer() {
  console.log('Testing AudioPlayer component...');
  
  // Create a test audio URL
  const testAudioUrl = 'https://file-examples.com/storage/fe1134defc6538ed39b8efa/2017/11/file_example_MP3_700KB.mp3';
  
  // Check if AudioPlayer component exists
  if (typeof AudioPlayer !== 'undefined') {
    console.log('AudioPlayer component is available');
    
    try {
      // Create a container for the AudioPlayer
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.bottom = '20px';
      container.style.right = '20px';
      container.style.width = '300px';
      container.style.zIndex = '9999';
      container.style.backgroundColor = '#333';
      container.style.padding = '10px';
      container.style.borderRadius = '10px';
      
      document.body.appendChild(container);
      
      // Create a title
      const title = document.createElement('h3');
      title.textContent = 'AudioPlayer Test';
      title.style.color = 'white';
      title.style.margin = '0 0 10px 0';
      container.appendChild(title);
      
      // Create a close button
      const closeButton = document.createElement('button');
      closeButton.textContent = 'Close Test';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '10px';
      closeButton.style.right = '10px';
      closeButton.style.padding = '5px';
      closeButton.style.cursor = 'pointer';
      closeButton.onclick = () => {
        document.body.removeChild(container);
      };
      container.appendChild(closeButton);
      
      // Create audio element
      const audio = document.createElement('audio');
      audio.src = testAudioUrl;
      audio.controls = true;
      audio.style.width = '100%';
      audio.style.marginBottom = '10px';
      container.appendChild(audio);
      
      // Add a message
      const message = document.createElement('p');
      message.textContent = 'This is a test of the native audio player. The AudioPlayer component should be tested in the actual app.';
      message.style.color = 'white';
      message.style.fontSize = '12px';
      container.appendChild(message);
      
      console.log('Test audio player created with URL:', testAudioUrl);
      return true;
    } catch (error) {
      console.error('Error creating test AudioPlayer:', error);
      return false;
    }
  } else {
    console.warn('AudioPlayer component is not available in this context');
    return false;
  }
}

// Export test functions
export { testAudioMessage, testAudioPlayer };

// If running directly in browser
if (typeof window !== 'undefined') {
  window.testAudioMessage = testAudioMessage;
  window.testAudioPlayer = testAudioPlayer;
  
  console.log('Audio message test functions are available:');
  console.log('- testAudioMessage() - Test recording and playing an audio message');
  console.log('- testAudioPlayer() - Test the AudioPlayer component with a sample audio');
} 
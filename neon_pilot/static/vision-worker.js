/* Classic worker: MediaPipe's WASM loader uses importScripts in worker contexts. */
let recognizer;
let frameCanvas;
let frameContext;
self.onmessage = async ({data}) => {
  if (data.type === 'init') {
    try {
      const {FilesetResolver, GestureRecognizer} = await import('./vendor/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks('/static/vendor/wasm');
      recognizer = await GestureRecognizer.createFromOptions(files, {
        baseOptions: {modelAssetPath:'/static/vendor/gesture_recognizer.task', delegate:'CPU'},
        runningMode:'VIDEO', numHands:1, minHandDetectionConfidence:.55,
        minHandPresenceConfidence:.55, minTrackingConfidence:.5,
      });
      frameCanvas = new OffscreenCanvas(640, 480);
      frameContext = frameCanvas.getContext('2d');
      self.postMessage({type:'ready'});
    } catch (error) { self.postMessage({type:'error', message:String(error.message || error)}); }
  }
  if (data.type === 'frame') {
    try {
      if (!recognizer) throw new Error('Model jeszcze się ładuje.');
      frameContext.drawImage(data.bitmap, 0, 0, 640, 480);
      const result = recognizer.recognizeForVideo(frameCanvas, data.time);
      self.postMessage({type:'result', time:data.time, landmarks:result.landmarks[0] || [],
        gesture:result.gestures[0]?.[0]?.categoryName || 'None', confidence:result.gestures[0]?.[0]?.score || 0});
    } catch (error) { self.postMessage({type:'error', message:String(error.message || error)}); }
    finally { data.bitmap.close(); }
  }
};

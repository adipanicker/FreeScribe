import { pipeline, env } from "@xenova/transformers";
import { MessageTypes } from "./presets";

env.allowRemoteModels = true;
env.allowLocalModels = false;

class MyTranscriptionPipeline {
  static task = "automatic-speech-recognition";
  static model = "Xenova/whisper-tiny.en";
  static instance = null;

  static async getInstance(progress_callback = null) {
    if (this.instance === null) {
      console.log("⏳ Loading speech recognition model...");

      const models = [
        "Xenova/whisper-tiny.en", // Most reliable English-only
        "Xenova/whisper-base.en", // Backup English-only
        "Xenova/whisper-tiny", // Multilingual fallback
      ];

      for (const modelName of models) {
        try {
          console.log(`📥 Trying model: ${modelName}...`);

          // More robust pipeline configuration
          this.instance = await pipeline(this.task, modelName, {
            progress_callback,
            dtype: {
              encoder_model: "fp32",
              decoder_model_merged: "q4", // Use quantized decoder for efficiency
            },
            device: "webgpu", // Try WebGPU first, fallback to CPU
            // Remove revision parameter as it can cause issues
          });

          console.log(`✅ Successfully loaded: ${modelName}`);
          this.model = modelName; // Store which model was loaded
          break;
        } catch (error) {
          console.error(`❌ Failed to load ${modelName}:`, error.message);

          // If WebGPU failed, try CPU
          if (
            error.message.includes("webgpu") ||
            error.message.includes("WebGPU")
          ) {
            try {
              console.log(`🔄 Retrying ${modelName} with CPU...`);
              this.instance = await pipeline(this.task, modelName, {
                progress_callback,
                dtype: "fp32",
                device: "cpu",
              });
              console.log(`✅ Successfully loaded: ${modelName} (CPU)`);
              this.model = modelName;
              break;
            } catch (cpuError) {
              console.error(
                `❌ CPU fallback also failed for ${modelName}:`,
                cpuError.message
              );
            }
          }

          if (modelName === models[models.length - 1]) {
            // Last model failed
            throw new Error(
              `Could not load any speech recognition model. Last error: ${error.message}`
            );
          }
        }
      }
    }
    return this.instance;
  }
}

self.addEventListener("message", async (event) => {
  const { type, audio } = event.data;
  console.log("📩 Received message:", type);

  if (type === MessageTypes.INFERENCE_REQUEST) {
    await transcribe(audio);
  }
});

async function load_model_callback(data) {
  const { status } = data;
  if (status === "progress") {
    const { file, progress, loaded, total } = data;
    sendDownloadingMessage(file, progress, loaded, total);
  }
}

async function transcribe(audio) {
  sendLoadingMessage("loading");
  console.log("🚀 Starting transcription");

  let pipeline;

  try {
    pipeline = await MyTranscriptionPipeline.getInstance(load_model_callback);
    console.log("✅ Pipeline loaded", pipeline);
  } catch (err) {
    console.error("❌ Error loading pipeline:", err);
    sendLoadingMessage("error");
    return;
  }

  if (!pipeline) {
    console.error("❌ Pipeline is still undefined after loading!");
    sendLoadingMessage("error");
    return;
  }

  sendLoadingMessage("success");

  // Enhanced transcription configuration
  const stride_length_s = 5;
  const generationTracker = new GenerationTracker(pipeline, stride_length_s);

  try {
    console.log("🎤 Starting transcription with audio data...");

    const result = await pipeline(audio, {
      top_k: 0,
      do_sample: false,
      chunk_length_s: 30, // Use chunk_length_s instead of chunk_length
      stride_length_s,
      return_timestamps: true,
      force_full_sequences: false,
      callback_function:
        generationTracker.callbackFunction.bind(generationTracker),
      chunk_callback: generationTracker.chunkCallback.bind(generationTracker),
    });

    console.log("✅ Transcription completed:", result);
    generationTracker.sendFinalResult();
  } catch (transcriptionError) {
    console.error("❌ Error during transcription:", transcriptionError);
    console.error("Error stack:", transcriptionError.stack);
    sendLoadingMessage("error");
  }
}

function sendLoadingMessage(status) {
  self.postMessage({
    type: MessageTypes.LOADING,
    status,
  });
}

async function sendDownloadingMessage(file, progress, loaded, total) {
  self.postMessage({
    type: MessageTypes.DOWNLOADING,
    file,
    progress,
    loaded,
    total,
  });
}

class GenerationTracker {
  constructor(pipeline, stride_length_s) {
    this.pipeline = pipeline;
    this.stride_length_s = stride_length_s;
    this.chunks = [];
    this.time_precision = this.calculateTimePrecision();
    this.processed_chunks = [];
    this.callbackFunctionCounter = 0;
  }

  calculateTimePrecision() {
    try {
      return (
        this.pipeline?.processor?.feature_extractor?.config?.chunk_length /
          this.pipeline.model?.config?.max_source_positions || 0.02
      );
    } catch (error) {
      console.warn("Could not calculate time precision, using default:", error);
      return 0.02;
    }
  }

  sendFinalResult() {
    self.postMessage({ type: MessageTypes.INFERENCE_DONE });
  }

  callbackFunction(beams) {
    this.callbackFunctionCounter += 1;
    if (this.callbackFunctionCounter % 10 !== 0) {
      return;
    }

    try {
      const bestBeam = beams[0];
      let text = this.pipeline.tokenizer.decode(bestBeam.output_token_ids, {
        skip_special_tokens: true,
      });

      const result = {
        text,
        start: this.getLastChunkTimestamp(),
        end: undefined,
      };

      createPartialResultMessage(result);
    } catch (error) {
      console.error("Error in callbackFunction:", error);
    }
  }

  chunkCallback(data) {
    try {
      this.chunks.push(data);

      // Enhanced chunk processing with error handling
      const decoded = this.pipeline.tokenizer._decode_asr(this.chunks, {
        time_precision: this.time_precision,
        return_timestamps: true,
        force_full_sequence: false,
      });

      if (!decoded || !Array.isArray(decoded) || decoded.length < 2) {
        console.warn("Invalid decoded data:", decoded);
        return;
      }

      const [text, { chunks }] = decoded;

      this.processed_chunks = chunks.map((chunk, index) => {
        return this.processChunk(chunk, index);
      });

      createResultMessage(
        this.processed_chunks,
        false,
        this.getLastChunkTimestamp()
      );
    } catch (error) {
      console.error("Error in chunkCallback:", error);
    }
  }

  getLastChunkTimestamp() {
    if (this.processed_chunks.length === 0) {
      return 0;
    }
    const last = this.processed_chunks[this.processed_chunks.length - 1];
    return last.end || 0;
  }

  processChunk(chunk, index) {
    const { text, timestamp } = chunk;
    const [start, end] = timestamp || [0, 0];

    return {
      index,
      text: `${text.trim()}`,
      start: Math.round(start),
      end: Math.round(end) || Math.round(start + 0.9 * this.stride_length_s),
    };
  }
}

function createResultMessage(results, isDone, completedUntilTimestamp) {
  self.postMessage({
    type: MessageTypes.RESULT,
    results,
    isDone,
    completedUntilTimestamp,
  });
}

function createPartialResultMessage(result) {
  self.postMessage({
    type: MessageTypes.RESULT_PARTIAL,
    result,
  });
}

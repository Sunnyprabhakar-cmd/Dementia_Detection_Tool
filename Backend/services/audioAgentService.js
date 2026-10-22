export const analyzeAudioAgent = async () => ({
  status: "unavailable",
  code: "model_unavailable",
  model_version: null,
  output: null,
  missing_inputs: ["authorized_participant_labeled_speech_model"],
  limitation:
    "Transcription and descriptive speech measurements are not dementia-related speech inference."
});

export default { analyzeAudioAgent };

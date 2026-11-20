import {
  analyzeDrawingSubmission,
  getScreeningDrawing,
  getUserDrawingHistory,
  parseImageDataUrl,
  submitClockDrawing
} from "../services/drawingService.js";

export const validateDrawingController = async (req, res) => {
  try {
    const { imageDataUrl } = req.body || {};
    const parsed = parseImageDataUrl(imageDataUrl);
    return res.status(200).json({
      valid: true,
      format: parsed.extension,
      sizeBytes: parsed.buffer.length
    });
  } catch (error) {
    return res.status(400).json({
      valid: false,
      message: error.message || "Invalid drawing image"
    });
  }
};

export const submitDrawingController = async (req, res) => {
  try {
    const saved = await submitClockDrawing(req.params.id, req.user.userId, req.body || {});
    return res.status(200).json({
      message: "Clock drawing saved and analyzed",
      drawing: saved
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Unable to process clock drawing"
    });
  }
};

export const extractDrawingFeaturesController = async (req, res) => {
  try {
    const analysis = await analyzeDrawingSubmission(req.body || {});
    return res.status(200).json(analysis);
  } catch (error) {
    return res.status(400).json({
      status: "error",
      message: error.message || "Unable to extract drawing features"
    });
  }
};

export const getScreeningDrawingController = async (req, res) => {
  try {
    const drawing = await getScreeningDrawing(req.params.id, req.user.userId);
    if (!drawing) return res.status(404).json({ message: "Drawing not found" });
    return res.status(200).json({ drawing });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to load drawing" });
  }
};

export const getDrawingHistoryController = async (req, res) => {
  try {
    const history = await getUserDrawingHistory(req.user.userId);
    return res.status(200).json({ history });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to fetch drawing history" });
  }
};

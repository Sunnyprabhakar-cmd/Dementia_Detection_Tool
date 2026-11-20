import {
  deleteUserBrainScan,
  listScansForScreening,
  uploadAndAnalyzeBrainScan
} from "../services/imagingService.js";

export const uploadImagingController = async (req, res) => {
  try {
    const screeningId = req.headers["x-screening-id"] || req.query.screeningId;
    const modality = req.headers["x-imaging-modality"] || req.query.modality;
    const originalFilename = req.headers["x-file-name"] || req.query.filename || "scan.nii.gz";
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    const scan = await uploadAndAnalyzeBrainScan({
      screeningId,
      userId: req.user.userId,
      modality,
      originalFilename,
      buffer
    });
    return res.status(201).json({ scan });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || "Unable to process brain scan upload"
    });
  }
};

export const getScreeningScansController = async (req, res) => {
  try {
    const scans = await listScansForScreening(
      req.params.id,
      req.user.userId,
      req.user.role || "patient"
    );
    return res.status(200).json({ scans });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || "Unable to fetch brain scans"
    });
  }
};

export const deleteImagingController = async (req, res) => {
  try {
    const result = await deleteUserBrainScan(req.params.scanId, req.user.userId);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      message: error.message || "Unable to delete brain scan"
    });
  }
};

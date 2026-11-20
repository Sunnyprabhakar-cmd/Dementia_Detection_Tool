import {
  addClinicianReview,
  getClinicianScreeningDetail,
  listPatientScreenings
} from "../services/clinicianService.js";

export const getScreeningsForClinician = async (req, res) => {
  try {
    const screenings = await listPatientScreenings({
      clinicianId: req.user.userId,
      filter: req.query.filter,
      q: req.query.q,
      limit: req.query.limit
    });
    return res.status(200).json({ screenings });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to list screenings" });
  }
};

export const getScreeningDetailForClinician = async (req, res) => {
  try {
    const detail = await getClinicianScreeningDetail(req.params.id, req.user.userId);
    if (!detail) return res.status(404).json({ message: "Screening not found" });
    return res.status(200).json(detail);
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message || "Unable to load screening detail" });
  }
};

export const postClinicianReview = async (req, res) => {
  try {
    const review = await addClinicianReview(req.params.id, req.user.userId, req.body || {});
    return res.status(201).json({ review });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ message: error.message || "Unable to save review" });
  }
};

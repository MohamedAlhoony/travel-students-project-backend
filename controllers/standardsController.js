const Standards = require("../models/Standards");

// Get current standards
const getStandards = async (req, res) => {
  try {
    const standards = await Standards.findOne();
    if (!standards) {
      return res.status(404).json({ message: "Standards not found" });
    }
    res.json(standards);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching standards", error: error.message });
  }
};

// Update standards
const updateStandards = async (req, res) => {
  try {
    const updatedStandards = await Standards.findOneAndUpdate({}, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedStandards) {
      // If no standards exist, create new ones
      const newStandards = new Standards(req.body);
      await newStandards.save();
      return res.status(201).json(newStandards);
    }

    res.json(updatedStandards);
  } catch (error) {
    res
      .status(400)
      .json({ message: "Error updating standards", error: error.message });
  }
};

module.exports = {
  getStandards,
  updateStandards,
};

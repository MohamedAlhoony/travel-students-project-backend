const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ProviderApplication = require("../models/ProviderApplication");
const { Roles } = require("../constants/roles");
const { ServiceTypes } = require("../constants/serviceTypes");
// Add multer for file uploads
const multer = require("multer");
const path = require("path");

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Make upload middleware available for routes
exports.upload = upload;

// Add a separate upload middleware for registration images
const registrationImageUpload = multer({
  storage: storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit for registration documents
  },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|pdf/; // Allow PDFs for registration documents
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(
        new Error(
          "Only images and PDFs are allowed for registration documents",
        ),
      );
    }
  },
});

exports.registrationImageUpload = registrationImageUpload;

// Single multer instance that accepts both fields together
const uploadFields = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (
      file.fieldname === "images" ||
      file.fieldname === "registrationImages"
    ) {
      return cb(null, true);
    }
    cb(new Error(`Unexpected field: ${file.fieldname}`));
  },
}).fields([
  { name: "images", maxCount: 10 },
  { name: "registrationImages", maxCount: 10 },
]);

const uploadOnlyImages = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "images") {
      return cb(null, true);
    }
    cb(new Error(`Unexpected field: ${file.fieldname}`));
  },
}).fields([{ name: "images", maxCount: 10 }]);

// Error handling wrapper for multer
function handleMulterError(req, res, next) {
  uploadFields(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum file size is 2MB.",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          message: "Too many files uploaded.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    } else if (err) {
      // Other errors
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    // Everything went fine
    next();
  });
}

function handleImagesMulterError(req, res, next) {
  uploadOnlyImages(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File too large. Maximum file size is 1MB.",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          message: "Too many files uploaded.",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    } else if (err) {
      // Other errors
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }
    // Everything went fine
    next();
  });
}

exports.uploadFields = uploadFields;
exports.uploadOnlyImages = handleImagesMulterError;

function normalizeLower(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

// Function to normalize file names for safe storage
function normalizeFileName(filename) {
  return String(filename || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special characters with underscores
    .toLowerCase();
}

function validateSubmittedData(serviceType, data) {
  if (!data || typeof data !== "object") {
    return { ok: false, message: "submittedData is required" };
  }

  // Minimal required fields per service type.
  if (serviceType === ServiceTypes.DRIVER) {
    const required = [
      "fullName",
      "licenseNumber",
      "vehicleType",
      "seats",
      "serviceAreas",
      "pricingModel",
    ];
    for (const k of required) {
      if (data[k] === undefined || data[k] === null || data[k] === "") {
        return { ok: false, message: `submittedData.${k} is required` };
      }
    }
    if (!Array.isArray(data.serviceAreas) || data.serviceAreas.length === 0) {
      return {
        ok: false,
        message: "submittedData.serviceAreas must be a non-empty array",
      };
    }
    if (Number(data.seats) <= 0) {
      return {
        ok: false,
        message: "submittedData.seats must be a positive number",
      };
    }
    return { ok: true };
  }

  if (serviceType === ServiceTypes.PROPERTY_OWNER) {
    const required = [
      "propertyType",
      "city",
      "addressLine",
      "maxGuests",
      "nightlyPrice",
      "amenities",
    ];
    for (const k of required) {
      if (data[k] === undefined || data[k] === null || data[k] === "") {
        return { ok: false, message: `submittedData.${k} is required` };
      }
    }
    if (Number(data.maxGuests) <= 0) {
      return {
        ok: false,
        message: "submittedData.maxGuests must be a positive number",
      };
    }
    if (Number(data.nightlyPrice) <= 0) {
      return {
        ok: false,
        message: "submittedData.nightlyPrice must be a positive number",
      };
    }
    if (!Array.isArray(data.amenities)) {
      return { ok: false, message: "submittedData.amenities must be an array" };
    }
    return { ok: true };
  }

  if (serviceType === ServiceTypes.TOURIST_SERVICES) {
    const required = [
      "providerName",
      "languages",
      "experienceTitle",
      "durationHours",
      "groupSizeMax",
      "price",
      "locations",
    ];
    for (const k of required) {
      if (data[k] === undefined || data[k] === null || data[k] === "") {
        return { ok: false, message: `submittedData.${k} is required` };
      }
    }
    if (!Array.isArray(data.languages) || data.languages.length === 0) {
      return {
        ok: false,
        message: "submittedData.languages must be a non-empty array",
      };
    }
    if (!Array.isArray(data.locations) || data.locations.length === 0) {
      return {
        ok: false,
        message: "submittedData.locations must be a non-empty array",
      };
    }
    if (Number(data.durationHours) <= 0) {
      return {
        ok: false,
        message: "submittedData.durationHours must be a positive number",
      };
    }
    if (Number(data.groupSizeMax) <= 0) {
      return {
        ok: false,
        message: "submittedData.groupSizeMax must be a positive number",
      };
    }
    if (Number(data.price) <= 0) {
      return {
        ok: false,
        message: "submittedData.price must be a positive number",
      };
    }
    return { ok: true };
  }

  return { ok: false, message: "Invalid serviceType" };
}

// Public: Create client user + pending provider application
exports.registerClientApplication = async (req, res) => {
  try {
    // Parse the JSON data from the 'data' field
    let userData;
    try {
      if (!req.body.data) {
        return res
          .status(400)
          .json({ success: false, message: "Missing user data" });
      }
      userData = JSON.parse(req.body.data);
    } catch (parseError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid data format" });
    }

    const username = normalizeLower(userData.username);
    const email = userData.email ? normalizeLower(userData.email) : undefined;
    const serviceType = normalizeLower(userData.serviceType);
    const password = userData.password;
    const submittedData = userData.submittedData;

    const validation = validateSubmittedData(serviceType, submittedData);
    if (!validation.ok) {
      return res
        .status(400)
        .json({ success: false, message: validation.message });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Username is already in use." });
    }
    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res
          .status(400)
          .json({ success: false, message: "Email is already in use." });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Process uploaded images if any
    const images = [];
    if (req.files && req.files.images) {
      for (const file of req.files.images) {
        // Validate that file has required properties
        if (!file.buffer || !file.mimetype || !file.originalname) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid image file uploaded" });
        }
        console.log(
          "Uploaded image:",
          file.originalname,
          "Size:",
          file.size,
          "type:",
          file.mimetype,
        );
        images.push({
          data: file.buffer,
          contentType: file.mimetype,
          originalName: normalizeFileName(file.originalname), // Normalize file name
        });
      }
    }

    // Process registration images if any
    const registrationImages = [];
    if (req.files && req.files.registrationImages) {
      for (const file of req.files.registrationImages) {
        // Validate that file has required properties
        if (!file.buffer || !file.mimetype || !file.originalname) {
          return res.status(400).json({
            success: false,
            message: "Invalid registration image file uploaded",
          });
        }
        registrationImages.push({
          data: file.buffer,
          contentType: file.mimetype,
          originalName: normalizeFileName(file.originalname), // Normalize file name
        });
      }
    }

    console.log(
      "Registration images count:",
      registrationImages.length,
      "Images count:",
      images.length,
    );

    const user = await User.create({
      username,
      email,
      passwordHash,
      roles: [Roles.CLIENT],
      activated: false,
      registrationImages, // Store registration images with the user
    });
    const application = await ProviderApplication.create({
      applicantUserId: user._id,
      serviceType,
      status: ProviderApplication.Statuses.PENDING,
      submittedData,
      images, // Store images with the application
    });

    res.status(201).json({
      success: true,
      message: "Application submitted. Await admin approval.",
      data: {
        user: User.sanitize(user),
        application,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to submit application.",
      error: err.message,
    });
  }
};

// Client (authenticated): submit a new provider application under the same account
exports.createMyApplication = async (req, res) => {
  try {
    // Parse the JSON data from the 'data' field
    let userData;
    try {
      if (!req.body.data) {
        return res
          .status(400)
          .json({ success: false, message: "Missing application data" });
      }
      userData = JSON.parse(req.body.data);
    } catch (parseError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid data format" });
    }

    const serviceType = normalizeLower(userData.serviceType);
    const submittedData = userData.submittedData;

    // Process uploaded images if any
    const images = [];
    if (req.files && req.files.images) {
      for (const file of req.files.images) {
        // Validate that file has required properties
        if (!file.buffer || !file.mimetype || !file.originalname) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid image file uploaded" });
        }
        images.push({
          data: file.buffer,
          contentType: file.mimetype,
          originalName: normalizeFileName(file.originalname), // Normalize file name
        });
      }
    }

    const validation = validateSubmittedData(serviceType, submittedData);
    if (!validation.ok) {
      return res
        .status(400)
        .json({ success: false, message: validation.message });
    }

    const application = await ProviderApplication.create({
      applicantUserId: req.userId,
      serviceType,
      status: ProviderApplication.Statuses.PENDING,
      submittedData,
      images, // Store images with the application
    });

    res.status(201).json({
      success: true,
      message: "Application submitted. Await admin approval.",
      data: application,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to submit application.",
      error: err.message,
    });
  }
};

// Client: list own applications
exports.getMyApplications = async (req, res) => {
  try {
    const apps = await ProviderApplication.find({
      applicantUserId: req.userId,
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch applications.",
      error: err.message,
    });
  }
};

// Admin: list all applications
exports.listApplications = async (req, res) => {
  try {
    const { status, serviceType, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = normalizeLower(status);
    if (serviceType) query.serviceType = normalizeLower(serviceType);

    const [total, apps] = await Promise.all([
      ProviderApplication.countDocuments(query),
      ProviderApplication.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit))
        .populate("applicantUserId", "username email roles activated"),
    ]);
    res.json({
      success: true,
      data: apps,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.max(1, Math.ceil(total / Number(limit))),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to list applications.",
      error: err.message,
    });
  }
};

exports.getApplicationById = async (req, res) => {
  try {
    const app = await ProviderApplication.findById(req.params.id).populate(
      "applicantUserId",
      "username email roles activated",
    );
    if (!app)
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });
    res.json({ success: true, data: app });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch application.",
      error: err.message,
    });
  }
};

// Admin: approve / reject
async function decide(req, res, status) {
  const note = req.body && req.body.note ? String(req.body.note) : undefined;
  try {
    const app = await ProviderApplication.findById(req.params.id);
    if (!app)
      return res
        .status(404)
        .json({ success: false, message: "Application not found" });

    if (app.status !== ProviderApplication.Statuses.PENDING) {
      return res.status(400).json({
        success: false,
        message: "Only pending applications can be decided.",
      });
    }

    app.status = status;
    app.adminDecision = {
      decidedByUserId: req.userId,
      decidedAt: new Date(),
      note,
    };
    await app.save();

    if (status === ProviderApplication.Statuses.APPROVED) {
      await User.findByIdAndUpdate(app.applicantUserId, { activated: true });
    }

    res.json({ success: true, message: `Application ${status}.`, data: app });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update application.",
      error: err.message,
    });
  }
}

exports.approve = (req, res) =>
  decide(req, res, ProviderApplication.Statuses.APPROVED);
exports.reject = (req, res) =>
  decide(req, res, ProviderApplication.Statuses.REJECTED);
